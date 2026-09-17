# Aturan Kerja — Menara Kas

Berlaku untuk manusia dan untuk agen AI, tanpa perbedaan. Tujuannya satu: kode di repositori ini harus terlihat seperti ditulis oleh satu orang yang paham akuntansi dan tidak suka basa-basi.

Ini aplikasi keuangan. Angka yang salah lebih buruk daripada fitur yang belum ada.

Brand: **Menara** (PT Menara Mitra Solusi). Produk ini: **Menara Kas**. Produk saudara: Menara Angkut, Menara Tim, Menara Polis.

Urutan pengerjaan mengikuti [docs/phases.md](docs/phases.md). Setiap fase selesai wajib lulus QA/QC sebelum fase berikutnya dimulai.

---

## 1. Sebelum menulis kode

1. Baca [docs/PRD.md](docs/PRD.md) bagian modul yang dikerjakan. Setiap kebutuhan punya kode seperti `M4-2` dan kriteria penerimaan. Kerjakan yang tertulis, bukan yang terbayang.
2. Baca [docs/phases.md](docs/phases.md). Kerjakan **satu fase** sesuai status; setelah selesai jalankan QA/QC fase itu sebelum lanjut.
3. Baca [docs/data-model.md](docs/data-model.md) bagian 5 dan 6 sebelum menyentuh apa pun yang berkaitan dengan jurnal, laporan, atau project.
4. Baca [docs/design-system.md](docs/design-system.md) sebelum menyentuh antarmuka. Warna, huruf, dan emoji yang tidak ada di sana tidak boleh dipakai.
5. Baca [docs/architecture.md](docs/architecture.md) bagian 3.1 untuk arah ketergantungan antar modul.

Jika kebutuhan di PRD ambigu, **tanya**. Jangan menebak lalu membangun. Menebak di aplikasi akuntansi menghasilkan angka yang terlihat benar dan tidak bisa direkonsiliasi.

Jika sesuatu di dokumen ini bertabrakan dengan permintaan tugas, dokumen ini menang. Sampaikan tabrakannya, jangan diam-diam melanggar salah satunya.

---

## 2. Anti-slop: yang ditolak saat review

Bagian ini bukan preferensi gaya. Setiap butir di bawah adalah alasan yang cukup untuk menolak pull request.

### 2.1 Komentar yang mengulang kode

Komentar hanya dipakai untuk menjelaskan **kenapa**, terutama ketika alasannya berasal dari aturan akuntansi atau pajak yang tidak terlihat dari kode.

```ts
// DITOLAK
// Loop melalui semua baris
for (const line of lines) {
  // Tambahkan debit ke total
  totalDebit += line.debit;
}

// DITERIMA
// PPh dipotong pelanggan mengurangi kas tetapi bukan beban,
// karena itu masuk sebagai pajak dibayar dimuka di golongan ASET.
const prepaidTaxLine = buildPrepaidTaxLine(withholding);
```

Juga ditolak: komentar penanda seperti `// ===== HELPERS =====`, komentar yang menyebut proses pengerjaan seperti `// diperbaiki sesuai permintaan`, dan JSDoc yang hanya mengulang nama parameter.

### 2.2 `any`, `as`, dan `!` yang menutupi masalah

`any` dilarang oleh lint. `as` hanya boleh dipakai ketika TypeScript benar-benar tidak bisa menyimpulkan tipe, misalnya hasil `sql` mentah, dan wajib disertai satu baris alasan. `!` non-null hanya boleh setelah pemeriksaan yang terlihat pada baris sebelumnya.

```ts
// DITOLAK
const total = (rows as any).reduce((a: any, b: any) => a + b.amount, 0);

// DITERIMA
const rows = await tx.execute<TrialBalanceRow>(sql`...`);
```

### 2.3 Placeholder, `TODO`, dan implementasi setengah jadi

Tidak boleh ada `TODO`, `FIXME`, fungsi yang mengembalikan nilai palsu, `throw new Error("not implemented")`, atau komponen yang menampilkan data contoh. Jika sebuah bagian belum dikerjakan, jangan buat berkasnya. Repositori tidak boleh memuat jalan yang tidak sampai.

### 2.4 Data tiruan yang bocor ke produksi

Data contoh hanya boleh berada di `lib/db/seed/` dan `tests/fixtures/`. Komponen dan fungsi laporan tidak pernah punya nilai cadangan berupa angka karangan. Laporan tanpa data menampilkan keadaan kosong, bukan nol yang dibuat-buat.

### 2.5 Abstraksi yang dipakai satu kali

Jangan buat `BaseRepository`, `AbstractReportBuilder`, pabrik, atau lapisan generik untuk satu pemakaian. Tulis fungsi yang langsung mengerjakan tugasnya. Abstraksi dibuat setelah pemakaian ketiga, bukan sebelum pemakaian pertama.

### 2.6 Duplikasi logika akuntansi

Satu aturan hidup di satu tempat. Beberapa contoh yang paling sering dilanggar:

| Aturan | Satu-satunya tempat |
|---|---|
| Pembentukan jurnal per jenis transaksi | `lib/accounting/posting/build-*.ts` |
| Perhitungan PPN dan PPh, termasuk pembulatan | `lib/accounting/tax.ts` |
| Pembagian nilai ke beberapa project | `lib/accounting/allocate.ts` |
| Tanda debit dan kredit menurut golongan akun | `lib/accounting/balance.ts` |
| Format rupiah, tanggal, persen | `lib/ui/format.ts` |
| Kamus emoji | `lib/ui/emoji.ts` |
| Konteks organisasi pada kueri | `lib/db/tenant.ts` |

Jika sebuah angka bisa dihitung di dua tempat berbeda, cepat atau lambat kedua tempat itu akan memberi jawaban berbeda, dan pengguna yang menemukannya lebih dulu.

### 2.7 Penanganan kesalahan yang menelan masalah

```ts
// DITOLAK
try {
  await postEntry(ctx, draft);
} catch (e) {
  console.error(e);
  return { ok: false, message: "Terjadi kesalahan" };
}
```

`catch` hanya boleh menangkap kesalahan yang memang bisa ditangani. Kesalahan domain menjadi pesan yang bisa ditindaklanjuti; kesalahan lain dilempar ulang agar tercatat di pemantauan. `catch` kosong dan `catch` yang hanya mencatat ke konsol dilarang.

### 2.8 Pemeriksaan defensif yang tidak mungkin terjadi

Jika tipe sudah menjamin sebuah nilai ada, jangan memeriksanya lagi. Pemeriksaan palsu membuat pembaca menduga ada kasus yang sebenarnya tidak ada, dan menyembunyikan pemeriksaan yang sungguh dibutuhkan.

### 2.9 Agregasi uang di JavaScript

Menjumlahkan, mengelompokkan, atau menghitung saldo awal dengan mengambil baris jurnal ke memori dilarang. Itu tugas SQL. Lihat [docs/architecture.md](docs/architecture.md) bagian 8.

### 2.10 Berkas barel dan ekspor ulang

Tidak ada `index.ts` yang hanya mengekspor ulang. Impor langsung dari berkas asalnya. Barel merusak penelusuran ketergantungan dan menyembunyikan pelanggaran arah impor.

### 2.11 Ketergantungan baru tanpa alasan

Jangan menambah paket sebelum memastikan kebutuhannya tidak terjawab oleh paket yang sudah ada di [docs/architecture.md](docs/architecture.md) bagian 2. Penambahan paket dijelaskan di deskripsi pull request: apa yang dibutuhkan, dan mengapa yang sudah ada tidak cukup.

### 2.12 Sisa pengembangan

`console.log`, `debugger`, berkas `*.backup.ts`, kode yang dikomentari, `eslint-disable` tanpa alasan tertulis, dan impor yang tidak terpakai. Semuanya gagal di lint dan tidak boleh di-bypass.

### 2.13 Menghias masalah dengan kata

Nama fungsi, nama variabel, dan pesan antarmuka harus menyebut apa yang sebenarnya terjadi. `handleData`, `processStuff`, `utils.ts`, `helper.ts`, dan `manager.ts` ditolak. Begitu juga pesan antarmuka yang mengaburkan kegagalan seperti `"Data sedang diproses"` ketika yang terjadi adalah kesalahan.

---

## 3. Yang diwajibkan

### 3.1 Invariant akuntansi punya tes

Perubahan apa pun pada mesin posting, skema jurnal, atau kueri laporan wajib disertai tes untuk invariant yang terkait, dari I1 sampai I8 di [docs/data-model.md](docs/data-model.md) bagian 5. Pull request tanpa tes ini ditolak tanpa diskusi.

### 3.2 Angka harapan dihitung tangan

Nilai harapan dalam tes ditulis dari perhitungan manual, bukan dari keluaran program. Fixture `tests/fixtures/prj-001.ts` beserta hasil yang sudah diverifikasi ada di [docs/data-model.md](docs/data-model.md) bagian 6.4. Menyalin keluaran program menjadi nilai harapan berarti mengunci kesalahan menjadi standar.

### 3.3 Setiap layar punya empat keadaan

Keadaan normal, memuat, kosong, dan gagal. Mengirim hanya keadaan normal dianggap belum selesai.

### 3.4 Setiap kueri terikat organisasi

Setiap kueri menulis `where org_id = ctx.orgId` secara eksplisit, meskipun Row Level Security sudah aktif. Dua lapis, keduanya wajib.

### 3.5 Setiap mutasi memeriksa peran

`defineAction` wajib menerima daftar `roles`. Tidak ada nilai default. Aksi yang lupa menyebut peran tidak boleh ada.

### 3.6 Setiap aksi penting tercatat di audit

Pembuatan, posting, pembalikan, penguncian periode, tutup buku, perubahan hak akses, dan perubahan master data masuk `audit_logs` beserta nilai sebelum dan sesudah.

---

## 4. Konvensi kode

**Bahasa.** Kode berbahasa Inggris, antarmuka berbahasa Indonesia. Pengecualian yang disengaja: nilai enum domain dan nama peran `account_roles` memakai istilah Indonesia, karena `BEBAN_POKOK_PROJECT` dan `PPH_4_2` tidak punya padanan Inggris yang satu lawan satu. Rute URL berbahasa Indonesia agar sesuai bahasa produk, misalnya `/laporan/arus-kas`.

**Nama berkas.** `kebab-case.ts`. Komponen React memakai `PascalCase` sebagai nama ekspor di dalam berkas `kebab-case.tsx`.

**Ekspor.** Ekspor bernama di mana-mana. `export default` hanya untuk berkas khusus Next.js, yaitu `page.tsx`, `layout.tsx`, `route.ts`, dan `error.tsx`.

**Tipe.** `type` untuk bentuk data, `interface` hanya bila perlu digabung. Hindari `enum` TypeScript; pakai union string atau enum PostgreSQL yang sudah ada.

**Fungsi.** Kembalikan lebih awal, hindari `else` yang bersarang. Fungsi yang lebih dari 60 baris biasanya menggabungkan dua tugas yang berbeda.

**Async.** Tidak ada rantai `.then`. `await` saja. Setiap `await` yang menyentuh basis data berada di dalam `withOrg`.

**React.** Server Component sebagai bawaan. `"use client"` hanya untuk komponen yang benar-benar butuh keadaan atau peristiwa peramban, dan diletakkan di komponen terkecil yang membutuhkannya, bukan di halaman. Tidak ada `useEffect` untuk mengambil data.

**Impor.** Alias `@/` untuk akar proyek. Arah ketergantungan mengikuti [docs/architecture.md](docs/architecture.md) bagian 3.1 dan ditegakkan lint.

---

## 5. Antarmuka

Aturan lengkap ada di [docs/design-system.md](docs/design-system.md). Yang paling sering dilanggar:

- Warna hanya dari token design system (dark teal `#018081`, mint `#E1F7F4`, putih, hitam). Warna bawaan Tailwind dan palet navy/kuning lama dilarang.
- Mint tidak pernah menjadi warna teks. Latar halaman kerja berwarna putih.
- Satu tombol `primary` per layar.
- Huruf tulisan tangan Caveat hanya pada sembilan tempat yang terdaftar di bagian 3.4 design system, satu baris, dan tidak pernah menyentuh angka.
- Emoji diambil dari `lib/ui/emoji.ts`, ditulis sebagai karakter Unicode, dibungkus `aria-hidden`, dan selalu berpasangan dengan teks.
- Angka uang memakai kelas `.num`, rata kanan, nol sebagai `-`, negatif dalam tanda kurung.
- Cincin fokus keyboard tidak boleh dihilangkan.

---

## 6. Copywriting Indonesia

Pengguna adalah pemilik usaha dan staf administrasi, bukan akuntan publik. Tulis seperti menjelaskan ke rekan kerja, bukan seperti menulis peraturan.

**Aturan bentuk.**
- Sapa pengguna dengan "Anda". Jangan "kamu", jangan "user", jangan bentuk pasif berbelit.
- Tombol memakai kata kerja beserta objeknya: `Simpan Transaksi`, `Posting Jurnal`, `Buat Paket Laporan`. Bukan `Submit`, bukan `OK`, bukan `Kirim` tanpa objek.
- Istilah akuntansi dipakai konsisten: **Jurnal**, **Buku Besar**, **Neraca Saldo**, **Laba Rugi**, **Neraca**, **Arus Kas**, **Piutang Usaha**, **Utang Usaha**, **Nomor Akun**, **Project**. Jangan mencampur "Utang" dan "Hutang" dalam satu produk; dokumen ini memakai **Utang** untuk nama akun dan **Hutang & Piutang** hanya sebagai nama menu warisan yang sudah dikenal pengguna.
- Kata `Project` dipakai apa adanya, tidak diterjemahkan menjadi "Proyek", karena calon pengguna memakai kata itu sehari-hari.
- Jangan memakai istilah Inggris yang punya padanan lazim: pakai `Ubah` bukan `Edit` sebagai label, `Unduh` bukan `Download`, `Lampiran` bukan `Attachment`. Tetapi `Invoice`, `Cash Flow` pada judul laporan project, dan `Draft` tetap dipakai karena memang itu yang diucapkan pengguna.

**Aturan pesan kesalahan.** Sebutkan apa yang salah, di mana, dan apa yang harus dilakukan.

```
DITOLAK   Validasi gagal.
DITOLAK   Terjadi kesalahan pada sistem.
DITERIMA  Jurnal belum seimbang. Selisih 250.000 di sisi kredit.
DITERIMA  Baris 3: akun 5-1100 Biaya Material wajib punya project.
DITERIMA  Periode Agustus 2026 sudah terkunci. Minta Owner membuka periode
          lebih dulu, atau catat transaksi ini di September 2026.
```

**Aturan pesan sukses.** Sebutkan objeknya. `Transaksi KM-2026-0042 sudah diposting.` Bukan `Berhasil disimpan.`

**Yang dilarang.** Tanda seru berlebihan, bahasa pemasaran di dalam aplikasi, kalimat yang menyalahkan pengguna, dan singkatan yang tidak dikenal seperti "dr/cr" atau "AR/AP" di antarmuka.

---

## 7. Pull request

- Satu pull request mengerjakan satu hal. Perbaikan kebersihan kode dipisah dari perubahan perilaku.
- Deskripsi memuat: kode kebutuhan dari PRD yang dikerjakan, keputusan yang diambil beserta alasannya, dan cara memverifikasinya secara manual.
- Perubahan pada mesin posting atau kueri laporan wajib mencantumkan angka sebelum dan sesudah pada fixture `PRJ-001`.
- Perubahan tampilan wajib melampirkan tangkapan layar dan mengisi daftar periksa di [docs/design-system.md](docs/design-system.md) bagian 9.
- CI menjalankan `typecheck`, `lint`, `test`, dan `build`. Gagal di salah satunya memblokir penggabungan. Menonaktifkan tes agar CI hijau adalah pelanggaran paling berat di daftar ini.

---

## 8. Daftar periksa sebelum menyatakan selesai

- [ ] Kriteria penerimaan dari kode kebutuhan PRD terkait sudah terpenuhi, semuanya.
- [ ] Tidak ada `TODO`, `any`, `console.log`, kode yang dikomentari, atau berkas sisa.
- [ ] Tidak ada komentar yang hanya mengulang kode.
- [ ] Tidak ada logika akuntansi yang kini ada di dua tempat.
- [ ] Uang diproses sebagai `bigint` satuan sen; tidak ada `parseFloat` atau `Number()` pada nilai uang.
- [ ] Pembulatan pajak terjadi satu kali, di `lib/accounting/tax.ts`.
- [ ] Setiap kueri baru menyebut `org_id` secara eksplisit.
- [ ] Setiap mutasi baru menyebut `roles` dan mencatat audit.
- [ ] Invariant akuntansi yang terkait punya tes, dan angka harapannya dihitung tangan.
- [ ] Keadaan normal, memuat, kosong, dan gagal sudah ada untuk setiap layar baru.
- [ ] Daftar periksa design system bagian 9 sudah dilalui.
- [ ] `typecheck`, `lint`, `test`, dan `build` lulus di mesin lokal sebelum pull request dibuka.
