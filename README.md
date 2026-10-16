# Pi Reason prototype

**Autonomous behavior evaluation:** [I24 protocol](docs/BEHAVIOR-EVALUATION.md)
provides three frozen tasks, trusted verifiers, goal-only prompts and a controlled
stock-core/prototype comparison. Preparation is offline; live evaluation requires
a new allowance. The completed v1 comparison passed 12/12 tasks; prototype used
fewer requests but more input/output tokens in this sample. See
[results and follow-up fixes](docs/BEHAVIOR-RESULTS-V1.md). V2 fixes pass 189/189
offline tests; their live model-behavior effect and Reason parity remain unknown.

**Continuing on another device:** start with [HANDOFF.md](HANDOFF.md) for Windows bootstrap and current limits. Public exclusions are described in [PUBLICATION.md](PUBLICATION.md). The historical 159/159 result is original-workstation evidence; current I23 verification is recorded separately. Private baselines and proprietary Reason source are not distributed.

**Interactive live mode:** [docs/LIVE.md](docs/LIVE.md) describes the separate
`launch-live.mjs --live --config PATH` entrypoint for your provider, with persistent
shared accounting. The standard launcher stays offline. The example config grants
no usage; a new explicit model/allowance and local credential are required.
One separately authorized native live smoke with 9router/Astra now passes: parent
and child tools, exact file result, accounting, cleanup and resume; see
[the sanitized receipt](artifacts/checkpoint/interactive-live-smoke.json). Prices,
broad daily-workload reliability and full Reason parity remain unverified.



Prototype terisolasi berdasarkan `D:/pi-ic4ruz/PI-IMPLEMENTATION-PLAN.md`.
Runtime kandidat **1.0.0+reason-ui.4**, berbasis Pi resmi 1.0.0, provider slot **9router/cx/gpt-6-sol**.
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
mengganti config: gunakan entrypoint live eksplisit dengan allowance baru, atau
runner evaluasi dengan campaign terpisah. `--offline` Pi sendiri bukan network sandbox; guard Node tambahan
memblokir API network umum pada fixture terpercaya, tidak membatasi arbitrary
process/shell sebagai OS sandbox.

## Verifikasi dan batas

I22 menambahkan layout content-order dan tool adjacency lewat optional hook pada
kandidat terisolasi. Urutan tampilan mengikuti message content; komponen tool asli,
signed reasoning dan isi session tetap dipertahankan. Delapan focused tests,
96 perbandingan layout, scoped strict TS lima file, dan native Windows Ctrl+O /
Ctrl+T / resize / resume / exit lulus. Detail dan batas bukti:
`upstream-patches/transcript-hook/LAYOUT-VERIFICATION.md`.

- T0/O01 awal lulus 13 tes. Full suite terbaru **159/159 PASS**, termasuk 51 tes
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
untuk 54 frame 80x24/120x40 offline replay (surface dark/light adalah fixture);
Windows PTY 80x24/120x40 telah diuji tanpa inference. O14 penuh tetap pending. Untuk rollback tampilan,
ubah `ui.reasonTerminal=false` di `config/harness.json`, lalu restart.
Hook user-message terisolasi sudah disetujui dan aktif: teks literal, marker,
indentasi, wrapping dan optional measured surface. Komponen actual cocok dengan
source oracle Reason CLI 0.2.269 pada 16/16 fixture; native Windows resume/exit
lulus. Ini belum membuktikan whole-transcript/menu parity.
`config/runtime-selection.json` memilih `transcript-hook-v1`; `stock` memulihkan
runtime asli setelah restart. Hook teks assistant kini mempertahankan indentasi/tab
dan styling quote/code fence; 80/80 fixture nonempty cocok dengan source Reason.
Build memakai esbuild; strict TypeScript checking 5 file patch lulus terhadap
deklarasi kandidat, bukan seluruh monorepo upstream. Native resume/code/Unicode/
paste/clear/exit lulus. Reasoning kini collapsed dengan ringkasan per blok;
Ctrl+T/klik membuka Markdown dim/italic berindentasi tiga kolom. Replay reasoning
96/96 cocok; native Ctrl+T expand/collapse dan exit lulus. Visibility Pi tetap
persisten: set `hideThinkingBlock:false` untuk default expanded pada rollback.
Splash/startup dan working/shimmer kini memakai hooks upstream tanpa patch baru:
Pi art/identitas aktual, startup 2400 ms, shimmer 1400+500 ms, lifecycle cleanup.
Native resize sampai 32x16, Escape cancel, Unicode, clear dan exit lulus.
Bukti terbaru: `upstream-patches/transcript-hook/LAYOUT-VERIFICATION.md`; detail reasoning tetap pada
`upstream-patches/transcript-hook/THINKING-VERIFICATION.md`.
Source, profil dan launcher `pi` / `pi-clean` tetap terpisah.

Lihat `docs/ROLLBACK.md` untuk kembali ke workflow lama dan `docs/DEVIATIONS.md`
untuk batas bukti. Backlog utama tetap di `D:/pi-ic4ruz`.
