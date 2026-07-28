"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, Input, Button, Label } from "@/components/ui";
import { setScreenLocation, createLocationForScreen } from "@/app/practices/[practiceId]/actions";

// Location picker that also lets you create a location inline (no Locations tab).
// Changes save immediately to the screen.
export default function ScreenLocationField({
  practiceId,
  deviceId,
  locations,
  currentLocationId,
}: {
  practiceId: string;
  deviceId: string;
  locations: { id: string; name: string }[];
  currentLocationId: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    startTransition(async () => {
      await setScreenLocation(practiceId, deviceId, value);
      router.refresh();
    });
  }

  function onAdd() {
    const clean = name.trim();
    if (!clean) return;
    startTransition(async () => {
      await createLocationForScreen(practiceId, deviceId, clean);
      setName("");
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <div>
      <Label>Location</Label>
      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Office"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              } else if (e.key === "Escape") {
                setAdding(false);
                setName("");
              }
            }}
          />
          <Button type="button" onClick={onAdd} disabled={pending}>
            Add
          </Button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setName("");
            }}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select
            key={currentLocationId ?? "none"}
            defaultValue={currentLocationId ?? ""}
            onChange={onSelect}
            disabled={pending}
          >
            <option value="">None</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Button type="button" variant="ghost" onClick={() => setAdding(true)}>
            + New
          </Button>
        </div>
      )}
    </div>
  );
}
