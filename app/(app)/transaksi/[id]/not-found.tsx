import Link from "next/link";

export default function TransaksiNotFound() {
  return (
    <div className="rounded-xl border border-mist-300 bg-mint p-8 text-center">
      <p className="font-hand text-[22px] text-ink-muted">
        Jurnal tidak ditemukan
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Nomor ini tidak ada di perusahaan aktif Anda.
      </p>
      <p className="mt-3">
        <Link href="/transaksi" className="text-sm text-teal-600 hover:underline">
          Kembali ke daftar transaksi
        </Link>
      </p>
    </div>
  );
}
