"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  TrendingUp,
  FileText,
  Coins,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { MOCK_STATS } from "@/services/mockData";
import { formatCurrency } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { websiteSchema, organizationSchema, faqSchema, serializeSchema } from "@/lib/structuredData";

const HERO_HEADLINE = "Invoice Financing, On-Chain";

const HERO_STATS = [
  {
    label: "Total Invoices",
    value: MOCK_STATS.activeInvoices,
    formatter: (value: number) => value.toLocaleString(),
  },
  {
    label: "Total USDC Financed",
    value: MOCK_STATS.totalVolumeFinanced,
    formatter: (value: number) => formatCurrency(value, "USDC", true),
  },
  {
    label: "Average APR",
    value: MOCK_STATS.averageApr,
    formatter: (value: number) => `${value.toFixed(1)}%`,
  },
];

const STATS = [
  { label: "Total Volume Financed", value: formatCurrency(MOCK_STATS.totalVolumeFinanced, "USDC", true) },
  { label: "Active Invoices", value: MOCK_STATS.activeInvoices.toLocaleString() },
  { label: "Liquidity Providers", value: MOCK_STATS.totalInvestors.toLocaleString() },
  { label: "Avg. APR", value: `${MOCK_STATS.averageApr}%` },
];

function AnimatedStat({ value, label, formatter }: { value: number; label: string; formatter: (value: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let frameId = 0;
    const start = performance.now();
    const duration = 1400;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const nextValue = Math.round(value * progress);
      setCount(nextValue);
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [inView, value]);

  return (
    <div ref={ref} className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6 text-center shadow-2xl shadow-black/10 backdrop-blur-xl">
      <p className="text-3xl font-semibold text-white sm:text-4xl">{formatter(count)}</p>
      <p className="mt-2 text-sm uppercase tracking-[0.24em] text-zinc-400">{label}</p>
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Connect Wallet",
    description: "Connect your Stellar wallet (Freighter, xBull, LOBSTR) to access the protocol.",
    icon: Shield,
  },
  {
    step: "02",
    title: "Upload Invoice",
    description: "Upload your unpaid invoice. Metadata is stored on IPFS; the NFT is minted on Soroban.",
    icon: FileText,
  },
  {
    step: "03",
    title: "List on Marketplace",
    description: "Set your discount rate and minimum investment. Your invoice goes live instantly.",
    icon: Globe,
  },
  {
    step: "04",
    title: "Receive Liquidity",
    description: "Investors fund your invoice. USDC is transferred to your wallet immediately.",
    icon: Coins,
  },
  {
    step: "05",
    title: "Repay & Close",
    description: "On due date, repay the financed amount. Investors receive principal + yield.",
    icon: TrendingUp,
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Instant Settlement",
    description: "Soroban smart contracts settle transactions in seconds, not days.",
  },
  {
    icon: Shield,
    title: "Non-Custodial",
    description: "Your assets stay in your wallet. Smart contracts hold escrow, not us.",
  },
  {
    icon: Globe,
    title: "Global Access",
    description: "SMEs across Africa, Asia, and LatAm access institutional-grade financing.",
  },
  {
    icon: BarChart3,
    title: "Transparent Risk",
    description: "On-chain risk scores and repayment history visible to all participants.",
  },
];

export default function LandingPage() {
  const words = useMemo(() => HERO_HEADLINE.split(" "), []);

  return (
    <div className="bg-mesh">
      {/* Structured data for SEO ≥ 95 — injected after hydration to avoid SSR mismatch */}
      <Script
        id="ld-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeSchema(faqSchema()) }}
        strategy="afterInteractive"
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-24 pt-24 sm:px-6 lg:px-8" aria-labelledby="hero-heading">
        <div className="absolute inset-0 hero-background" aria-hidden="true" />
        <div className="absolute inset-0 hero-grid-dots" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
            className="relative z-10"
          >
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.26em] text-cyan-200/90"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
              Live on Stellar Testnet
            </motion.span>

            <motion.h1
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
              className="mx-auto mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl"
              id="hero-heading"
            >
              {words.map((word, index) => (
                <motion.span
                  key={`${word}-${index}`}
                  variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } }}
                  className="inline-block mr-2 whitespace-nowrap"
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl"
            >
              Unlock working capital for emerging market SMEs with on-chain invoice financing, stablecoin liquidity and transparent investor access — all non-custodial.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5"
            >
              <Link href="/invoice/create">
                <Button size="xl" className="min-w-[220px]">
                  Finance My Invoice
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button size="xl" variant="outline" className="min-w-[220px]">
                  Browse Marketplace
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="relative z-10 mx-auto mt-16 grid gap-4 sm:grid-cols-3"
          >
            {HERO_STATS.map((stat) => (
              <AnimatedStat key={stat.label} value={stat.value} label={stat.label} formatter={stat.formatter} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-800/60 bg-zinc-900/30 px-4 py-12 sm:px-6" aria-label="Protocol statistics">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <p className="text-2xl font-bold text-zinc-100 sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="px-4 py-24 sm:px-6" aria-labelledby="how-it-works-heading">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-zinc-100 sm:text-4xl" id="how-it-works-heading">How It Works</h2>
            <p className="mt-3 text-zinc-500">Five steps from invoice to liquidity</p>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-kora-500/40 via-kora-500/20 to-transparent lg:block" />

            <div className="space-y-8">
              {HOW_IT_WORKS.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-6"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-kora-500/20 bg-kora-500/10 text-kora-400">
                    <step.icon className="h-5 w-5" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-950 text-[9px] font-bold text-kora-400 ring-1 ring-kora-500/30">
                      {i + 1}
                    </span>
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold text-zinc-100">{step.title}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="bg-zinc-900/30 px-4 py-24 sm:px-6" aria-labelledby="features-heading">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-zinc-100 sm:text-4xl" id="features-heading">
              Built for the Real Economy
            </h2>
            <p className="mt-3 text-zinc-500">
              Institutional-grade infrastructure for emerging market SMEs
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <GlassCard className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kora-500/10 text-kora-400">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-zinc-100">{f.title}</h3>
                  <p className="mt-2 text-sm text-zinc-500">{f.description}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Protocol Architecture ─────────────────────────────────────────── */}
      <section className="px-4 py-24 sm:px-6" aria-labelledby="architecture-heading">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-100 sm:text-4xl" id="architecture-heading">Protocol Architecture</h2>
            <p className="mt-3 text-zinc-500">Fully on-chain, non-custodial, and auditable</p>
          </div>

          <GlassCard className="overflow-hidden p-8">
            <div className="grid gap-8 lg:grid-cols-3">
              {[
                {
                  layer: "Application Layer",
                  items: ["Next.js Frontend", "Stellar Wallets Kit", "TanStack Query"],
                  color: "text-blue-400",
                  bg: "bg-blue-400/10",
                },
                {
                  layer: "Protocol Layer",
                  items: ["Invoice NFT Contract", "Marketplace Contract", "Token Contract"],
                  color: "text-kora-400",
                  bg: "bg-kora-400/10",
                },
                {
                  layer: "Storage Layer",
                  items: ["Stellar Soroban", "IPFS / Pinata", "Horizon API"],
                  color: "text-purple-400",
                  bg: "bg-purple-400/10",
                },
              ].map((layer) => (
                <div key={layer.layer} className="space-y-3">
                  <div className={`inline-flex rounded-lg px-3 py-1 text-xs font-medium ${layer.bg} ${layer.color}`}>
                    {layer.layer}
                  </div>
                  <ul className="space-y-2">
                    {layer.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-zinc-400">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${layer.color}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-32 pt-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <GlassCard className="relative overflow-hidden p-12 text-center">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-kora-500/10 blur-3xl" />
            </div>
            <h2 className="relative text-3xl font-bold text-zinc-100">
              Ready to unlock your capital?
            </h2>
            <p className="relative mt-3 text-zinc-500">
              Join hundreds of SMEs already financing invoices on Kora Protocol.
            </p>
            <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/invoice/create">
                <Button size="xl">
                  Create Invoice <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button size="xl" variant="outline">
                  Explore Marketplace
                </Button>
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
