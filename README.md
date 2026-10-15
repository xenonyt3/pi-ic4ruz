# Pi Reason prototype

**Continuing on another device:** start with [HANDOFF.md](HANDOFF.md) for Windows
bootstrap, the current checkpoint and known portability limits. This public
snapshot includes source/docs/tests and selected evidence; see
[PUBLICATION.md](PUBLICATION.md) for the files deliberately kept local.

```powershell
node scripts/bootstrap-device.mjs
```

The 151/151 result below belongs to the original workstation. A fresh clone does
not include its private baseline or proprietary Reason reference oracle.

Prototype terisolasi berdasarkan `D:/pi-ic4ruz/PI-IMPLEMENTATION-PLAN.md`.
Runtime kandidat **1.0.0+reason-ui.3**, berbasis Pi resmi 1.0.0, provider slot **9router/cx/gpt-6-sol**.
T1-T4 terintegrasi dengan paket acceptance offline T5. Default launcher memakai
endpoint fixture dan tetap offline. Pilot headless terpisah sudah dijalankan
dengan izin pengguna memakai 9router/cx/gpt-6-astra; hasil parsial ada di bawah.

```powershell
cd D:/pi-reason-prototype/workspace
../pi-reason-proto.ps1 --version
../pi-reason-proto.ps1
node ../scripts/verify-offline.mjs --suite all
node ../scripts/typecheck-candidate.mjs
node ../scripts/audit-baseline.mjs --check
```

Ctrl+D dari editor kosong menutup TUI. Prompt ditangani dengan pesan bahwa
budget gate tertutup, tanpa memulai agent turn. Resource overrides, prompt
CLI, package install/update, provider override, foreign session dan cwd di
fork/baseline ditolak. Tidak ada alias global atau perubahan PATH.

Profil dan session berada di `agent/`. `agent/models.json` memuat **fixture**,
bukan credential/endpoint produksi. Nilai cost nol dari SDK adalah default
fixture, bukan tarif terverifikasi. Jangan membuka live gate hanya dengan
mengganti config: jalur live wajib memakai runner evaluasi, acceptance terbaru,
dan budget eksplisit. `--offline` Pi sendiri bukan network sandbox; guard Node tambahan
memblokir API network umum pada fixture terpercaya, tidak membatasi arbitrary
process/shell sebagai OS sandbox.

## Verifikasi dan batas

- T0/O01 awal lulus 13 tes. Full suite terbaru **151/151 PASS**, termasuk 43 tes
  UI. `artifacts/verification/all-latest.json`; O14 penuh belum lulus.
- `config/runtime-identity.json`: hash seluruh installed runtime tree dari
  instalasi upstream dan direct helper dependencies pinned. Install scripts
  dimatikan; helper yang belum ada dalam cache diambil dari npm registry.
- `artifacts/verification/baseline.json`: snapshot path/hash untuk 5.599
  file source/config/launcher yang dilindungi; tidak memuat isi credential.
- `artifacts/verification/latest.json`: status suite terakhir dan path log.
- `artifacts/verification/rpc-smoke.json`: state/read-only RPC dan counter
  **blocked network attempts**; tidak dipakai sebagai network capture OS.
- `artifacts/verification/tui-smoke.json`: startup/exit Windows PTY tanpa prompt.
- `docs/UI-REFERENCE.md`, `docs/UI-PARITY.md`: source oracle 0.2.269 dan marketing
  reference; full live Reason parity belum. Adapter TU1 awal aktif.

Codemode memakai QuickJS upstream, deadline host, lima deklarasi awal dan
deferred discovery. Shell Windows dan file writes memakai writer lease.
Supervisor membatasi tiga child, menyimpan receipt/owner/branch, dan menjaga
slot ketika cleanup belum terkonfirmasi. Worker SDK diuji memakai stream
sintetis; default launcher tidak menjalankan child sintetis sebagai pekerjaan nyata.

Shared vault tetap `D:/.vault-brain/vault`. Adapter Brain terkurasi tersedia
dan diuji dengan fake MCP; launcher offline melaporkan Brain unavailable
tanpa menghubungi vault. Brain production tetap ditunda oleh pengguna.
`node scripts/evaluate-tasks.mjs --dry-run` membuat artefak rencana evaluasi;
`--live --budget config/evaluation-astra.json` membutuhkan acceptance yang cocok
dan campaign baru; campaign yang sudah selesai tidak dapat dipakai ulang.
Pilot `2026-10-15-astra-small-01`: A/B/C lulus verifier kode, tetapi overall
**belum lulus** karena C melewati delegasi (discovery tanpa await). Total 11
request, 42441 input token, 600 output token; biaya uang unknown. Rerun C dengan
budget tambahan memakai 8 request, 31522 input/498 output: live child spawn/read
terbukti, tetapi completion dan edit parent terhenti pada cap request.
Campaign terbaru **`2026-10-15-astra-c-03` PASS**: child diagnosis selesai,
parent menerima hasil dan mengedit, verifier 12/12, cleanup confirmed. Pemakaian
7 request, 28339 input/540 output, sekitar 25 detik. Pilot kecil terpenuhi;
benchmark luas/pricing tetap unknown. CLI mendukung `--live --budget PATH --conditions C`
tanpa Node `--input-type`. Lihat `docs/EVALUATION.md` untuk bukti dan batas hasil.
TU1 awal menyediakan theme/header/footer/editor/tool presentation via upstream
hooks. Editor surface kini mengikuti warna terminal yang tersedia, dengan border
fallback; lifecycle state mengikuti event SDK. Lihat `artifacts/ui-replay/index.html`
untuk 48 frame 80x24/120x40 offline replay (surface dark/light adalah fixture);
Windows PTY 80x24/120x40 telah diuji tanpa inference. O14 penuh tetap pending. Untuk rollback tampilan,
ubah `ui.reasonTerminal=false` di `config/harness.json`, lalu restart.
Hook user-message terisolasi sudah disetujui dan aktif: teks literal, marker,
indentasi, wrapping dan optional measured surface. Komponen actual cocok dengan
source oracle Reason CLI 0.2.269 pada 16/16 fixture; native Windows resume/exit
lulus. Ini belum membuktikan whole-transcript/menu parity.
`config/runtime-selection.json` memilih `transcript-hook-v1`; `stock` memulihkan
runtime asli setelah restart. Hook teks assistant kini mempertahankan indentasi/tab
dan styling quote/code fence; 80/80 fixture nonempty cocok dengan source Reason.
Build memakai esbuild; strict TypeScript checking 4 file patch lulus terhadap
deklarasi kandidat, bukan seluruh monorepo upstream. Native resume/code/Unicode/
paste/clear/exit lulus. Reasoning kini collapsed dengan ringkasan per blok;
Ctrl+T/klik membuka Markdown dim/italic berindentasi tiga kolom. Replay reasoning
96/96 cocok; native Ctrl+T expand/collapse dan exit lulus. Visibility Pi tetap
persisten: set `hideThinkingBlock:false` untuk default expanded pada rollback.
Splash/startup dan working/shimmer kini memakai hooks upstream tanpa patch baru:
Pi art/identitas aktual, startup 2400 ms, shimmer 1400+500 ms, lifecycle cleanup.
Native resize sampai 32x16, Escape cancel, Unicode, clear dan exit lulus.
Bukti terbaru: `docs/STARTUP-WORKING-VERIFICATION.md`; detail reasoning tetap pada
`upstream-patches/transcript-hook/THINKING-VERIFICATION.md`.
Source, profil dan launcher `pi` / `pi-clean` tetap terpisah.

Lihat `docs/ROLLBACK.md` untuk kembali ke workflow lama dan `docs/DEVIATIONS.md`
untuk batas bukti. Backlog utama tetap di `D:/pi-ic4ruz`.
