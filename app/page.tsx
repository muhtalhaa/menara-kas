import Link from "next/link";
import { BrandMark, Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-teal-500 px-6 py-4">
        <BrandMark />
      </header>
      <section className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-16">
        <p className="font-hand text-[20px] font-semibold text-teal-600">
          Akuntansi project based
        </p>
        <h1 className="text-3xl font-bold text-ink">Menara Kas</h1>
        <p className="text-ink-muted">
          Satu pembukuan, dua sudut pandang: laporan perusahaan yang sah untuk
          pajak, dan arus kas serta margin per project.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/masuk">
            <Button variant="primary" emojiChar={emoji.posting}>
              Masuk
            </Button>
          </Link>
          <Link href="/daftar">
            <Button variant="outline" emojiChar={emoji.tambah}>
              Daftar
            </Button>
          </Link>
        </div>
        <div className="rounded-xl border border-mist-300 bg-mint p-5 text-sm text-ink-muted">
          <Emoji>{emoji.peringatan}</Emoji>
          Pastikan PostgreSQL berjalan lalu jalankan{" "}
          <code className="text-ink">npm run db:migrate</code> sebelum daftar.
        </div>
      </section>
    </main>
  );
}
