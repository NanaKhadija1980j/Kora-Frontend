import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Manage your Kora Protocol notification preferences, persona, and product tour settings.",
  alternates: { canonical: "/settings" },
  // Personal preferences behind a wallet connection — nothing here belongs in
  // a search index, matching the transactions route.
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
