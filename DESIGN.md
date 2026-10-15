# Terminal presentation

Mode: Operate. The user works on coding tasks in a Windows terminal. The approved
visual authority is Reason CLI, with Pi's real state and capabilities.

## Evidence and boundaries

- CLI 0.2.269 extracted renderer: theme `o7`, editor `A0A`, transcript `B0A`,
  footer `p7`, session host `FeA`. Hashes and replay snippets are under
  `artifacts/ui-reference/20261015/`.
- Official website terminal demo captured separately. It is marketing HTML,
  not a live CLI capture; the displayed Agent 1.10 is not CLI version 0.2.269.
- Typography is the user's terminal font. Fixture previews use Consolas as a
  declared test font, not a claim about Reason's required font.
- No Reason logos, account quota, cloud machines, or unsupported services.

## Supported tokens and layout

- ANSI 256 accent 75 dark / 26 light; muted 245 / 243; success 78 / 28;
  warning 179 / 130; error 203 / 160. Inherit terminal foreground/background.
- Prompt marker U+203A with three-column content indentation. Preserve Pi's
  multiline editor, cursor, paste, autocomplete, selection and key handling.
- Tool status U+25CF; compact successful output; the last four logical error
  lines wrap without losing their ending, with earlier-line count/expand hint;
  expanded output, images and edit preview/diff use upstream renderers.
- Header identifies Pi and actual model/workspace. Footer shows actual model,
  phase, estimated context (explicit unknown), child/cleanup state and statuses.
  Context percentage is not a provider account quota.
- Footer key hints come from Pi keybindings. Do not advertise Reason-only keys.
- Use the host Theme constructor and host editor keybindings across CLI/SDK
  module boundaries. Pin the custom editor's padding when the host copies defaults.
- Query terminal colors using the public TUI API. With a measured background,
  blend 10% foreground into dark backgrounds or 6% into light backgrounds in sRGB,
  matching source o7. Apply this neutral surface only to editor rows and padding;
  preserve cursor/overflow and leave autocomplete rows alone. Missing colors or
  NO_COLOR keep the horizontal-border fallback. Late replies after disposal do
  not change the theme. Native Windows color autodetection is not yet verified.
- Drive Thinking/Writing/running-tool labels from actual events. Finishing one
  tool does not hide another active tool. Preserve cancelled/error at turn end;
  reset on a new session. Compaction with unknown usage stays explicit.
- The approved isolated runtime `1.0.0+reason-ui.3` retains the optional user-message
  renderer hook. Literal text, marker, wrapping and measured surface match the
  Reason source row; OSC133 zones stay in Pi's component wrapper. Persisted/model
  text is untouched. Invalid/throwing renderers use stock output and warn once.
- Assistant text uses upstream Markdown with raw indentation and tabs preserved,
  italic quotes, inherited code-block foreground, and the source-derived accent
  palette. Default padding is one column, matching Reason; explicit Pi outputPad
  settings remain respected. Thinking, tools, errors and OSC133 zones stay in Pi.
  The optional text-only hook has stock fallback and resets on extension unload.
  Markdown transformers still receive the current streaming flag and usable width.
- The prototype launcher injects its own resume-command path, so the printed
  PowerShell hint uses the prototype and an absolute owned session file.
- Reasoning starts collapsed in the prototype profile. Each run shows `Thinking:`
  with its last bold heading or first nonempty line, matching source deI. Expanded
  Markdown is dim/italic with outputPad+2 columns (three by default). Text followed
  by custom reasoning gains a blank row. Pi MouseRegion, Ctrl+T, original content
  and opaque signatures remain intact. Ctrl+T visibility preferences persist in Pi.
- Startup follows Mh/lGA geometry: compact lockup below 44 columns or 23 rows;
  otherwise center 7-16 braille rows, wordmark and real Pi/model/workspace details.
  The Pi silhouette and PI wordmark are owned substitutions for Reason's assets.
  A fresh empty session gets the source 2400 ms damped rotation at 33 ms intervals;
  a restored transcript is static. Starting a turn, disposal or fallback stops it.
- Working uses the upstream aboveEditor widget and hides only Pi's working loader.
  Source uGA/o7 shimmer sweeps for 1400 ms then rests 500 ms, checked every 80 ms.
  Show actual Thinking/Writing/Running tool, elapsed seconds and Pi's cancel binding.
  NO_COLOR follows the source's bold-only shimmer. Idle/error/cancel remove the row
  and its timer. Suppress identical-frame redraws; never start timers during render.
  Retry/compaction indicators remain Pi-owned and visible above the custom editor.
  Reset, reload, shutdown and renderer failure dispose both animations.

## Deliberate remaining differences

Whole transcript layout and Reason-specific session menus remain upstream Pi.
Splash layout/motion and shimmer are source-tested, with explicit Pi art/identity
substitution. No exact parity claim for full composition or live Reason states without
capture. The editor surface is now source-tested; physical terminal autodetection
is still a separate proof. This remains a partial TU1 adapter, not O14 release
acceptance. The approved user-message hook is applied only in the separately
built candidate under `upstream-patches/transcript-hook/build/package`; installed
runtime/node_modules and the clean/fork baselines remain unmodified.

Reason host apply also skips empty/whitespace-only assistant and reasoning events.
The 80 assistant and 96 reasoning comparisons cover nonempty rows and selected
mixed-block spacing, not complete entry grouping/tool composition or live timing.
Native color autodetection remains unknown.

Flag: `ui.reasonTerminal`. Disabling it restores stock presentation on restart.
Renderer failure restores stock header/footer/editor/theme and reports a warning.
