"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { createOrgAction } from "../(auth)/actions";

export function OnboardingForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [coaTemplate, setCoaTemplate] = useState<
    "konstruksi" | "konsultan" | "kosong"
  >("konstruksi");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await createOrgAction({
            name: String(form.get("name") ?? ""),
            companyCode: String(form.get("companyCode") ?? ""),
            npwp: String(form.get("npwp") ?? "") || undefined,
            address: String(form.get("address") ?? "") || undefined,
            phone: String(form.get("phone") ?? "") || undefined,
            email: String(form.get("email") ?? "") || undefined,
            bankAccountLabel:
              String(form.get("bankAccountLabel") ?? "") || undefined,
            coaTemplate,
          });
          if (!result.ok) {
            setMessage(result.message);
            setFieldErrors(result.fieldErrors ?? {});
            return;
          }
          router.push("/dashboard");
          router.refresh();
        });
      }}
    >
      {message ? <Notice message={message} tone="error" /> : null}
      <TextField
        label="Nama perusahaan"
        name="name"
        required
        error={fieldErrors.name}
      />
      <TextField
        label="Kode perusahaan"
        name="companyCode"
        required
        placeholder="Contoh: MMS"
        error={fieldErrors.companyCode}
      />
      <TextField label="NPWP" name="npwp" error={fieldErrors.npwp} />
      <TextField label="Alamat" name="address" error={fieldErrors.address} />
      <TextField label="Telepon" name="phone" error={fieldErrors.phone} />
      <TextField
        label="Email perusahaan"
        name="email"
        type="email"
        error={fieldErrors.email}
      />
      <TextField
        label="Rekening bank default (untuk dokumen cetak)"
        name="bankAccountLabel"
        placeholder="BCA 123456789 a.n. PT Contoh"
        error={fieldErrors.bankAccountLabel}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">
          Template Chart of Account
        </legend>
        {(
          [
            ["konstruksi", "Jasa Konstruksi & Kontraktor"],
            ["konsultan", "Jasa Konsultan & Agensi"],
            ["kosong", "Mulai dari COA kosong"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="coaTemplate"
              checked={coaTemplate === value}
              onChange={() => setCoaTemplate(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <Button
        type="submit"
        variant="primary"
        emojiChar={emoji.simpan}
        disabled={pending}
      >
        {pending ? "Menyimpan..." : "Simpan Perusahaan"}
      </Button>
    </form>
  );
}
