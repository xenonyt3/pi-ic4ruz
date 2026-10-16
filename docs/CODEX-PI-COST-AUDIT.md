# Cost audit of the existing Codex/Pi v2 campaign

Using the matched upstream token records and OpenAI's Standard short-context
reference rates, **Pi costs $0.865268 versus Codex $1.411920 for six successful
runs each: 38.7169% less**. This is an API-equivalent calculation, not proof of
a debit from the user's OAuth subscription or credits.

No new inference was run. The original v2 client ledgers and result receipt are
unchanged. This post-hoc audit corrects the cost interpretation of their counters.
Public evidence: `artifacts/checkpoint/codex-pi-cost-audit.json`.

## Matching evidence

The local 9router SQLite database was opened with `mode=ro` and `query_only=ON`.
Only selected usage columns and the connection's auth type were queried; account
credentials, API keys, request headers and request bodies were not exported.

All **73 ledger requests matched 73 distinct usageHistory rows**, using provider,
model, endpoint, output count and completion timestamp. Each match was unique
within 250 ms; the largest observed difference was only **30 ms**. Input counts
and known cache counters were then checked independently. Other traffic in the
same time window was excluded instead of being included in the benchmark totals.

| Token metric | Codex, 33 requests | Pi, 40 requests |
| --- | ---: | ---: |
| Input recorded by the benchmark client | 432804 | 192300 |
| Upstream input recorded by 9router | 432804 | **112300** |
| Cached input recorded by 9router | 362880 | **69248** |
| Uncached upstream input | **69924** | **43052** |
| Output, including reasoning | 6996 | 7310 |
| Separately itemized reasoning subset | 395 | 0 |
| Logged cache-creation tokens | 0 | 0 |

Two previously unknown details are now resolved for this campaign:

1. Every Pi Chat Completions response reports **2000 more input tokens** than its
   matched upstream usage row. The installed router's chunk `5330.js`, module
   `73483`, export `O9`, adds 2000 to input/prompt and total counters. The 40-request
   offset is **80000 tokens**. Codex Responses has no such delta. This is reporting
   padding, not evidence that Pi sent those extra tokens to the model.
2. All **11 missing Pi cache counters** map to an explicit `cached_tokens: 0` in
   router history. The 29 already-known counters match exactly. This resolves the
   missing subdivision here; it does not justify treating missing fields as zero
   for other providers, versions or campaigns.

The router's installed package identifies as 0.5.104. Audited bundle hashes are
recorded in the public receipt; runtime observations are separately established
by the 73 matched historical records. No router code, configuration or ledger was
modified. In particular, no allowance was refunded or reopened after discovering
the conservative input padding.

## Reproducible calculation

[OpenAI's Astra model page](https://developers.openai.com/api/docs/models/gpt-6-astra),
checked on 2026-10-16, lists Standard short-context rates per million tokens:
uncached input **$10**, cached input **$1**, output **$50**, and cache writes **$12.50**.
Every matched request is below the 272000-input long-context threshold; the router
records zero cache-creation tokens for these requests.

| Component | Codex | Pi |
| --- | ---: | ---: |
| Uncached input | 69924 x $10 / 1M = $0.699240 | 43052 x $10 / 1M = $0.430520 |
| Cached input | 362880 x $1 / 1M = $0.362880 | 69248 x $1 / 1M = $0.069248 |
| Output | 6996 x $50 / 1M = $0.349800 | 7310 x $50 / 1M = $0.365500 |
| **Standard API-equivalent total** | **$1.411920** | **$0.865268** |

The difference is **$0.546652**, or **38.7169%** of Codex's reference cost. A higher
cache percentage does not settle this comparison: Pi has fewer absolute uncached
tokens as well as fewer cached tokens; its small output increase does not offset
those savings at the stated rates. Pi's upstream cache proportion is about 61.7%,
compared with Codex's 83.8%.

### Router cost field versus the corrected reference

Summing the stored router `cost` field gives **$1.431670 for Codex** and
**$0.865268 for Pi**. The router's `calculateCostFromTokens` function charges
completion tokens and then adds separately itemized reasoning tokens again.
For these Codex records, that extra amount is `395 x $50 / 1M = $0.019750`.

[OpenAI's counting guide](https://developers.openai.com/api/docs/guides/token-counting)
defines output/completion usage as all generated tokens, including non-visible
output. The 395 reasoning tokens are therefore already part of the 6996 output
tokens in this reference calculation. They are not added a second time. Both
the router's stored estimate and the corrected reference favor Pi, but the
corrected value is used for the 38.7% comparison.

## What this proves and what it does not

- Verified: 73 unique request matches, the input-padding pattern, the 11 explicit
  zero-cache records, and the stored router cost formula for every request.
- Verified reference: the dated Standard API rates and arithmetic above, using
  logged zero cache writes and no additional fees or service-tier adjustments.
- Unknown: actual subscription/credit debits, invoice allocation, negotiated
  rates, unreported charges and provider-side accounting beyond these records.

All matched connections use **Codex OAuth**, not a directly billed OpenAI API-key
connection. The router cost column is locally calculated telemetry, not an invoice.
[OpenAI's Codex pricing guidance](https://learn.chatgpt.com/docs/pricing) explicitly
separates API token prices from subscription usage. Consequently, the defensible
claim is **Pi is 38.7% cheaper at the stated API-equivalent rates on this corpus**.
An actual cash-spend or subscription-quota comparison is not established.

The original benchmark's small corpus, transport differences and Codex Windows
EPERM recovery remain relevant. This audit does not establish a universal harness
ranking or Reason parity.

## Re-run the read-only audit

```powershell
python scripts/audit-codex-pi-cost.py --database 'C:/path/to/9router/db/data.sqlite'
```

The script requires the existing private campaign ledgers and historical router
rows. It fails on missing/ambiguous matches, altered input offsets, inconsistent
cache counters, changed cost formulas or another model. It writes only a private
sanitized match record inside this checkout and prints aggregate results.

Validation includes the real 73-row reconciliation and three local fixture
controls: the complete reference matches, duplicate candidates are rejected, and
an unexpected input delta is rejected. An initial fixture cleanup exposed an
unclosed SQLite handle; explicit connection closing fixed it and all three
controls then passed with cleanup. No full model campaign was repeated.

Only aggregate evidence is published. Raw database rows, row identifiers and
account linkage stay under the existing `PUBLICATION.md` exclusions.
