"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

type StartViewTransition = (cb: () => void) => unknown;

/**
 * Link that navigates inside a View Transition, so a shared element on this page
 * and the destination (matched by `view-transition-name`) morphs — e.g. zooming
 * a screen card up into the screen's detail preview. Falls back to a normal
 * client navigation where the API isn't available (non-Chromium browsers).
 */
export default function ZoomLink({
  href,
  className,
  children,
  prefetch,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  prefetch?: boolean;
}) {
  const router = useRouter();

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks (new tab, etc.) behave normally.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      const start = (document as Document & { startViewTransition?: StartViewTransition })
        .startViewTransition;
      if (typeof start !== "function") return; // unsupported → default Link nav
      e.preventDefault();
      start.call(document, () => {
        router.push(href);
      });
    },
    [href, router],
  );

  return (
    <Link href={href} className={className} onClick={onClick} prefetch={prefetch}>
      {children}
    </Link>
  );
}
