# Rollback prototype

Tutup proses prototype. Gunakan launcher `pi` untuk fork atau `pi-clean` untuk
baseline. Prototype tidak memasang alias global atau mengubah PATH.
Tidak perlu restore backup ke atas profil aktif. Simpan session dan receipts.
Jangan hapus direktori otomatis; review diff task secara terpisah.

Live inference ditutup oleh launcher, extension dan network guard.
`--offline` upstream sendiri hanya menutup startup discovery, bukan semua
inference. Guard Node ini untuk verifikasi terpercaya, bukan OS sandbox untuk
arbitrary shell. Untuk delegation, tunggu shutdown sampai semua child
settled dan cleanup confirmed. Jangan menghapus writer lease dengan state
cleanup_unconfirmed; periksa proses milik harness sebelum explicit recovery.

Config `ui.reasonTerminal=false`, lalu restart, mematikan adapter dan hook renderer
agar memakai tampilan stock pada runtime terpilih. Untuk rollback runtime penuh,
ubah `config/runtime-selection.json` menjadi `{"runtime":"stock"}` lalu restart.
Runtime asli pada `runtime/` dipertahankan; kandidat `1.0.0+reason-ui.3` dibangun
di `upstream-patches/transcript-hook/build/package`, terpisah dari node_modules
yang terpasang. Session dan receipts tetap tersedia. Adapter Brain telah diuji dengan fake MCP;
transport production tetap tidak aktif di launcher offline. Vault tetap
D:/.vault-brain/vault.

Prototype sekarang memakai `hideThinkingBlock:true` pada `agent/settings.json`.
Ctrl+T menyimpan visibility ke settings; mematikan adapter atau memilih runtime
stock tidak menghapus pilihan ini. Untuk default thinking Pi awal yang terbuka,
set `hideThinkingBlock:false`, lalu restart. Session content tetap utuh.

Untuk menonaktifkan capability, ubah `features.codemode`, `features.delegation`,
`features.brain`, `features.context`, atau `features.telemetry` di
`config/harness.json`, lalu tutup session dan restart dengan registry baru.
Menonaktifkan extension tidak membatalkan perubahan file task yang sudah terjadi.
Session JSONL dan receipts dipertahankan. Tidak perlu restore file upstream;
selector menentukan runtime. Renderer error menggunakan stock fallback dengan warning.

Startup/working memakai API yang sudah ada di `reason-ui.3`, tanpa build kandidat
baru. Shutdown/reset/fallback membuang widget dan timer startup/shimmer; fallback
mengaktifkan kembali working indicator stock. Toggle UI lalu restart cukup untuk
membatalkan presentation slice ini. Tidak perlu mengedit installed runtime.
