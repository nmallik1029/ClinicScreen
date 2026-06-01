"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  title: string;
  type: "VIDEO" | "IMAGE";
  url: string;
  duration: number;
};

export default function Player({ screenName, items }: { screenName: string; items: Item[] }) {
  const [index, setIndex] = useState(0);
  const current = items[index];

  useEffect(() => {
    const ms = Math.max(2, current.duration) * 1000;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % items.length), ms);
    return () => clearTimeout(timer);
  }, [index, current, items.length]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white">
      <div className="flex h-full w-full items-center justify-center">
        {current.type === "IMAGE" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={current.title} className="max-h-full max-w-full object-contain" />
        ) : (
          <video
            key={current.id}
            src={current.url}
            autoPlay
            muted
            playsInline
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-4 py-2 text-xs text-slate-300">
        <span>{screenName}</span>
        <span>
          {current.title} ({index + 1}/{items.length})
        </span>
      </div>
    </div>
  );
}
