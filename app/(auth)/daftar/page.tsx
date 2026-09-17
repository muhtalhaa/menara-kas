import Link from "next/link";
import { BrandMark } from "@/components/ui/emoji";
import { RegisterForm } from "./register-form";

export default function DaftarPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-teal-500 px-6 py-4">
        <BrandMark />
      </header>
      <section className="mx-auto max-w-md px-6 py-12">
        <p className="font-hand text-[20px] font-semibold text-teal-600">
          Mulai pembukuan rapi
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink">Daftar</h1>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Sudah punya akun?{" "}
          <Link href="/masuk" className="font-semibold text-teal-600">
            Masuk
          </Link>
        </p>
      </section>
    </main>
  );
}
