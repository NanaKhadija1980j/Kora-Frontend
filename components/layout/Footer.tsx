"use client";

import { useUIStore } from "@/store/uiStore";

const APP_VERSION = "0.1.0";

export function Footer() {
  const setChangelogOpen = useUIStore((s) => s.setChangelogOpen);

  return (
    <footer className="border-t border-border/60 bg-background/80 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Kora Protocol</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("kora:open-shortcut-modal"))
            }
            className="transition-colors underline-offset-2 hover:text-foreground hover:underline"
          >
            Keyboard Shortcuts
          </button>
          <button
            type="button"
            onClick={() => setChangelogOpen(true)}
            className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
            aria-label="Open changelog"
          >
            Changelog
          </button>
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">
            v{APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
