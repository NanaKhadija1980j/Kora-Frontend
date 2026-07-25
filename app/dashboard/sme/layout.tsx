import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SME Dashboard",
  description:
    "Manage your tokenized invoices. Track funding progress, monitor repayment schedules, and access instant USDC liquidity for your business.",
  keywords: [
    "SME dashboard",
    "invoice management",
    "invoice financing",
    "Stellar",
    "USDC liquidity",
  ],
  openGraph: {
    title: "SME Dashboard | Kora Protocol",
    description:
      "Manage your tokenized invoices and track funding progress on Kora Protocol.",
    url: "/dashboard/sme",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kora Protocol SME Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SME Dashboard | Kora Protocol",
    description: "Manage your tokenized invoices on Kora Protocol.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "/dashboard/sme" },
  robots: { index: false, follow: false },
};

import { ConnectWalletGuard } from "@/components/layout/ConnectWalletGuard";

export default function SMEDashboardLayout({ children }: { children: React.ReactNode }) {
  return <ConnectWalletGuard>{children}</ConnectWalletGuard>;
}