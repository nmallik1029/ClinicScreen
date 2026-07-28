"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import EditorPreview from "@/components/EditorPreview";
import VideoFrame from "@/components/VideoFrame";
import type { EditorItem, LibraryMedia, EditorDoctor } from "@/lib/screen-content";
import {
  addScreenContent,
  addDoctorContent,
  removeScreenContent,
  reorderScreenContent,
  saveScreenLayout,
  setScreenContentTrim,
  deleteLibraryMediaForEditor,
  presignMediaAction,
  finalizeMediaForEditor,
  uploadMediaLocalForEditor,
} from "@/app/practices/[practiceId]/actions";
import { setTrashState } from "@/lib/editor-trash";

// Upload a file straight to R2 via the presigned URL (production path).
function putToR2(uploadUrl: string, contentType: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled";
}

function readVideoDurationSeconds(file: File): Promise<number | null> {
  if (!file.type.startsWith("video/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (seconds: number | null) => {
      URL.revokeObjectURL(url);
      resolve(seconds && Number.isFinite(seconds) ? Math.max(1, Math.round(seconds)) : null);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

const MIN_PX_PER_SEC = 6;
const MAX_PX_PER_SEC = 240;
const MIN_CLIP_PX = 44;
const MIN_TRIM_SECONDS = 1;
const SNAP_PX = 10;
const DRAG_MIME = "application/x-clinicscreen-drag";

type DragPayload =
  | { kind: "timeline"; id: string }
  | { kind: "library"; id: string }
  | { kind: "doctor"; id: string };
type DropIndicator = { index: number; left: number } | null;
type ContextMenuState = { mediaId: string; x: number; y: number } | null;
// `gap` rides along with the trim so front-trimming can open an island in one gesture.
type TrimDraft = { itemId: string; start: number; end: number; gap: number };
// While dragging a timeline clip, its left edge follows the pointer freely (seconds).
type DragDraft = { itemId: string; startSec: number } | null;
type PointerDrag = {
  payload: DragPayload;
  originX: number;
  originY: number;
  grabDx: number;
  x: number;
  y: number;
  active: boolean;
  title: string;
} | null;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtMs(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const whole = Math.floor(safe);
  const ms = Math.floor((safe - whole) * 1000);
  const m = Math.floor(whole / 60);
  const sec = whole % 60;
  return `${m}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

// m:ss.cc (centiseconds) — matches the Clipchamp transport readout.
function fmtCs(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export default function ScreenEditor({
  practiceId,
  deviceId,
  screenName,
  backHref,
  initialItems,
  initialLibrary,
  doctors,
}: {
  practiceId: string;
  deviceId: string;
  screenName: string;
  backHref: string;
  initialItems: EditorItem[];
  initialLibrary: LibraryMedia[];
  doctors: EditorDoctor[];
}) {
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [library, setLibrary] = useState<LibraryMedia[]>(initialLibrary);
  const [panelOpen, setPanelOpen] = useState(true);
  const [pxPerSec, setPxPerSec] = useState(36);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
  const [dragKind, setDragKind] = useState<DragPayload["kind"] | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [trimDraft, setTrimDraft] = useState<TrimDraft | null>(null);
  const [dragDraft, setDragDraft] = useState<DragDraft>(null);
  const [pointerGhost, setPointerGhost] = useState<{ x: number; y: number; title: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Playback
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekNonce, setSeekNonce] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const trimDraftRef = useRef<TrimDraft | null>(null);
  trimDraftRef.current = trimDraft;
  const trimDragRef = useRef<{
    itemId: string;
    edge: "start" | "end";
    originX: number;
    originStart: number;
    originEnd: number;
    originGap: number;
    sourceDuration: number;
  } | null>(null);
  const dragDraftRef = useRef<DragDraft>(null);
  dragDraftRef.current = dragDraft;
  const pxPerSecRef = useRef(pxPerSec);
  pxPerSecRef.current = pxPerSec;
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const pointerDragRef = useRef<PointerDrag>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The global theme-toggle button doubles as the trash target while dragging.
  function cornerFabRect() {
    return document.getElementById("cs-corner-fab")?.getBoundingClientRect() ?? null;
  }
  function pointerOverFab(x: number, y: number) {
    const r = cornerFabRect();
    return Boolean(r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  }

  // The trimmed play window (which frames of the source actually show).
  function clipTiming(it: EditorItem) {
    if (trimDraft?.itemId === it.itemId) {
      return {
        start: trimDraft.start,
        end: trimDraft.end,
        duration: Math.max(MIN_TRIM_SECONDS, trimDraft.end - trimDraft.start),
      };
    }
    const start = Math.max(0, it.trimStartSeconds ?? 0);
    const end = it.trimEndSeconds ?? it.sourceDuration ?? start + it.duration;
    return { start, end, duration: it.duration };
  }

  // Black "dead air" before the clip. Live front-trim feedback rides on trimDraft.gap.
  function leadingGap(it: EditorItem) {
    if (trimDraft?.itemId === it.itemId) return Math.max(0, trimDraft.gap);
    return Math.max(0, it.leadingGapSeconds ?? 0);
  }

  // The clip block's visible length on the track (what plays), gap excluded.
  function clipDuration(it: EditorItem) {
    return clipTiming(it).duration;
  }

  // Total footprint of a clip (gap + block) — used for the preview clock / index math.
  function slotDuration(it: EditorItem) {
    return leadingGap(it) + clipDuration(it);
  }

  // Pack clips left-to-right; each clip's block starts after the previous block's
  // right edge plus its own leading gap, so gaps render as real empty track.
  const timelineLayouts = items.reduce<
    Array<{ item: EditorItem; timing: ReturnType<typeof clipTiming>; gap: number; left: number; width: number }>
  >((acc, item) => {
    const prevEnd = acc.length === 0 ? 0 : acc[acc.length - 1].left + acc[acc.length - 1].width;
    const gap = leadingGap(item);
    acc.push({ item, timing: clipTiming(item), gap, left: prevEnd + gap, width: clipDuration(item) });
    return acc;
  }, []);

  const visualTotal =
    timelineLayouts.length === 0
      ? 0
      : timelineLayouts[timelineLayouts.length - 1].left + timelineLayouts[timelineLayouts.length - 1].width;
  const total = visualTotal;

  // Absolute start (seconds) of every clip's block, keyed by item id — the source
  // of truth for turning a free drag back into per-clip leading gaps.
  const absoluteStarts = new Map(timelineLayouts.map((l) => [l.item.itemId, l.left]));

  function insertionFromPointer(clientX: number) {
    const el = timelineContentRef.current;
    if (!el) return { index: itemsRef.current.length, left: total * pxPerSecRef.current };
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    let acc = 0;
    const list = itemsRef.current;
    for (let i = 0; i < list.length; i++) {
      const w = Math.max(slotDuration(list[i]) * pxPerSecRef.current, MIN_CLIP_PX);
      if (x < acc + w / 2) return { index: i, left: acc };
      acc += w;
      if (x < acc) return { index: i + 1, left: acc };
    }
    return { index: list.length, left: acc };
  }

  const runAction = useCallback((fn: () => Promise<EditorItem[]>) => {
    startTransition(async () => {
      const next = await fn();
      setItems(next);
    });
  }, []);

  const addMedia = (mediaId: string, insertIndex?: number) =>
    runAction(() => addScreenContent(practiceId, deviceId, mediaId, insertIndex));
  const addDoctor = (doctorId: string, insertIndex?: number) =>
    runAction(() => addDoctorContent(practiceId, deviceId, doctorId, insertIndex));

  const removeItem = (itemId: string) => {
    if (selectedId === itemId) setSelectedId(null);
    runAction(() => removeScreenContent(practiceId, deviceId, itemId));
  };
  const setTrim = (itemId: string, start: number, end: number | null, gap?: number) =>
    runAction(() => setScreenContentTrim(practiceId, deviceId, itemId, start, end, gap));
  const deleteLibraryMedia = (mediaId: string) => {
    setContextMenu(null);
    startTransition(async () => {
      const next = await deleteLibraryMediaForEditor(practiceId, deviceId, mediaId);
      setItems(next.items);
      setLibrary(next.library);
      if (next.items.every((it) => it.itemId !== selectedId)) setSelectedId(null);
    });
  };

  // Inline upload — adds to the media LIBRARY only (not the timeline).
  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const title = titleFromFilename(file.name);
      const durationSeconds = await readVideoDurationSeconds(file);
      const presign = await presignMediaAction(practiceId, file.name, file.size);
      if (!presign.ok) {
        setUploadError(presign.error);
        return;
      }
      const result =
        presign.mode === "local"
          ? await (() => {
              const fd = new FormData();
              fd.append("title", title);
              if (durationSeconds) fd.append("durationSeconds", String(durationSeconds));
              fd.append("file", file);
              return uploadMediaLocalForEditor(practiceId, fd);
            })()
          : await (async () => {
              await putToR2(presign.uploadUrl, presign.contentType, file);
              return finalizeMediaForEditor(practiceId, { title, url: presign.publicUrl, durationSeconds });
            })();

      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setLibrary((prev) => [result.media, ...prev]);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // --- Drag / drop ---
  function beginDrag(payload: DragPayload, e: React.DragEvent) {
    dragPayloadRef.current = payload;
    setDragKind(payload.kind);
    e.dataTransfer.effectAllowed = payload.kind === "timeline" ? "move" : "copy";
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  }

  function finishDrag() {
    dragPayloadRef.current = null;
    setDragKind(null);
    setDropIndicator(null);
  }

  function updateDropFromEvent(e: React.DragEvent<HTMLDivElement>) {
    const payload = dragPayloadRef.current;
    if (!payload) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = payload.kind === "timeline" ? "move" : "copy";
    setDropIndicator(insertionFromPointer(e.clientX));
  }

  function onTimelineDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const payload = dragPayloadRef.current;
    const indicator = insertionFromPointer(e.clientX);
    if (!payload) return finishDrag();

    if (payload.kind === "library") {
      addMedia(payload.id, indicator.index);
      return finishDrag();
    }

    if (payload.kind === "doctor") {
      addDoctor(payload.id, indicator.index);
      return finishDrag();
    }

    const fromIdx = itemsRef.current.findIndex((it) => it.itemId === payload.id);
    if (fromIdx < 0) return finishDrag();
    const next = [...itemsRef.current];
    const [moved] = next.splice(fromIdx, 1);
    const targetIdx = fromIdx < indicator.index ? indicator.index - 1 : indicator.index;
    next.splice(clamp(targetIdx, 0, next.length), 0, moved);
    setItems(next);
    runAction(() => reorderScreenContent(practiceId, deviceId, next.map((it) => it.itemId)));
    finishDrag();
  }

  function finishPointerDrag() {
    pointerDragRef.current = null;
    dragPayloadRef.current = null;
    setPointerGhost(null);
    setDragKind(null);
    setDropIndicator(null);
    setDragDraft(null);
    setTrashState({ active: false, armed: false });
  }

  // Absolute start (seconds) of each clip's block, packed from raw item fields.
  // Used inside pointer handlers where render-scope layout may be stale.
  function absoluteStartsFromItems(list: EditorItem[]) {
    const starts = new Map<string, number>();
    let cursor = 0;
    for (const it of list) {
      const gap = Math.max(0, it.leadingGapSeconds ?? 0);
      starts.set(it.itemId, cursor + gap);
      cursor += gap + it.duration;
    }
    return starts;
  }

  // Magnetically snap a dragged clip's left edge to 0 or to any other clip's edge.
  function snapStartSec(itemId: string, rawStart: number) {
    const list = itemsRef.current;
    const snap = SNAP_PX / pxPerSecRef.current;
    const starts = absoluteStartsFromItems(list);
    const targets = [0];
    for (const it of list) {
      if (it.itemId === itemId) continue;
      const s = starts.get(it.itemId) ?? 0;
      targets.push(s, s + it.duration);
    }
    const raw = Math.max(0, rawStart);
    for (const t of targets) {
      if (Math.abs(raw - t) <= snap) return Math.max(0, t);
    }
    return raw;
  }

  // Turn a free drag (new absolute start for one clip) back into per-clip order +
  // leading gaps, keeping every other clip's absolute position fixed. Clips that
  // land within a snap of their neighbor butt flush (gap 0).
  function commitReposition(itemId: string, newStartSec: number) {
    const list = itemsRef.current;
    const snap = SNAP_PX / pxPerSecRef.current;
    const starts = absoluteStartsFromItems(list);
    const entries = list.map((it) => ({
      it,
      start: it.itemId === itemId ? Math.max(0, newStartSec) : starts.get(it.itemId) ?? 0,
    }));
    entries.sort((a, b) => a.start - b.start || (a.it.itemId === itemId ? -1 : 1));
    const layout: { id: string; leadingGapSeconds: number }[] = [];
    let cursor = 0;
    for (const e of entries) {
      let gap = e.start - cursor;
      if (gap < snap) gap = 0;
      gap = Math.max(0, Math.round(gap));
      layout.push({ id: e.it.itemId, leadingGapSeconds: gap });
      cursor += gap + e.it.duration;
    }
    const byId = new Map(list.map((it) => [it.itemId, it]));
    const nextItems = layout.map((l) => ({ ...byId.get(l.id)!, leadingGapSeconds: l.leadingGapSeconds }));
    setItems(nextItems);
    runAction(() => saveScreenLayout(practiceId, deviceId, layout));
  }

  function beginPointerClipDrag(e: React.PointerEvent, it: EditorItem) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-trim-handle='true']")) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(it.itemId);
    const rect = timelineContentRef.current?.getBoundingClientRect();
    if (rect) seekTo((e.clientX - rect.left) / pxPerSec);
    // Offset between the pointer and the clip's left edge, so the block tracks the
    // cursor from wherever it was grabbed rather than jumping its left edge under it.
    const clipLeftPx = (absoluteStarts.get(it.itemId) ?? 0) * pxPerSec;
    const grabDx = rect ? e.clientX - (rect.left + clipLeftPx) : 0;
    pointerDragRef.current = {
      payload: { kind: "timeline", id: it.itemId },
      originX: e.clientX,
      originY: e.clientY,
      grabDx,
      x: e.clientX,
      y: e.clientY,
      active: false,
      title: it.title,
    };
  }

  function startTrim(e: React.PointerEvent<HTMLSpanElement>, it: EditorItem, edge: "start" | "end") {
    if (it.type !== "VIDEO" || !it.sourceDuration) return;
    e.preventDefault();
    e.stopPropagation();
    const timing = clipTiming(it);
    const gap = leadingGap(it);
    trimDragRef.current = {
      itemId: it.itemId,
      edge,
      originX: e.clientX,
      originStart: timing.start,
      originEnd: timing.end,
      originGap: gap,
      sourceDuration: it.sourceDuration,
    };
    setSelectedId(it.itemId);
    setTrimDraft({ itemId: it.itemId, start: timing.start, end: timing.end, gap });
  }

  // --- Scroll to zoom ---
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) return;
      e.preventDefault();
      setPxPerSec((p) => clamp(p * (e.deltaY < 0 ? 1.12 : 0.89), MIN_PX_PER_SEC, MAX_PX_PER_SEC));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const drag = trimDragRef.current;
      if (!drag) return;
      const delta = (e.clientX - drag.originX) / pxPerSecRef.current;
      if (drag.edge === "start") {
        const start = clamp(Math.round(drag.originStart + delta), 0, drag.originEnd - MIN_TRIM_SECONDS);
        // Trimming the front holds the block's right edge in place and opens an
        // island before it, so the gap grows by however much the start moved.
        const gap = Math.max(0, drag.originGap + (start - drag.originStart));
        setTrimDraft({ itemId: drag.itemId, start, end: drag.originEnd, gap });
      } else {
        const end = clamp(
          Math.round(drag.originEnd + delta),
          drag.originStart + MIN_TRIM_SECONDS,
          drag.sourceDuration,
        );
        setTrimDraft({ itemId: drag.itemId, start: drag.originStart, end, gap: drag.originGap });
      }
    }

    function onPointerUp() {
      const drag = trimDragRef.current;
      if (!drag) return;
      const draft = trimDraftRef.current;
      trimDragRef.current = null;
      setTrimDraft(null);
      if (!draft) return;
      setTrim(draft.itemId, draft.start, draft.end >= drag.sourceDuration ? null : draft.end, draft.gap);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const drag = pointerDragRef.current;
      if (!drag) return;

      const dx = e.clientX - drag.originX;
      const dy = e.clientY - drag.originY;
      if (!drag.active && Math.hypot(dx, dy) >= 2) {
        drag.active = true;
        dragPayloadRef.current = drag.payload;
        setDragKind(drag.payload.kind);
        setTrashState({ active: true, armed: false });
      }
      if (!drag.active) return;

      drag.x = e.clientX;
      drag.y = e.clientY;

      const timelineRect = timelineContentRef.current?.getBoundingClientRect();
      const overTimeline = Boolean(
        timelineRect &&
          e.clientX >= timelineRect.left &&
          e.clientX <= timelineRect.right &&
          e.clientY >= timelineRect.top &&
          e.clientY <= timelineRect.bottom,
      );

      if (drag.payload.kind === "timeline" && overTimeline && timelineRect) {
        // Show the clip block itself gliding under the cursor (with snapping),
        // rather than a floating text ghost, so gaps read naturally.
        const rawStart = (e.clientX - drag.grabDx - timelineRect.left) / pxPerSecRef.current;
        setDragDraft({ itemId: drag.payload.id, startSec: snapStartSec(drag.payload.id, Math.max(0, rawStart)) });
        setPointerGhost(null);
      } else {
        setDragDraft(null);
        setPointerGhost({ x: e.clientX, y: e.clientY, title: drag.title });
      }

      setTrashState({ active: true, armed: pointerOverFab(e.clientX, e.clientY) });
    }

    function onPointerUp(e: PointerEvent) {
      const drag = pointerDragRef.current;
      if (!drag) return;
      if (!drag.active) {
        finishPointerDrag();
        return;
      }

      const droppedOnTrash = pointerOverFab(e.clientX, e.clientY);
      if (droppedOnTrash && drag.payload.kind === "timeline") {
        removeItem(drag.payload.id);
        finishPointerDrag();
        return;
      }

      const timelineRect = timelineContentRef.current?.getBoundingClientRect();
      const droppedOnTimeline = Boolean(
        timelineRect &&
          e.clientX >= timelineRect.left &&
          e.clientX <= timelineRect.right &&
          e.clientY >= timelineRect.top &&
          e.clientY <= timelineRect.bottom,
      );
      if (droppedOnTimeline && drag.payload.kind === "timeline" && timelineRect) {
        const rawStart = (e.clientX - drag.grabDx - timelineRect.left) / pxPerSecRef.current;
        commitReposition(drag.payload.id, snapStartSec(drag.payload.id, Math.max(0, rawStart)));
      }
      finishPointerDrag();
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, practiceId, runAction]);

  // --- Playback controls ---
  function seekTo(seconds: number) {
    setCurrentTime(clamp(seconds, 0, total));
    setSeekNonce((n) => n + 1);
  }
  function togglePlay() {
    if (total <= 0) return;
    setPlaying((p) => !p);
  }
  function onTimelinePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-trim-handle='true']")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    seekTo(x / pxPerSec);
  }

  const playheadLeft = Math.min(currentTime, total) * pxPerSec;

  // Ruler ticks ~ every 64px.
  const tickStep = Math.max(1, Math.round(64 / pxPerSec));
  const tickCount = Math.ceil(Math.max(total, 10) / tickStep) + 1;
  const trackWidth = Math.max(visualTotal, 10) * pxPerSec;

  return (
    <div className="editor-enter flex h-[calc(100vh-9rem)] flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ← Done
          </Link>
          <h1 className="text-lg font-semibold">{screenName}</h1>
        </div>
        <span className="text-xs text-slate-400">
          {pending ? "Saving…" : "Changes save automatically"}
        </span>
      </div>

      {/* Middle: media panel + preview */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Collapsible media panel */}
        <div
          className={`flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 ${
            panelOpen ? "w-64" : "w-11"
          }`}
        >
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            title={panelOpen ? "Collapse media" : "Expand media"}
          >
            {panelOpen && <span>Media</span>}
            <span className="text-slate-400">{panelOpen ? "‹" : "›"}</span>
          </button>

          {panelOpen && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="m-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60 dark:border-slate-700 dark:hover:border-blue-700"
                >
                  {uploading ? "Uploading…" : "+ Upload media"}
                </button>
                {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
                {library.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-slate-400">
                    No media yet. Upload something to add it here.
                  </p>
                ) : (
                  library.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      draggable
                      onClick={() => addMedia(m.id)}
                      onDragStart={(e) => beginDrag({ kind: "library", id: m.id }, e)}
                      onDragEnd={finishDrag}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ mediaId: m.id, x: e.clientX, y: e.clientY });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={`Drag "${m.title}" to the timeline`}
                    >
                      <span className="relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-950">
                        {m.type === "IMAGE" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <VideoFrame url={m.url} className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{m.title}</span>
                        <span className="block text-[10px] text-slate-400">{m.type.toLowerCase()}</span>
                      </span>
                      <span className="shrink-0 text-slate-400">+</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column: preview + controls + timeline, so they all center together */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* Preview — single dark stage, video letterboxed */}
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
          <div className="relative h-full w-full max-w-4xl overflow-hidden rounded-xl bg-black">
            {items.length > 0 ? (
              <EditorPreview
                items={items.map((it) => ({
                  id: it.itemId,
                  type: it.kind === "DOCTOR" ? ("DOCTOR" as const) : it.type,
                  url: it.url,
                  duration: clipDuration(it),
                  leadingGapSeconds: leadingGap(it),
                  trimStartSeconds: it.type === "VIDEO" ? clipTiming(it).start : 0,
                  trimEndSeconds: it.type === "VIDEO" ? clipTiming(it).end : null,
                  doctor: it.doctor,
                }))}
                playing={playing}
                seekTime={currentTime}
                seekNonce={seekNonce}
                onTime={setCurrentTime}
                onEndedAll={() => setPlaying(false)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-slate-400">
                <p className="text-base font-medium">Nothing on this screen yet</p>
                <p className="text-sm text-slate-500">Upload media, then click it to add it.</p>
              </div>
            )}
          </div>
        </div>
      {/* Transport controls — Clipchamp-style */}
      <div className="flex shrink-0 items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => seekTo(0)}
          disabled={total <= 0}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Jump to start"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="5" y="5" width="2.4" height="14" rx="1" />
            <path d="M20 5v14L9 12z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => seekTo(currentTime - 5)}
          disabled={total <= 0}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Back 5 seconds"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span className="absolute text-[8px] font-bold">5</span>
        </button>
        <button
          type="button"
          onClick={togglePlay}
          disabled={total <= 0}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-black/10 transition hover:bg-slate-100 disabled:opacity-40"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => seekTo(currentTime + 5)}
          disabled={total <= 0}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Forward 5 seconds"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span className="absolute text-[8px] font-bold">5</span>
        </button>
        <span className="ml-3 font-mono text-xs tabular-nums text-slate-500">
          {fmtCs(currentTime)} / {fmtCs(total)}
        </span>
      </div>

      {/* Timeline */}
      <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-end">
        </div>

        <div ref={timelineRef} className="overflow-x-auto pb-1">
          <div
            ref={timelineContentRef}
            className="relative"
            style={{ width: trackWidth, minWidth: "100%" }}
            onPointerDown={onTimelinePointerDown}
            onDragOver={updateDropFromEvent}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropIndicator(null);
            }}
            onDrop={onTimelineDrop}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoverTime(clamp((e.clientX - rect.left) / pxPerSec, 0, total));
            }}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Ruler */}
            <div className="relative mb-1 h-4 border-b border-slate-200 dark:border-slate-700">
              {Array.from({ length: tickCount }).map((_, i) => {
                const sec = i * tickStep;
                return (
                  <span
                    key={i}
                    className="absolute top-0 text-[10px] tabular-nums text-slate-400"
                    style={{ left: sec * pxPerSec }}
                  >
                    <span className="absolute -top-0.5 left-0 h-2 w-px bg-slate-300 dark:bg-slate-600" />
                    <span className="ml-1">{fmt(sec)}</span>
                  </span>
                );
              })}
            </div>

            {/* Clips */}
            <div className="relative h-20">
              {items.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
                  Drag media here, or click an item in the panel to add it.
                </div>
              ) : (
                timelineLayouts.map(({ item: it, timing, gap, left, width }) => {
                  const isDragging = dragDraft?.itemId === it.itemId;
                  const blockLeftSec = isDragging ? dragDraft!.startSec : left;
                  const w = Math.max(width * pxPerSec, MIN_CLIP_PX);
                  const isSel = it.itemId === selectedId;
                  return (
                    <Fragment key={it.itemId}>
                      {/* Leading gap ("island" dead air) — hatched empty track. */}
                      {gap > 0 && !isDragging && (
                        <div
                          className="absolute inset-y-3 rounded-md border border-dashed border-slate-300/70 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(148,163,184,0.18)_5px,rgba(148,163,184,0.18)_10px)] dark:border-slate-600/70"
                          style={{ left: (left - gap) * pxPerSec, width: gap * pxPerSec }}
                          title={`${Math.round(gap)}s gap`}
                        />
                      )}
                      <div
                        onPointerDown={(e) => beginPointerClipDrag(e, it)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(it.itemId);
                        }}
                        title={it.title}
                        className={`group absolute inset-y-0 overflow-hidden rounded-lg bg-black ring-2 ${
                          isDragging
                            ? "z-40 cursor-grabbing opacity-90 shadow-xl ring-blue-400"
                            : isSel
                              ? "cursor-grab ring-blue-500"
                              : "cursor-grab ring-transparent hover:ring-slate-400"
                        }`}
                        style={{ left: blockLeftSec * pxPerSec, width: w }}
                      >
                        {it.kind === "DOCTOR" ? (
                          <div
                            className="flex h-full items-center gap-2 px-2.5"
                            style={{ background: "linear-gradient(135deg,#0b1e3b,#12294d)" }}
                          >
                            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-600 ring-1 ring-white/20">
                              {it.doctor?.photoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.doctor.photoUrl} alt="" className="h-full w-full object-cover" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[9px] font-medium uppercase tracking-wider text-blue-300">
                                Doctor
                              </span>
                              <span className="block truncate text-[11px] font-semibold text-white">
                                {it.doctor?.name}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* One frame per clip, stretched — not a decoder per
                                thumbnail cell (dozens of <video>s crash the tab). */}
                            <div className="h-full w-full overflow-hidden bg-black">
                              {it.type === "IMAGE" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.url} alt="" className="h-full w-full object-cover opacity-95" />
                              ) : (
                                <VideoFrame url={it.url} className="h-full w-full object-cover opacity-95" />
                              )}
                            </div>
                            {it.type === "VIDEO" && it.sourceDuration && (
                              <>
                                <span
                                  role="slider"
                                  aria-label="Trim clip start"
                                  aria-valuemin={0}
                                  aria-valuemax={Math.max(0, timing.end - MIN_TRIM_SECONDS)}
                                  aria-valuenow={timing.start}
                                  data-trim-handle="true"
                                  onPointerDown={(e) => startTrim(e, it, "start")}
                                  className="absolute inset-y-1 left-0 z-10 w-3 cursor-ew-resize rounded-r bg-white/80 opacity-0 shadow transition-opacity group-hover:opacity-100"
                                />
                                <span
                                  role="slider"
                                  aria-label="Trim clip end"
                                  aria-valuemin={timing.start + MIN_TRIM_SECONDS}
                                  aria-valuemax={it.sourceDuration}
                                  aria-valuenow={timing.end}
                                  data-trim-handle="true"
                                  onPointerDown={(e) => startTrim(e, it, "end")}
                                  className="absolute inset-y-1 right-0 z-10 w-3 cursor-ew-resize rounded-l bg-white/80 opacity-0 shadow transition-opacity group-hover:opacity-100"
                                />
                              </>
                            )}
                            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[10px] font-medium text-white">
                              {it.title}
                            </span>
                          </>
                        )}
                      </div>
                    </Fragment>
                  );
                })
              )}
            </div>

            {/* Drop indicator */}
            {dropIndicator && dragKind && (
              <div
                className="pointer-events-none absolute bottom-0 top-5 z-30 w-0.5 -translate-x-1/2 bg-fuchsia-500 shadow-[0_0_16px_rgba(217,70,239,0.75)]"
                style={{ left: dropIndicator.left }}
              >
                <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-fuchsia-500" />
              </div>
            )}

            {/* Hover time */}
            {hoverTime !== null && total > 0 && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-20 w-px -translate-x-1/2 bg-orange-400/45"
                style={{ left: hoverTime * pxPerSec }}
              >
                <span className="absolute top-5 left-1/2 -translate-x-1/2 rounded bg-black px-1.5 py-0.5 font-mono text-[10px] text-white shadow">
                  {fmtMs(hoverTime)}
                </span>
              </div>
            )}

            {/* Playhead */}
            {total > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-orange-400"
                style={{ left: playheadLeft }}
              >
                <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-orange-400" />
              </div>
            )}
          </div>
        </div>
      </div>
        </div>

        {/* Right: doctors panel — drag a doctor onto the timeline, or click to add. */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Doctors</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Drag a doctor onto the timeline, or click to add their card to the end.
            </p>
          </div>

          {doctors.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              No doctors imported yet. Import them from the practice&apos;s website first.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {doctors.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => beginDrag({ kind: "doctor", id: d.id }, e)}
                    onDragEnd={finishDrag}
                    onClick={() => addDoctor(d.id)}
                    title={`Drag ${d.name} to the timeline, or click to add`}
                    className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent p-2 text-left hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-slate-800"
                  >
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      {d.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {d.name}
                        {d.credentials ? `, ${d.credentials}` : ""}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {d.specialty ?? d.title ?? ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-slate-400">+</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[70] min-w-36 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => deleteLibraryMedia(contextMenu.mediaId)}
            className="w-full rounded-md px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete from library
          </button>
        </div>
      )}

      {pointerGhost && (
        <div
          className="pointer-events-none fixed z-[80] max-w-48 -translate-x-1/2 -translate-y-1/2 truncate rounded-md border border-blue-400 bg-slate-950/90 px-3 py-2 text-xs font-medium text-white shadow-2xl"
          style={{ left: pointerGhost.x, top: pointerGhost.y }}
        >
          {pointerGhost.title}
        </div>
      )}

    </div>
  );
}
