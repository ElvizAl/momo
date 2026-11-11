# Momo — webhook WhatsApp

Penerima webhook KirimDev menggunakan Next.js App Router, dengan referensi
[ElvizAl/kempong](https://github.com/ElvizAl/kempong).

## Menjalankan lokal

1. Jalankan `bun install`.
2. Isi `KIRIM_WEBHOOK_SECRET` di `.env.local` sesuai contoh `.env.example`.
   Jika sudah ada secret di `.env`, hindari konfigurasi ganda. Jangan commit secret.
3. Jalankan `bun dev`.

Endpoint: `POST /api/webhooks/kirimdev`. Membukanya melalui browser (GET)
menghasilkan HTTP 405. Untuk menerima webhook saat pengembangan lokal,
gunakan URL HTTPS publik dari tunnel yang mengarah ke server lokal.

## KirimDev dan Vercel

1. Deploy repo Momo ini ke proyek Vercel penerima webhook. Domain Frozenbot
   hanya bisa digunakan jika deployment di domain itu memuat endpoint ini.
2. Di KirimDev, buka **Settings → Webhooks → Tambah webhook**.
3. Jika menggunakan domain Frozenbot, isi URL:
   `https://frozenbot-iota.vercel.app/api/webhooks/kirimdev`.
   Untuk domain lain, ganti domain dan pertahankan path endpoint.
4. Centang **message.received** dan akun WhatsApp untuk bot.
5. Simpan subscription dan salin signing secret yang ditampilkan.
6. Di Vercel, buka **Settings → Environment Variables**, tambahkan
   `KIRIM_WEBHOOK_SECRET` dengan signing secret tersebut untuk **Production**.
7. Redeploy agar environment variable diterapkan.
8. Kirim pesan dari nomor lain ke nomor bot. Periksa delivery di KirimDev
   dan log `Pesan WhatsApp masuk:` di Vercel.

API key KirimDev tidak dibutuhkan untuk penerimaan webhook ini.

## Perilaku endpoint

- Verifikasi signature menggunakan SDK resmi dan raw body, toleransi 300 detik.
- Sama dengan referensi kempong, hanya membaca pesan pertama pada entry dan
  change pertama. Respons sukses menyertakan pesan tersebut di field `message`.
- Mencatat ID pesan, nomor akun, nomor pengirim, jenis pesan, dan teks ke log
  server. Pesan media dicatat dengan teks `null`; media belum diunduh.
- Event selain `message.received`, termasuk `message.status` dan `message.sent`,
  diabaikan setelah signature diverifikasi, sama seperti repo kempong.
- HTTP 200 berarti diterima; respons ini bukan balasan chat WhatsApp.
- HTTP 401: signature hilang/tidak valid; 400: signature kedaluwarsa/JSON
  tidak valid; 500: kegagalan server lainnya. Secret wajib diisi sebelum pengujian.

Route disalin dari repo kempong.
Cache Components dan Partial Prefetching lokal
dinonaktifkan agar ekspor `runtime = "nodejs"` pada route kompatibel dengan
Next.js versi proyek ini.

Tahap ini menerima dan mencatat pesan. Agent AI, pengiriman balasan, database,
dan deduplikasi persisten belum ditambahkan. KirimDev dapat mengirim ulang
sehingga log bisa muncul lebih dari sekali. Tambahkan deduplikasi ID pesan/event
sebelum menghubungkan tindakan AI atau pengiriman balasan.

## Pemeriksaan

```sh
bun test
bun run lint
bunx tsc --noEmit
bun run build
```

Test menggunakan pesan dan secret sintetis tanpa mengirim ke KirimDev/WhatsApp.

Referensi: [KirimDev SDK webhooks](https://docs.kirimdev.com/sdks/typescript/webhooks/).
