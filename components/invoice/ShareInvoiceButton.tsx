"use client";

import { useEffect, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Copy, Linkedin, QrCode, Twitter } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

type Props = {
  id: string;
  invoiceTitle?: string;
  summary?: string;
};

export function buildInvoiceShareUrl(origin: string, tokenId: string): string {
  const url = new URL(`/marketplace/${tokenId}`, origin);
  url.searchParams.set("utm_source", "kora");
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_content", tokenId);
  return url.toString();
}

function supportsMobileShare(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  return navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)").matches === true;
}

export default function ShareInvoiceButton({ id, invoiceTitle, summary }: Props): JSX.Element {
  const t = useTranslations("shareInvoice");
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const { copy, copied } = useCopyToClipboard();

  const invoiceUrl = useMemo(
    () => (typeof window === "undefined" ? "" : buildInvoiceShareUrl(window.location.origin, id)),
    [id],
  );

  useEffect(() => {
    if (!invoiceUrl) return;
    let mounted = true;
    QRCode.toDataURL(invoiceUrl, { margin: 1, width: 240 })
      .then((dataUrl: string) => mounted && setQrDataUrl(dataUrl))
      .catch(() => mounted && setQrDataUrl(null));
    return () => { mounted = false; };
  }, [invoiceUrl]);

  useEffect(() => {
    const current = new URL(window.location.href);
    const tracked = ["utm_source", "utm_medium", "utm_content"].some((key) =>
      current.searchParams.has(key),
    );
    if (!tracked) return;
    current.searchParams.delete("utm_source");
    current.searchParams.delete("utm_medium");
    current.searchParams.delete("utm_content");
    window.history.replaceState(
      window.history.state, "",
      `${current.pathname}${current.search}${current.hash}`,
    );
  }, []);

  const copyShareLink = async () => {
    const success = await copy(invoiceUrl);
    if (success) {
      toast.success(t("linkCopiedToast"));
      setOpen(true);
    } else {
      toast.error(t("unableToCopy"));
    }
  };

  const handlePrimaryShare = async () => {
    if (supportsMobileShare()) {
      try {
        await navigator.share({
          title: invoiceTitle ?? "Kora invoice opportunity",
          text: summary ?? "Review this invoice financing opportunity on Kora.",
          url: invoiceUrl,
        });
        toast.success(t("sharedSuccessfully"));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyShareLink();
  };

  const tweetText = encodeURIComponent(`${invoiceTitle ?? "Invoice"} · ${summary ?? "Invoice listed on Kora"}`);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(invoiceUrl)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(invoiceUrl)}`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("shareLabel")}
          onClick={(event) => { event.preventDefault(); void handlePrimaryShare(); }}
        >
          {t("shareButton")}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[260px] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
          sideOffset={8}
        >
          <div className="flex flex-col gap-2 p-2">
            <Button size="sm" variant="ghost" onClick={() => void copyShareLink()} className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              {copied ? t("linkCopied") : t("copyLink")}
            </Button>

            <div className="flex items-center gap-2">
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button size="sm" variant="ghost" className="w-full">
                  <Twitter className="mr-2 h-4 w-4" /> {t("shareOnX")}
                </Button>
              </a>
              <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button size="sm" variant="ghost" className="w-full">
                  <Linkedin className="mr-2 h-4 w-4" /> {t("shareOnLinkedIn")}
                </Button>
              </a>
            </div>

            <div className="pt-1 text-center">
              <div className="text-xs text-muted-foreground">{t("qrCodeLabel")}</div>
              <div className="mt-2 flex justify-center">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt={t("qrCodeAlt")} className="h-32 w-32" />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded bg-muted">
                    <QrCode aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
