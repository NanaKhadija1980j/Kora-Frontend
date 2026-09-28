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
import { useFormatters } from "@/hooks/useFormatters";
import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { websiteSchema, organizationSchema, faqSchema, serializeSchema } from "@/lib/structuredData";
import { useTranslations } from "next-intl";


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

// Ordering, icon, and step number only — the copy lives in
// `landing.howItWorks.*`. Keeping the presentation here and the words in the
// message catalogue is what stops a new step from shipping English-only.
const HOW_IT_WORKS = [
  { step: "01", key: "step1", icon: Shield },
  { step: "02", key: "step2", icon: FileText },
  { step: "03", key: "step3", icon: Globe },
  { step: "04", key: "step4", icon: Coins },
  { step: "05", key: "step5", icon: TrendingUp },
] as const;

// As above: copy lives in `landing.features.*`.
const FEATURES = [
  { key: "instant", icon: Zap },
  { key: "nonCustodial", icon: Shield },
  { key: "global", icon: Globe },
  { key: "transparent", icon: BarChart3 },
] as const;

export default function LandingPage() {
  const { formatCurrency, formatPercentage, formatNumber } = useFormatters();
  const t = useTranslations("landing");
  // Split the translated headline, not a module-level English constant, so the
  // per-word stagger animation runs over whatever the active locale says.
  const words = useMemo(() => t("headline").split(" "), [t]);

  const heroStats = useMemo(
    () => [
      {
        label: t("stats.totalInvoices"),
        value: MOCK_STATS.activeInvoices,
        formatter: (value: number) => formatNumber(value),
      },
      {
        label: t("stats.totalFinanced"),
        value: MOCK_STATS.totalVolumeFinanced,
        formatter: (value: number) => formatCurrency(value, "USDC", true),
      },
      {
        label: t("stats.averageApr"),
        value: MOCK_STATS.averageApr,
        formatter: (value: number) => formatPercentage(value, 1),
      },
    ],
    [t, formatCurrency, formatPercentage, formatNumber]
  );

  const stats = useMemo(
    () => [
      { label: t("stats.totalVolume"), value: formatCurrency(MOCK_STATS.totalVolumeFinanced, "USDC", true) },
      { label: t("stats.activeInvoices"), value: formatNumber(MOCK_STATS.activeInvoices) },
      { label: t("stats.liquidityProviders"), value: formatNumber(MOCK_STATS.totalInvestors) },
      { label: t("stats.avgApr"), value: formatPercentage(MOCK_STATS.averageApr, 0) },
    ],
    [t, formatCurrency, formatNumber, formatPercentage]
  );

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
              {t("badge")}
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
              {t("subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5"
            >
              <Link href="/invoice/create">
                <Button size="xl" className="min-w-[220px]">
                  {t("financeInvoice")}
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button size="xl" variant="outline" className="min-w-[220px]">
                  {t("browseMarketplace")}
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
            {heroStats.map((stat) => (
              <AnimatedStat key={stat.label} value={stat.value} label={stat.label} formatter={stat.formatter} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-800/60 bg-zinc-900/30 px-4 py-12 sm:px-6" aria-label="Protocol statistics">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {stats.map((stat, i) => (
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
            <h2 className="text-3xl font-bold text-zinc-100 sm:text-4xl" id="how-it-works-heading">{t("howItWorksTitle")}</h2>
            <p className="mt-3 text-zinc-500">{t("howItWorksSubtitle")}</p>
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
                    <h3 className="font-semibold text-zinc-100">
                      {t(`howItWorks.${step.key}Title` as Parameters<typeof t>[0])}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {t(`howItWorks.${step.key}Desc` as Parameters<typeof t>[0])}
                    </p>
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
              {t("featuresTitle")}
            </h2>
            <p className="mt-3 text-zinc-500">{t("featuresSubtitle")}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <GlassCard className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kora-500/10 text-kora-400">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-zinc-100">
                    {t(`features.${f.key}Title` as Parameters<typeof t>[0])}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500">
                    {t(`features.${f.key}Desc` as Parameters<typeof t>[0])}
                  </p>
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
            <h2 className="text-3xl font-bold text-zinc-100 sm:text-4xl" id="architecture-heading">{t("architectureTitle")}</h2>
            <p className="mt-3 text-zinc-500">{t("architectureSubtitle")}</p>
          </div>

          <GlassCard className="overflow-hidden p-8">
            <div className="grid gap-8 lg:grid-cols-3">
              {[
                {
                  key: "appLayer",
                  // Item lists are proper product names — Next.js, IPFS /
                  // Pinata, Horizon API — so they are deliberately not
                  // translated. Only the layer heading is localised.
                  items: ["Next.js Frontend", "Stellar Wallets Kit", "TanStack Query"],
                  color: "text-blue-400",
                  bg: "bg-blue-400/10",
                },
                {
                  key: "protocolLayer",
                  items: ["Invoice NFT Contract", "Marketplace Contract", "Token Contract"],
                  color: "text-kora-400",
                  bg: "bg-kora-400/10",
                },
                {
                  key: "storageLayer",
                  items: ["Stellar Soroban", "IPFS / Pinata", "Horizon API"],
                  color: "text-purple-400",
                  bg: "bg-purple-400/10",
                },
              ].map((layer) => (
                <div key={layer.key} className="space-y-3">
                  <div className={`inline-flex rounded-lg px-3 py-1 text-xs font-medium ${layer.bg} ${layer.color}`}>
                    {t(`architecture.${layer.key}` as Parameters<typeof t>[0])}
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
              {t("ctaTitle")}
            </h2>
            <p className="relative mt-3 text-zinc-500">
              {t("ctaSubtitle")}
            </p>
            <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/invoice/create">
                <Button size="xl">
                  {t("createInvoice")} <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button size="xl" variant="outline">
                  {t("exploreMarketplace")}
                </Button>
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
