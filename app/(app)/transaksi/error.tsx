"use client";

import { Notice } from "@/components/ui/notice";
import { Button } from "@/components/ui/button";
import { emoji } from "@/lib/ui/emoji";

export default function TransaksiError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="space-y-3">
      <Notice
        tone="error"
        dismissible={false}
        message={
          error.message ||
          "Daftar transaksi gagal dimuat. Periksa koneksi lalu coba lagi."
        }
      />
      <Button variant="outline" emojiChar={emoji.muat} onClick={reset}>
        Coba lagi
      </Button>
    </div>
  );
}
