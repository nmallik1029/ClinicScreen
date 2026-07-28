import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type SetupStep = {
  key: string;
  title: string;
  description: string;
  /** Short status line, e.g. "2 of 3 screens placed". */
  detail: string;
  done: boolean;
  /** Practice-relative section to send the technician to, e.g. "screens". */
  href: string;
  /** Call-to-action button label for the current step. */
  cta: string;
  /** Walkthrough id to launch on the destination page (highlights the elements). */
  tour?: string;
  /** Short label for the compact bottom progress bar. */
  shortLabel: string;
};

/**
 * Compute the guided-setup checklist for a practice from live counts. Shared by
 * the overview page (full checklist) and the persistent bottom progress bar, so
 * both always agree on what's done and what's next.
 */
export const getSetupSteps = cache(async (practiceId: string): Promise<SetupStep[]> => {
  const [deviceCount, screensWithContent] = await Promise.all([
    prisma.device.count({ where: { practiceId } }),
    prisma.device.count({ where: { practiceId, assignedPlaylist: { items: { some: {} } } } }),
  ]);

  const s = (n: number) => (n === 1 ? "" : "s");

  return [
    {
      key: "pair",
      shortLabel: "Pair screen",
      title: "Pair your first screen",
      description:
        "Open the ClinicScreen player on the TV or device. It shows a short pairing code — enter that code here to connect it.",
      detail: deviceCount > 0 ? `${deviceCount} screen${s(deviceCount)} paired` : "No screens paired yet",
      done: deviceCount > 0,
      href: "screens/pair",
      cta: "Pair a screen",
      tour: "pair",
    },
    {
      key: "content",
      shortLabel: "Add content",
      title: "Add content to a screen",
      description:
        "Open a screen and add the videos and images patients should see. They start playing right away.",
      detail:
        deviceCount === 0
          ? "Pair a screen first"
          : screensWithContent > 0
            ? `${screensWithContent} of ${deviceCount} screen${s(deviceCount)} playing content`
            : "No content added yet",
      done: screensWithContent > 0,
      href: "screens",
      cta: "Add content",
      tour: undefined,
    },
  ];
});
