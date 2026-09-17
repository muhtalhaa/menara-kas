import Link from "next/link";
import { BrandMark, Emoji } from "@/components/ui/emoji";
import { emoji } from "@/lib/ui/emoji";
import { logoutAction } from "@/app/(auth)/actions";
import type { AppSession } from "@/lib/server/auth";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: emoji.dashboard },
  { href: "/transaksi", label: "Transaksi", icon: emoji.transaksi },
  { href: "/invoice", label: "Invoice", icon: emoji.kasMasuk },
  { href: "/tagihan", label: "Tagihan", icon: emoji.kasKeluar },
  { href: "/dokumen", label: "Dokumen", icon: emoji.cetak },
  { href: "/project", label: "Project", icon: emoji.project },
  { href: "/master/akun", label: "Chart of Account", icon: emoji.coa },
  { href: "/master/kontak", label: "Kontak", icon: emoji.kontak },
  { href: "/periode", label: "Periode", icon: emoji.periode },
  { href: "/pengaturan/perusahaan", label: "Pengaturan", icon: emoji.pengaturan },
] as const;

type AppShellProps = {
  session: AppSession;
  children: React.ReactNode;
  periodLabel: string;
};

export function AppShell({ session, children, periodLabel }: AppShellProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-14 items-center justify-between bg-teal-500 px-4 text-white">
        <BrandMark />
        <div className="flex items-center gap-4 text-sm">
          <span>
            <Emoji>{emoji.perusahaan}</Emoji>
            {session.orgName}
          </span>
          <span className="font-hand text-[18px] text-mint">{periodLabel}</span>
          <span>
            <Emoji>{emoji.profil}</Emoji>
            {session.user.name}
          </span>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-56px)]">
        <aside className="w-60 shrink-0 bg-teal-700 px-3 py-4 text-white">
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-lg px-3 py-2 text-sm hover:bg-teal-500"
              >
                <Emoji>{item.icon}</Emoji>
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction} className="mt-8 px-3">
            <button
              type="submit"
              className="flex w-full items-center rounded-lg px-0 py-2 text-left text-sm text-mint hover:text-white"
            >
              <Emoji>{emoji.keluar}</Emoji>
              Keluar
            </button>
          </form>
        </aside>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
