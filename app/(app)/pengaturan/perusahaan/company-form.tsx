"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { updateOrgProfileAction } from "@/app/(auth)/actions";

type Props = {
  initial: {
    name: string;
    companyCode: string;
    npwp: string;
    address: string;
    phone: string;
    email: string;
    bankAccountLabel: string;
  };
};

export function CompanySettingsForm({ initial }: Props) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"error" | "success">("error");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await updateOrgProfileAction({
            name: String(form.get("name") ?? ""),
            companyCode: String(form.get("companyCode") ?? ""),
            npwp: String(form.get("npwp") ?? "") || undefined,
            address: String(form.get("address") ?? "") || undefined,
            phone: String(form.get("phone") ?? "") || undefined,
            email: String(form.get("email") ?? "") || undefined,
            bankAccountLabel:
              String(form.get("bankAccountLabel") ?? "") || undefined,
          });
          if (!result.ok) {
            setTone("error");
            setMessage(result.message);
            setFieldErrors(result.fieldErrors ?? {});
            return;
          }
          setTone("success");
          setMessage("Profil perusahaan sudah disimpan.");
          setFieldErrors({});
        });
      }}
    >
      {message ? <Notice message={message} tone={tone} /> : null}
      <TextField
        label="Nama perusahaan"
        name="name"
        required
        defaultValue={initial.name}
        error={fieldErrors.name}
      />
      <TextField
        label="Kode perusahaan"
        name="companyCode"
        required
        defaultValue={initial.companyCode}
        error={fieldErrors.companyCode}
      />
      <TextField
        label="NPWP"
        name="npwp"
        defaultValue={initial.npwp}
        error={fieldErrors.npwp}
      />
      <TextField
        label="Alamat"
        name="address"
        defaultValue={initial.address}
        error={fieldErrors.address}
      />
      <TextField
        label="Telepon"
        name="phone"
        defaultValue={initial.phone}
        error={fieldErrors.phone}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        defaultValue={initial.email}
        error={fieldErrors.email}
      />
      <TextField
        label="Rekening bank default"
        name="bankAccountLabel"
        defaultValue={initial.bankAccountLabel}
        error={fieldErrors.bankAccountLabel}
      />
      <Button
        type="submit"
        variant="primary"
        emojiChar={emoji.simpan}
        disabled={pending}
      >
        {pending ? "Menyimpan..." : "Simpan Profil"}
      </Button>
    </form>
  );
}
