# Biomechanics Lab design system

The product is a scientific workspace for building a mechanical model, inspecting its assumptions and comparing changes. The visual identity should make coordinates, units, editable inputs and valid conclusions easy to distinguish. It should feel calm and precise at both a small laptop viewport and a large analysis display.

## Identity and typography

The original mark in `public/brand-mark.svg` combines a lowercase **b**, an articulated segment and a force vector. Keep its proportions. Use it at 28–40 px beside the application name; maintain at least one joint-circle diameter of clear space. It illustrates a mechanical relationship and is not an anatomical certification mark.

Use the locally bundled **Instrument Sans** for headings, controls and explanatory text. Its variable font covers weights 400–700. Use **IBM Plex Mono** at 400 or 500 for the current coordinate, numerical outputs, units, code and formulas. Avoid setting long paragraphs in monospace. Font licenses, source versions and hashes live in `public/fonts/`; `fonts.css` makes no external requests.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Page title | 30–36 px / 1.15 | 600 |
| Section title | 20–24 px / 1.25 | 600 |
| Card title | 16–18 px / 1.35 | 600 |
| Body and controls | 14–16 px / 1.5 | 400–500 |
| Supporting label | 12–13 px / 1.45 | 400–500 |
| Primary number | 28–36 px / 1.15 | Mono 500 |
| Axis or secondary number | 11–13 px / 1.4 | Mono 400 |

Keep labels in sentence case. Reserve restrained uppercase lettering for short category labels; never for paragraphs or long field names. Use tabular numerals in changing measurements, and display the unit next to each value or unambiguously in its column header.

## Color and semantic roles

| Role | Value | Use |
| --- | --- | --- |
| Workspace | `#f3f5f7` | Cool ivory background |
| Surface | `#ffffff` | Editable panels, charts and dialogs |
| Ink | `#172b3a` | Main text, frame geometry and headings |
| Muted ink | `#526674` | Supporting text and secondary labels |
| Boundary | `#d6dee4` | Subtle grouping, nonessential dividers |
| Setup A / primary action | `#087f8c` | A identity, active controls, focused selections |
| Setup B | `#d66a45` | B line, bar or large mark |
| Setup B text | `#9f4428` | Small B labels with adequate contrast |
| Warning | `#875b08` | A caution requiring interpretation |
| Invalid | `#a5353d` | Invalid input or unavailable mechanics |
| Focus | `#075aab` | Visible keyboard focus ring |

A and B identify configurations; they do not mean good and bad. Coral is not an error color. Reinforce A/B with letters, line patterns and direct labels, so color is never the only signal. Light divider colors must not be the sole visible boundary of an essential control. Check text at 4.5:1 contrast and essential graphics at 3:1 against the actual adjacent surface.

## Layout and interaction

Use a 4 px spacing unit: 4, 8, 12, 16, 24, 32 and 48 px. Group related controls with 12–16 px gaps and give major panels 24–32 px separation. Prefer consistent alignment over excessive outlines. Panel radii are 10–14 px; control radii are 6–8 px. Shadows, if used, should communicate elevation for dialogs or popovers, not decorate every panel.

Organize the workspace around selecting a movement, changing a setup, observing the geometry and reading its result. The current action and comparison stay visible while advanced model settings can expand in place. Distinguish an editable number from a computed result through control shape and labeling. Preserve values when panels collapse. A change should show its effect near its input without displacing the main scene.

At narrow widths, stack coherent panels, preserve A/B labels and keep each chart adjacent to its legend and numerical result. Avoid horizontal page scrolling. Controls should normally provide a 40–44 px target; small visual icons can sit inside those larger buttons.

## Icons

`src/Icon.tsx` provides original, consistent 24×24 stroke icons. Standard size is 20 px, stroke width 1.7, round caps and joins, and inherited `currentColor`. Supported names: study, compare, movement, machine, search, measure, library, settings, help, download, upload, command, close, chevron, check, warning, arrow, play, undo and redo.

Use `<Icon name="measure" />` beside a visible label. Icons are decorative by default and hidden from assistive technology. Add `title` or `aria-label` only when the icon itself conveys a meaning that is not already supplied by surrounding text. Name icon-only buttons on the button, for example `aria-label="Download study"`; their nested icon stays decorative. Rotate the chevron or arrow through CSS rather than adding inconsistent glyphs. Do not use emoji as interface controls.

## Scene and chart grammar

- Geometry uses consistent projections, stroke weights and labels. Force arrows start at their actual modeled application point; their legend says whether arrow length is scaled or illustrative.
- A is teal and solid; B is coral with a distinguishable dashed chart line. Show A/B letters in scene and chart labels. Preserve each setup's identity across cards, legends, exports and tooltips.
- Axes name both coordinate and unit. Show the reference action beside signed results. A zero line is visually distinct from ordinary grid lines; keep grid contrast low enough that it does not compete with the data.
- A coordinate cursor joins the scene pose to the curve and current value. Values should not jump between decimal precisions as the cursor moves.
- Missing, singular or invalid mechanics create a visible curve gap. Never bridge a gap with a line or display it as zero. Mark unavailable intervals with a labeled, light hatch or band, and explain the reason in text.
- Comparison overlays require compatible coordinates and quantities. If the definitions differ, present separate plots with their own labels rather than implying direct equivalence.
- Confidence or uncertainty bands require actual assumptions or measurements; never add them as visual decoration. Keep illustrative anatomy, estimated proportions and supplied machine data visibly identified.

## Accessibility and motion

All operations need keyboard access and a visible focus indicator with adequate offset. Keep form labels programmatically associated with controls, describe errors next to the affected input and preserve input focus when calculations update. Do not announce every animation frame to a live region. A selected tab needs a selected state beyond its color.

Support browser zoom and reflow, reduced motion and manual animation controls. No feature should rely on hover alone. Give exported visualizations the same direct labels and units as the on-screen chart. Text summaries remain available for the conclusions that a user would otherwise have to infer from a curve. Numerical tests establish implementation behavior; the visual polish must not imply biological or clinical validation.
