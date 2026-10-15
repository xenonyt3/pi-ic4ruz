# Status implementasi T1-T5

## Startup / working continuation: reason-ui.3, tanpa patch baru

Implemented: header responsif dengan Pi art dan identitas runtime/model/workspace
aktual; animasi startup 2400 ms; working widget/shimmer source 1400+500 ms.
API upstream setHeader/setWidget/setWorkingVisible dipakai; retry/compaction tetap
terlihat di atas editor. Timer berhenti pada terminal state, reset, shutdown dan
fallback; tidak ada perubahan runtime kandidat atau stock.

Tested: 8/8 focused tests, 80 shimmer + 160 working-row source comparisons,
9 raster + 35 layout comparisons dengan Pi art/name substitution eksplisit.
Actual SDK stream/tool/complete/error/abort dan zero animation timers PASS;
4-file scoped strict TS tetap 0 diagnostics. Full acceptance **151/151 PASS**,
termasuk 43 UI tests, tanpa failed/cancelled/skipped. Source, kedua runtime,
baseline/fork dan vault unchanged; receipt lengkap dan unexpected network attempts 0.
Report `artifacts/verification/runs/2026-10-15T03-37-40.526Z/report.json`.

Runtime-verified: ConPTY SDK idle/thinking/writing/tool/complete/error/Escape cancel;
production launcher real identity, resize 120x40/80x24/32x16, Unicode multiline,
Ctrl+C clear dan Ctrl+D exit 0. Receipt `artifacts/ui-replay/windows-pty-startup-working.json`.
48 frame replay; empat PNG lengkap diperiksa. Tidak ada inference berbayar.

Unknown: full transcript/grouping/tool order, menus, native color autodetection,
live Reason frames/timing dan O14 penuh. Brain production tetap ditunda.
Evidence: `docs/STARTUP-WORKING-VERIFICATION.md`. Bagian berikut adalah histori.

## Milestone reasoning: reason-ui.3

Implemented: ringkasan reasoning per blok, expanded dim/italic padding 3 default,
blank row text->thinking, optional callback dengan stock fallback. Profil prototype
memulai collapsed; Ctrl+T Pi tetap menyimpan visibility preference. Tested: 4-file
strict typecheck/0 diagnostics, 7 thinking tests, 96 reasoning/80 assistant/16 user
source fixtures PASS; actual SDK dua thinking + dua text deltas dan lifecycle PASS.
Runtime-verified: native Windows Ctrl+T expand/collapse, Unicode, Ctrl+D exit 0 dan
isolated resume hint. Full acceptance **143/143 PASS**, termasuk 35 UI tests,
0 failed/cancelled/skipped, source/vault/baseline dan kedua runtime unchanged,
receipt lengkap serta unexpected network attempts 0. Report
`artifacts/verification/runs/2026-10-15T03-03-34.532Z/report.json`. Lihat
`upstream-patches/transcript-hook/THINKING-VERIFICATION.md`.

40 frame replay, dua viewport PNG diperiksa. Whole transcript/grouping/tool order,
splash/shimmer/menu/native color/live Reason parity tetap belum selesai.
Bagian kandidat sebelumnya di bawah adalah histori; Brain production tetap off.

## Kandidat assistant terbaru: reason-ui.2

Implemented: optional assistant-text renderer, raw indentation/tab, quote/fence
style source Reason, transformers dan user outputPad dipertahankan. Tested: strict
TypeScript 4 file patch/0 diagnostics (skipLibCheck; bukan monorepo), 7/7 assistant
tests dan 7/7 hook tests, 80/80 assistant serta 16/16 user source replay. Actual SDK
host memakai production adapter untuk dua delta stream, fallback/reset/resume/fork/
reload. Runtime-verified: Windows 120x40 resume, indented code/Unicode, paste,
Ctrl+C clear, Ctrl+D exit 0. Full acceptance final **136/136 PASS**, termasuk 28 UI
tests; 0 failed/cancelled/skipped, receipt lengkap, source/vault/baseline dan kedua
runtime unchanged, unexpected network attempts 0. Report:
`artifacts/verification/runs/2026-10-15T02-42-40.795Z/report.json`.

Evidence: `upstream-patches/transcript-hook/ASSISTANT-VERIFICATION.md`. Replay kini
32 frame; dua viewport PNG direview. Empty/whitespace-only messages tetap suppressed
Pi; whole-transcript/shimmer/menu/native color/live Reason parity masih terbuka.
No paid inference; Brain production off. Bagian kandidat .1 berikut adalah histori.

## Kandidat UI terbaru

User-message hook disetujui dan aktif sebagai `1.0.0+reason-ui.1` melalui
`config/runtime-selection.json`. Salinan source/build berada di
`upstream-patches/transcript-hook/`; runtime stock/fork/baseline dipertahankan.
Implemented: literal text, marker/indentation/wrapping, optional measured surface,
stock fallback dan reset/reload. Tested: 7/7 focused hook tests dan 16/16
source-oracle comparisons; full acceptance final **129/129 PASS**, termasuk 21 UI
tests, 0 failed/cancelled/skipped, source/vault/baseline dan kedua runtime unchanged,
receipt lengkap serta unexpected network attempts 0. Report:
`artifacts/verification/runs/2026-10-15T02-14-35.351Z/report.json`. Runtime-verified: Windows
120x40 resume, literal punctuation/Unicode, Ctrl+D exit 0 serta hint resume yang
memakai launcher prototype. Native receipt `windows-pty-user-hook-final.json`
di `artifacts/ui-replay/`. No paid inference; Brain production tetap off.
Build memakai esbuild transpilation, belum full TypeScript typecheck.

## Implemented

- T1: facade `createCodemodeExtension`, models:false, deadline default 300 s,
  ceiling input 900 s dengan cleanup grace host 1 s untuk timeout eksplisit;
  registry/path policy dan prompt behavior sendiri. Initial loadout lima tool.
- T2: factory file/shell upstream, PowerShell deferred, canonical roots,
  writer lease lintas proses, kill-tree confirmation dan retention bila cleanup
  tidak pasti. File operations tetap memakai queue upstream.
- T3: compaction/store upstream, pointer task pada custom entries, curated
  Brain config, request/schema hashes, bounded nested telemetry, usage unknown
  bila receipt hilang, cache warming off. Tidak menyalin seluruh konfigurasi fork.
- T4: dua profil dengan registry allowlist, tiga slot atomik sejak starting,
  prefix partial, owner/branch, delivery claim, follow-up same ID, cancel,
  shutdown dan stale-state recovery tanpa auto inference.
- T5: suite runner/core/windows/context/delegation/provider/all, manifest hash,
  baseline/vault audit, network guard receipts, dry-run eval dan budget accounting.
  Runner live memakai broker parent, ledger durable, acceptance hash gate,
  verifier isolated dengan receipt 12 assertion/source hash, dan cleanup gate.

## Tested dan runtime-verified

Full suite sebelum pilot **105/105 lulus**, tanpa failed/cancelled/skipped.
Baseline/fork, Markdown vault, dan frozen source/config unchanged;
unexpected network attempts 0. Report final:
`artifacts/verification/runs/2026-10-14T22-48-00.025Z/report.json`.

Lihat `artifacts/verification/all-latest.json` untuk hasil final dan hash file
tes/config yang dijalankan. Tes memakai SDK/QuickJS/compaction/transport
converter upstream aktual dengan model stream/fetch/MCP sintetis. Worker dan
process-tree fixtures berjalan di Windows; ini lebih kuat daripada unit stubs,
tetapi tes offline tersebut tidak memakai inference provider nyata.

Pilot live Astra/9router `2026-10-15-astra-small-01` kemudian selesai:
A/B/C masing-masing kode lulus 12 assertion, tetapi C tidak menjalankan child,
sehingga overall **passed:false**. Total 11 request, 42441 input token, 600
output token, 29.633 detik. Semua cleanup confirmed dan baseline audit passed.
Model response `gpt-6-astra`; Brain off; harga unknown. Evidence:
`artifacts/evaluations/2026-10-15-astra-small-01/report.json` dan `ledger.json`.

Trace C menunjukkan discovery tanpa await. Petunjuk async discovery telah
diperjelas, dengan regresi offline real SDK/QuickJS yang menemukan tool,
spawn/wait satu brokered child, kemudian edit. Targeted suite live 12/12 lulus;
full acceptance setelah perubahan **106/106 lulus**, 0 failed/cancelled/skipped,
source/vault unchanged, unexpected network attempts 0. Report terbaru:
`artifacts/verification/runs/2026-10-14T22-58-35.210Z/report.json`.
Perbaikan ini belum runtime-verified melalui provider live; campaign asli tidak diulang.

Rerun C dengan budget tambahan 8 request kemudian dijalankan. Bagian pertama
memakai 4 request tetapi entrypoint `--input-type=module -e` merusak startup
worker QuickJS. Bagian kedua memakai file `.mjs` dan hanya sisa allowance:
discovery, spawn, satu request Astra child, read target, dan parent wait nyata
berhasil; cap request menghentikan child completion dan edit parent. Agregat
8 request / 31522 input / 498 output / 87.832 detik; **C tetap belum lulus**.
Cleanup confirmed, baseline unchanged, Brain off, harga unknown. Bukti:
`artifacts/evaluations/2026-10-15-astra-c-02-aggregate.json`.

CLI sekarang menyediakan `--conditions C`; preflight menolak `--input-type`
sebelum credential/model request. Regresi offline entrypoint ditambahkan;
107 tes lulus tetapi gate agregat gagal karena satu receipt network hilang.
Identitas receipt PID/thread ID diperkuat dengan UUID per lifetime agar tidak
tertimpa ketika PID Windows dipakai ulang, dengan regresi khusus. Full acceptance
terbaru **108/108 PASS**, 0 failed/cancelled/skipped, receipt lengkap,
source/vault/baseline unchanged, unexpected network attempts 0:
`artifacts/verification/runs/2026-10-14T23-52-32.966Z/report.json`.
Tidak ada inference tambahan.

Percobaan full pertama meluluskan 91 tes tetapi report aggregation gagal
karena receipt kosong saat worker dihentikan. Writer receipt diperbaiki menjadi
atomic dengan snapshot awal dan update sebelum network attempt ditolak. Runner
sekarang memeriksa receipt tiap file tes dan menolak laporan yang tidak lengkap.

## Status live terbaru: C-03 PASS

`2026-10-15-astra-c-03` dijalankan lewat CLI `--conditions C` dengan budget
tambahan yang disetujui: 8 request/80000 input/8000 output/600 detik.
Discovery, spawn satu code_explorer, read/diagnosis child, parent delivery/edit,
verifier 12/12 dan cleanup semuanya runtime-verified. Report **passed:true**.
Pemakaian: 7 request (5 parent + 2 child), 28339 input/540 output, 25.023 detik.
Brain off, harga unknown; baseline/fork unchanged, tidak ada proses/lease sisa.
Evidence: `artifacts/evaluations/2026-10-15-astra-c-03/report.json`.
Source/runtime tetap sama dengan acceptance 108/108. Histori gagal di atas
dipertahankan; pilot satu task tidak membuktikan performance equivalence.

## TU0/TU1 terbaru

Source oracle CLI 0.2.269 dan capture demo pemasaran resmi kini tersedia dengan
provenance terpisah. Adapter TU1 awal aktif (`ui.reasonTerminal=true`): theme,
header/footer actual state, editor marker/padding, compact tools dan fallback.
Seluruh implementasi memakai factory/hooks Pi; edit diff, images, expanded
output, input/key handling dan tool execution upstream dipertahankan.

Suite UI **8/8 PASS**; full suite setelah perubahan **116/116 PASS**, 0 skipped,
source/baseline/vault unchanged, unexpected network attempts 0, receipt lengkap.
Report: `artifacts/verification/runs/2026-10-15T00-27-55.259Z/report.json`. Replay
20 frame pada 80x24/120x40 serta lima PNG direview; tiga temuan wrapping/status
selesai. Windows PTY 120x40 berhasil startup, multiline Unicode, Ctrl+C clear,
offline input gate, Ctrl+D exit 0. Host Theme/keybindings realm dan padding
copy ditemukan lewat smoke nyata lalu diperbaiki. PTY 80x24 startup/exit juga
lulus pada source final. Lihat `docs/UI-REFERENCE.md`,
`docs/UI-PARITY.md`, `artifacts/ui-replay/index.html`, dan receipt PTY.

## Unknown dan batas operasional

Lanjutan TU1: surface editor measured dark/light dan border fallback, lifecycle
Thinking/Writing/concurrent tools/error/cancel, serta color-listener cleanup
implemented. **14/14 UI tests PASS**, full suite **122/122 PASS**, 0 skipped,
source/vault/baseline unchanged, receipt lengkap, unexpected network attempts 0.
Report: `artifacts/verification/runs/2026-10-15T00-53-52.781Z/report.json`. Source
o7/A0A menjadi oracle, actual SDK events dan public TUI parser diuji offline.
Native Windows surface auto-detection belum terbukti; border fallback/keys/exit
lulus. Empat fixture gap stock menjadi dasar hook terisolasi yang kemudian
disetujui dan aktif; lihat status kandidat terbaru di awal dokumen.

- Default launcher tetap offline dengan endpoint/key fixture. Live provider
  dan core/codemode/delegation end-to-end terbukti terbatas pada pilot satu task.
  Corpus luas dan live follow-up/cancel/concurrency belum diuji. SDK cost nol bukan harga/tagihan nyata.
- Brain production belum tersambung di default launcher offline. Startup
  recall menghasilkan unavailable secara eksplisit; fake MCP memverifikasi
  allowlist, satu vault, error handling dan reconnect tanpa menulis vault.
- `xhigh` masih di-clamp upstream ke `high` untuk model fixture; limit model,
  grammar live, images dan cache provider belum terbukti. JSON fallback eksplisit.
- fd 10.5.0 kini disalin dari cache baseline dengan hash identik dan cache
  agent terisolasi. Find/grep/ls upstream berhasil di fixture offline; tidak
  mengunduh executable otomatis ketika offline.
- Snapshot process-tree tidak menjamin cleanup semua detached descendants.
  QuickJS dan canonical roots bukan OS sandbox; arbitrary shell memakai hak user.
- Crash tanpa cleanup acknowledgement menahan slot/lease. Tidak menebak bahwa
  PID lama aman untuk dibunuh dan tidak mengulang assignment otomatis.
- TU1 parsial sudah implemented/tested; full transcript/menu,
  native color autodetection dan exact live Reason parity belum. O14 penuh, compaction
  Reason serta benchmark equivalence tetap pending/unknown.
