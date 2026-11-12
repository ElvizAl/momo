# Jeda balasan WhatsApp

Route `app/api/webhooks/kirimdev/route.ts` mengembalikan HTTP 200 lebih dahulu.
Di callback `after()`, bot membuat jawaban AI, menunggu 60 detik, lalu mengirim
balasan melalui KirimDev. Waktu total sejak pesan masuk mencakup waktu AI
ditambah jeda 60 detik dan waktu pengiriman.

Jeda dibagi menjadi 40 detik menunggu, permintaan indikator mengetik, lalu
20 detik menunggu sebelum mengirim. Permintaan indikator juga menandai pesan
masuk sebagai sudah dibaca, menggunakan ID `wamid` dari webhook. Jika indikator
gagal, bot tetap mengirim balasan. Waktu request indikator menambah waktu total.
Indikator otomatis berhenti setelah sekitar 25 detik atau saat balasan dikirim;
tidak ditampilkan sepanjang satu menit.

Referensi: [KirimDev typing indicator](https://docs.kirimdev.com/sending/mark-as-read/).

`maxDuration` ditetapkan 300 detik agar jeda tidak menghabiskan batas 60 detik
sebelumnya. Deployment Vercel harus mendukung durasi ini (misalnya Fluid Compute).

Jeda berlaku untuk setiap balasan. Ini bukan pembatas global: request webhook
yang berjalan bersamaan dapat mengirim balasan bersamaan setelah masing-masing
menunggu 60 detik. Pekerjaan dalam satu request masih diproses berurutan.
Batch besar dapat melampaui durasi fungsi. Proses latar belakang ini belum
memakai antrean persisten; pekerjaan bisa hilang jika proses dihentikan.

Untuk menjamin jarak satu menit antara seluruh pengiriman di beberapa instance,
diperlukan antrean dan penjadwalan bersama yang persisten. Jeda pengiriman sendiri
tidak menjamin akun WhatsApp terhindar dari pembatasan.
