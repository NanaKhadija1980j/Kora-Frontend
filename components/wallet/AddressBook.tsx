"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store";
import { isValidStellarAddress } from "@/lib/utils";

export function AddressBook({ onClose }: { onClose?: () => void }) {
  const t = useTranslations("addressBook");
  const { addressBook, addAddressBookEntry, updateAddressBookEntry, removeAddressBookEntry } = useWalletStore();
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleBlur = () => {
    if (!addr) {
      setError(null);
      return;
    }
    if (!isValidStellarAddress(addr)) {
      setError(t("invalidAddress"));
    } else {
      setError(null);
    }
  };

  const handleAddrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddr(e.target.value);
    if (error) {
      setError(null);
    }
  };

  const add = () => {
    if (!addr) return;
    if (!isValidStellarAddress(addr)) {
      setError(t("invalidAddress"));
      return;
    }
    addAddressBookEntry(addr, label);
    setAddr("");
    setLabel("");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{t("title")}</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onClose?.()}>{t("close")}</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {addressBook.length === 0 && <p className="text-sm text-muted-foreground">{t("noSaved")}</p>}
          {addressBook.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
              <div>
                <div className="font-medium">{e.label || e.address}</div>
                <div className="text-xs text-muted-foreground">{e.address}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => {
                  const newLabel = prompt(`${t("editLabel")}`, e.label || "") || "";
                  updateAddressBookEntry(e.id, { label: newLabel });
                }}>{t("editButton")}</Button>
                <Button size="sm" variant="destructive" onClick={() => removeAddressBookEntry(e.id)}>{t("deleteButton")}</Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2">
          <Input 
            placeholder={t("addressPlaceholder")}
            value={addr} 
            onChange={handleAddrChange} 
            onBlur={handleBlur}
            error={error || undefined}
          />
          <Input placeholder={t("labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex justify-end">
            <Button onClick={add}>{t("addButton")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
