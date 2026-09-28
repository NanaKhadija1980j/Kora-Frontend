/**
 * useKybStatusPoller — Issue #489, resourced by the Synaps webhook in #694.
 *
 * Polls `kycStatus` from the wallet store on a fixed interval while `enabled`
 * is true. As soon as the status flips to `"verified"`, the `onVerified`
 * callback fires and polling stops.
 *
 * The poller stays side-effect-free — it reads the Zustand store directly and
 * makes no request of its own. What changed in #694 is who writes that store.
 * It used to be only `SynapsKycModal`; now `useKycStatusSync`, mounted app-wide
 * in `WalletButton`, pulls the status the `/api/webhooks/kyc` handler recorded
 * into the same store. So a real Synaps callback advances this gate through
 * exactly the path the mock always used, and this hook keeps working without a
 * TanStack Query client of its own.
 */

import { useEffect, useRef } from "react";
import { useWalletKycStatus, useWalletStore } from "@/store/walletStore";
import { KYC_POLL_INTERVAL_MS } from "@/hooks/useKycStatusSync";

interface UseKybStatusPollerOptions {
  /** Polling is active only while this is `true`. */
  enabled: boolean;
  /** Called once when `kycStatus` becomes `"verified"`. */
  onVerified?: () => void;
}

export function useKybStatusPoller({
  enabled,
  onVerified,
}: UseKybStatusPollerOptions): void {
  const kycStatus = useWalletKycStatus();
  const onVerifiedRef = useRef(onVerified);
  // Keep the ref fresh on every render without re-triggering the effect.
  onVerifiedRef.current = onVerified;

  useEffect(() => {
    if (!enabled) return;

    // Already verified before the effect even runs.
    if (kycStatus === "verified") {
      onVerifiedRef.current?.();
      return;
    }

    const intervalId = setInterval(() => {
      // Re-read the store value synchronously inside the interval.
      // Zustand's store is synchronously readable via getState().
      const status = useWalletStore.getState().kycStatus;
      if (status === "verified") {
        clearInterval(intervalId);
        onVerifiedRef.current?.();
      }
    }, KYC_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
