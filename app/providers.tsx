"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { useState } from "react";
import dynamic from "next/dynamic";

const WalletConnectModal = dynamic(
  () => import("@/components/wallet/WalletConnectModal").then((m) => m.WalletConnectModal),
  { ssr: false, loading: () => null }
);
const InstallPrompt = dynamic(
  () => import("@/components/pwa/InstallPrompt").then((m) => m.InstallPrompt),
  { ssr: false, loading: () => null }
);
const OnboardingTour = dynamic(
  () => import("@/components/onboarding/OnboardingTour").then((m) => m.default),
  { ssr: false, loading: () => null }
);
const CommandPalette = dynamic(
  () => import("@/components/command/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false, loading: () => null }
);
const ChangelogModal = dynamic(
  () => import("@/components/changelog/ChangelogModal").then((m) => m.ChangelogModal),
  { ssr: false, loading: () => null }
);
const InProgressOverlay = dynamic(
  () => import("@/components/transactions").then((m) => m.InProgressOverlay),
  { ssr: false, loading: () => null }
);

import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { useUIStore } from "@/store/uiStore";
import { env } from "@/lib/env";
import { isEnabled } from "@/lib/featureFlags";

// Pre-load both locale message files at the module level so they are
// bundled and available synchronously on the client.
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import arMessages from "@/messages/ar.json";
import ptBRMessages from "@/messages/pt-BR.json";
import type { Locale } from "@/i18n/config";

const ALL_MESSAGES: Record<Locale, Record<string, unknown>> = {
  en: enMessages as Record<string, unknown>,
  es: esMessages as Record<string, unknown>,
  ar: arMessages as Record<string, unknown>,
  "pt-BR": ptBRMessages as Record<string, unknown>,
};
const FeedbackWidget = dynamic(
  () => import("@/components/feedback/FeedbackWidget").then((m) => m.FeedbackWidget),
  { ssr: false, loading: () => null }
);
const KeyboardShortcutsProvider = dynamic(
  () =>
    import("@/components/keyboard/KeyboardShortcutsProvider").then(
      (m) => m.KeyboardShortcutsProvider
    ),
  { ssr: false, loading: () => null }
);

function ThemedToaster() {
  const theme = useUIStore((s) => s.theme);
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      style={{ zIndex: 99999 }}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "bg-card border border-border text-foreground z-[99999]",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider allMessages={ALL_MESSAGES}>
        <ThemeProvider>
          {children}
          {isEnabled("onboarding-tour") && <OnboardingTour />}
          <WalletConnectModal />
          <InProgressOverlay />
          <InstallPrompt />
          <FeedbackWidget />
          <KeyboardShortcutsProvider />
          <CommandPalette />
          <ChangelogModal />
          <ThemedToaster />
          {isEnabled("devtools") && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
