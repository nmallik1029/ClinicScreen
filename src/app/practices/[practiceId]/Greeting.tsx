"use client";

import { useEffect, useState } from "react";

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Computed on the client so it uses the *viewer's* local time. Doing this on the
// server is wrong because the server runs in UTC (e.g. 1:49 PM Pacific is 20:49
// UTC → "Good evening").
export default function Greeting({ name, className }: { name: string; className?: string }) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return <h1 className={className}>{greeting ? `${greeting}, ${name}` : name}</h1>;
}
