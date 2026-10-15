# Plan implementasi Pi native Windows berbasis kontrak Reason

Tanggal audit: 14 Oktober 2026. Penulisan plan: sesi 14-15 Oktober 2026 WIB. Status: **DISETUJUI; IMPLEMENTASI BERTAHAP DIMULAI 15 OKTOBER 2026 WIB**.

Dokumen kerja aktif berada di `D:/pi-ic4ruz`; sumber audit tetap di `D:/reason-investigation-20261014`. UI mengikuti **CLI/terminal Reason**. Pengguna telah menyetujui pilihan desain dan memerintahkan implementasi bertahap dari T0. Persetujuan ini menggantikan pembahasan bersyarat pada sesi planning. Pilot Astra/9router kemudian diotorisasi dengan batas 12 request / 120000 input token / 12000 output token / 15 menit; Brain production ditunda.

Status implementasi aktual, hasil tes dan unknown dilacak di [RECONSTRUCTION-BACKLOG.md](RECONSTRUCTION-BACKLOG.md). Bagian evidence dan catatan sesi planning di bawah tetap merupakan snapshot historis; kalimat "belum dibuat/dijalankan sesi ini" di bagian tersebut merujuk sesi planning, bukan status terbaru. Prototype kini berada di `D:/pi-reason-prototype`.

Pembaruan implementasi: T1-T4 terintegrasi; acceptance sebelum pilot T5 lulus
105/105 tes pada 15 Oktober 2026 WIB. Pilot live selesai memakai 11 request;
A/B lulus, C hasil kode lulus tetapi delegasi tidak dijalankan sehingga overall
belum lulus. Brain production dan TU1/O14 tetap unknown. Hasil serta perbaikan
sesudah pilot dicatat di backlog, termasuk full suite terbaru 108/108 lulus.
Rerun C pertama terhenti pada cap. Campaign terbaru C-03 dengan budget tambahan
terpisah kini PASS: diagnosis child, parent delivery/edit, verifier 12/12 dan
cleanup terverifikasi; 7 request/28339 input/540 output dalam sekitar 25 detik.
Pilot kecil terpenuhi; kelulusan core/pilot bukan klaim release lengkap.

Update TU0/TU1: source renderer CLI 0.2.269 terverifikasi dan demo terminal resmi
ditangkap dengan label marketing HTML. Adapter presentation awal aktif melalui
hooks/factories Pi; full suite 116/116 lulus, Windows PTY 80x24/120x40 lulus.
Full transcript/splash/surface/menu dan live Reason capture tetap gap; O14 penuh
belum lulus. Detail terbaru berada di backlog dan docs/UI-PARITY.md prototype.

Slice berikutnya menambahkan measured editor surface dan lifecycle via API Pi;
full suite milestone surface 122/122 lulus. Native color auto-detection belum terbukti.
Empat fixture membuktikan gap user-message renderer; proposal hook terisolasi
tersedia di `P/upstream-patches/transcript-hook/PROPOSAL.md`. Pengguna kemudian
menyetujui kelanjutannya: kandidat terisolasi `1.0.0+reason-ui.1` kini dibangun
dan dipilih melalui runtime selector; stock tetap tersedia. Hook user-message
cocok dengan source oracle 16/16 fixture; native Windows literal framing,
Unicode, resume hint prototype dan exit 0 terverifikasi. Build adalah esbuild
transpilation, belum full TypeScript typecheck. Full acceptance final 129/129 PASS,
source/vault/baseline dan kedua runtime unchanged; detail report di backlog.
Whole transcript/splash/shimmer/menu dan O14 penuh masih parsial.

Kelanjutan yang disetujui: kandidat `1.0.0+reason-ui.2` menutup gap raw indentation
dan quote/code styling assistant melalui hook text-only. Empat file patch lulus
strict TypeScript checking terhadap deklarasi kandidat (bukan full monorepo).
Replay assistant 80/80 nonempty dark/light 80/120 dan real SDK streaming/lifecycle
lulus; native Windows resume/code/Unicode/paste/clear/exit 0 terbukti. Full acceptance
final 136/136 PASS, kedua runtime/source/vault/baseline unchanged; report di backlog.
Empty-message suppression dan whole-transcript tetap Pi.

Kelanjutan reasoning: kandidat `1.0.0+reason-ui.3` menampilkan ringkasan per-run,
expanded dim/italic padding 3 dan separator text->thinking sesuai source.
Strict TS 4 file/0 diagnostics; replay reasoning 96/96, actual SDK delta/lifecycle
dan native Ctrl+T expand/collapse/exit 0 lulus. Profil prototype default collapsed;
visibility preference Pi tetap persisten. Full acceptance 143/143 PASS; source,
kedua runtime/vault/baseline unchanged, detail report dilacak di backlog.
Whole transcript/tool grouping/splash/shimmer/menu/native color tetap terbuka.

## 1. Keputusan arah

Bangun prototype terpisah di `D:/pi-reason-prototype`, memakai paket resmi Pi 1.0.0 dan provider sendiri. Pakai fondasi CLI/TUI, agent loop, QuickJS codemode, discovery, tool pipeline, file tools, session tree, serta compaction upstream. Sesuaikan presentation dan interaksi terminal mengikuti CLI Reason; stock Pi TUI merupakan fondasi awal, bukan target visual final. Tambahkan extension dan adapter kecil untuk policy, lifecycle child, observability, dan cleanup Windows. Tidak melakukan port server Reason, mengganti launcher `pi`, atau mengedit `D:/pi-clean`.

Target fidelity adalah **snapshot kontrak Reason 1.3 / runtime/reason-c2-tools-v7**, bukan clone exact Reason 1.1, server terkini, atau kesetaraan benchmark. Source publik Pi tidak membuktikan override server Reason. Semua nama fungsi/file prototype di dokumen ini adalah **rancangan baru**, belum ada implementasinya.

Urutan bacaan sesi ini: BASELINE-CONTRACTS, CODEMODE-CONTRACT, TRAJECTORY-AUDIT, RECONSTRUCTION-BACKLOG, README pi-clean, verification.json; kemudian bukti tambahan dan paket runtime terpasang. Investigasi tidak menjalankan inference, prompt coding, instalasi paket, atau script mentah trajectory.

## 2. Evidence ledger

Notasi: **S** source terpasang; **D** declaration dalam trajectory; **O** observation runtime terdahulu; **V** pemeriksaan sesi ini; **P** pilihan desain; **U** belum diketahui. Referensi source memakai root:

- `R = D:/reason-investigation-20261014`.
- `U = D:/pi-clean/runtime/node_modules/@earendil-works/pi-coding-agent`.
- `A = U/node_modules/@earendil-works/pi-agent-core`.
- `AI = U/node_modules/@earendil-works/pi-ai`.
- `P = D:/pi-reason-prototype` (belum dibuat).

| ID | Bukti dan anchor | Yang dibuktikan / batas |
| --- | --- | --- |
| R01 D/O | `R/BASELINE-CONTRACTS.md`; `trajectory-audit/phase2/baseline.json` | Agent 1.3, C2 v7, prompt/schema cocok tiga referensi; bukan single-build performance baseline |
| R02 D/S/O | `R/CODEMODE-CONTRACT.md`; `phase2/codemode-runtime-probe.json`; `phase2/upstream-source-comparison.json` | Library/wrapper 1.0.0; sepuluh probe Windows terdahulu lulus. Tidak diulang pada sesi ini |
| R03 D/O | `R/TRAJECTORY-AUDIT.md` E01-E13; `contracts/cebce3d0-0fd3-5f88-9c5e-5e766da23b36-system.txt` dan `-tools.json` | Lima tool awal; batching/filtering observed, 39/94 call mengandung sintaks Promise.all/allSettled; bukan pengukuran overlap |
| R04 D/O | `contracts/discovery-observations.json`, step 160, 185-188 | agents_spawn/wait ditemukan; sessions_send lookup undefined dan pencarian nama kosong; namespace index bukan registry aktif |
| R05 D/O | `phase2/child-assignment-map.json`; `phase2/child-context-audit.json` | Tiga assignment match persis; dua code_explorer, satu default; tidak ada rangkaian full transcript parent dalam ekspor awal child |
| R06 U/S | `phase2/compaction-audit.json`; BASELINE-CONTRACTS bagian 4 | Compaction Reason unknown setelah corpus 14 root; compaction Pi boleh dipilih eksplisit |
| R07 O | `SERVER-COMPATIBILITY.md`; `PUBLIC-SUPPORT-CHECK.md` | Jalur session native Windows/custom worker resmi Reason belum tersedia dalam bukti; tidak menjadi dependency prototype |
| P01 V/S | `D:/pi-clean/launch.mjs`; `agent/settings.json`; `runtime/package.json`; `verification.json` | Runtime resmi 1.0.0, discovery dimatikan; verification terdahulu RPC/TUI tanpa inference |
| P02 V/S | `U/package.json`, `dist/index.js`, `dist/core/sdk.d.ts:13`; `dist/core/resource-loader.d.ts:84` | Public exports dan opsi SDK benar-benar ada dan dapat di-import di Node Windows; bukan hanya source checkout fork |
| P03 S | `dist/extensions/codemode/index.js:createCodemodeExtension`; `tool.js:createCodemodeToolDefinition/prepareCodemodeLoadout`; `execute.js:executeCodemode/toScriptValue/readCodemodeStore/createDiscoveryGlobals` | Registrasi inactive; mode on/only; models opsional; QuickJS, store branch, discovery dan normalisasi hasil upstream |
| P04 S | `dist/core/extensions/types.d.ts:269,388,438`; `dist/core/agent-session.js:_getCallableTools/_refreshToolRegistry/_executeNestedToolCall/_beforeToolCall` | Exposure, callable vs declared, allowlist SDK, nested calls melewati validation dan hooks. Hook error memblokir execution |
| P05 S | `dist/core/nested-tool-calls.js:NestedToolCallRunner/NestedCallRecorder`; `A/dist/agent.js:145`; `dist/core/tools/file-mutation-queue.js:withFileMutationQueue` | Default parallel, sequential override, nested telemetry terbatas, queue mutasi per file dalam satu proses |
| P06 S | `dist/core/tools/{read,bash,powershell,edit,write,grep,find,ls}.js`; `dist/utils/shell.js:getShellConfig/getPowerShellConfig/killProcessTree` | Tool factories dan operasi native Windows sudah tersedia; taskkill dipanggil tetapi keberhasilan cleanup tidak dikonfirmasi |
| P07 S | `dist/core/compaction/compaction.js:DEFAULT_COMPACTION_SETTINGS/shouldCompact/prepareCompaction/compact`; `dist/core/session-manager.js`; `docs/compaction.md` | Threshold, summary, branch persistence, compaction events upstream. Summary memakai model |
| P08 S | `dist/core/extensions/types.d.ts:652,660`; `dist/core/cache-warmer.d.ts:CacheWarmingDecisionEventResult`; `dist/core/model-runtime.d.ts:CreateModelRuntimeOptions` | context/context_with_system, provider hooks, warming stop, model network refresh controls tersedia |
| P09 S | `dist/extensions/mcp/{index,config}.d.ts`; `examples/sdk/14-codemode-mcp.ts` | MCP upstream dengan loadConfig/createTransport injection; project config dapat override jika tidak dibatasi |
| P10 S | `examples/extensions/subagent/index.ts:runSingleAgent/mapWithConcurrencyLimit/getPiInvocation`; `examples/extensions/subagent/agents.ts` | Contoh delegation tersedia, bukan layanan child sessions bawaan yang aktif. Contoh memakai --no-session dan proses sekali jalan |
| P11 V/S | Allowlisted fields `D:/pi-clean/agent/models.json`; `AI/dist/api/openai-completions.js:convertTools/parseChunkUsage` | Provider 9router, API openai-completions; converter punya grammar path bersyarat dan JSON function fallback; konfigurasi bukan bukti transport live |
| P12 V/S | `U/dist/core/extensions/types.d.ts:84,101,111,115,121,175,188`; `R/public-reason-cli/README.md` | Pi menyediakan setStatus/setWidget/setFooter/setHeader/custom/setEditorComponent/setTheme. README mengonfirmasi surface CLI Reason, bukan detail visual atau seluruh akses renderer Pi |

### Verifikasi read-only sesi ini

- `Get-Command pi,pi-clean,node,o2b` dan isi shim mengonfirmasi `pi` menunjuk source fork `C:/Users/M S I/.pi/runtime-src/.../cli.ts`, `pi-clean` menunjuk `D:/pi-clean/launch.mjs`.
- Node `v24.12.0`, `win32`: import ESM `U/dist/index.js` berhasil; exports createAgentSession, createCodemodeExtension, createMcpExtension, createToolSearchExtension, DefaultResourceLoader, SettingsManager, SessionManager, ModelRuntime, InteractiveMode, runRpcMode dan tool factories tersedia. Ini hanya import; tidak membuat session/model request.
- Satu percobaan inspeksi dependency memakai `require.resolve` gagal `ERR_PACKAGE_PATH_NOT_EXPORTED` karena package import-only; diikuti import ESM yang berhasil. Gunakan ESM dan `pathToFileURL`, bukan mengubah exports upstream.
- Pi agent-core/ai/codemode yang terpasang semuanya 1.0.0; quickjs-wasi 3.6.2. CLI adalah `dist/bundle/cli.js` -> `cli-runtime.js` -> chunks; bukan `dist/index.js`. Symbol fitur juga ditemukan dalam chunk yang diimpor. Keberadaan kode bukan bukti aktivasi.
- Source map runtime bersih untuk `tool.ts`, `execute.ts`, `compaction.ts` menghasilkan normalized hash yang sama dengan audit. Ini memperkuat reuse paket, tanpa menganggap seluruh fork aktif.
- Konfigurasi model yang aman dibaca: `9router/cx/gpt-6-sol`, `api: openai-completions`, contextWindow 272000, maxTokens 128000, reasoning true, input `[text]`. Nilai limit merupakan konfigurasi, belum diukur terhadap gateway/provider. Credential dan endpoint tidak disalin ke dokumen.
- `C:/Program Files/Git/bin/bash.exe` dan backup-report fork ada. Backup seluruh isi tidak diverifikasi ulang. `P` dan PI-IMPLEMENTATION-PLAN belum ada sebelum penulisan plan.
- Brain context mengarah ke `D:/.vault-brain/vault`; keyword recall dijalankan tanpa semantic/model/rerank. Tidak membuat store memory kedua.

Hash acuan saat investigasi (SHA-256):

| File | SHA-256 |
| --- | --- |
| `D:/pi-clean/launch.mjs` | `ed4ef99fd8d3ebc79aad049a48b01fc211a0a539d27d88560fbf2b9657f77e99` |
| `D:/pi-clean/agent/settings.json` | `0c728c96aa44bcfa1cfdcb646a31bcb391a9978753d1f15952fa3f91f9bc2352` |
| `D:/pi-clean/runtime/package-lock.json` | `e35f077ef676f50416a07bc8b64c5c66a735779f098c52b67e316e4e0c03baa4` |
| `U/dist/bundle/chunks/chunk-33XOIQ5N.js` | `1fbf59b1126d78129049710d1c825afaf3a905333a62a680fdb2174fdb6d3aca` |
| `U/dist/extensions/codemode/execute.js` | `0b7d8c451d76a9d01ab8edafc05fa5a6c8b39061e28881602fa4df74b7c6a105` |
| `U/dist/core/extensions/types.d.ts` | `6c78c89ad1ffb421e81ff0ad11ceff1a635b21fd818a32aa3e87009392298d9f` |
| normalized `tool.ts` from source map | `67216b67186567278527edc5c6544cbb7e52a515a4887b4cf433299f8d1e9113` |
| normalized `execute.ts` from source map | `36dac616e4bed8e162954a8e55aeabaefcea7acaf99c549f4db7c8863a9eddeb` |
| normalized `compaction.ts` from source map | `d5aebd41333957b57fa3f1bee2a18b3c00b5d47bb1b4af6f913cf8cd791099c8` |

## 3. Gap matrix

Kategori bisa bertumpuk: tersedia berarti kode/API tersedia, bukan aktif atau sudah lolos end-to-end.

| Area | Status | Gap dan tindak lanjut | Bukti |
| --- | --- | --- | --- |
| Agent loop, CLI/TUI, provider sendiri | Sudah tersedia; perlu konfigurasi | Pertahankan upstream; model dipilih eksplisit, gagal tanpa silent fallback | P01/P02/P11 |
| Lima tool awal | Perlu konfigurasi | defaultTools read/bash/edit/write/codemode; mode on, bukan only | R03/P03 |
| Codemode QuickJS | Sudah tersedia; perlu konfigurasi | Muat factory upstream secara eksplisit; models:false untuk MVP | R02/P03 |
| Codemode default deadline | Perlu adapter; pilihan desain | Wrapper publik default Infinity. Host deadline terbatas adalah perubahan yang harus dilabeli | R02/P03 |
| Deferred catalog/BM25/schema | Sudah tersedia; perlu konfigurasi | exposure deferred + namespace; manifest hanya callable, detail on demand | R04/P03/P04 |
| Dynamic MCP | Sudah tersedia; perlu adapter konfigurasi | Load hanya server Brain yang dipilih, project override ditutup; offline fake transport | P09 |
| Parallel independent calls | Sudah tersedia; perlu policy/fixture | Promise.allSettled + output selektif; buktikan overlap, jangan sekadar menghitung sintaks | R03/P05 |
| Mutasi file paralel | Sudah tersedia sebagian; perlu adapter ownership | Queue upstream tidak melindungi lintas proses/shell; single writer atau worktree terpisah | P05/P06 |
| Hook parity direct/nested | Sudah tersedia; perlu fixture | Larangan, invalid schema, thrown hook, result transform harus konsisten | P04 |
| Windows read/edit/write | Sudah tersedia; perlu fixture | Path space/Unicode, CRLF/BOM, junction, original-snapshot edit, race limits | P06/R03 |
| Bash dan PowerShell | Sudah tersedia; perlu konfigurasi | Bash tetap Git Bash; PowerShell deferred sebagai tambahan yang diumumkan | P06 |
| Kill/timeout Windows | Perlu adapter/verifikasi | Upstream taskkill best effort; confirm exit, orphan reporting; bukan sandbox OS | P06/R07 |
| Store/load per branch | Sudah tersedia; perlu fixture | Persist hanya script sukses; session tree berbeda dari durable Brain memory | R02/P03 |
| Compaction Pi | Sudah tersedia; perlu konfigurasi | Pilih upstream, ukur budget terhadap contextWindow provider yang valid | P07 |
| Compaction Reason | Belum diketahui | Tidak membuat template/threshold Reason dari tebakan | R06 |
| Observability/cache | Sudah tersedia sebagian; perlu adapter | Usage source, prompt/schema hashes, bounded nested logs, warming dimatikan pada test | P05/P08/P11 |
| Child spawn/wait/result ownership | Perlu implementasi memakai SDK | Contoh subagent belum persistent session service; lifecycle supervisor baru | R04/R05/P10 |
| code_explorer/default profiles | Perlu implementasi/policy | Bounded assignment dan ceiling; code_explorer MVP tanpa arbitrary shell | R05/P04/P06 |
| fork_self/context_explorer | Belum diketahui; ditunda | Tidak diiklankan pada MVP; desain lanjut bukan rekonstruksi terverifikasi | R04/R05 |
| Child read-only enforcement Reason | Belum diketahui | Prompt read-only + bash bukan bukti host enforcement; implementasi Pi punya policy sendiri | R05 |
| Child follow-up/cancel/partial | Perlu implementasi; sebagian declaration-only | Same session ID, prefix semantics, ownership, cancellation dan dedup delivery | R04 |
| Real provider grammar/images/cache | Belum diketahui | Converter tersedia, model konfigurasi text-only; offline transport dulu, live gate terpisah | P11 |
| Server Reason Windows | Di luar scope/dependency | Tidak memakai enrollment, accepted worker hashes, Reason auth atau server | R07 |
| UI CLI Reason | Perlu investigasi referensi dan adapter presentation | Arahan pengguna sudah jelas: terminal. Capture version/state belum lengkap; pakai hooks TUI upstream dahulu, exact renderer gaps dipetakan pada TU0 | Arahan pengguna/P12; detail visual U |

Catatan konfigurasi: `agent/settings.json` baseline berisi `codemode.mode: "off"`, tetapi tipe upstream hanya `"on" | "only"`; `readMode()` memperlakukan selain only sebagai on. Baseline nonaktif karena `--no-extensions` dan codemode tidak diaktifkan. **Jangan memperbaiki baseline dalam proyek ini.** Prototype memakai nilai valid dan explicit loadout.

## 4. Keputusan desain yang diajukan

| ID | Pilihan yang direkomendasikan | Dasar dan tradeoff |
| --- | --- | --- |
| D01 | Paket upstream resmi 1.0.0 di runtime prototype sendiri, version/lock pinned | P02/P03 dan R02. Tidak menulis ulang QuickJS, parser, BM25, compaction atau agent loop |
| D02 | Parent memakai stock bundled CLI/TUI sebagai fondasi + extension presentation mengikuti CLI Reason; child memakai public SDK dalam worker Node | P01/P02/P10/P12. Runtime dan loop tetap upstream; target visual bukan stock Pi. Batas hooks renderer harus dipetakan sebelum memilih patch UI |
| D03 | Initial five tools, codemode mode on, inlineBudget 3000; tool tambahan deferred | R03 dan P03. PowerShell/agents/Brain ditemukan lewat catalog. Tidak menyalin namespace vendor yang tidak ada |
| D04 | Provider 9router/model tetap explicit, JSON function `{code:string}` fallback; grammar hanya jika compat telah terverifikasi | P11. Tidak menganggap gateway setara model Sol pada trace; tidak auto-migrasi ke Responses API |
| D05 | `createCodemodeExtension({mode:"on", inlineBudget:3000, models:false})` | P03. Menutup jalur classifier/image inference tambahan pada MVP. Bukan batasan Reason; fitur dapat ditinjau terpisah |
| D06 | Tidak ada arbitrary shell pada code_explorer; read/grep/find/ls dan optional codemode saja | R05 hanya membuktikan deklarasi read-only, P06 punya read-only factories. Penyimpangan sengaja dari schema child Reason yang punya bash/repl |
| D07 | Codemode host deadline default 300000 ms, batas input timeout 900000 ms, heap/output/store tetap upstream | P03 tidak mengekspos timeout dalam factory options; adapter kecil perlu. Nilai deadline ini pilihan desain, bukan default Reason |
| D08 | Maksimal tiga child aktif bersamaan, di luar parent; satu writer total per shared workspace | Batas tiga dipilih pengguna. P05/P10 mendasari bounded concurrency. Parent tidak mengedit ketika lease writer child aktif; parallel writers perlu worktree terpisah |
| D09 | Delegation MVP hanya code_explorer/default; exact assignment, tanpa full transcript otomatis; semua slot model eksplisit | R05. Slot thinking/coding/subagent boleh menunjuk model sama untuk awal; default bounded capability bukan inherit-all |
| D10 | Compaction Pi enabled, reserveTokens 16384, keepRecentTokens 20000 sebagai titik awal | P07/R06. Validasi against actual model window/output budget; bukan reproduksi compaction Reason |
| D11 | Shared Brain lewat upstream MCP untuk parent; CLI o2b eksplisit vault sebagai fallback | Instruksi pengguna/P09. Child MVP tanpa memory/skills; hasil reusable dicatat parent. Session JSONL/telemetry adalah state teknis, bukan memory store pesaing |
| D12 | Tidak mengaktifkan cache warming/model helpers saat offline/evaluasi awal; usage/cost diberi provenance | P08 dan E11. Warming memakai request tambahan; estimate SDK bukan tagihan provider |
| D13 | UI mengikuti CLI/terminal Reason, dengan referensi versi/state yang direkam | Arahan pengguna eksplisit, surface terminal dikonfirmasi. Belum menjadi klaim pixel/interaction parity; detail harus berasal dari capture/source UI |

### Kontrak tools dan failure behavior

1. `read`: offset 1-based, paging; model text maksimum 2000 lines/50 KiB sesuai tool upstream; image content dipertahankan pada layer tool, tetapi dukungan model aktif text-only tidak dinaikkan diam-diam. Binary/oversized-line behavior dicatat dari fixture upstream.
2. `edit`: `edits[]` dipadankan pada original snapshot, masing-masing unique dan non-overlap. Gagal validasi berarti tidak menulis file itu. Tidak menjanjikan transaksi lintas tools atau rollback write yang sudah terjadi. CRLF/BOM ditangani upstream dan dites.
3. `write`: upstream create/overwrite dan parent directories; tidak mengganti menjadi append API. Permission/path error tampil jelas.
4. `bash`: tetap semantik Bash, timeout dalam **detik**; PowerShell adalah nama tool berbeda. Direct nonzero menjadi error result; di codemode hasil structured `{output,truncated,full_output_path?,exit_code,wall_time_seconds}` tetap resolve. Timeout/abort bukan normal exit_code sukses.
5. Shell direct output menggunakan tail/2000 lines/50 KiB; structured output codemode dapat sampai 1 MiB, head/tail 512 KiB jika lebih panjang. Output akhir codemode dibatasi lagi 10000 estimated tokens (chars/4) dan spill file. Ketiga lapisan tidak boleh disatukan menjadi satu limit.
6. Tool invalid/blocked/thrown menjadi rejected Error di script kecuali hasil structured memang merupakan kontraknya. MCP `CallToolResult.isError` tidak otomatis dilempar jika structured wrapper disediakan. Hook hasil yang mengubah content harus menjaga/drop structuredContent sesuai upstream.
7. Codemode memakai raw JS body dan parser upstream `// @options:`; transport JSON bukan perubahan bahasa script. Store hanya commit saat script sukses; failed script mempertahankan partial output. Calls pending menerima abort, tanpa klaim filesystem/process rollback.
8. Adapter deadline D07 membungkus execute upstream dengan linked AbortSignal: tanpa timeout input, abort pada 300000 ms; input valid sampai 900000 ms memakai deadline parser upstream; input di atas ceiling ditolak sebelum execute. Host cap tambahan melindungi cleanup. Expiry dari host dilabeli `HOST_DEADLINE`/aborted di details, tidak dipalsukan menjadi error.kind timeout upstream. Dispose timer/listener dalam finally.
9. Semua nested calls tetap melalui `ctx.executeTool()`; adapter tidak memanggil tool.execute langsung untuk memintas validation/hooks. `models:false` berarti tidak ada jalur model helpers di luar tool policy.
10. Discovery memakai registry callable aktual, normalized identifier collision ditolak saat registrasi adapter. `describeTool(unknown)` tetap undefined; ranking search bisa memberi tool lain, tidak sama dengan exact lookup. Gunakan `await searchTools/describeTool/describeNamespace` agar cocok dengan API publik Pi; gaya sinkron yang terlihat di trace bukan alasan mengeksekusi ulang script mentah.
11. `setActiveTools` hanya presentation/activation. Tool deferred tetap callable jika registered. Child memakai `CreateAgentSessionOptions.tools` sebagai registry allowlist (P04), curated factory list, dan policy hook; bukan hanya menghapus nama dari prompt.
12. File policy memeriksa canonical roots/junction, tetapi root tool shell menjalankan hak akun Windows. MVP bukan OS confinement. Jangan mengklaim regex command, readOnlyHint, atau QuickJS sebagai sandbox tool host.

## 5. Isolasi dan daftar file prototype

Tidak ada file di bawah ini dibuat dalam sesi planning. Seluruh path relatif berikut berakar di `P`:

| File baru | Fungsi/entry yang dirancang | Reuse upstream |
| --- | --- | --- |
| `package.json`, `package-lock.json`, `runtime/package.json`, `runtime/package-lock.json` | Dependency/verification commands; runtime pinned dan runtime-local resolution | npm package/lock resmi; jangan link node_modules fork |
| `launch.mjs`, `pi-reason-proto.cmd`, `pi-reason-proto.ps1` | `resolvePrototypePaths`, `buildChildEnv`, `validateLaunchArgs`, `assertIsolation`, `main` | Spawn absolute stock `dist/bundle/cli.js` |
| `agent/settings.json`, `agent/models.json` | Config prototype terpisah; secrets lokal/env dengan ACL; explicit model selection | Settings/model format upstream |
| `agent/shared-brain.md` | Instruksi vault tunggal dan recall, bahasa pengguna | MCP/o2b vault existing |
| `extensions/harness.ts` | `registerHarness(pi)` memanggil factory curated dan policy/telemetry/delegation | ExtensionAPI, createCodemodeExtension, createMcpExtension |
| `src/codemode-policy.ts` | `registerCodemode`, `withHostDeadline`, `validateScriptOptions` | Factory melalui registerTool adapter; preserve parameters, prepareLoadout, renderers; parser public `pi-codemode/source` |
| `src/tool-policy.ts` | `buildCapabilityManifest`, `authorizeToolCall`, `canonicalizeAllowedPath`, `assertNoIdentifierCollisions` | ToolExposure, namespace, tool_call; child tools allowlist |
| `src/windows-tools.ts` | `registerWindowsTools`, `resolveGitBash`, `wrapOwnedShellOperations` | createBashToolDefinition/createPowerShellToolDefinition; BashOperations.exec |
| `src/process-lifecycle.mjs` | `spawnOwnedProcess`, `terminateTreeAndConfirm`, `closeOwnedProcesses` | Node child_process; Windows taskkill absolute trusted executable; upstream pattern |
| `src/brain-config.ts` | `loadCuratedBrainConfig`, `verifyVaultBinding`, `recallSessionContext` | createMcpExtension(loadConfig/createTransport); fallback o2b with explicit vault |
| `src/context-policy.ts`, `prompts/harness.md` | `registerContextPolicy`, `buildBehaviorGuidelines`, `restoreRuntimePointers` | before_agent_start, context hooks, getContextUsage, session events; no replacement loop |
| `src/telemetry.ts` | `registerTelemetry`, `recordRequestEnvelope`, `recordUsage`, `redactEvent` | context_with_system, before_provider_request, message_end, nested execution/compaction events |
| `src/delegation.ts`, `src/child-supervisor.ts` | `registerDelegationTools`, `spawnChildren`, `waitChildren`, `sendChild`, `cancelChild`, `claimResult` | registerTool, appendEntry/sendMessage, session lifecycle |
| `src/child-runner.mjs`, `src/child-profiles.ts` | `createChildSession`, `runAssignment`, `resolveChildProfile`, `resolveModelSlot` | createAgentSession, ModelRuntime, DefaultResourceLoader, SessionManager |
| `src/workspace-ownership.ts` | `acquireWriterLease`, `releaseWriterLease`, `assertWriter` | Upstream file queue remains inside process; no claim cross-process queue |
| `config/harness.json`, `config/child-profiles.json` | Versioned policy, limits, model slots, allowed capabilities, feature flags | No arbitrary executable project config discovery |
| `scripts/verify-offline.mjs`, `scripts/audit-baseline.mjs`, `scripts/check-provider-fixture.mjs`, `scripts/evaluate-tasks.mjs` | Offline guard, inventory hashes, protocol fixtures, explicit live eval entry | node:test; no new test framework needed |
| `tests/*.test.mjs`, `tests/helpers/*.mjs`, `tests/fixtures/manifest.json`, `tests/fixtures/*` | Acceptance corpus dan fake provider/MCP/children | Public SDK and frozen upstream behavior |
| `docs/DEVIATIONS.md`, `docs/ROLLBACK.md`, `docs/EVALUATION.md` | Decision IDs, operator recovery, experiment protocol | Plan ini sebagai acuan |
| `docs/UI-REFERENCE.md`, `docs/UI-PARITY.md`, `artifacts/ui-reference/manifest.json` | `captureReferenceState` (future script) dan matriks state/layout/interaksi dengan versi, ukuran terminal, provenance | Bukti CLI Reason; mock state lokal tanpa inference |
| `extensions/reason-terminal-ui.ts`, `src/ui/{theme,header,footer,editor,tool-renderers,child-status}.ts` | `registerReasonTerminalUi`, `renderHeader`, `renderFooter`, `createPromptEditor`, `renderToolCall`, `renderToolResult`, `renderChildStatus` (fungsi rencana) | P12; renderCall/renderResult tool definitions; komponen @earendil-works/pi-tui |
| `tests/ui-replay.test.mjs`, `scripts/verify-terminal-ui.mjs` | `replayUiFixture`, `compareTerminalFrames`; acceptance visual/manual terminal | Fake stream/tool/child events, tanpa model berbayar |
| `agent/sessions`, `agent/children`, `artifacts/verification`, `artifacts/evaluations` | Runtime-owned state/receipts, bukan knowledge vault | JSONL Pi dan redacted artifacts |

Launcher wajib menghapus inherited PI_* dan NODE_OPTIONS seperti baseline, lalu menetapkan agent/session dirs prototype sebelum import/spawn. Jangan global set env, mengubah PATH, atau membuat alias `pi`. Resource overrides, --session path, --resume/import, install/update, dan argumen bentuk `--flag=value`/short alias divalidasi; tidak cukup hanya memeriksa token persis seperti baseline. Hanya session di prototype yang boleh dibuka.

Package root berisi scripts/dev tooling; satu instalasi runtime berada di `P/runtime`. Child runner dan test helpers memuat public entry runtime tersebut melalui ESM `pathToFileURL` dari absolute path yang diverifikasi. Jangan membiarkan bare import dari file di luar runtime resolve ke paket global/fork. Extension loader stock memakai package API alias milik runtime aktif; O01 juga memeriksa resolution ini. Dependency helper yang di-import langsung harus dideklarasikan/pinned, bukan bergantung pada hoisting kebetulan.

Parent menonaktifkan auto discovery extensions/skills/templates/themes/context; load satu extension absolute secara eksplisit (`--no-extensions -e <P/extensions/harness.ts>`). defaultTools berasal dari config prototype, bukan `--tools` lima nama yang akan memfilter registry deferred tambahan. `--system-prompt ''` mempertahankan stock prompt generation sambil mencegah project prompt file masuk, seperti baseline. Instruksi repo yang diperlukan dibaca sebagai data secara eksplisit dan provenance dicatat.

MVP menolak cwd yang memiliki `.pi/settings.json`, `.pi/SYSTEM.md`, atau `.pi/APPEND_SYSTEM.md`; untuk task dari repo tersebut gunakan checkout eksperimen terpisah dan catat exclusion configuration secara eksplisit. Child SDK memakai SettingsManager.inMemory, factory list curated, noContextFiles/noSkills/noExtensions, systemPromptOverride/appendSystemPromptOverride untuk menutup prompt discovery. Uji loader; jangan menganggap flag noContextFiles mematikan semua prompt/config file.

`createMcpExtension` memakai loadConfig milik adapter agar `.pi/mcp.json` proyek tidak menambah server. Muat hanya Brain yang disetujui, hidden by default dan exposure per tool allowlisted. MCP credentials/logPath berada di agent prototype. Jangan menyalin seluruh MCP/skills/prompt fork. Jika o2b fallback diperlukan, entrypoint, argumen Windows dan vault harus diverifikasi pada implementasi; jangan menebak syntax/config MCP dari harness Codex saat ini.

## 6. Tahapan, dependency, failure, acceptance, rollback

### T0 - Freeze dan skeleton eksperimen (P0)

Dependency: review D01-D04 dan lokasi prototype. File: launcher/config/runtime package, `scripts/audit-baseline.mjs`, docs rollback. Functions: assertIsolation/buildChildEnv/validateLaunchArgs.

- Pin dependency resmi dan lock dengan install scripts disabled; gunakan manifest baseline sebagai input, jangan mutate baseline. Catat hash runtime/launcher/config tanpa credential. Prototype tidak membawa sessions/extensions lama.
- Failure: path bertabrakan, runtime hash berbeda, model hilang, config proyek terdeteksi, override agent/session ditolak sebelum CLI start. Tidak fallback ke `pi` di PATH.
- Acceptance: --version/help + RPC get_state/get_commands/get_available_models di prototype tanpa prompt; API/import identity benar; profile/session paths terpisah; token request counter nol; hash baseline/fork launcher unchanged. TUI smoke tanpa prompt hanya pada tahap implementasi.
- Rollback: hentikan proses prototype, kembali ke `pi` atau `pi-clean`; tidak perlu restore fork/clean. Simpan artifacts untuk audit, tidak hapus direktori secara otomatis.

### T1 - Core loadout, codemode, deferred discovery dan policy (P0)

Dependency: T0. File: `extensions/harness.ts`, `src/codemode-policy.ts`, `src/tool-policy.ts`, `src/context-policy.ts`, `prompts/harness.md`, `tests/codemode.test.mjs`, `tests/discovery-policy.test.mjs`.

- Reuse createCodemodeExtension; adapter registerTool hanya membungkus execute/deadline dan tidak mengubah schema identity/render/loadout. Pin direct lima tools; register fixtures/deferred namespaces lewat public API. Namespace list dibuat dari manifest capabilities yang ada.
- Pasang policy `tool_call` yang menerima parentToolCallId; error/unknown decision fail closed. Policy final revalidates perubahan args jika ada hook mutasi, sebab upstream tidak melakukan schema revalidation setelah mutasi hook. Jangan load arbitrary third-party hooks pada MVP.
- Failure: parse invalid tidak menjalankan tools; reject capability sebelum side effect; deadline membatalkan pending calls, tetap melaporkan partial output dan kemungkinan side effect selesai. Duplicate normalized identifiers gagal startup.
- Acceptance: O01/O02/O03/O04 di bagian 8, initial request tepat lima declarations, deferred detail tidak bocor, unknown tools tidak diiklankan. Direct/nested block hook sama; runtime read/edit/write tetap upstream.
- Rollback: flags `codemode=false`, `deferred=false` lalu restart session prototype baru; jangan pakai reload sebagai penghapusan capability, karena upstream reload mempertahankan sebagian tools aktif.

### T2 - Windows shell, paths, batching dan process lifecycle (P0)

Dependency: T1. File: `src/windows-tools.ts`, `src/process-lifecycle.mjs`, `src/workspace-ownership.ts`, `tests/windows-tools.test.mjs`, `tests/batching.test.mjs`.

- Pin Git Bash executable, jangan jadikan shellPath PowerShell karena bash semantics berbeda. Powershell tersedia deferred dengan description jelas. Reuse shell tool definitions/truncation; operasi native di-wrap hanya untuk ownership/cleanup.
- Independent read calls boleh parallel; mutasi same file mempertahankan queue upstream. Jangan menambahkan Promise.all untuk langkah dependent. Shell dan edits tidak memiliki transaksi bersama.
- Failure: shell tidak ada => tool unavailable/preflight gagal; cwd hilang, access denied, timeout/cancel dan nonzero dibedakan. taskkill failure/child masih hidup => `cleanup_unconfirmed`, catat PID milik harness dan blokir kerja konflik, tidak mengklaim cleaned.
- Acceptance: O05/O06/O07, termasuk satu real process tree fixture Windows, output nonzero dan timeout. Confirm exit fixture parent/descendant tanpa membunuh proses tak terkait. Unexpected parent crash/terminal close harus diuji sebelum release delegation.
- Rollback: nonaktifkan shell adapter/PowerShell dan hentikan session yang memilikinya; gunakan file tools fixture saja sampai cleanup lulus. OS Job Objects menjadi follow-up hanya bila fixture menunjukkan cleanup tidak cukup; bukan prasyarat spekulatif menulis runtime baru.

### T3 - Context, Brain, usage dan provider protocol (P1)

Dependency: T1; shell fallback Brain bergantung T2. File: `src/brain-config.ts`, `src/context-policy.ts`, `src/telemetry.ts`, config/settings, `tests/context-store.test.mjs`, `tests/provider-transport.test.mjs`, `tests/brain-telemetry.test.mjs`.

- Compaction dan store memakai upstream; persist pointer child/task sebagai custom entries, bukan raw transcript di store. Context hook tidak menghapus tool-call/result pair. Jangan memakai context_with_system untuk rewrite prompt tanpa fixture karena hook itu memiliki seluruh prompt/schema.
- Rekam final normalized prompt/schema hash, model/API/effort, usage source, cache read/write, compaction trigger/error, duration, child IDs dan nested completeness. Model context tidak disisipi full nested outputs. Raw provider headers/auth tidak dicatat; request bodies hanya redacted/synthetic dalam fixture.
- Matikan warming dengan cache_warming_decision action stop untuk fixture/eval awal; fake ModelRuntime tanpa live credentials. models:false menghilangkan classifier/image API dalam codemode.
- Brain context/search wajib untuk parent startup dan sebelum keputusan bergantung pekerjaan lama. Jika recall gagal, laporkan unavailable; keputusan yang bergantung memory tertunda, tugas independen masih boleh lanjut. Writes hanya aturan/milestone yang diotorisasi, bukan tiap output tool. Offline menggunakan fake Brain, tidak menulis vault sungguhan dari test.
- Failure: summary failure/cancel mempertahankan history dan memunculkan event, tidak menyimpan summary kosong palsu; jika masih over window, stop/return error sesuai upstream dan uji, tidak retry tanpa batas. Usage missing = unknown, bukan nol. Provider mismatch tidak memicu silent model change.
- Acceptance: O08-O11. Compaction threshold 255616 untuk configured window 272000 hanyalah hasil aritmetika, bukan limit provider terbukti; validate model limit dan output budget sebelum live gate. Tidak ada janji image capability pada konfigurasi text-only.
- Rollback: disable Brain adapter/telemetry/auto compaction di prototype melalui config lalu restart. Session JSONL dipertahankan; untuk membatalkan pengaruh summary pilih branch/session baru, jangan rewrite JSONL histori.

### T4 - Delegation dengan session ownership (P1)

Dependency: T1-T3, khususnya allowlist, cleanup dan usage. File: delegation/supervisor/runner/profiles/workspace-ownership, `tests/delegation.test.mjs`, `tests/delegation-process.test.mjs`.

Implementasi harus memakai SDK createAgentSession, ModelRuntime, SessionManager dan upstream tools. Contoh subagent hanya referensi bounded concurrency/JSON rendering; jangan mengaktifkannya tanpa perubahan karena --no-session dan one-shot lifecycle tidak memenuhi kontrak.

Kontrak lokal yang dirancang:

- Deferred `agents_spawn` menerima tasks 1..100, prompt 1..8000 chars dan title <=80 (R04); profile MVP enum code_explorer/default saja. model_slot resolved dari config sendiri; unknown/unavailable => gagal tanpa fallback. Profile unsupported ditolak sebelum ada child dimulai.
- `config/harness.json` menetapkan `maxActiveChildren: 3` (D08), di luar parent: maksimal empat agent aktif total. Slot direservasi secara atomik sejak starting, sehingga spawn bersamaan tidak bisa melewati batas. Gunakan sampai tiga child hanya untuk pekerjaan independen yang berguna; tugas kecil boleh dikerjakan parent, tidak wajib selalu spawn tiga. Paralelisme dapat mengurangi wall time tetapi tidak menjamin lebih cepat atau lebih murah.
- Start diurutkan; return `count/requested_count/partial/sessions/subagent_session_ids` hanya untuk prefix yang benar-benar berhasil startup. Jika resource gagal setelah child k, hanya prefix k dicatat; retry suffix saja. Nol start => error atau structured partial count 0 yang jelas. Saat tiga slot terisi, child keempat tidak dimulai dan tidak diam-diam masuk antrean yang akan menjalankan inference. Capacity tidak boleh menghasilkan skip ke task berikutnya. Slot dilepas setelah child settled dan proses terkait telah dibersihkan; cleanup_unconfirmed tetap menahan slot.
- Child dimulai dengan system prompt/profile plus **satu assignment user yang sama persis**; root memberi ringkasan eksplisit dalam assignment jika diperlukan. Capability ceiling = irisan parent granted capabilities, profile, dan runtime tersedia. Tidak ada secret/env dump, otomatis full parent transcript, skills atau Brain pada child MVP.
- code_explorer mendapat read/grep/find/ls (+codemode bila diperlukan), no bash/powershell/edit/write/MCP/delegation/user-question tools. default mendapat core tools terbatas dengan writer lease. Ini enforcement tools pada host terpercaya, bukan OS sandbox universal.
- Setiap worker Node menggunakan absolute `P/src/child-runner.mjs`, agentDir dan sessionDir child prototype, loader curated, tools allowlist dan model explicit. Gunakan IPC/stdin terstruktur untuk assignment, bukan command-string interpolation. Permission/budget tidak diperluas oleh child.
- State `starting -> running -> completed|failed|cancelled|interrupted`; tiap record owner parent session+branch, task key, generation, model, capability hash, child session path, timestamps dan receipt. Session paths tidak diterima langsung dari model.
- Spawn-call AbortSignal hanya membatalkan startup yang belum menjadi receipt. Child yang sudah committed dimiliki parent supervisor; **selesainya codemode spawn tidak otomatis membatalkan seluruh child**. On failure sebelum return, persist started prefix agar retry tidak menggandakan tugas. Request identity/idempotency extension adalah desain lokal, bukan bukti Reason.
- `agents_wait`: input IDs hanya child milik parent; timeout default 30000, range 0..120000 ms; poll_interval_ms 100..5000. Timeout mengembalikan status running, tidak cancel. Hasil penuh ada `session.reply.text`, preview/truncation terpisah. URL vendor tidak dipalsukan; local receipt/session ID menggantikan URL remote dan dicatat sebagai deviation.
- Satu completion punya delivery token; automatic delivery dan wait menggunakan `claimResult` yang sama. Dua waiter tidak menyebabkan double injection. Parent restart tidak mengirim ulang hasil yang sudah claimed. Jika parent sedang idle, kirim bounded completion via extension sendMessage, tanpa auto model turn; continuation berikutnya/wait membaca claim.
- Follow-up lokal `sessions_send` memakai ID lama setelah child idle/completed, menambah assignment dan generation dalam session yang sama; ketika running, return busy pada MVP. Ini tambahan desain: trace mendeklarasikannya tetapi lookup observed justru tidak menemukannya. Jangan klaim fidelity exact.
- `sessions_cancel` idempotent: abort session, tunggu settlement, terminate owned process tree bila perlu, confirm exit. Cancelling wait tidak membatalkan child. Parent shutdown membatalkan anak miliknya; reload/switch harus settle children atau menolak transisi. Tidak membunuh PID yang hanya cocok angka dari session lama.
- Crash recovery: record running lama menjadi interrupted setelah ownership/process identity diverifikasi; tidak otomatis mengulang assignment atau memulai inference. Resume eksplisit memakai child ID/path dari registry, cek capability ceiling lagi. Branch fork tidak mewarisi hak kontrol active child dari branch lain.
- Satu writer lease per workspace mencakup parent dan child default. Semua arbitrary bash/powershell dianggap memerlukan writer lease; jangan mengandalkan klasifikasi regex untuk menyatakan command aman/read-only. Lease tidak boleh dilepas sebelum cleanup confirmed. Untuk parallel writers berikutnya, worktree terpisah dan merge ter-review; tidak memasang locking global ke seluruh komputer.

Failure: invalid profile/model/capability/owner ditolak sebelum spawn; partial startup tercatat; lost IPC/nonzero exit => failed/interrupted dengan bounded stderr; result-write failure tidak ditandai completed; cancellation tidak rollback edit yang telah terjadi.

Acceptance: O12/O13, termasuk mock child, real local no-model worker, parent death, cancel race, duplicate delivery, partial prefix, follow-up same ID, blocked recursive spawn dan nested forbidden tools. Tidak ada child/model nyata berbayar pada acceptance offline.

Rollback: `delegation=false`, restart parent setelah child settled; nonaktifkan tools registry, pertahankan receipts/child sessions dan diff pekerjaan. `pi` fork tetap jalur harian. Tidak menjalankan restore backup kecuali ada kerusakan nyata dan arahan terpisah.

### T5 - Paket acceptance dan evaluasi nyata terpisah (P2)

Dependency: T0-T4 offline lulus. File: scripts verification/evaluation, tests fixture manifest, docs deviations/evaluation/rollback. Tidak ada inference dalam sesi planning ini.

- Freeze fixture manifest+hash, config, prompt/schema dan model selection sebelum eval. Offline report memisahkan assert runtime, declaration, source dan expected deviation.
- Failure: satu kontrak wajib gagal => tidak maju ke live eval; missing provider/price/budget => eval tetap disabled. Unknown Reason tidak diubah menjadi passed.
- Acceptance: semua O01-O13 wajib lulus; tidak ada request provider eksternal, tidak ada perubahan baseline/fork/vault fixture, tidak ada orphan fixture. Gate live di bagian 9 disetujui terpisah.
- Rollback: freeze prototype sebagai eksperimen dan kembali launcher lama. Hasil eval tidak otomatis mengaktifkan prototype sebagai default.

Dependency ringkas: `T0 -> T1 -> T2`; `T1 -> T3`; `T2 + T3 -> T4`; `T0..T4 -> T5`. MCP Brain dapat dikerjakan setelah T1; shell fallback menunggu T2. Tidak perlu menutup unknown exact Reason 1.1/compaction untuk memulai implementasi yang jelas diberi label desain Pi.

### TU0/TU1 - UI terminal mengikuti Reason

Arahan UI sudah ditetapkan pengguna, tidak perlu memilih style baru. Mode penggunaan: bekerja pada task coding dari terminal Windows; hasil yang diinginkan adalah hierarki informasi dan interaksi yang terasa seperti CLI Reason sambil menampilkan state Pi yang nyata. Audit trajectory model-visible bukan bukti visual CLI. Gambar dock/web/Harbor tidak dipakai sebagai referensi terminal.

**TU0: inventaris referensi dan pemetaan renderer.** Dependency: akses bukti UI lokal/publik; tidak perlu model call. File: docs/UI-REFERENCE.md, docs/UI-PARITY.md, artifacts/ui-reference/manifest.json. Rekam versi CLI Reason, asal bukti, tema/font terminal, rows/columns dan state: startup/idle, input multiline, streaming, tool running/completed/error, diff/output panjang, child running/completed, cancel, session resume dan status model/context. Tandai state yang belum diamati; jangan mengarang tampilan Reason. Bila capture membutuhkan inference, hentikan jalur itu dan gunakan bukti source/screenshot yang tersedia sampai fase live berbudget.

Peta source Pi: `U/dist/modes/interactive/interactive-mode.js` (host), `components/tool-execution.js` (tool output), `components/custom-editor.js` (editor), `theme/theme.js` (theme), serta hooks P12. Periksa keberadaan dan fungsi internal tepatnya saat TU0; nama fungsi custom di tabel file adalah rancangan, bukan assertion API internal. Tentukan per state apakah theme/hooks/renderers cukup. Perubahan main transcript/layout yang tidak diekspos extension dicatat sebagai gap; baru ajukan patch minimum di salinan upstream prototype sesuai bagian 7 jika perlu.

**TU1: adapter presentation.** Dependency: TU0, T0/T1; child status setelah T4. Implementasikan file UI pada tabel menggunakan hooks dan tool renderers dahulu. Wiring di extensions/harness.ts; feature flag `ui.reasonTerminal`. Jangan ubah kontrak tools atau provider untuk meniru visual. State error/abort/tool unavailable/usage unknown harus tetap jujur. Branding/nama model mencerminkan harness Pi dan provider aktual; fitur layanan Reason yang tidak ada tidak ditampilkan seolah aktif.

Failure: renderer error tidak boleh menghilangkan transcript/input atau menyembunyikan kegagalan tool; fallback ke stock Pi presentation dengan pemberitahuan. Narrow terminal/resize, long Windows path, Unicode, paste multiline, scrolling, Ctrl+C, Ctrl+D dan cancel tetap berfungsi. Tidak menambah efek/animasi yang tidak didukung referensi.

Acceptance **O14**: replay deterministic startup/input/stream/tool-error/diff/child/cancel/compaction fixtures tanpa inference. Capture pada ukuran referensi yang dicatat, plus terminal sempit dan lebar (usulan fixture 80x24 dan 120x40, bukan ukuran Reason yang sudah terbukti). Bandingkan susunan header/transcript/editor/footer, spacing, warna, hierarchy tool output, status dan key interactions dengan UI-PARITY. Jalankan satu review visual gabungan, perbaikan satu batch, lalu konfirmasi. Tidak mengklaim exact parity pada state yang referensinya belum tersedia. Smoke actual Windows terminal diperlukan selain snapshot renderer.

Rollback: matikan ui.reasonTerminal dan restart prototype kembali stock Pi TUI; session/history dan harness behavior tetap dapat dipakai. Release UI menunggu O14, sementara tes core dapat berjalan independen. T5 acceptance final menjadi O01-O14; evaluasi task berbayar tetap gate terpisah.

## 7. Batas scope patch upstream

Rencana awal **tidak mengedit** U, fork lama, maupun file upstream yang dipasang di runtime prototype. Gunakan exported factories/extension hooks lebih dulu. Internal source path di evidence ledger adalah anchor review, bukan daftar file yang harus diubah.

Jika acceptance membuktikan bug upstream yang tidak bisa diatasi dengan public API, buka item baru berisi fixture reproduksi, path source map `packages/coding-agent/src/...`, fungsi, expected/actual dan patch minimum pada salinan source khusus di `P/upstream-patches`. Build artifact/version/hash baru dicatat. Perubahan runtime tidak dilakukan diam-diam lewat node_modules atau fork lama; butuh review scope tambahan.

## 8. Verifikasi offline dengan fixtures

Seluruh tabel berikut **rencana tes, belum dijalankan sesi ini**. Prior ten probes R02 bukan pengganti integration tests prototype. Gunakan `node:test`, fake provider stream deterministic yang mengeluarkan tool calls, fake MCP transport, fake child transport, dan file/process fixture buatan sendiri. Tidak menjalankan JS/command yang diambil langsung dari trajectory.

Offline profile tidak memiliki credentials/provider produksi; loader hanya fixture, tidak membaca models/auth milik pengguna. Semua network transport harus disuntik stub fail-on-unexpected-call; jika menguji HTTP, allow hanya localhost fixture dan jangan forward request. Jangan mengandalkan hook model saja karena MCP/catalog/cache warming juga bisa membuat network. Counters network/inference nonfixture harus nol.

| ID / file test | Fixture dan assertion wajib | Evidence / oracle |
| --- | --- | --- |
| O01 `isolation.test.mjs` | P env/path yang benar, malicious override forms, project .pi config, foreign session path, no extension leak; immutable baseline hash | P01/P02, D01/D02 |
| O02 `codemode.test.mjs` | Adapt sepuluh R02 probes: isolated globals; await/return/exit; partial rejection; success/failure store; dangling tools; abort; CPU timeout; unsettled promise; invalid options; output cap/spill dan heap failure tambahan | R02/P03; deadline D07 ditandai deviation |
| O03 `discovery-policy.test.mjs` | Five initial schemas, deferred not inline, search/describe namespace, unknown undefined, BM25 bukan exact search, namespace reconnect; identifier collision; no fictitious tools | R03/R04/P03/P09 |
| O04 `tool-pipeline.test.mjs` | Fake assistant tool call melalui AgentSession; direct dan nested ditolak policy/schema sama; thrown hook blocks; content transform; structured nonzero vs throw; forbidden deferred tetap unreachable pada child | P04; jangan hanya memanggil standalone tool yang tidak punya session ctx |
| O05 `file-tools.test.mjs` | Temp files space/Unicode/CRLF/BOM; offsets/boundaries/binary/image; non-unique/overlap edits tidak write; multi-edit original; write new parents; access errors; symlink/junction root cases | P06/R03 |
| O06 `windows-tools.test.mjs` | Bash dan PowerShell stdout/stderr/exit 7; seconds timeout; argv quoting; cwd; >50KiB/direct vs >1MiB structured vs codemode cap; ordinary child tree dan descendant exit | P06, native Windows fixture |
| O07 `batching.test.mjs` | Barrier fixture membuktikan dua independent starts sebelum salah satu release; allSettled partial failure; sequential tool tidak overlap; same-file mutations serialized, different file overlap; writer lease blocks parent conflicts | P05/D08; bukan flaky wall-time-only test |
| O08 `context-store.test.mjs` | Session resume/branch store success-only, key delete/copy, size limits; fork branch tidak membawa store sibling; compaction doesn't merge memory vault | P03/P07 |
| O09 `compaction.test.mjs` | Below/equal/above threshold; low-window model overrides; deterministic summary response; tool pairs intact; previous summary, overflow one recovery, failure/cancel no corrupt append; restore child pointer from entries | P07/R06, Pi-specific oracle |
| O10 `provider-transport.test.mjs` | Fake completion SSE chunks JSON code/function args, malformed JSON, nonzero tools, cancel/disconnect/429/context overflow, usage absent/cached; conditional grammar fixture; no credential logs and no silent provider fallback | P11/P08; live compatibility belum dibuktikan |
| O11 `brain-telemetry.test.mjs` | Fake Brain confirms one vault binding; unavailable recall explicit; no child memory; event order/request hashes; nested record limits complete:false; missing usage unknown; warming disabled | P05/P08/P09 + instruksi user |
| O12 `delegation.test.mjs` | Prefix partial start, unknown model, owner mismatch, forbidden profile/recursive tools, exact assignment, busy follow-up, same ID next generation, timeout vs cancel, claim race and restart; tiga child bisa running bersamaan, child keempat tidak start, concurrent spawn tidak oversubscribe, slot baru tersedia setelah settlement/cleanup | R04/R05; lifecycle baru dan batas tiga pilihan pengguna adalah design oracle |
| O13 `delegation-process.test.mjs` | Actual no-model Windows worker startup/IPC, crashed worker, parent shutdown, kill confirmation, no ghost resume, writer lease retained on cleanup failure | P06/P10/D08; OS confinement tidak disimpulkan |

Setiap fixture manifest memuat ID, evidence reference+hash/step, synthetic input, expected values, allowed platform deviations, dan classification source/declaration/observed/design. Redacted capture tetap redacted. Expected outputs dibuat dari kontrak, bukan snapshot implementation output tanpa review.

Perintah yang **akan tersedia setelah implementasi**, belum bisa dijalankan sekarang:

```powershell
node D:/pi-reason-prototype/scripts/audit-baseline.mjs --check
node D:/pi-reason-prototype/scripts/verify-offline.mjs --suite core
node D:/pi-reason-prototype/scripts/verify-offline.mjs --suite windows
node D:/pi-reason-prototype/scripts/verify-offline.mjs --suite context
node D:/pi-reason-prototype/scripts/verify-offline.mjs --suite delegation
node D:/pi-reason-prototype/scripts/check-provider-fixture.mjs
```

Runner harus menolak unknown suite, mengembalikan nonzero untuk failure/cleanup_unconfirmed/network escape, dan menulis redacted report ke `P/artifacts/verification`. Resource fixture dengan path `D:/...` dihapus hanya setelah memastikan target berada dalam root fixture yang dibuat run itu. Tidak ada recursive cleanup path hasil model.

## 9. Evaluasi task nyata (fase berbeda, memerlukan budget eksplisit)

Tidak ada perintah inference dijalankan sesi planning. Sesudah offline gate, sepakati total budget uang/token, harga yang terverifikasi, hard request/turn/time caps, dan provider credentials khusus eval. Budget tidak boleh hanya memakai SDK estimated cost; pakai batas token/request ketika tarif tidak diketahui. Hard stop mencakup parent+child+summary+retry, preflight worst-case reserve dan accounting setelah request. Request tunggal bisa selesai melewati estimasi; tulis overshoot limit di protokol sebelum run.

Eksperimen A/B pada copy workspace/disposable checkout, bukan baseline profile:

- A: upstream core settings tanpa codemode/delegation, runtime/profile eksperimen sendiri.
- B: codemode+deferred+batching, delegation off.
- C: B+delegation setelah T4. Bandingkan B-C terpisah agar kontribusi delegation tidak tercampur.
- Model/provider/effort, starting tree, task/instructions, permission policy, verifier, compaction settings dan budget sama; urutan attempt diacak/diimbangi. Kondisi cache cold/warm dicatat; jangan mengklaim controlled cache bila gateway tidak menyediakan kontrol.
- Corpus pilot: investigasi repository dengan jawaban bersumber, bugfix lintas file, task web/Worker dengan verifier lokal, dan task native Windows path/process. Semua memakai repo fixture/copy yang ditentukan sebelum run, tanpa deploy/messaging side effects.
- Minimal tiga attempt per task per kondisi adalah usulan pilot, bukan bukti statistik. Ukur per-task pass/fail, regresi/out-of-scope diff, review/recovery time, parent+child latency, input/output/cached tokens, summary costs, retries dan tool errors. Jangan cherry-pick attempt sukses.
- Gate pilot yang diusulkan: nol capability bypass/baseline modification/orphan fixture; semua perubahan lolos verifier task; tidak menerima task regression terhadap A tanpa review. Peningkatan efisiensi bukan acceptance wajib MVP, dan empat task kecil tidak membuktikan uplift/savings umum.
- Reason trajectory dipakai sebagai referensi kontrak/behavior, bukan pembanding numeric live. Evaluasi Reason server, model lain, GPU task atau full benchmark di luar plan ini.

`scripts/evaluate-tasks.mjs` default dry-run, butuh explicit live mode dan budget config; jangan memberi default budget tak terbatas. Hasil gate berupa rekomendasi adopsi, tidak mengganti command `pi` secara otomatis.

## 10. Rollback operasional dan keputusan review

Rollback tidak berarti membatalkan perubahan task yang sudah dibuat. Hentikan owned children dan tunggu cleanup confirmed, tutup parent, simpan diff/receipts. Jalankan `pi` untuk fork atau `pi-clean` untuk baseline. Jangan restore `D:/pi-backups/fork-20261014` ke atas profile aktif sebagai langkah rutin. Prototype dapat diarsipkan tanpa mengubah vault atau launcher lain. Untuk menghapus capability, restart dengan registry baru; perubahan setting/reload saja bukan jaminan revoke deferred access.

Keputusan yang perlu Falih review sebelum implementasi:

1. D01-D03: direktori `D:/pi-reason-prototype`, stock CLI+extension untuk parent dan SDK child; tidak mengubah baseline/fork.
2. D04-D07: tetap provider/model sendiri, JSON fallback, models:false, PowerShell deferred, dan host codemode deadline 300 s / ceiling 900 s.
3. D06/D08/D09: code_explorer tanpa arbitrary shell, satu writer per shared workspace, hanya dua profile MVP. Batas maksimal tiga child aktif di luar parent sudah dipilih pengguna.
4. D10/D11: compaction upstream Pi sebagai desain eksplisit; Brain hanya parent dengan vault tunggal dan adapter terkurasi.
5. D12/T5: offline gate dahulu; budget dan corpus live belum diotorisasi oleh plan ini.

D13 sudah diarahkan pengguna: gunakan CLI/terminal Reason. Jika pilihan arsitektur di atas disetujui, tidak perlu review per file/function. Review pengguna berikutnya cukup pada hasil UI yang konkret untuk melihat kecocokan referensi, perubahan scope material jika hooks upstream tidak memadai, dan budget sebelum evaluasi berbayar. Detail implementasi/fixture rutin dikerjakan mengikuti plan.

Celah bukti material yang tetap terbuka:

- Exact Reason 1.1, single-build end-to-end baseline, server overrides codemode/quota/store dan compaction Reason belum diketahui.
- fork_self/context_explorer, full host enforcement read-only, partial/cancel/follow-up Reason belum teruji. sessions_send observed unavailable meski description merujuknya.
- Source+import Pi tidak membuktikan CLI/SDK integrated tool pipeline prototype, Windows process cleanup, atau concurrency policy; O01-O13 masih pekerjaan implementasi.
- Gateway grammar/freeform/SSE/cancellation/cache counters, actual context/output limits, harga, dan kemampuan image belum runtime-verified untuk prototype.
- QuickJS membatasi script, bukan tools/shell host; root scope checks dan taskkill bukan OS sandbox atau jaminan cleanup semua detached descendants.
- Tidak ada klaim model-call success, benchmark uplift, atau biaya lebih rendah dari sesi planning ini.
- Detail visual seluruh state CLI Reason belum diinventarisasi; TU0 menutup gap referensi ini. Source/API TUI Pi tidak otomatis membuktikan seluruh layout bisa ditiru melalui extension saja.

## 11. Catatan penyerahan sesi planning

Artefak kerja yang ditulis: plan ini dan pembaruan RECONSTRUCTION-BACKLOG. Runtime bersih, profil bersih, source/profile fork, backup dan launcher tetap tidak diedit. Shared Brain menerima taste signals/milestone dan catatan pengetahuan sesuai instruksi sesi; tidak ada store memory tambahan. Investigasi runtime hanya melakukan pembacaan, hashing, dan import SDK read-only; semua acceptance/evaluasi prototype di atas tetap berstatus belum dijalankan. Setelah penulisan dokumen, hash launcher, settings bersih dan package-lock dibandingkan dengan acuan sesi dan tetap sama; direktori prototype belum dibuat.
