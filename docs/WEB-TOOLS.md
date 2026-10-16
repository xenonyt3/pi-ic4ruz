# Web tools from oh-my-pi

The prototype exposes `web_search`, `web_extract` and `browser` through Pi's
deferred registry and codemode. Brain is disabled. The standard launcher stays
offline; actual web access uses the explicit live launcher. No Reason server,
OpenRouter, search LLM or personal browser profile is used by these tools.

## Installation and source

```powershell
npm ci --prefix tools/web --ignore-scripts --no-audit --no-fund
```

Dependencies are pinned under `tools/web/node_modules`. Chrome or Edge must
already be installed. `config/web-tools.json.browserExecutable` selects an exact
executable or `auto` (Chrome, then Edge on Windows). No global install, browser
download, extension, shared browser daemon or profile migration is performed.

Selected components are adapted from MIT-licensed
`@oh-my-pi/pi-coding-agent@18.10.1`: public search parsing, readable extraction,
Turndown rules, console capture, ARIA snapshot/ref helpers and snapshot processing.
The npm tarball SHA-512 and source SHA-256 values are recorded in
`vendor/oh-my-pi/provenance.json`. `scripts/import-omp-web.py <tarball>` verifies
the archive before reading selected files and stripping TypeScript types without
executing the package. Internal imports are adapted to Node and separately pinned
DOM/Readability/Turndown packages. This is a selected component port, not OMP's
entire agent or browser API. No global OMP settings or authentication are imported.

The MIT notice is retained in `vendor/oh-my-pi/LICENSE`. The unchanged generated
ARIA bundle includes Playwright v1.61.0 code; `LICENSE.playwright` retains its
Apache-2.0 license. Installed dependencies retain their own notices.

## Usage

Live allowance requirements are unchanged; see [LIVE.md](LIVE.md). `/web-status`
reports the public search provider and browser mode. These tools are deferred;
the five initial model tools are unchanged. Inside codemode:

```javascript
text(await tools.web_search({query: 'site:nodejs.org AbortSignal documentation', limit: 5}));
text(await tools.web_extract({url: 'https://example.com', format: 'markdown'}));
text(await tools.browser({action: 'open', url: 'http://localhost:5173'}));
text(await tools.browser({action: 'snapshot'}));
text(await tools.browser({action: 'click', selector: '@e3'}));
text(await tools.browser({action: 'fill', selector: '#name', text: 'Example'}));
text(await tools.browser({action: 'console'}));
text(await tools.browser({action: 'resize', width: 390, height: 844}));
text(await tools.browser({action: 'screenshot', path: 'ui-check.png'}));
text(await tools.browser({action: 'close'}));
```

Use refs from the latest snapshot, not the example's literal `@e3`. Other browser
actions: `tabs`, `extract`, `press`, `select`, `wait`, `evaluate`, `close_tab`.
`open` accepts `newTab:true`; at most five tool-owned tabs are open. `evaluate`
runs JavaScript in the page, not Node. Browser `extract` reads rendered content;
`web_extract` reads the HTTP document without executing its scripts. Extraction
supports CSS selectors, heading outlines and heading-section filters. Binary
document formats such as PDF are not included in this adapter.

Screenshots are PNG files inside the workspace; existing files are not overwritten.
The tool returns path and size. Current live model registration is text-only:
this change does not enable or claim verified model vision. Snapshots, DOM text
and console capture still provide textual UI evidence. Browser actions are
serialized and use the existing writer lease. Children retain their existing
profiles and offline guard; web/browser operations are parent-owned.

## Search availability

`searchProvider` defaults to `exa`, using OMP's public, unauthenticated MCP path
at `https://mcp.exa.ai/mcp?tools=web_search_exa`. The user's local OMP config has
no web-role override; its upstream priority chain includes `web/exa` before the
HTML scrapers, and Exa explicitly supports keyless access. This prototype pins
that path rather than importing OMP's whole chain of hosted models/credentials.
It uses OMP's argument builder, structured/text result normalization and strict
JSON-RPC decoder, with bounded JSON/SSE streaming that stops on the matching
terminal response even when HTTP has not reached EOF. Searches are paced at
least one second apart. Existing EXA_API_KEY/OMP authentication is not imported.

The optional `google` and `duckduckgo` selections use public HTML frontends. Google
uses HTTP first, then isolated Chromium only when JavaScript rendering is
required. Results identify provider and `http`/`browser` transport. The adapter
does not switch providers, solve a CAPTCHA or use a paid fallback.

During initial installation probes, DuckDuckGo failed TLS validation and Google
returned HTTP 429. Separate Ecosia/Mojeek probes were also blocked; those
providers were not installed. After matching the OMP keyless path, **Exa public
MCP returned three search results through the actual Pi tool service**. Public
extraction from `example.com` also passed. These are single bounded web checks,
not a guarantee of service uptime or unlimited quota. Keep TLS verification
enabled. Provider errors are errors, never invented results or empty success;
there is no automatic switch to a credentialed/paid service or hosted search model.

## Isolation, cancellation and accounting

The 9router credential stays with the existing model broker. Web HTTP carries
no model Authorization header. Chromium receives a sanitized environment and a
fresh private profile under the allowance's `web/` directory. CDP uses inherited
pipes, not a public debugging port. Downloads are denied, dialogs dismissed,
and personal browser tabs/profiles are not attached. Profiles/receipts are ignored
by Git. Browser tabs/cookies are not restored on session resume.

Web HTTP and navigation reject URL credentials, non-HTTP(S) schemes, private
destinations and the model endpoint. Loopback is restricted to exact configured
`localOrigins`; common dev ports are included and 9router's port stays denied.
Redirects are revalidated; HTTP responses have byte, time and output caps.
Browser subresource requests are checked too. These trusted-tool controls are
not an OS sandbox or comprehensive protection against hostile pages, DNS
rebinding or every browser network channel.

Cancel/abort uses the existing process supervisor and waits for process-tree
exit plus CDP pipe closure. Unconfirmed cleanup preserves writer recovery state
and stops the live allowance during abort. Shutdown drains web work. The first
native test caught a CDP-pipe ownership-release race; its failed receipt is kept,
and subsequent verification checks both tree exit and registry release.

These web operations do not call a model. Their output enters the parent
transcript; later turns and compaction consume the same persistent allowance.
There is no second inference transport/budget. The pending daily allowance is
still unauthorized; installing tools does not activate it.

## Verification and rollback

Final I28 verification on this workstation: 210/210 full offline acceptance,
23/23 focused web/live fixtures, 15 native browser checks, and successful public
Exa search (three results) plus extraction. Baseline/source/both runtimes/vault
were unchanged and unexpected tracked network attempts were zero. Receipt:
`artifacts/checkpoint/omp-web-verification.json`. No model inference was run.

```powershell
node --import ./src/offline-guard.mjs --test tests/web-tools.test.mjs
node scripts/verify-web-tools.mjs
# Optional public HTTP/browser check, with no model inference:
node scripts/verify-web-tools.mjs --public
node scripts/verify-offline.mjs --suite all
```

Native checks use a temporary loopback app and fresh Chromium profile, without
reading personal pages or credentials. Reports separate native checks from
public search availability. Full acceptance requires the real baseline, runtimes,
source oracle and vault prerequisites. See the I28 receipt for actual results.

Disable tool registration with `config/harness.json.features.web:false`, then
exit/restart. `config/web-tools.json.enabled:false` denies execution while keeping
discovery/status. Return to `launch.mjs` for offline mode. Keep allowance ledgers
and unconfirmed writer leases; disabling tools does not reset usage. Brain stays
off and no global rollback is needed.
