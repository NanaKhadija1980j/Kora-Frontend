"use client";

import { useState } from "react";
import { useWalletStore } from "@/store/walletStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertCircle, FileText, Upload } from "lucide-react";

interface SynapsKycModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SynapsKycModal({ open, onOpenChange }: SynapsKycModalProps) {
  const { setKycStatus } = useWalletStore();
  const [step, setStep] = useState<"intro" | "upload" | "verifying" | "success" | "failed">("intro");
  const [docType, setDocType] = useState<string>("passport");

  const startVerification = () => {
    setStep("upload");
  };

  const handleUpload = (simulateSuccess: boolean) => {
    setStep("verifying");
    setKycStatus("pending");
    setTimeout(() => {
      if (simulateSuccess) {
        setKycStatus("verified");
        setStep("success");
      } else {
        setKycStatus("rejected");
        setStep("failed");
      }
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border border-zinc-850 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-zinc-100">
            Synaps KYC Verification
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Verify your identity with Synaps to unlock higher investment limits.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4 py-3">
            <p className="text-sm text-zinc-300 leading-relaxed">
              To comply with global regulatory standards, you must verify your identity. The verification process is handled securely by Synaps and takes about 2 minutes.
            </p>
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3.5 space-y-2">
              <p className="text-xs font-semibold text-zinc-200">What you will need:</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Government-issued ID or Passport</li>
                <li>Clear selfie photo</li>
                <li>Proof of address (for higher tier limits)</li>
              </ul>
            </div>
            <Button className="w-full mt-2" onClick={startVerification}>
              Start Verification Flow
            </Button>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4 py-3">
            <p className="text-sm text-zinc-300 font-medium">Select Document Type:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDocType("passport")}
                className={`p-3 rounded-lg border text-xs font-medium text-left transition-all ${
                  docType === "passport"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-350"
                }`}
              >
                <FileText className="h-4.5 w-4.5 mb-1.5 text-primary" />
                Passport
              </button>
              <button
                type="button"
                onClick={() => setDocType("id_card")}
                className={`p-3 rounded-lg border text-xs font-medium text-left transition-all ${
                  docType === "id_card"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-350"
                }`}
              >
                <FileText className="h-4.5 w-4.5 mb-1.5 text-primary" />
                National ID Card
              </button>
            </div>

            <div className="border border-dashed border-zinc-800 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-zinc-900/10">
              <Upload className="h-6 w-6 text-zinc-550 mb-2" />
              <p className="text-xs text-zinc-300">Drag and drop your document here, or click to browse</p>
              <p className="text-[10px] text-zinc-500 mt-1">Accepts PDF, JPG, or PNG up to 10MB</p>
            </div>

            <div className="flex gap-2.5 mt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("intro")}>
                Back
              </Button>
              <Button type="button" className="flex-1" onClick={() => handleUpload(true)}>
                Verify (Success)
              </Button>
              <Button type="button" variant="danger" className="flex-1 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20" onClick={() => handleUpload(false)}>
                Verify (Fail)
              </Button>
            </div>
          </div>
        )}

        {step === "verifying" && (
          <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="text-sm font-semibold text-zinc-200">Verifying Documents</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Synaps automated checks are analyzing your document and checking compliance databases...
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
            <div className="h-12 w-12 rounded-full bg-success/10 text-success border border-success/20 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-205">Identity Verified Successfully!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Thank you! Your KYC status is now verified. Your account investment limits have been upgraded.
              </p>
            </div>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              Continue
            </Button>
          </div>
        )}

        {step === "failed" && (
          <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-205">Verification Failed</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Synaps was unable to verify your document automatically. Make sure the document image is clear, uncropped, and all details are visible.
              </p>
            </div>
            <Button type="button" className="w-full" onClick={() => setStep("upload")}>
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
