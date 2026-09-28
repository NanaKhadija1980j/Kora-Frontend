"use client";

import { useCallback, useEffect, useState } from "react";
import { useUIStore } from "@/store/uiStore";
import { parseChangelog } from "@/hooks/useChangelog";

const SEEN_KEY = "kora-changelog-seen-version";

function readSeenVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    // Private mode or blocked storage — treat as "nothing seen yet" and let
    // the fail-closed rule below decide whether to show anything.
    return null;
  }
}

/**
 * Tracks whether the newest release in CHANGELOG.md has been seen (Issue #679).
 *
 * `useChangelog` already stores the seen version, but it only drives the
 * auto-opening modal — nothing surfaced an unread release once that modal had
 * been dismissed, so users only found releases via the footer link.
 *
 * Fails closed: if the changelog cannot be fetched or parses to nothing, there
 * is no version to compare against, so no badge is shown. A dot that might be
 * pointing at nothing is worse than no dot.
 */
export function useChangelogBadge() {
  const changelogOpen = useUIStore((s) => s.changelogOpen);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [seenVersion, setSeenVersion] = useState<string | null>(null);

  useEffect(() => {
    setSeenVersion(readSeenVersion());
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/CHANGELOG.md")
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const releases = parseChangelog(text);
        // parseChangelog skips [Unreleased], so releases[0] is the newest
        // published version.
        setLatestVersion(releases[0]?.version ?? null);
      })
      .catch(() => {
        // Fail closed — leave latestVersion null so no badge renders.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Record the latest version as seen and drop the badge. */
  const markSeen = useCallback(() => {
    if (!latestVersion) return;
    try {
      localStorage.setItem(SEEN_KEY, latestVersion);
    } catch {
      // Storage unavailable: the badge still clears for this session.
    }
    setSeenVersion(latestVersion);
  }, [latestVersion]);

  // Opening the modal is what "reading the changelog" means, however it was
  // opened — the navbar button, the footer link, or the auto-open on a new
  // version.
  useEffect(() => {
    if (changelogOpen) markSeen();
  }, [changelogOpen, markSeen]);

  return {
    hasUnread: latestVersion !== null && latestVersion !== seenVersion,
    latestVersion,
    markSeen,
  };
}
