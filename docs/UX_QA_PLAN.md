# Workspace navigation and interaction acceptance

Run these checks against the final interface and built assets. Keep existing numerical and persistence regressions: a smaller interface must not silently remove supported settings or change mechanical results.

## Reach every workflow

At desktop width, 360 px portrait and phone landscape, reach joint comparison, compound movements, machines, setup exploration/research, study planning and measurement/calibration from the primary navigation. Exercise search must route isolated and compound results to the selected A/B side. Posture, equipment, joint, laterality and model-status filters must remain usable. Confirm every former drawer has an explicit entry point: examples, body profiles, named comparisons/equipment, training-list matching, whole-workspace backup and model notes.

The inspector must expose the selected setup's body, pose, load, apparatus, constraints and reset controls without moving the user to an unrelated workspace. Changing inspector groups must preserve pending fields. A/B cards, shared movement position and the comparison curve must remain available together; phone tabs must not become the only way to compare A with B.

## Keyboard, touch and assistive technology

- Open the command palette and mobile navigation using the keyboard and their visible buttons. Search, select, close with Escape, and return focus to the trigger. A modal must contain focus while open and must not leave background controls keyboard-accessible.
- Verify that the palette does not intercept ordinary typing, numeric editing or browser shortcuts. Each action must name its destination, especially A versus B and reset versus restore.
- Operate all essential controls without dragging. Check field labels/units, numeric alternatives, slider keyboard behavior, curve-region handles, copy/swap, undo/redo and zoom/fit. Preserve visible focus and reduced-motion behavior.
- Check readable text and adequate targets at narrow widths, browser zoom and long exercise names. Verify no horizontal page overflow; allow explicitly labeled scrolling tables. Status and resistance meaning must remain understandable without color.
- Confirm menus, overlays, fixed headers and inspectors neither hide the focused field nor cover the shared movement controls. Dismissed overlays must stop intercepting pointer events.

## Persistence and recovery

Edit each workbench, switch workspace/exercise, reload and return. Check per-side exercise drafts, measured body dimensions, compound drafts, machine curves, research attachments, framing and named libraries. Explicit preset reset must bypass saved drafts while ordinary selection restores them.

Export a whole workspace with pending autosaves, restore it into cleared active storage, and verify the editors as well as the stored JSON. Unapplied machine curve/formula/calibration or unsaved research/planner drafts must block a reload/update until the user applies, saves or discards them. Malformed imports and quota failures must leave original data recoverable, surface a message and avoid reporting success. Unreadable favorites/training mappings require explicit recovery before replacement.

## Offline, installation and network clarity

Use the production PWA suite: prepare the cache, disconnect, reload, edit, load an example and export a file. Verify compact status opens capability/storage details and makes no persistent-storage request before a user action. Test granted/declined protection and unavailable saving without changing existing records. Test update acceptance, old-build pinning, draft guards and incomplete-cache repair.

Record same-origin asset/example requests separately from user-opened reference links and hosting authentication. Do not describe all website behavior as offline merely because calculations are local. Physical Android installation, OS eviction and performance require a real device; Chromium emulation is separate evidence.

## Responsiveness and numerical consistency

Measure input-to-next-painted-frame latency for angle dragging, numeric equipment edits, profile changes, workspace switching and palette search. Report viewport, browser, throttling and median/tail observations. Compare title/notes edits against geometry edits: text changes should not resample unchanged mechanics. Keep current-position feedback immediate; reveal expensive full-range analyses when requested rather than blocking every pointer movement.

For the same saved state, compare displayed position, curve, contact status and exported values before and after the interface changes. Preserve signs, units, unavailable gaps and all model assumptions. Performance work must not reduce event detection accuracy or turn an unknown result into zero.

## Delivery evidence

Record which automated suites ran against the delivered build, screenshots of representative desktop/phone states, observed timing and remaining device-specific limits. Verify the hosted link and source branch. Explain what the user can test there, one mechanical comparison and what it does not establish.
