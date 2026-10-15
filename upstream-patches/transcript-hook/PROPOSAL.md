# Proposed isolated user-message renderer hook

Latest: I22 adds an isolated optional content-order layout in reason-ui.4 after
12 actual-host gap fixtures. See `LAYOUT-VERIFICATION.md`. Five scoped TypeScript
files, 96 composition comparisons and native Ctrl+O/Ctrl+T/resize checks pass.
The v1-v3 paragraphs below remain historical records.

Current continuation: candidate `1.0.0+reason-ui.3` includes the approved user hook
and bounded assistant-text/thinking hooks after concrete indentation/style gaps were
reproduced. See `THINKING-VERIFICATION.md` and `ASSISTANT-VERIFICATION.md` for scoped strict typecheck, comparison,
runtime and acceptance evidence. Proposal/history below describes the v1 milestone.

Status: scope approved by the user, then implemented in an isolated candidate
`1.0.0+reason-ui.1`. The historical proposal is retained below; installed upstream
node_modules, the stock prototype runtime, clean baseline and fork were not patched.
No Reason service or paid model call is used. Current evidence: `transcript-hook.patch`,
`source-provenance.json`, `parity.json`, `config/runtime-candidate.json` at prototype root,
and the full verification report. Build uses pinned local esbuild transpilation;
a full TypeScript typecheck has not been performed.

## Reproduction and expected behavior

Run `node scripts/audit-transcript-gap.mjs` from the prototype. `reproduction.json`
records hashes of current upstream files and four 80/120-column cases against
the extracted CLI 0.2.269 source oracle.

- Expected: user text is literal, begins with the prompt marker, has three-column
  content indentation, and can use the same measured neutral surface as the editor.
- Actual: UserMessageComponent owns a Markdown component and vertical padding;
  literal `**` and backticks become formatting, and there is no prompt marker.
- The original text/session/model input is unchanged in both cases. This is a
  presentation capability gap, not an upstream correctness/security bug.
- `registerMarkdownTransformer` only returns another Markdown string. It cannot
  replace surrounding padding/framing or the component. `registerMessageRenderer`
  is for custom message types, not standard user messages.

## Minimum proposed change

Add an optional `setUserMessageRenderer` presentation hook. A renderer receives
the original user text, available width and current theme, and returns terminal
lines (or undefined to request stock rendering). Preserve OSC133 zones and
selection/copy metadata in the upstream UserMessageComponent wrapper.

Expected source files, using published source-map anchors:

1. `packages/coding-agent/src/core/extensions/types.ts`: optional renderer type
   and ExtensionUIContext setter. No model-facing tool or message schema change.
2. `packages/coding-agent/src/modes/interactive/components/user-message.ts`:
   optional renderer callback; stock rendering remains the default; invalid or
   throwing renderers fall back to stock. Retain terminal zones and outputPad API.
3. `packages/coding-agent/src/modes/interactive/interactive-mode.ts`:
   store/set the renderer and supply it through the common construction path for
   live, skill-associated and resumed user messages. Reset on extension unload.
   Defer a warning after renderer failure without recursive rendering.
4. Focused upstream/prototype tests: default output identical, literal prompt
   content preserved, multiline/Unicode/80/120 widths, callback failure, selection
   zones, resume/fork/reload, and no change to model-visible transcript hashes.

The proposal deliberately does not replace AgentSession, tools, providers,
permission policy, model context, compaction, or the entire interactive host.
Assistant/whole-transcript layout would need its own proven gap before expansion.

## Isolation, build and rollback

- Work only in a separate source/build directory below this folder, never patch
  installed node_modules, D:/pi-clean, or C:/Users/M S I/.pi in place.
- Record exact source provenance, patch diff, lockfile, build command, version
  label and hashes; run baseline/guard/UI/CLI acceptance against the candidate.
- Activation would select the separately pinned candidate for this prototype
  only, with the existing unpatched runtime retained for rollback.
- Default hook absent => stock Pi behavior. Disable the hook/adapter to roll back;
  sessions and Markdown vault remain unchanged.

Build/import and the explicit unbundled candidate CLI work. The candidate is
selected through `config/runtime-selection.json`; `stock` restores the unpatched
runtime after restart. Candidate and inactive stock trees are both hash-audited
by the verification runner. Focused tests cover stock compatibility, malformed
renderers, OSC133 zones, literal framing, host resume/fork/reload and unchanged
model transcript. Full suite results are tracked in the backlog.

## Approved decision

The user approved proceeding with the isolated hook to match Reason's UI.
The scope also fixes the candidate's resume hint so it calls the prototype
launcher with PowerShell-safe arguments. No additional approval is pending for
this bounded change. Whole-transcript/assistant-layout changes still require
their own concrete evidence and scope assessment; this patch does not claim
complete O14 or live Reason parity.
