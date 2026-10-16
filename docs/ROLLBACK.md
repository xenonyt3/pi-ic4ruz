# Rollback prototype

I26 Codex comparison is selected only by `--comparison codex`. Stop with Ctrl+C
and wait for the Windows job/tree cleanup receipt. Preserve the private campaign,
ledger and any unconfirmed writer lease; never reset an allowance to repeat cells.
Codex state lives under the ignored campaign's `codex-home` and does not replace
the user's Codex configuration. The installed pinned executable is read-only.
Return to the standard offline Pi launcher; no global rollback is required.
The v1 Codex/Pi campaign is stopped and retained. Its unused quota must not be
transferred to v2. To inspect the original stream-ending behavior, use commit
`e521a9d` in a separate checkout without running its consumed live campaign.

I24 evaluation is opt-in through `scripts/evaluate-behavior.mjs`; existing launchers
keep their behavior. Interrupt the campaign to cancel active parent/child work and
wait for cleanup. Preserve `agent/live-private/behavior-campaigns/` and per-cell
ledgers; an existing campaign is never replayed or replenished. Workspaces under
`artifacts/evaluations/behavior/` are disposable fixtures. Selecting stock-core for
an evaluation does not change `config/runtime-selection.json` or another Pi install.

I24 v2 creates Git metadata only inside new disposable fixtures and adds generic
command-escaping guidance. The paid v1 state and corpus history remain preserved.
Use the recorded v1 source checkpoint `ac12d83` in a separate checkout for inspection;
do not replay its consumed campaign or reset ledgers. Disabling future evaluation
requires no changes to production profiles, runtime selection or the Brain vault.

For the interactive-live entrypoint, interrupt active work, then exit Pi and
confirm child cleanup and writer lease release. Return to `node launch.mjs` for
offline mode; do not flip `config/harness.json.liveInference`. Keep the ignored
`agent/live-private/` configuration, sessions and accounting intact. Removing a
ledger does not restore allowance. Stale lock recovery requires inspecting its
owner and child processes; see [LIVE.md](LIVE.md). No global launcher/profile is
installed or modified by live mode. Production Brain remains disabled.

Tutup proses prototype. Gunakan launcher `pi` untuk fork atau `pi-clean` untuk
baseline. Prototype tidak memasang alias global atau mengubah PATH.
Tidak perlu restore backup ke atas profil aktif. Simpan session dan receipts.
Jangan hapus direktori otomatis; review diff task secara terpisah.

Live inference ditutup oleh launcher offline, extension dan network guard.
`--offline` upstream sendiri hanya menutup startup discovery, bukan semua
inference. Guard Node ini untuk verifikasi terpercaya, bukan OS sandbox untuk
arbitrary shell. Untuk delegation, tunggu shutdown sampai semua child
settled dan cleanup confirmed. Jangan menghapus writer lease dengan state
cleanup_unconfirmed; periksa proses milik harness sebelum explicit recovery.

Config `ui.reasonTerminal=false`, lalu restart, mematikan adapter dan hook renderer
agar memakai tampilan stock pada runtime terpilih. Untuk rollback runtime penuh,
ubah `config/runtime-selection.json` menjadi `{"runtime":"stock"}` lalu restart.
Runtime asli pada `runtime/` dipertahankan; kandidat `1.0.0+reason-ui.4` dibangun
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

I22 adds optional setTranscriptLayout('content'). Clearing it restores Pi ordering
without replacing the original tool components; extension reset also clears it.
For all stock presentation, disable ui.reasonTerminal and restart. The prior v3
source/build/pin snapshot remains under upstream-patches/transcript-hook/history/reason-ui.3.

Startup/working memakai API yang sudah ada di `reason-ui.3`, tanpa build kandidat
baru. Shutdown/reset/fallback membuang widget dan timer startup/shimmer; fallback
mengaktifkan kembali working indicator stock. Toggle UI lalu restart cukup untuk
membatalkan presentation slice ini. Tidak perlu mengedit installed runtime.
