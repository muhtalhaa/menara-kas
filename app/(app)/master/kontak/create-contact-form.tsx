"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { createContactAction } from "@/app/(app)/master/actions";

export function CreateContactForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="grid max-w-3xl gap-3 rounded-xl border border-mist-300 p-4 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await createContactAction({
            name: String(form.get("name") ?? ""),
            code: String(form.get("code") ?? "") || undefined,
            isCustomer: form.get("isCustomer") === "on",
            isVendor: form.get("isVendor") === "on",
          });
          if (!result.ok) {
            setMessage(result.message);
            return;
          }
          setMessage(null);
          event.currentTarget.reset();
          router.refresh();
        });
      }}
    >
      {message ? (
        <div className="md:col-span-4">
          <Notice message={message} tone="error" />
        </div>
      ) : null}
      <TextField label="Nama" name="name" required />
      <TextField label="Kode" name="code" />
      <label className="flex items-end gap-4 pb-2 text-sm">
        <span className="inline-flex items-center gap-1">
          <input type="checkbox" name="isCustomer" defaultChecked /> Pelanggan
        </span>
        <span className="inline-flex items-center gap-1">
          <input type="checkbox" name="isVendor" /> Vendor
        </span>
      </label>
      <div className="flex items-end">
        <Button
          type="submit"
          variant="primary"
          emojiChar={emoji.tambah}
          disabled={pending}
        >
          {pending ? "Menyimpan..." : "Tambah Kontak"}
        </Button>
      </div>
    </form>
  );
}
