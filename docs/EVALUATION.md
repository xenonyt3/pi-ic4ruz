# T5 - evaluasi tetap terpisah dari acceptance offline

I28 adds fake web/provider and actual SDK fixtures to offline acceptance. The
separate `scripts/verify-web-tools.mjs` runs a native isolated Chromium against
a loopback fixture; `--public` also checks public search/extraction with no model
inference. Reports distinguish native success and external provider failure.
Existing headless behavior campaigns do not enable the new web tools. Historical
benchmark results do not measure web capabilities. See [WEB-TOOLS.md](WEB-TOOLS.md).

I26 introduces [Codex versus Pi through 9router](CODEX-PI-BENCHMARK.md), reusing
the v2 corpus and accounting. Native Codex Responses and Pi Chat Completions are
explicitly different transports; single-agent settings, prompts and quotas are
matched. The explicitly approved v1 campaign stopped at its first Codex request
because of the broker's terminal-stream handling; see
[the retained v1 result](CODEX-PI-RESULTS-V1.md). It consumed one accounted request
(11794 input, 108 output), with confirmed cleanup and no Pi cell dispatched.
V2 was then separately approved and completed **12/12 task passes**, consuming
73 requests / 625104 client-reported input / 14306 output, with confirmed cleanup and complete
total usage. [V2 results](CODEX-PI-RESULTS-V2.md) retain cache-reporting and Windows
EPERM limitations; no verified monetary winner follows. The allowance is closed.
The later [cost audit](CODEX-PI-COST-AUDIT.md) reconciles all 73 router records,
resolves cache omissions and +2000/request client input padding, and gives Pi
38.7% lower Standard API-equivalent cost. Actual OAuth billing remains unverified.

I24 now has a separate [behavior corpus/protocol](BEHAVIOR-EVALUATION.md). Its
goal-only prompts and 12 fresh stock-core/prototype cells reuse the existing live
runtime and accounting. The historical pilot's mandatory-delegation prompt is not
used to assess autonomous decisions. Preparation is offline and the proposed
campaign requires a new explicit budget. I24 v1 subsequently completed with 12/12
task passes and fully accounted usage (83 requests, 368647 input, 15453 output).
The [v1 results](BEHAVIOR-RESULTS-V1.md) distinguish automated outcomes, Codex trace
review and evaluation limitations. V2 offline fixes do not reuse that authorization.

Interactive daily use now has a separate explicit entrypoint; see [LIVE.md](LIVE.md).
It shares the existing live transport and child broker with the evaluator, with
persistent resumable allowances. The campaign path retains its one-shot Astra
scope and refuses reuse. All campaign authorizations documented below are historical;
they are not permission to run the interactive launcher or repeat a campaign.

## I23 interactive smoke, separate authorization

After the explicit launcher and 171/171 offline acceptance were complete, the user
authorized 6 total requests / 120000 input / 6000 output / 1000 output per request /
5 minutes for 9router `cx/gpt-6-astra`. The actual Windows ConPTY live launcher
passed one disposable marker task: one read-only child read the marker, the parent
wrote the exact result, then exited and resumed without another inference request.
The shared ledger accounted all **5 requests (3 parent + 2 child), 18430 input and
250 output tokens**. Response model `gpt-6-astra` matched the explicit alias allowlist.
No fallback, error, budget stop, unconfirmed cleanup or credential leak was observed.
Baseline/fork audit remained unchanged. Prices and broad workload reliability remain
unknown; no savings or full UI parity claim follows from this smoke.

Public receipt: `artifacts/checkpoint/interactive-live-smoke.json`. Raw terminal,
sessions and allowance state remain under ignored `agent/live-private/`. This new
smoke did not repeat any historical evaluation campaign; no further paid run is
authorized by its remaining capacity.

## Historical campaign workflow

Perintah `node scripts/evaluate-tasks.mjs` default dry-run. Artefak berada di
`artifacts/evaluations/dry-run.json`. Tidak ada request model pada dry-run.
Pengguna mengotorisasi pilot headless live dengan `cx/gpt-6-astra` melalui
9router, Brain tetap off, dan batas total 12 request / 120000 input token /
12000 output token / 15 menit. Konfigurasi ada di `config/evaluation-astra.json`.
Mode live hanya dibuka jika acceptance `all` lulus, mencakup tes jalur live,
dan hash source/test/config masih cocok. O14 tetap unknown dan tidak diklaim
selesai oleh pilot headless yang diotorisasi ini.

```powershell
node scripts/evaluate-tasks.mjs --live --budget config/evaluation-astra.json
```

Untuk campaign C-only baru gunakan `--live --budget PATH --conditions C`.
Jalankan file `.mjs` langsung; `node --input-type=module -e` tidak kompatibel
dengan worker QuickJS yang mewarisi execArgv dan kini ditolak sebelum request.

`EvaluationBudget` menghitung reservasi bersama parent, child, compaction,
retry dan follow-up. Batas requests/input/output/duration/attempts wajib
positif. Cost cap memerlukan harga terverifikasi. Usage hilang dibebankan
sebesar reservasi lalu stop; overshoot menghentikan reservasi selanjutnya.
Ini komponen accounting yang dites offline, bukan klaim hard billing cap
pada provider nyata. `LiveBudgetTransport` membatasi POST ke endpoint/model
yang dipilih, mem-pin output maksimum 1000 token per request, mematikan retry,
dan mencatat reservasi secara durable sebelum jaringan. Child tetap di worker
dengan offline guard; respons model nyata datang melalui broker parent dan
ledger bersama. Tidak ada credential yang dikirim ke child.

Verifikasi hasil tidak mengandalkan exit code 0: evaluator trusted menjalankan
fungsi kandidat dalam VM tanpa process/imports, menguji 12 assertion, dan
menghasilkan receipt yang terikat ke hash source. Seluruh child serta writer
lease wajib bersih sebelum kondisi dianggap lulus. Ini bukan OS sandbox umum.

Pilot A/B/C memakai model/provider/effort, starting tree, permissions,
instructions, verifier dan compaction yang sama. Pilot kecil saat ini memakai
satu tugas normalisasi string, satu attempt pada masing-masing A/B/C. Proposal
awal tiga attempt pada empat jenis task belum dijalankan.
Task kinds: investigasi repo, bugfix lintas file, web/Worker fixture dan
native Windows. Gunakan copy/disposable checkout, tanpa deploy atau messaging.

Catat correctness, scope drift, token/cache counters dengan provenance,
latency parent+child, biaya dengan harga terverifikasi, waktu review dan
recovery manusia. Tidak mengklaim savings/uplift dari fixture atau satu pilot.
Reason trajectory adalah oracle kontrak, bukan baseline numerik live.

O01-O13 boleh lulus offline tanpa model berbayar. TU1 kini memiliki adapter awal
berdasarkan source oracle 0.2.269 dan demo pemasaran berlabel. O14 penuh tetap
pending karena live capture/full layout parity belum; kelulusan core/pilot
tidak menjadi klaim kesetaraan UI atau release lengkap.

## Hasil pilot 15 Oktober 2026 WIB

Campaign `2026-10-15-astra-small-01` berjalan 05:55:47-05:56:16 WIB
(29.633 detik wall time). Gate memakai acceptance 105/105 dari
`artifacts/verification/runs/2026-10-14T22-48-00.025Z/report.json`.
Evidence live tersimpan pada `artifacts/evaluations/2026-10-15-astra-small-01/`:
`report.json`, `ledger.json`, serta sessions tiap kondisi. Raw response model
seluruh request adalah `gpt-6-astra`; model yang diminta `cx/gpt-6-astra`.

| Kondisi | Request | Input token | Output token | Hasil kode | Delegasi |
| --- | ---: | ---: | ---: | --- | --- |
| A: core tools | 3 | 10723 | 172 | 12/12 PASS | Tidak disyaratkan |
| B: codemode/deferred | 4 | 15859 | 213 | 12/12 PASS | Tidak disyaratkan |
| C: codemode + child | 4 | 15859 | 215 | 12/12 PASS | Tidak dijalankan; FAIL |

Total **11 request, 42441 input token, 600 output token**; semua raw usage
tercatat, tidak ada request pending, stop karena budget atau fallback model.
Input mencakup cached tokens. Harga belum diverifikasi sehingga biaya uang
tetap `null/unknown`, bukan nol. Brain nonaktif. Cleanup semua kondisi
terkonfirmasi; audit sesudah pilot memverifikasi 5599 file baseline/fork dan
satu sumber tool unchanged. Tidak ditemukan proses Node prototype atau lease
pilot yang tertinggal setelah runner keluar.

Overall **passed:false**: pada C, model memanggil `searchTools` tanpa `await`,
mencetak Promise sebagai `{}`, lalu melewati child. Ini bukti kegagalan alur
delegasi pilot, bukan bukti tool tidak terdaftar. Petunjuk async discovery
diperjelas sesudah run, dan regresi offline ditambahkan untuk awaited discovery,
spawn/wait child via broker parent, lalu edit. Hasil live asli tidak diubah;
perbaikan petunjuk belum diuji live. Campaign tidak direset/dijalankan ulang.

Verifikasi setelah perubahan: suite live 12/12, lalu full offline **106/106**,
0 failed/cancelled/skipped, source/vault unchanged, unexpected network attempts 0.
Report: `artifacts/verification/runs/2026-10-14T22-58-35.210Z/report.json`.

Pilot satu tugas ini tidak menutup I15 penuh, live child, UI O14, provider
limits/images/grammar, kontrol cache, harga, atau benchmark lintas task.

## Rerun C dengan budget tambahan

Pengguna kemudian menyetujui tambahan 8 request / 80000 input / 8000 output /
600 detik untuk C saja. Dua bagian di bawah memakai satu allowance; bagian
kedua hanya mengalokasikan sisa request/token/waktu dari ledger pertama.

| Campaign | Request | Input | Output | Hasil |
| --- | ---: | ---: | ---: | --- |
| 2026-10-15-astra-c-02 | 4 | 16202 | 252 | Kode 12/12, delegasi gagal akibat entrypoint |
| 2026-10-15-astra-c-02-remainder | 4 | 15320 | 246 | Child spawn/read live; cap tercapai sebelum selesai; kode 7/12 |

Total **8 request, 31522 input token, 498 output token, 87.832 detik** termasuk
jeda antar-run. Harga unknown; Brain off; cleanup confirmed; baseline unchanged.
Aggregate: `artifacts/evaluations/2026-10-15-astra-c-02-aggregate.json`.

Pada bagian pertama model sudah memakai await, tetapi peluncuran oleh parent
dengan `--input-type=module -e` membuat worker QuickJS gagal sebelum discovery.
Bagian kedua memakai file `.mjs`: discovery menemukan tool, parent spawn satu
code_explorer, model child nyata mengeluarkan read target, dan parent menunggu.
Cap bersama tercapai sebelum respons diagnosis child dan edit parent. Error
child `Connection error.` tidak membuktikan outage: ledger mencatat `capacity`
dan hanya satu request child terkirim. Overall tetap **passed:false**.

CLI kini mendukung `--conditions C`; preflight menolak flag `--input-type`
sebelum credentials/model request, dengan regresi offline. Tidak ada rerun live
sesudah budget habis.

Verifikasi pertama sesudah perbaikan meluluskan 107 tes, tetapi gate agregat
menolak run karena receipt network untuk harness.test.mjs hilang. Report gagal
tetap disimpan pada `artifacts/verification/runs/2026-10-14T23-45-02.431Z/report.json`.
Nama receipt sebelumnya hanya PID/thread ID dan dapat bertabrakan saat Windows
memakai ulang PID. Nama kini juga memakai UUID per lifetime; regresi mensimulasikan
dua proses dengan PID sama dan mewajibkan kedua receipt tetap ada. Full acceptance
setelah perbaikan receipt **108/108 PASS**, 0 failed/cancelled/skipped, receipt
lengkap, source/vault/baseline unchanged, unexpected network attempts 0.
Report: `artifacts/verification/runs/2026-10-14T23-52-32.966Z/report.json`.

## C-03: end-to-end PASS

Campaign baru `2026-10-15-astra-c-03` memakai persetujuan tambahan terpisah:
8 request / 80000 input / 8000 output / 600 detik, Astra/9router dan Brain off.
CLI dijalankan dari file, dengan `--conditions C`. Acceptance 108/108 dan hash
preflight cocok; tidak ada perubahan source/runtime atau tes pada campaign ini.

Hasil **passed:true**: awaited discovery, satu child code_explorer membaca file
dan menyelesaikan diagnosis, parent menerima hasil dan mengedit, verifier 12/12,
model stop normal, child completed, cleanup confirmed. Total **7 request**
(5 parent + 2 child), **28339 input token, 540 output token**, **25.023 detik**.
Semua usage accounted; response model `gpt-6-astra`; tidak ada fallback/error
atau stop budget. Cost tetap unknown. Audit akhir 5599 file baseline/fork dan
satu sumber tool unchanged; tidak ada proses prototype atau lease tertinggal.

Evidence: `artifacts/evaluations/2026-10-15-astra-c-03/report.json`, `ledger.json`,
sessions dan child receipts. Reproduksi memerlukan campaign/budget baru yang
diotorisasi; command asli (tidak untuk diulang dengan campaign yang sudah dipakai):

```powershell
node scripts/evaluate-tasks.mjs --live --budget artifacts/evaluations/2026-10-15-astra-c-03-budget.json --conditions C
```

A/B awal dan C terbaru masing-masing pernah lulus satu task. Run gagal tetap
tersimpan; perubahan petunjuk/entrypoint antar-run berarti hasil ini tidak
menjadi controlled performance comparison. Pilot kecil terpenuhi, tetapi
corpus luas, pricing, cache control, UI O14 dan equivalence Reason masih unknown.

Catatan kualitas: child menyarankan coercion/nullish fallback karena assignment
child hanya meminta diagnosis file tanpa memuat kontrak normalisasi lengkap.
Saran itu tidak sesuai syarat TypeError; parent yang memiliki kontrak lengkap
tetap menghasilkan implementasi benar. PASS mengukur hasil akhir, lifecycle dan
cleanup, bukan ketepatan setiap saran child. Follow-up: sertakan acceptance
criteria yang relevan dalam assignment child; belum diubah/diuji pada C-03.
