"use client";

import { useState } from "react";
import { Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";

type NoticeProps = {
  tone?: "error" | "success" | "attention";
  message: string;
  dismissible?: boolean;
};

const toneClass = {
  error: "border-deficit bg-deficit-bg text-deficit",
  success: "border-surplus bg-surplus-bg text-surplus",
  attention: "border-attention bg-attention-bg text-attention",
};

export function Notice({
  tone = "error",
  message,
  dismissible = true,
}: NoticeProps) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${toneClass[tone]}`}
    >
      <p>
        <Emoji>
          {tone === "success"
            ? emoji.posting
            : tone === "attention"
              ? emoji.peringatan
              : emoji.batal}
        </Emoji>
        {message}
      </p>
      {dismissible ? (
        <button
          type="button"
          className="font-semibold"
          onClick={() => setOpen(false)}
          aria-label="Tutup pemberitahuan"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
