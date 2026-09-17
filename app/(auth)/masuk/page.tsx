import Link from "next/link";
import { BrandMark } from "@/components/ui/emoji";
import { LoginForm } from "./login-form";

export default function MasukPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-teal-500 px-6 py-4">
        <BrandMark />
      </header>
      <section className="mx-auto max-w-md px-6 py-12">
        <p className="font-hand text-[20px] font-semibold text-teal-600">
          Selamat datang kembali
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink">Masuk</h1>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Belum punya akun?{" "}
          <Link href="/daftar" className="font-semibold text-teal-600">
            Daftar
          </Link>
        </p>
      </section>
    </main>
  );
}
