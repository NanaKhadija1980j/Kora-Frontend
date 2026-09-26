"use client";

/**
 * /test-components — Component test fixture page
 *
 * Mounts the three UI primitives that need browser-level Playwright testing
 * in complete isolation.  Only available when NEXT_PUBLIC_ENABLE_MOCK_DATA is
 * true (i.e. never reachable in production).
 *
 * This page is intentionally minimal — no auth, no wallet, no providers beyond
 * what the components themselves need.  It exists solely to give the Playwright
 * component tests a stable, predictable URL to navigate to.
 *
 * Sections (each has a data-testid for targeted locators):
 *   #file-input-fixture   — FileInput component
 *   #range-slider-fixture — RangeSlider component
 *   #date-picker-fixture  — DatePicker component
 */

import * as React from "react";
import { redirect } from "next/navigation";
import { FileInput } from "@/components/ui/file-input";
import { RangeSlider } from "@/components/ui/range-slider";
import { DatePicker } from "@/components/ui/date-picker";

// ── FileInput fixture ────────────────────────────────────────────────────────

function FileInputFixture() {
  const [file, setFile] = React.useState<File | null>(null);

  return (
    <section id="file-input-fixture" className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
        FileInput
      </h2>
      <FileInput
        label="Invoice Document"
        maxSizeMB={5}
        value={file}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
        }}
      />
      {file && (
        <p data-testid="selected-file-name" className="text-xs text-zinc-400">
          Selected: {file.name}
        </p>
      )}
    </section>
  );
}

// ── RangeSlider fixture ──────────────────────────────────────────────────────

function RangeSliderFixture() {
  const [value, setValue] = React.useState<[number, number]>([0, 50]);

  return (
    <section id="range-slider-fixture" className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
        RangeSlider
      </h2>
      <div data-testid="range-slider-output" className="text-xs text-zinc-300 font-mono">
        {value[0]}% – {value[1]}%
      </div>
      <RangeSlider
        min={0}
        max={50}
        step={1}
        value={value}
        onChange={setValue}
        formatLabel={(v) => `${v}%`}
      />
    </section>
  );
}

// ── DatePicker fixture ───────────────────────────────────────────────────────

function DatePickerFixture() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = React.useState<string>("");

  return (
    <section id="date-picker-fixture" className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
        DatePicker
      </h2>
      <DatePicker
        label="Select Date"
        name="fixture-date"
        min={today}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        placeholder="Select date..."
      />
      {date && (
        <p data-testid="selected-date-value" className="text-xs text-zinc-400 font-mono">
          Value: {date}
        </p>
      )}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TestComponentsPage() {
  // Safety guard: redirect away in production unless dev flag is enabled (#725)
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_COMPONENTS !== "true"
  ) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-8 space-y-12 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-zinc-100">
        Component Test Fixtures
      </h1>
      <FileInputFixture />
      <RangeSliderFixture />
      <DatePickerFixture />
    </main>
  );
}
