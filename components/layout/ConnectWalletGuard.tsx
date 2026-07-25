"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { WalletButton } from "@/components/wallet/WalletButton";

function IntendedDestinationSetter() {
  const searchParams = useSearchParams();
  const { setIntendedDestination } = useUIStore();

  useEffect(() => {
    const redirectTo = searchParams.get("redirectTo");
    if (redirectTo) setIntendedDestination(redirectTo);
  }, [searchParams, setIntendedDestination]);

  return null;
}

import { Suspense } from "react";

export function ConnectWalletGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("wallet");
  const pathname = usePathname();
  const { isConnected } = useWallet();

  if (
    !isConnected &&
    ["/invoice/create", "/dashboard/sme", "/dashboard/investor"].some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    )
  ) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h3 className="text-lg font-bold">{t("connectGuardTitle")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("connectGuardDesc")}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <WalletButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <IntendedDestinationSetter />
      </Suspense>
      {children}
    </>
  );
}
