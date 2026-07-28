import type { useRouter } from "next/navigation";

/**
 * Client-side glue for "I just completed a setup step" moments. A form calls
 * `completeStep` on success: it fires an event so the persistent bottom progress
 * bar can animate the matching segment, waits for that animation, then returns
 * the user to the checklist (overview) with a `?done=` flag so a confirmation
 * banner shows.
 */
export const STEP_COMPLETE_EVENT = "clinicscreen:step-complete";

/** Time the progress-bar completion animation runs before we navigate away. */
export const STEP_COMPLETE_ANIM_MS = 900;

export function fireStepComplete(key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STEP_COMPLETE_EVENT, { detail: { key } }));
}

export async function completeStep(
  router: ReturnType<typeof useRouter>,
  practiceId: string,
  key: string,
) {
  fireStepComplete(key);
  await new Promise((r) => setTimeout(r, STEP_COMPLETE_ANIM_MS));
  // Screens is the home/checklist surface, so confirmations land there.
  router.push(`/practices/${practiceId}/screens?done=${encodeURIComponent(key)}`);
  router.refresh();
}
