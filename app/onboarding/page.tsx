import { BrandMark } from "@/components/ui/emoji";
import { OnboardingForm } from "./onboarding-form";
import { getUserIdFromCookie } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const userId = await getUserIdFromCookie();
  if (!userId) redirect("/masuk");

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-teal-500 px-6 py-4">
        <BrandMark />
      </header>
      <section className="mx-auto max-w-lg px-6 py-12">
        <p className="font-hand text-[20px] font-semibold text-teal-600">
          Siapkan perusahaan Anda
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ink">Onboarding</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Isi profil perusahaan. Kode perusahaan akan dipakai pada nomor
          Quotation, Invoice, Berita Acara, dan Kwitansi.
        </p>
        <div className="mt-6">
          <OnboardingForm />
        </div>
      </section>
    </main>
  );
}
