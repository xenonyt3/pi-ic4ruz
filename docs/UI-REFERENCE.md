# TU0 - Referensi CLI Reason

## I22 continuation: content-order layout

FeA.showEntry at source line 252117 is extracted with a hash in the local oracle
and replayed directly with B0A. A tool attaches only if the previous visible entry
is also a tool; other entries get one structural blank. Binary/source hashes still
match the original audit. The extracted proprietary source remains local.

Actual Pi InteractiveMode reproduced 12 gaps before patching. Candidate reason-ui.4
adds an optional layout projection while retaining original components and payloads.
There are 96 mixed-block comparisons of visible order/spacing, ignoring trailing
surface padding. Actual SDK stream/resume/mouse/expansion and native Windows checks
pass. Details: `../upstream-patches/transcript-hook/LAYOUT-VERIFICATION.md`.

Inventaris diperiksa 2026-10-15 WIB, tanpa membuka session Reason atau inference.
Target kontrak agent 1.3 / C2 v7 berbeda dari versi CLI presentation.

## Bukti awal

- `D:/reason-investigation-20261014/public-reason-cli/docs/commands.md:3`:
  dokumentasi berasal dari help CLI **0.2.261**.
- `docs/commands.md:19`: `reason` membuka terminal interaktif dan
  `reason --resume ID` melanjutkan session. Baris 27 menjelaskan `?` untuk
  daftar key dan `/` untuk commands; baris 42 menjelaskan Ctrl+C graceful,
  lalu sekali lagi force stop.
- `public-reason-cli/README.md:31`: entry terminal interaktif. Repository
  lokal menyediakan dokumentasi, bukan source renderer terminal.
- Paket binary lokal `probe/official-windows-0.2.136/package/package.json`
  berlabel **0.2.136**. Ini provenance berbeda, bukan bukti visual 0.2.261.

## Bukti tambahan terverifikasi - 15 Oktober 2026 WIB

Manifest SHA-256: `artifacts/ui-reference/manifest.json`. Paket CLI dan Agent
adalah versi berbeda; jangan menggabungkan labelnya.

- Source renderer hasil ekstraksi binary resmi CLI **0.2.269** ditemukan pada
  `D:/reason-investigation-20261014/reason-readable.js`. Binary SHA-256 cocok
  dengan audit asal: `87d20c2d10c8ebaa308949b5f65a12dd5fe28a0827fca25a6794a472f185bed7`.
- `scripts/capture-reason-reference.mjs` mengekstrak fungsi/class renderer saja;
  oracle di `artifacts/ui-reference/20261015/source-oracle.json`. Tidak memuat
  entrypoint, account, API, atau session Reason. Test replay memakai helper
  width/wrapping/Markdown Pi 1.0.0; ini source oracle, bukan live capture.
- `o7`: accent ANSI 75/26, muted 245/243, success 78/28, warning 179/130,
  error 203/160 untuk dark/light. `A0A`: marker U+203A, padding tiga kolom.
  `B0A/Q0A`: dot state, header tool, collapse success, tail error empat baris.
  `p7/FeA`: header/model/location, editor dan footer/status/hints. Oracle kini
  juga memuat A0A: border/overflow dan neutral editor surface setelah warna
  terminal diketahui. Mix sRGB 10% dark / 6% light diuji terhadap source asli.
- Situs resmi `https://reasonmachines.com/`, tab "Reason in your terminal",
  diambil dengan browser terisolasi tanpa login. `official-demo.png` dan
  `official-demo.json` di folder evidence adalah **HTML pemasaran**, bukan
  screenshot session CLI. Teks Agent 1.10 pada demo bukan versi CLI 0.2.269.
  Demo menguatkan hierarchy ringkas; angka benchmark/data demo tidak diadopsi.

## TU1 pertama dan batas bukti

Adapter aktif pada prototype melalui `ui.reasonTerminal=true`: theme, header,
editor marker, compact tool renderers, footer actual state dan fallback.
SDK factories, CustomEditor, Theme, diff, images dan expanded output upstream
dipertahankan. Tidak mengubah fork/baseline, kontrak tools atau provider.

Fixture offline mencakup 20 state pada 80x24 dan 120x40 (40 frame): idle,
multiline, streaming, tool-running, tool-error, diff, child-completed, cancel,
compaction-unknown, status-warning, surface-dark, surface-light, assistant-markdown,
assistant-code, assistant-cancel, assistant-thinking, thinking-expanded,
thinking-expanded-light, thinking-after-text dan thinking-collapsed-light. Font preview **Consolas** adalah pilihan
fixture. `artifacts/ui-replay/index.html`, `frames.json` dan PNG adalah replay
prototype, bukan capture Reason. Review visual atas lima PNG telah dilakukan;
pesan error/status panjang dan ringkasan child selesai diperbaiki satu batch.

Windows PTY 120x40: header/footer/marker/key hints terpasang, paste multiline
Unicode, Ctrl+C clear, input gate offline dan Ctrl+D exit 0 terverifikasi.
Receipt: `artifacts/ui-replay/windows-pty-120x40.json`; startup/exit source final
pada 80x24 juga lulus (`windows-pty-80x24.json`). Smoke pertama menemukan
perbedaan instance Theme SDK/CLI; adapter sekarang memakai constructor host.

Lanjutan: 14 UI tests memverifikasi surface/query, event SDK actual untuk
tool/error/abort, concurrent tools, Writing dan context unknown. Terminal warna
dark/light pada preview berasal dari fixture sintetis. Public TUI query parser
diuji dengan fake Terminal; native Windows hanya membuktikan border fallback,
multiline, clear dan exit. Auto-detection warna native tetap belum terbukti.

Frame **live Reason** dan font terminal asli tetap belum tersedia. Whole
transcript layout dan menu Reason masih gap/stock Pi. Startup/shimmer continuation
is documented below. State cancel/resume/compaction memakai semantics Pi,
bukan bukti Reason-specific. **TU1 parsial; O14 penuh belum lulus.**

Reproduksi gap stock user-message tetap ada pada `upstream-patches/transcript-hook/reproduction.json`.
Setelah persetujuan pengguna, hook terisolasi aktif; kandidat terbaru `1.0.0+reason-ui.3`
menambahkan hook text-only assistant. `assistant-parity.json` memverifikasi 80/80
nonempty text fixtures dark/light 80/120, termasuk partial Markdown, whitespace,
tabs dan indented code. Stock trim mengubah indented code menjadi paragraf;
hook mempertahankan raw text sebelum renderer. Empty/whitespace-only messages
tetap mengikuti suppression Pi, yang juga ditemukan pada host Reason apply.
Source B0A/deI kini dipakai untuk ringkasan per blok dan expanded dim/italic
padding 3: 96/96 fixtures cocok. Gap text->thinking blank row diperbaiki hanya
pada custom renderer sukses. Grouping contiguous Pi thinking/tool order tetap.
`parity.json` di folder patch membandingkan actual UserMessageComponent dengan
source oracle: 16/16 cocok pada 80/120 kolom, literal/Unicode/multiline dan
surface fixture. Windows PTY final membuktikan literal framing, Unicode, resume
melalui launcher prototype dan exit 0; bukan live capture Reason.

## Pemetaan upstream Pi 1.0.0

Root `runtime/node_modules/@earendil-works/pi-coding-agent/`:

| Surface | API/source | Batas |
| --- | --- | --- |
| Header/footer | `dist/core/extensions/types.d.ts:84`; `dist/modes/interactive/interactive-mode.js:1917` | setHeader/setFooter tersedia |
| Editor | types `setEditorComponent`; `components/custom-editor.js` | Ganti editor, pertahankan key/input contract |
| Theme | types `setTheme`; `theme/theme.js` | Bisa memakai theme resmi tanpa patch |
| Working/status/widget | types `setWorkingMessage`, `setStatus`, `setWidget` | State aplikasi aktual, bukan fitur Reason fiktif |
| Tool call/result | `types.d.ts:494`; `components/tool-execution.js:7` | renderCall/renderResult; error fallback perlu diuji |
| Transcript/layout | `interactive-mode.js:381`, `:678`, `:2029` | Container/chat layout internal; tidak ada hook mengganti semua transcript |

## Startup / working source verification - 15 Oktober 2026 WIB

The same binary/source SHA-256 was rechecked before editing. Oracle extraction now
includes Mh (249459), lGA (249491), uGA (249530), asA/YeI, and host method snippets
spinToRest/startWorking/stopWorking/refreshWorking with hashes and numeric constants.
No Reason entrypoint, account or service was loaded. Constants: width threshold 44,
height reserve 16, large art 7-16 rows; startup amplitude 0.08 turns, 2400 ms with
33 ms ticks; shimmer 1400 ms sweep + 500 ms pause with 80 ms ticks.

Reason art is a bitmap rendered through a rotated, supersampled braille raster.
The prototype uses that algorithm/layout with its own Pi silhouette and PI wordmark,
and replaces the narrow `Reason` fallback with `Pi`. Art equality is deliberately
excluded. Source replay checks raster and layout against identical supplied Pi
assets, and byte-compares working/shimmer rows against the unmodified source.

`setHeader`, `setWidget`, and `setWorkingVisible` already exist upstream. The working
widget is disposed by Pi on replacement/reset; the adapter additionally stops on
turn completion, error/abort, shutdown and presentation fallback. Pi's original
retry/compaction indicator is rendered above the editor instead of being swallowed
by the custom border override. No additional runtime patch was needed.

The 48-frame replay now includes fresh/static startup, rotated startup, light startup,
light/dark working, writing and tool activity. Four complete PNGs were inspected;
they remain synthetic renderer previews, not native or live Reason screenshots.
Actual Windows ConPTY tests are separate, including production launcher and an SDK
with deterministic streams. See `STARTUP-WORKING-VERIFICATION.md` for commands,
receipts, test scope and remaining differences.

TU0 sendiri tidak memerlukan patch. Gap user-message dan assistant-text yang dibuktikan sesudahnya
ditangani hook optional di salinan source/build terisolasi; installed upstream
node_modules, baseline dan fork dipertahankan. Whole-transcript hook belum tersedia.
