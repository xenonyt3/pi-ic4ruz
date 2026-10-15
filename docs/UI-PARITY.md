# Matriks parity terminal

Status TU0 + adapter TU1 pertama; bukan kelulusan O14 penuh.

| State | Bukti Reason | Permukaan Pi | Status |
| --- | --- | --- | --- |
| Startup / idle | Source Mh/lGA/asA + FeA.spinToRest | setHeader + Pi braille assets | 35 source-layout + 9 raster comparisons; 2400 ms animation lifecycle tested; Windows 120x40/80x24/32x16 verified; art intentionally Pi |
| Input multiline | Source A0A | CustomEditor + marker/padding/surface measured | Exact source replay dark/unknown at 80/120; native border fallback lulus; native surface autodetection unknown |
| User message | Source literal user-row framing CLI 0.2.269 | Isolated optional UserMessageComponent hook | 16/16 exact component comparisons; native 120x40 literal/Unicode/resume/exit lulus; measured colors fixture-only |
| Assistant text / partial Markdown | B0A raw Markdown, padding 1, quote italic, plain code blocks | Optional text-only hook plus upstream Markdown | 80/80 exact nonempty text fixtures dark/light 80/120 streaming/completed; raw indentation/tab preserved; native restored code/Unicode lulus |
| Reasoning collapsed / expanded | B0A/deI summary, dim/italic Markdown padding 3 | Optional thinking renderer inside upstream MouseRegion | 96/96 source fixtures; native Ctrl+T expand/collapse/exit; per-run labels, signed content and stock fallback tested |
| Streaming | Source uGA/o7 + FeA.refreshWorking | setWidget aboveEditor + setWorkingVisible | 80 shimmer + 160 working-row source comparisons; actual SDK/native thinking-writing-tool-complete/error/Escape cancel; timer cleanup tested; transcript composition remains partial |
| Tool running / complete / error | Source B0A/Q0A, palette o7 | Tool renderCall/renderResult | Header compared to source oracle at 12/80/120; error wrap/expand diuji |
| Diff / output panjang | Source diff/output policy | Upstream edit renderer + expand | Diff dipertahankan, fixture direview; exact Reason diff parity belum |
| Child running / complete | Tool rows + status patterns | Actual child status footer | Completed/failed/cleanup states diuji; live lifecycle C-03 lulus terpisah |
| Cancel | Source + Ctrl+C graceful/force docs | Stock Pi key handling | SDK aborted/error state dipertahankan saat agent_end; key/native smoke lulus; Reason semantics tidak disalin |
| Session resume | Source + `--resume ID` docs | Stock Pi session tree + guarded path | Core resume offline tested; visual Reason replay belum |
| Model / context | Source p7/FeA + demo | Footer/status hooks | Actual provider/model, context percent/unknown dan statuses; bukan account quota |
| Compaction | Reason-specific contract unknown | Upstream events | Hook replay context unknown setelah compact; full Reason compaction parity belum |

Ukuran 80x24 dan 120x40 adalah usulan fixture plan, bukan ukuran capture
Reason yang telah terbukti. `ui.reasonTerminal=true` mengaktifkan adapter;
false mengembalikan stock Pi saat restart. Source oracle 0.2.269 dan marketing
demo dipisahkan dari capture live yang masih tidak tersedia. Lima PNG review
adalah fixture prototype, bukan Reason; reviewer menerima perbaikan error/status
wrap dan child completed untuk scope parsial. Slice surface/lifecycle berikutnya
juga diterima reviewer pada evidence sintetis; native color autodetection belum.
Empat fixture gap stock tetap disimpan sebagai baseline. Hook user-message
terisolasi kini disetujui, dibangun dan aktif; kandidat terbaru `1.0.0+reason-ui.3`
menambahkan hook teks assistant dengan transformers dan padding Pi tetap berfungsi.
Real SDK host menguji reset/fallback/resume/fork/reload dan model transcript
unchanged. Native receipt final: `artifacts/ui-replay/windows-pty-user-hook-final.json`.
Full transcript/menu serta exact live Reason parity belum ditutup.
Source host Reason apply juga melewati pesan kosong/whitespace-only. Reasoning rows
kini source-matched; grouping dan susunan tool/text lengkap belum. Native receipt assistant:
`artifacts/ui-replay/windows-pty-assistant-hook.json`; reasoning receipt:
`artifacts/ui-replay/windows-pty-thinking-hook.json`. 48 frame gallery merupakan
fixture sintetis. O14 penuh tetap pending; detail terbaru pada
`docs/STARTUP-WORKING-VERIFICATION.md`. Startup/working native receipt:
`artifacts/ui-replay/windows-pty-startup-working.json`. Candidate stays
`1.0.0+reason-ui.3`: this slice uses existing upstream APIs without new patch/build.
