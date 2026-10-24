# Video pratinjau proyek

Status: **belum otomatis end-to-end pada produksi**. Kartu produk memutar video asli saat hover/fokus hanya jika `Product.previewVideoUrl` berisi URL HTTPS. Tanpa video, gambar produk tetap tampil; tidak ada video buatan atau URL palsu.

## Video yang disertakan dalam proyek

`discoverPreviewVideo(files)` di `src/lib/preview-video.ts` memilih MP4/WebM yang memang ada dalam folder/files yang dipilih, mengutamakan `preview`, `demo`, `teaser`, atau `screencast`; maksimum 25 MB. `uploadPreviewVideo(file, productId)` mengunggah byte asli ke bucket Supabase `preview-videos` dengan nama acak lalu mengembalikan URL publik HTTPS hanya setelah unggahan berhasil. Simpan hasilnya melalui `store.saveProduct({ ...product, previewVideoUrl: url })`; katalog Supabase menyimpan field ini di JSON `products.data`. Terapkan migrasi `supabase/migrations/20261023_preview_videos.sql` pada proyek Supabase sebelum mencoba unggahan. Browser hanya mendapat izin INSERT untuk admin yang terautentikasi; bucket publik hanya untuk penayangan.

**Integrasi wizard/uploader:** folder/files diperiksa dengan `discoverPreviewVideo(rawFiles)`; jika video terdeteksi, sesudah upload proyek berhasil berkas video diunggah via `uploadPreviewVideo(video, projectId)` lalu URL-nya masuk ke draf produk yang disimpan saat admin menyelesaikan wizard. Jangan simpan blob URL, data URL, atau path proyek sebagai URL publik. ZIP belum diekstrak untuk video; upload ZIP tanpa video tetap menampilkan gambar.

## Perekaman otomatis dari URL demo

`scripts/capture-preview.mjs` merekam URL pratinjau publik yang lolos validasi menggunakan Playwright dan FFmpeg. `scripts/preview-worker.mjs` dapat dijalankan terpisah oleh operator/scheduler untuk menemukan produk **published** dengan deployment terverifikasi dan belum mempunyai video, merekamnya, mengunggah MP4 ke bucket, lalu memperbarui JSON katalog secara kondisional. Tes lokal mencakup loopback Chromium→FFmpeg dan adaptor Supabase tiruan; worker ini **belum dijalankan terhadap database/deployment produksi**, belum dipasang sebagai layanan, dan migrasi bucket belum diverifikasi. Lihat `scripts/CAPTURE_PREVIEW.md` untuk syarat isolasi, pengaturan server-side, serta batas keamanan. Edge Function deployment sendiri tidak merekam layar. Jangan mengklaim status preview READY sebagai bukti video telah direkam.

Belum ada penerapan migrasi maupun uji backend langsung di lingkungan ini. Integrasi folder/files telah dipasang di wizard/uploader, tetapi unggahan admin ke Supabase, perekaman deployment publik, serta playback produk tersimpan belum diuji end-to-end.
