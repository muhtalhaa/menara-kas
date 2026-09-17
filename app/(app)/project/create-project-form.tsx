"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { createProjectAction } from "@/app/(app)/master/actions";

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="grid max-w-3xl gap-3 rounded-xl border border-mist-300 p-4 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await createProjectAction({
            code: String(form.get("code") ?? ""),
            name: String(form.get("name") ?? ""),
            contractValue: String(form.get("contractValue") ?? "") || undefined,
          });
          if (!result.ok) {
            setMessage(result.message);
            setFieldErrors(result.fieldErrors ?? {});
            return;
          }
          setMessage(null);
          setFieldErrors({});
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
      <TextField
        label="Kode"
        name="code"
        required
        placeholder="PRJ-001"
        error={fieldErrors.code}
      />
      <TextField
        label="Nama"
        name="name"
        required
        error={fieldErrors.name}
      />
      <TextField
        label="Nilai kontrak"
        name="contractValue"
        placeholder="500000000"
        error={fieldErrors.contractValue}
      />
      <div className="flex items-end">
        <Button
          type="submit"
          variant="primary"
          emojiChar={emoji.tambah}
          disabled={pending}
        >
          {pending ? "Menyimpan..." : "Tambah Project"}
        </Button>
      </div>
    </form>
  );
}
