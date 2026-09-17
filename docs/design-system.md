# Design System — Menara Kas

Dokumen ini adalah sumber kebenaran tampilan. Warna, huruf, dan emoji yang tidak ada di sini tidak boleh dipakai.

---

## 1. Prinsip desain

1. **Angka adalah bintang utama.** Segala hal lain adalah pendukung. Tidak ada dekorasi yang mengurangi keterbacaan kolom rupiah.
2. **Teal untuk struktur, mint untuk sorotan lembut.** Dark teal adalah warna merek. Mint dipakai untuk latar lembut, sorot baris, dan aksen sekunder — bukan untuk teks.
3. **Hitam untuk teks, putih untuk permukaan.** Teks utama dan seluruh angka berwarna hitam. Latar halaman dan kartu berwarna putih. Tidak ada teks putih di atas mint.
4. **Handwriting adalah bumbu, bukan bahan utama.** Huruf tulisan tangan memberi kesan personal pada label penting, tetapi tidak pernah menyentuh angka atau isi tabel.
5. **Emoji menggantikan ikon.** Emoji gaya WhatsApp membuat antarmuka akuntansi terasa akrab bagi pengguna yang takut pembukuan. Emoji selalu berdampingan dengan teks, tidak pernah berdiri sendiri sebagai satu-satunya penanda makna.
6. **Padat, bukan lapang.** Pengguna finance menatap ratusan baris. Kepadatan tabel diutamakan di atas ruang kosong yang estetis.

---

## 2. Warna

### 2.1 Palet dasar

| Nama | Hex | Peran |
|---|---|---|
| Putih | `#FFFFFF` | Latar halaman, permukaan kartu, tabel, formulir |
| Mint | `#E1F7F4` | Latar lembut, sorot baris, sidebar soft, keadaan sekunder |
| Dark Teal | `#018081` | Warna merek, sidebar, header, judul, tombol primer, tautan |
| Hitam | `#0B0B0F` | Teks utama dan seluruh angka |

### 2.2 Skala turunan

Skala dibuat dari dark teal dan mint. Tidak boleh ada warna di luar daftar ini.

```css
/* Dark Teal */
--teal-50:  #E1F7F4; /* sama dengan mint merek */
--teal-100: #C5EFEB;
--teal-200: #9ADFD9;
--teal-300: #5FC4BE;
--teal-400: #2AA3A0;
--teal-500: #018081; /* merek */
--teal-600: #016B6C;
--teal-700: #015556;
--teal-800: #014041;
--teal-900: #012B2C;

/* Mint / netral lembut */
--mint:     #E1F7F4;
--mist-50:  #F7FBFB;
--mist-100: #F0F7F6;
--white: #E1F7F4; /* mint merek sebagai latar soft */
--mist-300: #C9DEDC;
--mist-400: #A3BDBA;
--mist-500: #6F8A87;
--mist-600: #4A6360;

/* Putih dan Ink */
--white:      #FFFFFF;
--ink:        #0B0B0F;
--ink-muted:  #4A4954;
--ink-subtle: #6F6D7A;
```

### 2.3 Warna status keuangan

Hanya tiga, dan hanya untuk angka serta lencana status. Tidak untuk latar halaman.

```css
--surplus:     #0E7A56; /* saldo positif, lunas, laba */
--surplus-bg:  #E6F4EF;
--deficit:     #B4232F; /* saldo negatif, jatuh tempo, rugi */
--deficit-bg:  #FBEAEB;
--attention:   #8A5A00; /* peringatan, draft, perlu ditindak */
--attention-bg:#FFF6E5;
```

### 2.4 Token semantik

Komponen memakai token semantik, bukan warna mentah.

```css
/* Permukaan */
--surface:            var(--white);
--surface-sunken:     var(--mist-100);
--surface-page:       var(--white);
--surface-brand:      var(--teal-500);
--surface-brand-soft: var(--mint);
--surface-accent:     var(--teal-500);

/* Teks */
--text:           var(--ink);
--text-muted:     var(--ink-muted);
--text-subtle:    var(--ink-subtle);
--text-on-brand:  var(--white);
--text-on-accent: var(--white);
--text-link:      var(--teal-600);

/* Garis */
--border:        var(--mist-300);
--border-strong: var(--mist-400);
--border-brand:  var(--teal-500);

/* Fokus */
--focus-ring: var(--teal-400);
```

### 2.5 Aturan kontras

| Kombinasi | Boleh dipakai untuk |
|---|---|
| Hitam di atas Putih | Semua teks dan angka |
| Putih di atas Dark Teal `#018081` | Sidebar, header, tombol primer |
| Hitam di atas Mint `#E1F7F4` | Teks di atas sorot/latar lembut |
| Dark Teal di atas Putih | Judul, tautan, ikon teks |
| Dark Teal di atas Mint | Label aksen, eyebrow |
| Mint sebagai warna teks | **Dilarang.** Kontrasnya terlalu lemah |

Aturan tak boleh dilanggar: mint tidak pernah menjadi warna teks; hitam tetap warna dasar seluruh teks isi.

### 2.6 Yang dilarang

- Gradien, kecuali satu gradien halus teal-500 ke teal-700 pada header sidebar.
- Bayangan besar dan berlapis. Maksimal `0 1px 2px rgba(11,11,15,0.06)` untuk kartu dan `0 8px 24px rgba(11,11,15,0.12)` untuk dialog.
- Warna di luar skala di dokumen ini, termasuk navy/kuning lama dan warna bawaan Tailwind seperti `blue-500` atau `slate-700`.
- Latar halaman berwarna selain putih pada halaman kerja. Dark teal penuh hanya untuk sidebar dan header.

---

## 3. Tipografi

### 3.1 Dua keluarga huruf

| Peran | Keluarga | Sumber | Dipakai untuk |
|---|---|---|---|
| Utama | **Plus Jakarta Sans** | `next/font/google` | Seluruh teks, label formulir, isi tabel, dan semua angka |
| Aksen | **Caveat** | `next/font/google` | Label penting bergaya tulisan tangan |

Cadangan sistem: `ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif` untuk utama, dan `"Segoe Script", cursive` untuk aksen.

```ts
// app/fonts.ts
import { Plus_Jakarta_Sans, Caveat } from "next/font/google";

export const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const hand = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-hand",
  display: "swap",
});
```

### 3.2 Skala huruf utama

| Token | Ukuran / tinggi baris | Bobot | Dipakai untuk |
|---|---|---|---|
| `display` | 32 / 38 px | 700 | Angka besar di kartu KPI |
| `h1` | 24 / 32 px | 700 | Judul halaman |
| `h2` | 19 / 26 px | 700 | Judul kartu dan seksi |
| `h3` | 16 / 22 px | 600 | Sub seksi, judul kelompok laporan |
| `body` | 14 / 21 px | 400 | Teks umum |
| `body-strong` | 14 / 21 px | 600 | Label formulir, total baris |
| `table` | 13 / 18 px | 400 | Isi tabel dan laporan |
| `caption` | 12 / 16 px | 400 | Keterangan, catatan kaki laporan |
| `micro` | 11 / 14 px | 600 | Lencana, huruf kapital kecil |

Seluruh teks pada skala ini berwarna `--text` kecuali dinyatakan lain.

### 3.3 Angka

Aturan yang wajib diikuti setiap kali menampilkan uang:

```css
.num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  text-align: right;
  white-space: nowrap;
}
```

- Semua angka rata kanan, termasuk di kepala kolom.
- Nol ditampilkan `-` berwarna `--text-subtle`.
- Negatif dalam tanda kurung dan berwarna `--deficit`, contoh `(1.250.000)`.
- Format ribuan titik, desimal koma. Tampilan ringkas tanpa desimal, laporan detail dua desimal.
- Angka tidak pernah memakai huruf tulisan tangan.

### 3.4 Huruf tulisan tangan: daftar pemakaian tertutup

Caveat hanya boleh muncul pada sembilan tempat berikut. Di luar daftar ini, pemakaian Caveat dianggap cacat dan harus ditolak saat review.

| Tempat | Contoh teks | Ukuran |
|---|---|---|
| Eyebrow di atas judul halaman | `Ringkasan bulan ini` | 20 px, 600, `--teal-600` |
| Keterangan kartu KPI | `uang yang benar-benar ada` | 18 px, 500, `--ink-muted` |
| Sapaan di dashboard | `Selamat pagi, Bu Ratna` | 28 px, 700, `--teal-500` |
| Label periode aktif | `Periode Sep 2026` | 20 px, 600, `--teal-500` |
| Judul paket laporan | `Paket Laporan Bulanan` | 26 px, 700, `--teal-500` |
| Catatan pada keadaan kosong | `Belum ada transaksi di sini` | 22 px, 600, `--ink-muted` |
| Catatan kaki penjelas laporan | `beban operasional tidak dibagi ke project` | 17 px, 500, `--ink-muted` |
| Judul seksi laporan cetak | `Laba Rugi per Project` | 24 px, 700, `--teal-500` |
| Pesan sukses setelah aksi besar | `Buku bulan ini sudah rapi` | 20 px, 600, `--surplus` |

Aturan tambahan:
- Maksimal satu baris. Jika teks berpotensi lebih dari satu baris pada lebar 320 px, gunakan huruf utama.
- Caveat berukuran optik lebih kecil dari Plus Jakarta Sans pada nilai `px` yang sama, karena itu ukuran di tabel ini sudah dinaikkan 4 sampai 6 px. Jangan menurunkannya.
- Caveat tidak boleh dipakai pada label formulir, tombol, isi tabel, angka, pesan kesalahan, dan teks yang harus dibaca cepat.
- Tambahkan `letter-spacing: 0.01em` pada Caveat agar tidak terlihat rapat.

```tsx
// Contoh pasangan handwriting dan angka pada kartu KPI
<article className="rounded-xl border border-[--border] bg-[--surface] p-5">
  <p className="font-hand text-[18px] text-[--text-muted]">uang yang benar-benar ada</p>
  <h2 className="text-[14px] font-semibold">💰 Saldo Kas &amp; Bank</h2>
  <p className="num mt-1 text-[32px] font-bold">1.482.300.500</p>
</article>
```

---

## 4. Emoji

### 4.1 Aturan pemakaian

1. Emoji ditulis sebagai karakter Unicode di dalam JSX, bukan berkas gambar, bukan pustaka ikon. Ini yang membuat tampilannya mengikuti emoji WhatsApp di Android dan emoji sistem di perangkat lain.
2. Emoji selalu berpasangan dengan teks. Tombol yang hanya berisi emoji dilarang, kecuali tombol ikon di dalam baris tabel yang wajib punya `aria-label`.
3. Emoji dibungkus `<span aria-hidden="true">` agar pembaca layar tidak membacakan namanya.
4. Emoji diletakkan sebelum teks, dipisahkan satu spasi tipis.
5. Satu makna memakai satu emoji, selamanya. Kamus di bawah bersifat mengikat.
6. Emoji tidak dipakai di dalam sel angka, di isi tabel laporan, dan di dokumen PDF hasil ekspor, kecuali pada judul seksi.

```tsx
// Satu-satunya cara menulis emoji di UI
export function Emoji({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="mr-1.5 inline-block leading-none">
      {children}
    </span>
  );
}

// Pemakaian
<Button variant="primary"><Emoji>💾</Emoji>Simpan Transaksi</Button>
```

### 4.2 Kamus emoji: navigasi

| Emoji | Menu |
|---|---|
| 🏠 | Dashboard |
| 🧾 | Transaksi |
| 📊 | Laporan |
| 🏗️ | Project |
| 🗃️ | Master Data |
| 🔢 | Chart of Account |
| 👥 | Kontak |
| 💰 | Kas & Bank |
| 🧰 | Aset Tetap |
| 🏷️ | Kode Pajak |
| 🗓️ | Periode & Tutup Buku |
| 🕵️ | Jejak Audit |
| 🏢 | Perusahaan |
| 👤 | Profil Saya |
| ⚙️ | Pengaturan |
| 🚪 | Keluar |

### 4.3 Kamus emoji: aksi dan tombol

| Emoji | Aksi |
|---|---|
| ➕ | Tambah, Buat Baru |
| 💾 | Simpan |
| ✅ | Posting, Setujui |
| ✏️ | Ubah |
| 🗑️ | Hapus |
| 📋 | Duplikat |
| ↩️ | Batalkan dengan Jurnal Balik |
| ✂️ | Pecah ke Beberapa Project |
| 🔍 | Cari |
| 👁️ | Lihat Detail |
| 📥 | Impor Excel |
| 📤 | Ekspor Excel |
| 🖨️ | Cetak PDF |
| ⬇️ | Unduh |
| 📎 | Lampiran |
| ✉️ | Kirim Invoice |
| 🔄 | Muat Ulang |
| 🔒 | Kunci Periode |
| 🔓 | Buka Periode |
| 📦 | Buat Paket Laporan |
| ❌ | Batal, Tutup |

### 4.4 Kamus emoji: status dan lencana

| Emoji | Status | Warna lencana |
|---|---|---|
| ⏳ | Draft | `--attention` di atas `--attention-bg` |
| ✅ | Terposting | `--surplus` di atas `--surplus-bg` |
| 🔒 | Terkunci | `--mist-600` di atas `--mist-100` |
| 🚫 | Dibatalkan | `--mist-600` di atas `--mist-100` |
| 🟢 | Lunas | `--surplus` di atas `--surplus-bg` |
| 🟡 | Dibayar Sebagian | `--attention` di atas `--attention-bg` |
| 🔴 | Jatuh Tempo | `--deficit` di atas `--deficit-bg` |
| ⚠️ | Perlu Perhatian | `--attention` di atas `--attention-bg` |
| 📌 | Wajib Project | `--teal-500` di atas `--mint` |
| 🆕 | Hasil Impor | `--teal-500` di atas `--mint` |

### 4.5 Kamus emoji: jenis transaksi

| Emoji | Jenis |
|---|---|
| 💵 | Kas Masuk |
| 💸 | Kas Keluar |
| 🔁 | Transfer Kas & Bank |
| 🧾 | Invoice Penjualan |
| 🛒 | Tagihan Pembelian |
| 🤝 | Terima Pembayaran |
| 🏦 | Bayar Tagihan |
| 📔 | Jurnal Umum |
| 🧮 | Jurnal Penyesuaian |
| 📉 | Posting Depresiasi |

### 4.6 Kamus emoji: laporan

| Emoji | Laporan |
|---|---|
| 📔 | Jurnal |
| 📖 | Buku Besar |
| ⚖️ | Neraca Saldo |
| 💹 | Laba Rugi |
| 🏛️ | Neraca |
| 🪙 | Perubahan Modal |
| 🌊 | Arus Kas |
| 📗 | Piutang Usaha |
| 📕 | Hutang Usaha |
| 🏗️ | Laporan Project |
| 🧾 | Rekap PPN |
| 🏷️ | Rekap PPh Dipotong |
| 🧰 | Daftar Aset & Depresiasi |
| 📦 | Paket Laporan Bulanan & Tahunan |

Kamus ini diterjemahkan menjadi satu berkas konstanta `lib/ui/emoji.ts`. Menuliskan emoji secara langsung di komponen dilarang; ambil dari konstanta agar tidak ada makna ganda.

---

## 5. Komponen

### 5.1 Tombol

| Varian | Latar | Teks | Garis | Pemakaian |
|---|---|---|---|---|
| `primary` | `--teal-500` | putih | tidak ada | Aksi utama layar. Satu per layar. Contoh `💾 Simpan Transaksi` |
| `brand` | `--teal-700` | putih | tidak ada | Aksi penting kedua. Contoh `✅ Posting` |
| `outline` | putih | `--teal-500` | `--border-strong` | Aksi netral. Contoh `📤 Ekspor Excel` |
| `ghost` | transparan | `--ink-muted` | tidak ada | Aksi di dalam baris tabel |
| `danger` | putih | `--deficit` | `--deficit` | Hapus, batalkan |

Spesifikasi:
- Tinggi 38 px untuk ukuran normal, 32 px untuk ukuran kecil di tabel, 44 px untuk aksi utama di ponsel.
- Radius 8 px. Tidak ada tombol berbentuk pil.
- Sorot `primary`: latar `--teal-400`. Tekan: `--teal-600`.
- Fokus keyboard: `outline: 2px solid var(--focus-ring); outline-offset: 2px`. Cincin fokus tidak boleh dihilangkan.
- Nonaktif: latar `--mist-100`, teks `--mist-500`, kursor `not-allowed`. Tombol nonaktif wajib punya penjelasan lewat `title` atau teks pendamping, misalnya `Periode sudah terkunci`.
- Tombol yang memicu proses menampilkan teks berubah, contoh `💾 Menyimpan...`, dan tidak bisa ditekan dua kali.

### 5.2 Kartu

Latar putih, garis `--border` 1 px, radius 12 px, isi 20 px, bayangan halus. Judul kartu memakai `h2` plus emoji. Kartu KPI boleh punya garis atas 3 px berwarna `--teal-500` untuk satu kartu terpenting saja.

### 5.3 Tabel dan tabel laporan

Tabel adalah komponen terpenting di aplikasi ini.

- Kepala tabel: latar `--mist-100`, teks `micro` huruf kapital, `--ink-muted`, menempel saat digulir.
- Baris: tinggi 40 px pada mode normal, 32 px pada mode padat. Mode padat tersimpan sebagai preferensi pengguna.
- Garis horizontal `--mist-300` 1 px. Tidak ada garis vertikal, kecuali satu garis sebelum kolom total.
- Baris bergaris genap dilarang. Garis horizontal sudah cukup dan lebih bersih untuk angka.
- Sorot baris: latar `--mint`.
- Kolom uang rata kanan dengan kelas `.num`.
- Baris total: latar `--mist-100`, teks 600, garis atas 2 px `--teal-500`.
- Baris kelompok pada laporan, misalnya `Beban Pokok Project`, memakai teks 600 dan latar `--surface-sunken`.
- Tabel laporan menampilkan nomor akun dalam kolom terpisah berhuruf `font-variant-numeric: tabular-nums`, tidak digabung dengan nama akun.
- Kolom kiri pertama menempel saat digulir horizontal pada laporan lebar.

### 5.4 Formulir

- Label di atas medan isian, `body-strong`, hitam.
- Medan isian tinggi 38 px, radius 8 px, garis `--border`, latar putih. Fokus: garis `--teal-400` plus cincin fokus.
- Medan uang rata kanan, memformat ribuan saat pengguna berhenti mengetik, dan menerima tempel dari Excel.
- Pemilih akun berupa pencarian yang mencari sekaligus nomor dan nama akun, menampilkan `5-1100 · Biaya Material`, dan mengelompokkan hasil menurut golongan akun.
- Pemilih project menampilkan `PRJ-001 · Renovasi Kantor BCA Sudirman` beserta lencana status.
- Pesan kesalahan di bawah medan isian, warna `--deficit`, ukuran `caption`, selalu menyebut cara memperbaiki. Contoh: `Jurnal belum seimbang. Selisih 250.000 di sisi kredit.`
- Baris jurnal pada formulir transaksi berbentuk tabel yang bisa dinavigasi dengan `Tab`, `Enter` menambah baris baru, dan menampilkan total debit, total kredit, serta selisih secara langsung di kaki tabel.

### 5.5 Lencana

Tinggi 22 px, radius 6 px, isi horizontal 8 px, teks `micro`, emoji di depan. Warna mengikuti tabel di bagian 4.4.

### 5.6 Keadaan kosong

Struktur tetap: emoji besar 40 px, satu baris Caveat, satu baris penjelasan huruf utama, satu tombol aksi.

```
            🏗️
   Belum ada project di sini        <- Caveat 22px
   Tambahkan project agar biaya
   dan penerimaan bisa dipantau     <- body, --text-muted
       [ ➕ Tambah Project ]        <- primary
```

### 5.7 Dialog dan konfirmasi

- Lebar maksimal 520 px, radius 12 px.
- Aksi merusak memakai konfirmasi yang meminta pengguna mengetik ulang nilai, misalnya nomor transaksi atau tahun buku. Tidak cukup tombol "Ya".
- Tombol utama di kanan, tombol batal di kiri.

### 5.8 Notifikasi

Muncul di kanan atas, hilang setelah 5 detik, selalu memuat emoji dan kalimat yang menyebut objeknya. Contoh: `✅ Transaksi KM-2026-0042 sudah diposting.` Pesan kesalahan tidak hilang otomatis dan menyediakan aksi coba lagi.

---

## 6. Tata letak

### 6.1 Kerangka aplikasi

```
┌──────────────────────────────────────────────────────────────────────┐
│ teal-500                                                             │
│  Menara Kas    [🏢 PT Karya Abadi ▾]   [🗓️ Periode Sep 2026]  [👤]  │  56px
├───────────────┬──────────────────────────────────────────────────────┤
│ teal-700      │  white                                            │
│ 🏠 Dashboard  │   Ringkasan bulan ini            <- Caveat eyebrow   │
│ 🧾 Transaksi  │   Dashboard                      <- h1 hitam         │
│ 🏗️ Project    │  ┌──────────┬──────────┬──────────┬──────────┐       │
│ 📊 Laporan    │  │ 💰 Kas    │ 📗 Piutang│ 📕 Utang │ 💹 Laba  │       │
│ 🗃️ Master     │  └──────────┴──────────┴──────────┴──────────┘       │
│ 🗓️ Periode    │  ┌──────────────────────────┬───────────────────┐    │
│ ⚙️ Pengaturan │  │ Grafik arus kas 6 bulan   │ ⚠️ Perlu Ditindak │    │
│               │  └──────────────────────────┴───────────────────┘    │
│ 🚪 Keluar     │  ┌──────────────────────────────────────────────┐    │
│               │  │ 🏗️ Project Perlu Perhatian                   │    │
│  240px        │  └──────────────────────────────────────────────┘    │
└───────────────┴──────────────────────────────────────────────────────┘
```

- Sidebar 240 px, latar `--teal-700`, menu aktif diberi latar `--teal-500` dan garis kiri 3 px `--teal-500`.
- Header 56 px, latar `--teal-500`. Pemilih perusahaan dan pemilih periode selalu terlihat karena keduanya mengubah arti seluruh angka di layar.
- Isi halaman berlatar `--surface-page` dengan isi 24 px, lebar maksimal 1440 px.
- Di bawah 1024 px, sidebar menjadi menu geser dan bilah bawah menampilkan lima menu utama.

### 6.2 Kerangka halaman laporan

```
Laporan Keuangan                                    <- Caveat eyebrow
💹 Laba Rugi                                        <- h1
┌──────────────────────────────────────────────────────────────────┐
│ [🗓️ Sep 2026 ▾] [🏗️ Semua Project ▾] [Bandingkan ▾]             │
│                              [📤 Ekspor Excel] [🖨️ Cetak PDF]    │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ PT Karya Abadi · Laba Rugi · 1 - 30 Sep 2026                     │
├──────────┬───────────────────────────┬─────────────┬─────────────┤
│ No. Akun │ Nama Akun                 │  Sep 2026   │  Ags 2026   │
├──────────┴───────────────────────────┴─────────────┴─────────────┤
│ Pendapatan                                                       │
│ 4-1100     Pendapatan Jasa Konstruksi   450.000.000  380.000.000 │
│            Total Pendapatan             450.000.000  380.000.000 │
│ ...                                                              │
├──────────────────────────────────────────────────────────────────┤
│            Laba Bersih                  112.500.000   (8.400.000)│
└──────────────────────────────────────────────────────────────────┘
 beban operasional tidak dibagi ke project     <- Caveat, catatan kaki
```

Kepala dokumen di dalam kartu laporan wajib ada karena bagian inilah yang terbawa ke PDF.

### 6.3 Kerangka formulir transaksi

```
Transaksi Baru                                      <- Caveat eyebrow
💸 Kas Keluar                                       <- h1

┌─ Informasi ──────────────────────────────────────────────────────┐
│ Tanggal [ 17 Sep 2026 ]   No. Transaksi [ KK-2026-0113 ]         │
│ Bayar Dari [ 💰 1-1200 Bank BCA ▾ ]  Kontak [ 👥 Toko Maju ▾ ]   │
│ Keterangan [ Pembelian material lantai 3                      ]  │
└──────────────────────────────────────────────────────────────────┘
┌─ Rincian ────────────────────────────────────────────────────────┐
│ No.Akun     Nama Akun         🏗️ Project       Nominal           │
│ 5-1100      Biaya Material    PRJ-001          30.000.000  [🗑️]  │
│ 5-1100      Biaya Material    PRJ-002          20.000.000  [🗑️]  │
│ [ ➕ Tambah Baris ]  [ ✂️ Pecah ke Beberapa Project ]            │
├──────────────────────────────────────────────────────────────────┤
│ Total Debit 50.000.000   Total Kredit 50.000.000   Selisih  -    │
└──────────────────────────────────────────────────────────────────┘
┌─ Lampiran ───────────────────────────────────────────────────────┐
│ [ 📎 Tambah Lampiran ]   nota-material-lt3.pdf                   │
└──────────────────────────────────────────────────────────────────┘

[ ❌ Batal ]                      [ 💾 Simpan Draft ] [ ✅ Posting ]
```

Kaki tabel rincian yang menampilkan selisih harus selalu terlihat. Ini penanda kesehatan jurnal yang paling dibutuhkan saat input.

---

## 7. Ruang, radius, gerak

| Token | Nilai |
|---|---|
| Kisi ruang | 4 px. Nilai yang dipakai: 4, 8, 12, 16, 20, 24, 32, 40 |
| Radius kecil | 6 px (lencana, medan isian kecil) |
| Radius normal | 8 px (tombol, medan isian) |
| Radius kartu | 12 px |
| Durasi transisi | 120 ms untuk sorot, 180 ms untuk dialog |
| Kurva | `cubic-bezier(0.2, 0, 0, 1)` |

Gerak hanya untuk perubahan keadaan. Tidak ada animasi masuk pada tabel, kartu, atau angka. Hormati `prefers-reduced-motion` dengan mematikan seluruh transisi.

---

## 8. Konfigurasi Tailwind v4

Seluruh token didaftarkan sekali di `app/globals.css`, sehingga komponen memakai kelas seperti `bg-surface`, `text-ink`, `border-default`.

```css
@import "tailwindcss";

@theme {
  --color-teal-50:  #E1F7F4;
  --color-teal-500: #018081;
  --color-teal-700: #015556;
  --color-mint:     #E1F7F4;
  --color-white:    #FFFFFF;
  --color-ink:      #0B0B0F;
  --color-surplus:  #0E7A56;
  --color-deficit:  #B4232F;
  --color-attention:#8A5A00;

  --font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --font-hand: var(--font-hand), "Segoe Script", cursive;

  --radius-card: 0.75rem;
}
```

Daftar di atas dipotong untuk keterbacaan. Berkas sebenarnya memuat seluruh skala dari bagian 2.2 sampai 2.4.

---

## 9. Daftar periksa review tampilan

Setiap pull request yang menyentuh UI harus lulus seluruh butir ini.

- [ ] Tidak ada warna di luar skala dokumen ini, termasuk navy/kuning lama dan warna bawaan Tailwind.
- [ ] Mint tidak dipakai sebagai warna teks.
- [ ] Latar halaman kerja berwarna putih; dark teal hanya untuk sidebar/header/tombol.
- [ ] Hanya satu tombol `primary` di layar.
- [ ] Caveat hanya muncul pada tempat yang terdaftar di bagian 3.4, satu baris, dan tidak menyentuh angka.
- [ ] Seluruh angka uang memakai `.num`, rata kanan, negatif dalam tanda kurung.
- [ ] Emoji diambil dari `lib/ui/emoji.ts`, bukan ditulis langsung, dan dibungkus `aria-hidden`.
- [ ] Tidak ada tombol yang hanya berisi emoji tanpa `aria-label`.
- [ ] Cincin fokus keyboard terlihat pada seluruh elemen interaktif.
- [ ] Tombol nonaktif punya penjelasan alasan.
- [ ] Tabel laporan punya kepala dokumen berisi nama perusahaan, nama laporan, dan periode.
- [ ] Keadaan kosong, keadaan memuat, dan keadaan gagal sudah dibuat, bukan hanya keadaan normal.
- [ ] Halaman masih terbaca pada lebar 360 px.
