# SiteOwner (PWA + server)

Dashboard pemantauan tenaga kerja, K3, biaya upah, material, dan jadwal proyek untuk Owner,
dengan antarmuka input untuk Supervisor lapangan. Seluruh rumus (KPI, upah, progres, Kurva S,
deteksi kejanggalan, RAB/keuntungan) **sama persis** dengan `siteowner.html` asli; yang berubah
hanya tempat data disimpan: sekarang di server, bukan di browser/platform Claude.

## Menjalankan

Syarat: **Node.js 22.13 atau lebih baru**. Tidak ada `npm install` (tanpa dependensi).

```bash
node server/server.js          # atau: npm start
# buka http://localhost:3000
```

Pertama kali dijalankan, konsol server menampilkan **kode setup 8 angka**. Buka aplikasi,
pilih *Owner*, masukkan kode itu dan buat dua PIN (Owner dan Supervisor). Setelah itu Owner
mengisi Pengaturan (nama proyek, durasi, pekerja & target, RAB, material, jadwal), dan
Supervisor sudah bisa masuk dengan PIN-nya dari HP.

Variabel lingkungan: `PORT` (3000), `HOST` (0.0.0.0), `DATA_DIR` (`./data`),
`COOKIE_SECURE=1` (paksa cookie Secure; otomatis aktif jika proxy mengirim `X-Forwarded-Proto: https`).

## Pasang di HP (PWA) dan HTTPS

Agar bisa "Tambahkan ke layar utama" dan service worker aktif, aplikasi harus dibuka lewat
**HTTPS** (kecuali `localhost`). Cara paling mudah: taruh di belakang reverse proxy, mis. Caddy:

```
proyek.contoh.com {
    reverse_proxy localhost:3000
}
```

Atau pakai Docker: `docker build -t siteowner . && docker run -d -p 3000:3000 -v siteowner-data:/data siteowner`.

> Tanpa HTTPS aplikasi tetap jalan di jaringan lokal, tetapi PIN dan data lewat jaringan tanpa enkripsi.
> Jangan buka ke internet tanpa HTTPS.

## Cadangan, pemulihan, lupa PIN

| Kebutuhan | Perintah |
|---|---|
| Cadangan basis data (konsisten, aman saat server berjalan) | `node server/cli.js backup [folder]` |
| Pulihkan | hentikan server, ganti `data/siteowner.db` dengan berkas cadangan, jalankan lagi |
| Lupa PIN Owner | `node server/cli.js reset-pins` (data proyek **tidak** terhapus; kode setup baru tampil) |

Owner juga bisa mengunduh cadangan JSON dari Pengaturan → Cadangan data dan mengujinya
(termasuk pemeriksaan rantai hash) dengan memilih berkasnya.

## Isi project

```
server/server.js    HTTP + API + SSE (sinkronisasi antar perangkat)
server/validate.js  validasi semua masukan di sisi server
server/auth.js      PIN (scrypt), sesi cookie, penguncian login, kode setup
server/db.js        SQLite; catatan append-only (UPDATE/DELETE ditolak pemicu SQL)
server/cli.js       backup, reset-pins
public/             PWA: index.html, css, js/*, manifest, sw.js, ikon
public/js/integrity.js  bentuk teks yang di-hash; dipakai server DAN browser
test/               tes API (node --test) dan tes browser (Playwright)
```

## Fitur yang dipertahankan

Input audit harian (+foto bukti, maks 3) · Biaya lapangan · Dashboard Owner (Kurva S, KPI,
peringatan, kejanggalan, ranking, RAB & keuntungan, jejak audit) · Persetujuan & koreksi
berversi · Opname rinci + segel · Keuangan · Material (stok, peringatan) · Jadwal (Gantt) ·
Analisis + CSV/PDF + anonimisasi · Laporan WhatsApp · Riwayat aktivitas · Pengaturan
(upah, RAB, material, jadwal, Kurva S, PIN, cadangan) · Bantuan · rantai hash SHA-256 ·
login dua peran, kunci 30 detik setelah 5 salah, sesi tutup otomatis 10 menit.

## Yang sengaja dibuang (tidak dipakai di versi server)

Mode lokal (data di localStorage, PIN di browser), tombol "Muat data contoh / Mulai dari data
kosong", pemulihan cadangan ke mode lokal, dan seluruh sambungan ke platform Claude
(`window.claude`, db/assets/downloads, `/_blob/`).

## Perbedaan perilaku dibanding versi lama (disengaja)

* Sidik hash hari/koreksi kini dibuat **server**, bukan browser, dan server memvalidasi ulang
  semua aturan (opname wajib, tanggal, volume wajar, peran). Browser tetap memverifikasi rantai.
* PIN diperiksa di server; PIN Owner tidak pernah sampai ke perangkat Supervisor.
* Supervisor tidak menerima nilai kontrak/RAB dari server.
* Proyek dibuat otomatis (nama "Proyek", durasi 20, pekerja contoh Pak Budi dst.) saat setup;
  Owner tinggal mengubahnya di Pengaturan.
* Setelah login, muat ulang halaman tidak meminta PIN lagi selama sesi aktif; sesi tetap
  ditutup otomatis setelah 10 menit tanpa aktivitas.

## Keterbatasan yang perlu diketahui

* Satu server = satu proyek. Untuk beberapa proyek, jalankan beberapa instance (`DATA_DIR` berbeda).
* Satu PIN dipakai bersama semua supervisor; nama pengisi hanya isian teks, bukan akun.
* Offline: tampilan terakhir terbuka, tetapi input baru butuh sambungan (belum ada antrean offline).
* `node:sqlite` masih berstatus *experimental* di Node, sehingga muncul peringatan di konsol; fungsinya stabil untuk pemakaian ini.
* Tes otomatis dijalankan di Chromium desktop; belum diuji di perangkat HP fisik.

## Tes

```bash
node --test test/api.test.js   # 11 tes API: peran, hash chain, opname, biaya, material, PIN
node test/e2e.js               # alur browser dua perangkat (butuh playwright + chromium)
```
