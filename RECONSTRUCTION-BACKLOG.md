# Bahan backlog rekonstruksi perilaku Reason di Pi Windows

Tanggal audit: 14 Oktober 2026. **Plan disetujui; implementasi bertahap dimulai 15 Oktober 2026 WIB.** Referensi utama [PI-IMPLEMENTATION-PLAN.md](PI-IMPLEMENTATION-PLAN.md), [TRAJECTORY-AUDIT.md](D:/reason-investigation-20261014/TRAJECTORY-AUDIT.md).

Dokumen kerja aktif berada di `D:/pi-ic4ruz`; evidence audit tetap di `D:/reason-investigation-20261014`. UI: **ikuti CLI/terminal Reason** (D13). Persetujuan desain sudah eksplisit; tidak memerlukan persetujuan ulang untuk detail rutin. Pengguna telah mengotorisasi pilot live Astra/9router dengan budget terbatas; hasilnya dilacak pada bagian terbaru berikut.

## Status terbaru: I22 content-order transcript dan tool adjacency - 15 Oktober 2026 WIB

- Implemented: kandidat `1.0.0+reason-ui.4`, optional setTranscriptLayout('content') setelah 12 actual-host gap fixtures membuktikan text/tool order dan separator berbeda dari FeA.showEntry/B0A. Projection memakai komponen tool asli; model/session payload, signatures, execution dan registry tetap utuh. Error result mengalahkan stale running status. Undefined/reset/failure kembali ke layout Pi.
- Tested: **8/8 focused PASS**, **96 visible-row composition comparisons** pada dark/light, reasoning collapsed/expanded, lebar 8/32/80/120; trailing surface padding diabaikan secara eksplisit. User/assistant/reasoning fixtures tetap 16/80/96 PASS. Scoped strict TypeScript **5 file / 0 diagnostics**. Actual SDK streaming, replay/resume, mouse, expansion, image/diff payloads dan fallback/reset/reload lulus.
- Runtime-verified: native Windows resume menunjukkan urutan text/tool benar dan error tetap terlihat; Ctrl+O expand/collapse kedua hasil, Ctrl+T Unicode reasoning, resize 120/80/32 columns, input/clear dan Ctrl+D exit 0. Message records dan final settings unchanged; journal Pi dapat menambah metadata resume. Receipt `P/artifacts/ui-replay/windows-pty-transcript-layout.json`. Gallery 54 frame, tiga PNG layout diperiksa parent.
- Full acceptance pertama **158/159**, seluruh 51 UI tests PASS. Satu tes delegation lama gagal karena Windows EPERM saat rename receipt fixture Task 5; supervisor fail-closed, cleanup confirmed. Pemegang lock unknown. Focused delegation rerun 6/6 lulus tanpa edit logic. Full rerun final **159/159 PASS**, termasuk 51 UI tests, 0 failed/cancelled/skipped; source/kedua runtime/baseline/fork/vault unchanged, receipt lengkap dan unexpected network attempts 0. Report final `P/artifacts/verification/runs/2026-10-15T07-28-50.699Z/report.json`. Report gagal tetap disimpan di `P/artifacts/verification/runs/2026-10-15T07-19-38.166Z/report.json`.
- Unknown: nested codemode composition, custom notices/compaction/branch cards, scroll/menu, native color autodetection dan live Reason parity. **O14 keseluruhan tetap parsial**; ini bukan klaim seluruh transcript/layanan identik. Brain production tetap ditunda, inference berbayar 0. Parent satu writer, tidak ada subagent writer.
- Evidence: `P/upstream-patches/transcript-hook/LAYOUT-VERIFICATION.md`; v3 source/build/pin snapshot disimpan di `history/reason-ui.3`. Rollback `ui.reasonTerminal=false` + restart atau selector `stock`. Runtime installed/clean/fork/profile/launcher mereka tidak diedit.

## Milestone sebelumnya: splash/startup dan working/shimmer - 15 Oktober 2026 WIB

- Implemented I21 di `D:/pi-reason-prototype`: source CLI 0.2.269 Mh/lGA/asA/uGA/o7 dan host timing diverifikasi sebelum edit. Header responsif, braille Pi art/PI wordmark, identitas versi/provider/model/workspace aktual, startup damped rotation 2400 ms, shimmer 1400 ms + pause 500 ms. Memakai API upstream setHeader/setWidget/setWorkingVisible; tidak ada patch/build baru, kandidat tetap `1.0.0+reason-ui.3`.
- Lifecycle: Thinking/Writing/Running tool dari event; overlapping tools tidak hilang saat satu selesai. Idle/error/cancel/reset/shutdown/fallback membuang timer; fallback mengembalikan stock working visibility. Retry/compaction milik Pi kini terlihat di atas custom editor. Pi cancel binding, waktu elapsed aktual dan context semantics tetap digunakan.
- Tested: **8/8 focused tests PASS**, 80 exact shimmer + 160 working-row source comparisons; 9 raster + 35 layout comparisons dengan Pi art/name substitution eksplisit. Actual SDK synthetic stream/tool/complete/error/abort dan nol animation timers lulus. **4-file scoped strict TS, 0 diagnostics**. Full acceptance **151/151 PASS**, termasuk 43 UI tests, 0 failed/cancelled/skipped; agregat PASS, source/kedua runtime/baseline/fork/vault unchanged, receipt lengkap, unexpected network attempts 0. Report `P/artifacts/verification/runs/2026-10-15T03-37-40.526Z/report.json`; tidak ada proses Node prototype/native verification Electron tersisa.
- Runtime-verified: ConPTY SDK idle/thinking/writing/tool/complete/error dan **Escape cancel aktual**; resize 120x40 -> 80x24 -> 120x40; Unicode; zero adapter animation timers. Production launcher identitas aktual, resize 120x40/80x24/32x16, multiline Unicode paste, Ctrl+C clear dan Ctrl+D exit 0. Receipt `P/artifacts/ui-replay/windows-pty-startup-working.json`. 48 frame replay; empat PNG lengkap direview parent, bukan independent/live Reason capture.
- Unknown/deviation: art milik Pi menggantikan Reason; empty resumed branch dapat dianggap fresh oleh branch-based heuristic Pi. Whole transcript/grouping/tool composition, menus, native color autodetection dan live Reason frames/timing tetap terbuka. **O14 penuh tetap pending**. Brain production ditunda, vault tetap `D:/.vault-brain/vault`, model requests 0 dan campaign live tidak diulang.
- Evidence/rollback: `P/docs/STARTUP-WORKING-VERIFICATION.md`; `ui.reasonTerminal=false` + restart untuk stock presentation, selector `stock` tetap tersedia. Parent satu writer; clean/fork/profil/launcher mereka tidak diedit.

## Milestone sebelumnya: reasoning presentation dan spacing - 15 Oktober 2026 WIB

- Implemented I20: kandidat `1.0.0+reason-ui.3`, optional thinking renderer di dalam MouseRegion upstream. Ringkasan per-run mengikuti deI (bold heading terakhir/first nonempty line); expanded Markdown dim/italic dengan outputPad+2. Blank row text->thinking ditambahkan hanya pada custom renderer sukses; tool order, signatures dan transcript tidak diubah.
- Tested: **4 file strict TS, 0 diagnostics**, **7/7 thinking tests**, source replay **96/96 reasoning + 80/80 assistant + 16/16 user PASS**. Actual SDK production adapter menerima dua delta thinking dan dua text, toggle/fallback/reset/resume/fork/reload lulus. Full acceptance **143/143 PASS**, termasuk 35 UI tests, 0 failed/cancelled/skipped; source/vault/baseline dan kedua runtime unchanged, receipt lengkap, unexpected network attempts 0. Report `P/artifacts/verification/runs/2026-10-15T03-03-34.532Z/report.json`.
- Runtime-verified: Windows 120x40 resume, collapsed summary, Ctrl+T expand menampilkan Unicode, Ctrl+T collapse kembali, Ctrl+D exit 0; isolated resume hint. Receipt `P/artifacts/ui-replay/windows-pty-thinking-hook.json`, tanpa model request. 40 frame replay dan dua viewport PNG diperiksa; bukan live Reason capture.
- Deviation eksplisit: `hideThinkingBlock:true` menjadi default profil prototype; Ctrl+T Pi menyimpan visibility (Reason in-memory). Rollback renderer/runtime tidak mereset preference; set false untuk default expanded Pi. Source host Reason apply juga melewati pesan kosong, sehingga gap empty raw-component sebelumnya bukan bukti host divergence.
- Unknown: whole transcript/entry grouping/tool composition, splash/shimmer/menu, native color autodetection dan live Reason parity. O14 penuh tetap pending. Brain production off, inference tambahan 0. Evidence `P/upstream-patches/transcript-hook/THINKING-VERIFICATION.md`; parent satu writer, reviewer read-only.

## Milestone sebelumnya: assistant-text dan scoped typecheck - 15 Oktober 2026 WIB

- Implemented I19: kandidat `1.0.0+reason-ui.2`, 26.946 file pinned, optional assistant-text hook pada salinan source/build. Raw indentation/tab dipertahankan sehingga indented code tidak berubah menjadi paragraf; quote/fence styling mengikuti source Reason. Pi Markdown/transformers, user outputPad, reasoning/tool/error dan OSC133 tetap berfungsi; hook invalid memakai stock fallback.
- Tested: strict TypeScript 5.9.3 untuk **4 file implementation patch, 0 diagnostics**, terhadap deklarasi kandidat; compiler dipasang offline di tools terpisah. `skipLibCheck` aktif: bukan full monorepo typecheck. Focused assistant **7/7**, hook **7/7**, replay assistant **80/80** nonempty dark/light 80/120 streaming/completed, user **16/16** PASS. Full acceptance **136/136 PASS**, termasuk 28 UI tests, 0 failed/cancelled/skipped; source/vault/baseline dan kedua runtime unchanged, receipt lengkap, unexpected network attempts 0. Report `P/artifacts/verification/runs/2026-10-15T02-42-40.795Z/report.json`.
- Runtime-verified: actual SDK InteractiveMode + production adapter menerima dua delta stream sintetis, fallback/reset/resume/fork/reload tanpa mengubah model transcript. Native Windows 120x40 resume menampilkan assistant code/Unicode, multiline paste, Ctrl+C clear, Ctrl+D exit 0 dan isolated resume hint. Receipt `P/artifacts/ui-replay/windows-pty-assistant-hook.json`; bukan live inference/Reason capture.
- Visual review: 32 frame replay, dua viewport PNG assistant 80/120 diperiksa; review independen read-only tidak menemukan masalah material sesudah outputPad diperbaiki. Parent tetap satu writer. Bukti lengkap `P/upstream-patches/transcript-hook/ASSISTANT-VERIFICATION.md`.
- Unknown/deviation: empty/whitespace-only messages tetap suppressed Pi; whole transcript/reasoning-tool composition, splash/shimmer/menu, native color autodetection dan live Reason parity belum. O14 penuh tetap pending. Inference tambahan 0; Brain production tetap off; rollback adapter/runtime stock tersedia.

## Milestone sebelumnya: hook user-message terisolasi aktif - 15 Oktober 2026 WIB

- Scope I18 disetujui pengguna melalui instruksi melanjutkan UI seperti Reason. Implemented: optional `setUserMessageRenderer`, teks literal/marker/indent/wrap dan measured surface, stock fallback/validation, reset/reload, serta hint resume Windows yang memakai launcher prototype.
- Kandidat `1.0.0+reason-ui.1` aktif melalui `config/runtime-selection.json` = `transcript-hook-v1`. Build/source tersendiri di `P/upstream-patches/transcript-hook/`, 26.944 file kandidat dipin; original runtime tetap tersedia. `pin-runtime.mjs` khusus stock. Tidak mengedit installed node_modules, fork atau baseline.
- Tested: **129/129 full acceptance PASS**, termasuk 21 UI tests, 0 failed/cancelled/skipped. Source/vault/baseline dan kedua runtime unchanged; receipts lengkap, unexpected network attempts 0. Report `P/artifacts/verification/runs/2026-10-15T02-14-35.351Z/report.json`. Focused hook 7/7 PASS; actual component/source oracle CLI 0.2.269 16/16 cocok. Real SDK host menguji fallback/reset/resume/fork/reload dan model transcript unchanged; selector/hash-drift/resume quoting juga diuji.
- Runtime-verified: native Windows 120x40 menampilkan literal Markdown punctuation/Unicode, Ctrl+D exit 0, hint resume dengan launcher prototype dan absolute session path. Receipt final `P/artifacts/ui-replay/windows-pty-user-hook-final.json`; receipt sebelumnya dipertahankan sebagai histori sebelum hint fix.
- Unknown: full TypeScript typecheck (build menggunakan pinned esbuild transpilation), native color autodetection, whole transcript/splash/shimmer/menu dan live Reason capture. 24 frame preview dan PNG dark/light merupakan fixture sintetis, bukan capture Reason. O14 penuh tetap pending.
- Rollback adapter: `ui.reasonTerminal=false` lalu restart. Rollback runtime: pilih `stock` pada runtime-selection lalu restart. Inference tambahan 0; Brain production tetap ditunda. Detail build/evidence `P/upstream-patches/transcript-hook/VERIFICATION.md`.

## Milestone sebelumnya: surface editor dan lifecycle O14 - 15 Oktober 2026 WIB

- Implemented lewat API upstream: surface editor mengikuti warna terminal yang dilaporkan (10% mix dark / 6% light); background unknown/NO_COLOR mempertahankan border. Query tidak memanggil model/server; listener dan late reply dibersihkan saat UI berhenti.
- Lifecycle UI kini mengikuti event SDK: Thinking/Writing, tool yang masih aktif saat tool lain selesai, error/cancelled setelah turn end, dan context unknown sesudah compaction. Tidak mengubah tool execution atau input/model transcript.
- Tested: **14/14 UI tests PASS**, mencakup replay editor dan surface terhadap source o7/A0A, real SDK event pipeline, public TUI color parser dengan fake Terminal, shutdown late-reply dan overlap tool. Full suite **122/122 PASS**, 0 failed/cancelled/skipped, source/vault/baseline unchanged, receipt lengkap, unexpected network attempts 0: `P/artifacts/verification/runs/2026-10-15T00-53-52.781Z/report.json`.
- Runtime-verified: native Windows 120x40 border fallback, multiline Unicode, Ctrl+C clear, Ctrl+D exit 0. Native adaptive-color auto-detection belum terbukti; controlled OSC attempts tidak menunjukkan surface redraw. Capture dark/light adalah fixture sintetis. Receipt `P/artifacts/ui-replay/windows-pty-surface-fallback.json`; preview kini 24 frame.
- Gap transcript dibuktikan empat kasus 80/120 kolom: UserMessageComponent tetap memformat Markdown/padding, sedangkan source Reason menampilkan teks literal dengan marker. Ini capability gap, bukan klaim bug upstream. Evidence `P/upstream-patches/transcript-hook/reproduction.json`.
- Pada milestone ini proposal hook masih menunggu scope review; status tersebut digantikan persetujuan dan implementasi I18 pada bagian terbaru. Evidence gap stock tetap dipertahankan; inference off dan Brain production ditunda.

## TU0 diperluas, TU1 awal aktif - 15 Oktober 2026 WIB

- TU0: binary resmi CLI 0.2.269 dan hash sumber diverifikasi; fungsi renderer diekstrak sebagai source oracle (tanpa entrypoint/service Reason). Demo terminal situs resmi ditangkap dan ditandai HTML pemasaran, bukan live capture. Evidence: `P/artifacts/ui-reference/20261015/` dan manifest.
- Implemented: `src/reason-ui.mjs`, `src/ui-runtime.mjs`, wiring pada `src/harness.ts`, `ui.reasonTerminal=true`. Hooks/factory Pi upstream untuk theme, header, footer, custom editor, compact tool output; edit diff/images/expanded output tetap upstream. Tidak patch node_modules, fork, baseline, tool execution atau provider.
- Tested: suite UI **8/8 PASS**, termasuk perbandingan tool header terhadap source oracle, error/status wrapping, key/paste/Unicode/resize, fallback, host Theme constructor, dan real SDK tool pipeline. Defect native Theme realm dan keybindings/padding host diperbaiki. Full acceptance **116/116 PASS**, 0 failed/cancelled/skipped, receipt lengkap, source/vault/baseline unchanged dan unexpected network attempts 0: `P/artifacts/verification/runs/2026-10-15T00-27-55.259Z/report.json`.
- Runtime-verified: Windows PTY 120x40 menampilkan adapter, menerima multiline Unicode, Ctrl+C clear, menolak prompt melalui offline gate dan Ctrl+D exit 0; PTY 80x24 startup/key hints/exit 0 juga lulus. Receipts `P/artifacts/ui-replay/windows-pty-120x40.json` dan `windows-pty-80x24.json`. Ada 20 frame fixture pada 80x24/120x40 serta lima screenshot; review independen menerima tiga perbaikan untuk scope parsial, bukan seluruh O14.
- Unknown: capture live Reason, font terminal referensi, full transcript/user framing, adaptive surface, splash/shimmer/menu parity dan semua state lintas session. TU1/I17 parsial; O14 penuh pending. Tidak ada inference tambahan; Brain production tetap ditunda.
- Preview: `P/artifacts/ui-replay/index.html`. Rollback: `ui.reasonTerminal=false` lalu restart. `P = D:/pi-reason-prototype`.

## Pilot C PASS - 15 Oktober 2026 WIB

- Campaign baru `2026-10-15-astra-c-03` diotorisasi dengan budget tambahan 8 request / 80000 input / 8000 output / 10 menit. Dijalankan melalui CLI `--live --budget artifacts/evaluations/2026-10-15-astra-c-03-budget.json --conditions C`; acceptance 108/108 dan hash preflight cocok.
- **Runtime-verified PASS**: awaited discovery, spawn satu code_explorer, child Astra membaca target dan menyelesaikan diagnosis, parent menerima hasil serta mengedit target, verifier 12/12, model stop normal, cleanup confirmed. Ini satu tugas/satu attempt, bukan benchmark luas.
- Pemakaian **7/8 request (5 parent + 2 child), 28339/80000 input token, 540/8000 output token, 25.023/600 detik**. Seluruh raw usage accounted; tidak ada fallback, stop budget atau error. Brain off; harga uang unknown.
- Evidence: `D:/pi-reason-prototype/artifacts/evaluations/2026-10-15-astra-c-03/report.json`, `ledger.json`, parent/child session dan receipt. Audit akhir runner: 5599 file baseline/fork dan satu sumber tool unchanged; tidak ada proses Node prototype/lease tertinggal. Source/runtime tidak diubah pada campaign ini; acceptance offline tetap 108/108.
- Pilot A/B awal dan C terbaru kini masing-masing pernah lulus. Run gagal tetap tersimpan; perubahan prompt/perbaikan antar-run tidak dianggap perbandingan performa terkontrol. I15 pilot kecil terpenuhi; corpus multi-task/attempt, pricing, cache control dan TU1/O14 tetap belum selesai.
- Catatan kualitas C-03: saran child coercion/nullish fallback tidak sesuai kontrak TypeError karena assignment child tidak membawa acceptance criteria lengkap. Parent tetap memperbaiki dengan benar. Follow-up prompt assignment tercatat; PASS lifecycle/hasil akhir bukan bukti semua saran child benar.
- TU0 diperiksa ulang: hash tiga dokumen referensi cocok, tidak ditemukan capture terminal Reason pada inventaris lokal. Aset dock/web/Pi/Harbor bukan bukti terminal Reason. UI child tidak lagi menunggu implementasi T4, tetapi tetap memerlukan referensi visual sebelum TU1.

## Rerun C sebelumnya - 15 Oktober 2026 WIB

- Pengguna menyetujui budget tambahan C-only: 8 request total, 80000 input token, 8000 output token, 10 menit; Astra/9router, Brain off.
- `2026-10-15-astra-c-02`: 4 request, 16202 input/252 output; kode 12/12 PASS, child tidak dibuat. Kesalahan peluncuran oleh parent memakai `node --input-type=module -e` diwariskan ke worker QuickJS dan membuat discovery gagal. Petunjuk await sudah diikuti model; penyebab baru berbeda dari pilot awal.
- Koreksi memakai entrypoint `.mjs` dengan sisa budget yang dihitung dari ledger pertama; clock tidak direset. `2026-10-15-astra-c-02-remainder`: 4 request, 15320 input/246 output, stop `capacity`. Discovery, spawn satu child, request model child, read target, dan parent wait terverifikasi live. Child belum menyelesaikan diagnosis; parent belum mengedit, sehingga verifier 7/12 dan **overall tetap FAIL**. Error child `Connection error.` muncul sesudah read ketika ledger bersama telah mencapai cap, bukan bukti outage 9router.
- Agregat budget tambahan: **8/8 request, 31522/80000 input token, 498/8000 output token, 87.832/600 detik** termasuk jeda antar-run. Semua usage accounted, cleanup confirmed, baseline/fork unchanged; harga uang unknown. Evidence: `D:/pi-reason-prototype/artifacts/evaluations/2026-10-15-astra-c-02-aggregate.json` serta report/session tiap campaign. Budget tidak diperluas.
- Implemented sesudah run: CLI `--live --budget PATH --conditions C`, plus preflight menolak `--input-type` sebelum credential/request. Regresi entrypoint lulus. Full run pertama: 107 tes PASS tetapi gate agregat FAIL karena receipt network harness.test.mjs hilang; report `2026-10-14T23-45-02.431Z` dipertahankan. Identitas receipt PID/thread kini ditambah UUID per lifetime untuk mencegah overwrite saat PID Windows dipakai ulang; regresi PID reuse lulus. Full acceptance final **108/108 PASS**, 0 failed/cancelled/skipped, receipt lengkap, source/vault/baseline unchanged, unexpected network attempts 0: `D:/pi-reason-prototype/artifacts/verification/runs/2026-10-14T23-52-32.966Z/report.json`. Tidak ada inference tambahan.
- T5/I15 belum selesai; live child completion dan end-to-end C masih belum terverifikasi. TU1/O14 tetap menunggu referensi visual Reason; Brain production tetap ditunda.

## Audit dan pilot live Astra awal - 15 Oktober 2026 WIB

- Model: `cx/gpt-6-astra`, provider 9router; katalog model pernah dikonfirmasi lewat GET read-only. Tidak ada fallback ke model lain.
- Budget disetujui: maksimal 12 request model total, 120000 input token, 12000 output token, 15 menit, termasuk parent/child/summary/retry. Brain production ditunda.
- Pilot: satu tugas bugfix fungsi normalisasi string, masing-masing satu attempt A/B/C; shell model ditutup, perubahan hanya pada file target disposable, verifier independen.
- Audit menemukan false PASS dari process.exit(0), cleanup belum menjadi syarat kelulusan, serta acceptance stale. Ketiganya diperbaiki oleh parent; tidak ada subagent writer pada perbaikan ini.
- Verifier baru memerlukan 12 assertion dan receipt dengan hash source. Kelulusan mensyaratkan semua child/lease bersih; gate live memvalidasi ulang hash dan cakupan acceptance.
- Acceptance sebelum live lulus **105/105**, 0 skipped, source/config/vault unchanged, unexpected network attempts 0: `D:/pi-reason-prototype/artifacts/verification/runs/2026-10-14T22-48-00.025Z/report.json`.
- Live campaign `2026-10-15-astra-small-01` selesai: **11 request, 42441 input token, 600 output token**, 29.633 detik. Raw SSE usage seluruh request tercatat; response model `gpt-6-astra`, harga unknown. Report: `D:/pi-reason-prototype/artifacts/evaluations/2026-10-15-astra-small-01/report.json`.
- A core tools: 3 request, 10723 input/172 output, verifier 12/12 PASS. B codemode: 4 request, 15859 input/213 output, verifier 12/12 PASS. C codemode+child: 4 request, 15859 input/215 output, verifier 12/12 PASS tetapi tidak ada child. **Overall passed:false** karena delegasi C tidak dijalankan.
- Trace C menunjukkan `searchTools` tanpa `await` menghasilkan `{}`, lalu model melewati delegasi. Petunjuk async discovery diperjelas setelah run; regresi offline actual SDK/QuickJS + brokered child lulus. Targeted suite live **12/12 lulus**; acceptance penuh setelah perubahan **106/106 lulus**, 0 failed/cancelled/skipped, source/vault unchanged dan unexpected network attempts 0: `D:/pi-reason-prototype/artifacts/verification/runs/2026-10-14T22-58-35.210Z/report.json`. Perbaikan petunjuk belum runtime-verified dengan provider live.
- Seluruh kondisi cleanup confirmed; audit sesudah live: 5599 file baseline/fork dan satu sumber tool unchanged. Tidak ada proses Node prototype/lease pilot tertinggal. Brain production tetap off, default launcher offline; campaign tidak direset atau diulang.
- I15 tetap parsial: live provider/core/codemode terverifikasi pada satu tugas; live child, corpus multi-task, harga, controlled cache, dan UI O14 belum terverifikasi. Tidak ada klaim savings/uplift.

Arahan concurrency terbaru: D08 memakai **maksimal tiga subagent aktif bersamaan di luar parent** (`maxActiveChildren: 3`), bukan dua. Satu writer per shared workspace tetap berlaku; jumlah child dipilih sesuai pekerjaan independen, bukan wajib tiga pada semua task.

Pembaruan evidence: [BASELINE-CONTRACTS.md](D:/reason-investigation-20261014/BASELINE-CONTRACTS.md) dan [CODEMODE-CONTRACT.md](D:/reason-investigation-20261014/CODEMODE-CONTRACT.md). B01-B06 tetap mengikuti snapshot audit. T0-T4 dan paket offline T5 telah diimplementasikan. Inventaris TU0 tersedia; TU1/O14 dan I15 penuh belum selesai. Status pilot dan verifikasi terbaru berada di atas; 94 tes di catatan awal merupakan milestone historis.

## Pelaksanaan aktual - 15 Oktober 2026 WIB

`P = D:/pi-reason-prototype`. Satu writer (parent); dua subagent hanya melakukan inspeksi/review read-only. Runtime dipasang dari lock baseline dengan `npm ci --offline --ignore-scripts --no-audit --no-fund`, tanpa symlink ke fork. Shared Brain context/search dijalankan pada vault yang ditentukan; keyword search tidak menemukan konteks cocok, sehingga plan/source menjadi acuan, bukan asumsi dari recall kosong.

| Tahap / item | Implemented | Tested | Runtime-verified | Unknown / belum selesai |
| --- | --- | --- | --- | --- |
| T0 / I01 | Selesai: launcher .mjs/.cmd/.ps1; isolated profile; pinned runtime 1.0.0; hash audit; offline guards; runner/fixtures; rollback docs | **13/13 lulus** pada milestone T0, 0 skipped; 5.599 hash baseline/fork unchanged | Version/help; read-only RPC state/commands/models; own session resume/continue; input budget gate; Windows PTY startup dan Ctrl+D exit 0 | Default launcher tetap offline; bukan kesiapan produksi |
| TU0 / I16 | Source oracle CLI 0.2.269, marketing demo berlabel, UI-REFERENCE/PARITY, manifest dan peta hooks | Hash binary/source cocok; exact tool-header comparison 12/80/120 columns | Source-derived fixtures; bukan live Reason capture | Font/live frames dan exact full parity unknown; versi docs 0.2.261/Windows 0.2.136 dipisahkan |
| T1 / I02-I04 | Implemented: facade upstream codemode, deadline, policy/discovery dan prompt guidelines | O02-O04 lulus; petunjuk async discovery diperjelas sesudah pilot | AgentSession + QuickJS offline; core/codemode Astra live pada satu tugas | Live child belum terbukti; Reason server overrides unknown |
| T2 / I05-I06 | Implemented: owned shell operations, process confirmation, writer lease lintas proses | O05-O07 termasuk barrier, path/BOM/CRLF/image/output limits dan lock conflicts | Git Bash/PowerShell/ordinary process tree native Windows; find/grep/ls offline | Detached descendants universal cleanup tetap unknown; bukan OS sandbox |
| T3 / I07-I10 | Implemented: context/pointers, curated Brain adapter, telemetry dan provider fixture | O08-O11: real store/branch/resume/compaction/overflow; fake MCP/SSE/grammar/reconnect | Runtime SDK offline serta raw SSE usage dari pilot Astra/9router | Brain production ditunda; harga/limit/grammar/images provider unknown; default launcher offline |
| T4 / I11-I13 | Implemented: SDK worker, dua profile, tiga slot atomik, owner/branch, prefix, claim, follow-up/cancel/recovery; broker model parent | O12-O13 dan native broker worker fixtures; alur discovery/spawn/wait/edit C offline lulus | Campaign C-03: Astra child read/diagnosis completed, parent delivery/edit dan cleanup live PASS | Live follow-up/cancel/concurrency luas masih belum; harga unknown |
| T5 / I14-I15 | I14 core offline selesai; I15 dry-run, shared budget ledger, isolated verifier, CLI kondisi dan live driver tersedia | **159/159 full suite terbaru**, 0 skipped, receipt lengkap; P/artifacts/verification/all-latest.json | A/B pilot awal PASS; C-03 end-to-end PASS sebelum UI: 7 request/28339 input/540 output | Pilot kecil terpenuhi; corpus luas/pricing/performance belum; release lengkap menunggu O14 |
| TU1 / I17-I22 | Parsial: theme/header/footer/editor/tools, surface/lifecycle, user/assistant/thinking hooks, splash/working dan content-order layout | 51 UI tests PASS; 16 user/80 assistant/96 reasoning + 284 startup/working + 96 composition comparisons; strict5-file typecheck | Windows literal/code/Unicode/resume/CtrlT, native streaming/Escape cancel, 120/80/32-column resize, exit0 dan timer cleanup | Nested tools/notices/scroll/menu, native surface autodetection, live Reason parity dan O14 penuh belum |

Evidence T0: `P/artifacts/verification/baseline.json` mencatat 5.599 file source/config/launcher yang dilindungi; `P/config/runtime-identity.json` mem-pin 15.055 file seluruh installed runtime tree. Audit membandingkan hash tanpa mencatat isi credential. `rpc-smoke.json` memakai counter **blocked network attempts**, bukan packet capture OS. Endpoint dan key pada models.json adalah fixture localhost, tidak disalin dari profil produksi.

Kelanjutan T1-T5: snapshot T0 runtime disimpan sebagai `config/runtime-identity-t0.json`; identity aktif kini 27.009 file. Helper resmi pi-ai/pi-codemode 1.0.0 dan typebox 1.3.27 dipin langsung. Cache npm offline tidak lengkap untuk helper, sehingga dependency tambahan diambil dari registry dengan install scripts disabled; ini bukan inference. fd 10.5.0 disalin dari cache baseline, hash sumber/tujuan identik dan sumber tidak diedit.

Satu writer tetap parent pada prototype; tiga subagent menulis pada staging independen `D:/pi-reason-staging/t2`, `t3`, `t4`, lalu parent membaca dan mengintegrasikan. Implementasi dibaca/review sebelum salin; tidak ada patch node_modules/fork atau dependency server Reason.

Percobaan full awal: 91 tes lulus tetapi agregasi report gagal karena receipt kosong saat worker berhenti. Writer report diperbaiki atomik dan mengaudit kelengkapan receipt. Percobaan berikutnya 90/91 karena fixture abort memakai timer sebelum tool start; diganti barrier dan targeted test lulus. Runner final membekukan hash source/test/config sebelum run, menolak perubahan saat run, mengecek baseline/vault/network dan tidak menyamarkan run gagal. Artefak historis dipertahankan.

**Milestone offline awal (historis):** `node P/scripts/verify-offline.mjs --suite all` lulus 94/94, 0 failed/cancelled/skipped. Report: `P/artifacts/verification/runs/2026-10-14T18-31-57.462Z/report.json`. Baseline/fork 5.599 file dan hash fd sumber unchanged; Markdown vault serta source/config selama run unchanged; unexpected network attempts 0. `evaluate-tasks.mjs --dry-run` berhasil; `--live` tanpa budget exit 1 `BUDGET_REQUIRED` sebelum request. Status setelah audit dan pilot ada pada bagian terbaru di atas.

Temuan nyata: configured xhigh di-clamp upstream ke high pada model fixture; SDK cost nol bukan harga terverifikasi; fd belum ada dan download dilewati saat offline. Error hook before_agent_start/before_provider_request ditangkap upstream, sehingga budget gate memakai input handled + cancel compaction dan Node network guard. Semua batas dicatat pada `P/docs/DEVIATIONS.md`.

Perintah T0 yang dijalankan: `npm ci --prefix P/runtime --offline --ignore-scripts --no-audit --no-fund`, `node P/scripts/audit-baseline.mjs --freeze`, `node P/scripts/pin-runtime.mjs`, `node P/scripts/verify-offline.mjs --suite core`, dan `node P/launch.mjs` di Windows PTY. Pada kelanjutan, suite core/windows/context/delegation/provider tersedia dan seluruhnya dicakup `--suite all`; `--suite provider` juga dijalankan terpisah. UI replay O14 belum dijalankan. TUI terbaru tetap startup/exit tanpa prompt.

## Sasaran plan

Harness Pi Windows yang menyediakan kontrak codemode/tools dan pola context efisien yang dapat dibandingkan dengan bukti Reason. Provider sendiri dan satu vault Brain `D:/.vault-brain/vault` menjadi constraint desain. Prototype yang diajukan: `D:/pi-reason-prototype`, terpisah dari `D:/pi-clean` dan fork `C:/Users/M S I/.pi`. Tidak menjanjikan clone server Reason, benchmark identik, atau mengganti workflow/orchestrator aktif.

## P0 — status celah bukti untuk desain

| ID | Item | Bukti sekarang | Acceptance untuk siap masuk plan implementasi |
| --- | --- | --- | --- |
| B01 | Tetapkan versi baseline | Selesai: snapshot kontrak 1.3 C2 v7, model Sol xhigh; prompt/schema match 3 referensi dan hash tersimpan | Exact1.1 dan baseline performa single-build tetap belum tersedia; jangan campur label |
| B02 | Dapatkan corpus single-build dengan ekspor lebih lengkap | Masih terbuka: trace bercampur build dan missing build metadata; batas ini tertulis dalam plan | Tidak memblokir prototype kontrak berlabel desain Pi; tetap memblokir klaim exact clone/performance equivalence. Follow-up riset, bukan benchmark berbayar otomatis |
| B03 | Ambil dokumen codemode dan kontrak helpers | Source npm Pi 1.0.0 dan wrapper, 10 probe Windows lulus; default per lapisan tertulis | Kontrak upstream siap; quota/persistence/override server Reason masih unknown |
| B04 | Tutup kontrak deferred tools/child agent | Tiga child dalam export; assignment exact match, code_explorer dan default beda profiles/tools | Siap untuk dua profile observed; fork_self/context_explorer, enforcement, partial/cancel masih follow-up |
| B05 | Cari bukti compaction | 14 root traces, 3 raw parents/5 children, 597 parent events; tidak ada summary runtime yang teridentifikasi | Reason-specific tetap unknown; source compaction Pi 1.0.0 tersedia sebagai opsi eksplisit tanpa klaim identik |
| B06 | Read-only audit Pi lokal terbaru | Selesai untuk scope planning: launch chain, settings, package/exports, ESM import Windows, source map hashes, API hooks/discovery/SDK/Windows tools/provider config | Plan evidence P01-P11 dan gap matrix; runtime activation dibedakan dari installed API. Integration fixtures tetap belum dijalankan |

## P1 — kontrak spesifikasi yang dijabarkan dalam plan

| ID | Item | Dasar | Acceptance spesifikasi |
| --- | --- | --- | --- |
| B07 | Kontrak lima tools dan direct/codemode result | E02, E05, E06, E07, E13 | Input/output/error types, timeout satuan detik, offset 1-based, truncation/paging, edit terhadap original, binary/image handling tertulis |
| B08 | Kontrak codemode runtime | E03, E04, E10 | Pilihan runtime dibahas dengan tradeoff; deklarasi kemampuan yang tersedia dan enforcement cocok; semantics async/await/return/cancel tidak hanya mengikuti contoh sukses |
| B09 | Kontrak discovery | E08, E09 | Manifest tool stabil, detail dimuat sesuai kebutuhan, naming dan hasil not-found disepakati, API child tidak mengubah izin pengguna |
| B10 | Context dan cache observability | E01, E11, E12 | Catat model-visible prompt/schema, usage per request, cache counters dan compaction; tidak mengekspos credential dalam log |
| B11 | Adapter native Windows | Probe sebelumnya plus kontrak source | Pilih PowerShell/Git Bash dengan jelas, normalisasi path dan quoting, cancellation/cleanup; source Unix tidak diganti global secara buta |

## P2 — acceptance/replay yang dirinci dalam plan

### B12. Corpus replay offline

Gunakan fixtures sendiri, tanpa menjalankan command mentah dari trajectory. Kasus yang diperlukan: read offset/truncation/Unicode/image, edit unique/non-unique/non-overlap/overlap/BOM/newline, write/new parent dirs, bash stderr/nonzero/timeout/cancel, codemode Promise.allSettled rejection, await/return/exit, output filtering, store/load, unknown tool.

Acceptance: expected contract berasal dari source/schema/observation yang diberi ID; celah bukti dinyatakan. Perbedaan format atau platform yang disengaja terdokumentasi. Tidak menulis tes yang hanya mengulang implementation detail.

### B13. Perbandingan end-to-end

Calon corpus: tugas web/Worker, bugfix lintas file, investigasi repo, dan satu native Windows task yang membutuhkan environment pengguna. Model/effort, starting tree, instructions, permissions dan verifier sama. Jalankan beberapa attempt, ukur correctness/verifikasi manusia, perubahan scope, input/output/cached tokens, biaya, waktu review dan recovery. Benchmark API layanan Reason tetap bergantung pada akun/model/biaya yang disepakati dalam plan.

Acceptance: threshold ditetapkan sebelum run; bedakan deterministic tool equivalence dari variasi model; tidak mengklaim uplift atau savings dari empat/satu contoh. Provider berbeda tidak dipakai untuk membuktikan pengaruh harness saja.

### B14. Release isolation dan rollback

Acceptance plan: extension/profile Pi terpisah; perintah eksplisit memilih prototype; workload harian tidak diganti; rollback konkret; markdown Brain tetap satu vault `D:/.vault-brain/vault`.

## Gate implementasi

Keputusan desain D01-D13 telah disetujui. Dependency/acceptance plan tetap berlaku; pekerjaan rutin berjalan mandiri. Suite core/windows/context/delegation/provider/live/all tersedia. Pilot berbudget yang diotorisasi sudah selesai; campaign tidak boleh direset untuk mengulang inference.

## Status audit yang selesai

- [x] Unduh 10 trajectory publik dari 4 job dan hash/provenance.
- [x] Ekstrak dua system prompts identik dan dua schema sets identik.
- [x] Audit codemode/discovery/child events, metrics, fidelity dan version drift.
- [x] Buat evidence matrix serta backlog dengan dependency/acceptance.
- [x] B06: periksa runtime bersih terpasang dan public APIs, tanpa mengaktifkan codemode/delegation.
- [x] B07-B14: tulis spesifikasi, gap matrix, tahapan, offline acceptance, evaluasi terpisah dan rollback.
- [x] Keputusan desain disetujui; implementasi T0 dan inventaris TU0 dibuat.
- [ ] B02/B04/B05: evidence gaps Reason tetap terbuka sesuai batas pada plan, bukan dianggap selesai karena desain alternatif tersedia.

## Status spesifikasi B07-B14 setelah plan

| ID | Status planning | Implementasi/verifikasi yang masih diperlukan |
| --- | --- | --- |
| B07 | Spesifikasi dan implementasi T1/T2 | O04-O06 offline lulus; image model text-only tetap belum diverifikasi live |
| B08 | Upstream QuickJS + adapter deadline implemented | O02 integrated SDK/wrapper/hooks/store lulus; bukan sekadar sepuluh probe library lama |
| B09 | Deferred registry dan child ownership/profile/partial/follow-up implemented | O03/O04/O12/O13 offline lulus; fork_self/context_explorer tetap ditunda |
| B10 | Compaction Pi, context/store dan provenance usage implemented | O08-O11 offline lulus; exact Reason compaction dan gateway cache tetap unknown |
| B11 | Git Bash/PowerShell factories + owned-process adapter implemented | O05-O07/O13 native offline lulus; bukan OS sandbox/universal detached cleanup |
| B12 | Corpus offline O01-O13, regresi live driver dan TU1 slices tersedia | 143/143 full suite termasuk 35 UI tests; source/helper/oracle/compiler hashes, kedua runtime dan native workers |
| B13 | A/B/C pilot satu tugas berbudget dijalankan | A/B PASS pada pilot awal, C-03 PASS setelah perbaikan; bukan controlled performance comparison atau corpus penuh |
| B14 | Prototype terpisah, launcher eksplisit, rollback konkret | T0 dan T5 core offline lulus; audit sesudah live unchanged; `pi`/`pi-clean` tetap jalur masing-masing; O14 belum |

## Backlog implementasi yang diajukan

Status aktual mengikuti bagian audit/pilot dan tabel pelaksanaan: I01-I13 implemented dan offline-tested; I14 core offline lulus; I15 live driver implemented dan pilot runtime-verified parsial, bukan full pass. `P = D:/pi-reason-prototype`. Detail kontrak dan rollback tetap pada plan bagian 5-6. Tidak mengedit node_modules upstream atau source fork.

I16 diperluas dengan source oracle dan marketing reference; I17 adapter awal implemented/tested, bukan full visual parity. T5 gate akhir tetap O01-O14; core harness dan pemeriksaan UI diverifikasi terpisah.

| ID | Prioritas / tahap | Deliverable exact file/function | Dependency | Acceptance / rollback |
| --- | --- | --- | --- | --- |
| I01 | P0 / T0 | `launch.mjs:assertIsolation/buildChildEnv/validateLaunchArgs`; prototype runtime/lock/agent config; local launcher | Review D01-D04 | O01 + no-prompt RPC; tidak ada hash baseline/launcher berubah. Stop prototype, gunakan launcher lama |
| I02 | P0 / T1 | `extensions/harness.ts:registerHarness`; `src/codemode-policy.ts:registerCodemode/withHostDeadline` | I01; review D05/D07 | O02, five declarations; models:false; deadline berlabel desain. Disable feature dan session baru |
| I03 | P0 / T1 | `src/tool-policy.ts:buildCapabilityManifest/authorizeToolCall/assertNoIdentifierCollisions` | I02 | O03/O04, no forbidden deferred access; hook errors block. Revoke via registry baru/restart |
| I04 | P0 / T1 | `src/context-policy.ts:buildBehaviorGuidelines`; `prompts/harness.md` | I02/I03 | Batching independent, output filtering, only available namespace index; no vendor branding/prompt copy. Restore stock prototype prompt |
| I05 | P0 / T2 | `src/windows-tools.ts:registerWindowsTools/wrapOwnedShellOperations`; `src/process-lifecycle.mjs:terminateTreeAndConfirm` | I03 | O05/O06, native timeout/cancel and exit confirmation. Shell disabled on cleanup failure |
| I06 | P0 / T2 | `src/workspace-ownership.ts:acquireWriterLease/assertWriter/releaseWriterLease` | I05 | O07; parent+child single writer, cross-process limits explicit. Stop conflicting work until lease safe |
| I07 | P1 / T3 | `src/context-policy.ts:registerContextPolicy/restoreRuntimePointers`; compaction settings | I03 | O08/O09; source-backed Pi summary/branch behavior. Disable auto compaction/restart or branch old session |
| I08 | P1 / T3 | `src/brain-config.ts:loadCuratedBrainConfig/verifyVaultBinding/recallSessionContext` | I03; I05 if shell fallback | O11; one vault, fake MCP offline, no child memory. Disable adapter without touching vault |
| I09 | P1 / T3 | `src/telemetry.ts:registerTelemetry/recordRequestEnvelope/recordUsage/redactEvent` | I02/I07 | O10/O11; missing usage unknown; no credentials; no background warming. Disable telemetry, preserve prior receipts |
| I10 | P1 / T3 | `scripts/check-provider-fixture.mjs`; `tests/provider-transport.test.mjs` | I09 | O10; JSON/grammar, SSE, errors/cancel accounting; no external inference. Keep provider live gate closed on failure |
| I11 | P1 / T4 | `src/child-profiles.ts:resolveChildProfile/resolveModelSlot`; `src/child-runner.mjs:createChildSession/runAssignment` | I03/I05/I07/I09 | O12; exact assignment, bounded tools, explicit model, no recursive spawn. Disable delegation |
| I12 | P1 / T4 | `src/child-supervisor.ts:spawnChildren/waitChildren/claimResult`; `src/delegation.ts:registerDelegationTools`; `config/harness.json:maxActiveChildren=3` | I06/I11 | O12/O13; tiga child aktif di luar parent, reservasi slot atomik sejak starting, child keempat tidak start/auto-queue, prefix semantics, owner/branch IDs, delivery race. Slot dilepas sesudah settlement/cleanup; drain/cancel children, preserve sessions |
| I13 | P1 / T4 | `sendChild/cancelChild` in supervisor; crash/reload/shutdown lifecycle | I12 | O12/O13; same session follow-up, no silent restart, cleanup confirmed before lease release. Block new conflicting work if unconfirmed |
| I14 | P2 / T5 | `scripts/verify-offline.mjs`, `tests/fixtures/manifest.json`, `docs/DEVIATIONS.md`, `docs/ROLLBACK.md` | I01-I13 | All O01-O13 pass, no network escape/orphan/baseline changes. Do not advance on failed contract |
| I15 | P2 / T5 | `scripts/evaluate-tasks.mjs`, `docs/EVALUATION.md`, redacted eval artifacts | I14 + separate budget/corpus review | A/B/C pilot with same model/config, three attempts/task proposed; no savings claim from pilot alone. Never auto-replace pi |
| I16 | P1 / TU0 | `docs/UI-REFERENCE.md`, `docs/UI-PARITY.md`, `artifacts/ui-reference/manifest.json`; map source/hooks renderer Pi | D13: CLI Reason telah dipilih | Referensi versi/state/ukuran/provenance; state missing ditandai. Tidak membuka session inference demi screenshot tanpa budget |
| I17 | P1 / TU1 | Awal dikonsolidasikan pada `src/reason-ui.mjs`, `src/ui-runtime.mjs`, wiring `src/harness.ts`; `tests/reason-ui.test.mjs`, `scripts/render-ui-fixtures.mjs`, suite ui | I16 + I01/I02; child status setelah I12 | Adapter parsial diuji; O14 penuh tetap pending; hooks upstream dahulu; rollback ui.reasonTerminal=false + restart |
| I18 | Implemented / retained in I19 | `upstream-patches/transcript-hook/`: source/provenance/patch/build/parity/VERIFICATION; optional user renderer; milestone kandidat 1.0.0+reason-ui.1 | Empat fixture gap + persetujuan pengguna; TU0/I17 | Focused 7/7, oracle 16/16, stock fallback/transcript unchanged, native resume/exit verified; isolated pin/rollback; scoped typecheck kini PASS pada I19 |
| I19 | Implemented / active | `ASSISTANT-VERIFICATION.md`, assistant-text hook, candidate 1.0.0+reason-ui.2, scoped typecheck runner | I18 + gap raw indentation/quote/fence terbukti; pengguna menyetujui lanjut | 4-file strict typecheck PASS, 7 assistant tests, 80 source replays, real SDK stream/lifecycle dan native resume/code/exit PASS; whole transcript/O14 tetap parsial |
| I20 | Implemented / active | `THINKING-VERIFICATION.md`, optional ThinkingRenderer, candidate 1.0.0+reason-ui.3 | I19 + gap summary/indent/spacing terbukti; pengguna menyetujui lanjut | 4-file strict typecheck, 7 thinking tests, 96 source fixtures dan native Ctrl+T expand/collapse/exit PASS; full O14 tetap parsial |
| I21 | Implemented / tested / runtime-verified, bounded slice | `P/src/ui-startup.mjs`, `P/src/reason-ui.mjs`, `P/docs/STARTUP-WORKING-VERIFICATION.md` | I20 + source startup/working verified; task explicitly approved | Existing upstream hooks; actual identity/Pi asset substitution; 8 focused tests, 284 source comparisons, actual SDK/native lifecycle/resize/Escape/cleanup; full acceptance 151/151 PASS, O14 remains partial |
| I22 | Implemented / focused-tested / native-verified | `P/upstream-patches/transcript-hook/LAYOUT-VERIFICATION.md`, reason-ui.4 | Approved continuation; 12 actual host gaps vs FeA.showEntry/B0A | Original-component projection, 8 tests / 96 comparisons / strict5-file TS; native CtrlO/CtrlT/resize/resume/exit; full acceptance 159/159 PASS, O14 partial |

## Evidence follow-up yang tidak boleh disamarkan sebagai implementation task

| ID | Gap | Menghalangi apa | Langkah berikut yang dibolehkan oleh plan |
| --- | --- | --- | --- |
| U01 | Exact1.1/single-build export | Exact clone dan causal benchmark parity | Cari public artifact tambahan bila task riset terpisah; bukan syarat menulis adapter Pi |
| U02 | Reason server codemode quota/store/overrides | Klaim default/lifetime server sama | Tetap label source upstream vs Reason; jangan menganggap 60 s contoh adalah default |
| U03 | Reason compaction trigger/summary | Klaim compaction setara | Gunakan compaction Pi sebagai desain, uji O09; tidak mengejar run mahal otomatis |
| U04 | fork_self/context_explorer dan child enforcement | Profile parity lengkap | Jangan register/advertise MVP; follow-up evidence dan scope desain terpisah |
| U05 | Partial/cancel/delivery/follow-up Reason | Lifecycle equivalence | Tests lokal memakai design oracle; sessions_send observed unavailable tetap dicatat |
| U06 | Provider actual limits/grammar/cache/images/pricing | Live readiness dan cost/performance conclusions | Offline I10; live probe hanya sesudah budget dan konfigurasi jelas |
| U07 | Windows detached process cleanup/OS isolation | Jaminan confinement/cleanup universal | T2/T4 fixtures; adapter tambahan hanya jika failure nyata; no security claim dari taskkill |
| U08 | Referensi lengkap seluruh state CLI Reason dan jangkauan hooks renderer Pi | Klaim UI parity | I16 inventaris source/capture; I17 visual acceptance. Trajectory model-visible/gambar web bukan bukti tampilan terminal |

## Keputusan yang sudah disetujui dan gate tersisa

- Disetujui D01-D03: lokasi prototype dan CLI/extension parent + SDK child, upstream pinned.
- Disetujui D04-D07: provider sendiri, JSON fallback, models:false, PowerShell deferred, deadline host 300 s / maximum 900 s.
- Disetujui D06/D08/D09: code_explorer tanpa shell, satu writer, dua profile MVP, maksimal tiga child aktif di luar parent.
- Disetujui D10/D11: compaction Pi dan Brain parent-only sebagai desain eksplisit.
- Budget pilot awal dipakai 11/12 request, 42441 input/600 output. Budget tambahan C pertama dipakai 8/8 request, 31522 input/498 output; budget C-03 berikutnya dipakai 7/8 request, 28339 input/540 output. Semua campaign tersimpan; tidak ada reset allowance. Budget inference berikutnya serta corpus penuh belum ditentukan.
- Target UI sudah ditentukan: CLI/terminal Reason. Setelah arsitektur disetujui, review tambahan difokuskan pada hasil UI konkret, perubahan scope material, serta budget evaluasi; tidak perlu persetujuan per file/function.
