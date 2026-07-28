// Tiny channel so the content editor can turn the global theme-toggle button into
// a trash drop-target while a timeline clip is being dragged (no second button).
export const TRASH_STATE_EVENT = "cs:trash-state";

export type TrashState = { active: boolean; armed: boolean };

export function setTrashState(state: TrashState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TrashState>(TRASH_STATE_EVENT, { detail: state }));
}
