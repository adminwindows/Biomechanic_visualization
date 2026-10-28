# Verification record — 28 October 2026

The application covers the handoff's target exercise families and its comparison, machine, search, research and offline workflows. [COVERAGE.md](COVERAGE.md) describes the contract and limits of each model; [ACCEPTANCE.md](ACCEPTANCE.md) maps all 26 product acceptance criteria. A catalog entry is not a claim of validated anatomy or measured commercial-machine resistance.

## Automated checks

The final TypeScript/production build passed. The numerical and persistence suite passed **498 tests across 26 files**. All **7 current production offline workflows** are verified, including first opening every lazy-loaded workspace while disconnected and refusing an update while an unreadable comparison is protected. Production file hashes were identical before and after the update/cache fixtures.

The full interactive run exercised **120 desktop, phone and landscape cases**: 117 passed and three exposed a mobile recovery-button overflow, a rapid-reload persistence race and a missing accessible search label in the compact rail. All three were fixed and rerun. A 38-case related regression run verified the mobile/navigation fixes and exposed three clear/restore regressions in the initial exit-save fix. Guarded persistence then passed all 10 affected desktop/phone comparison, rapid-reload, framing, original-recovery and full-workspace restore cases. The original rapid-reload case also passed five repeated phone runs. Assertions were retained; the final checks have no unresolved observed functional failure.

Earlier in integration, a real unapplied-machine-draft loss on first lazy workspace navigation was fixed in all three editors, and workspace loading boundaries were isolated. Ten focused machine/research browser cases passed, including formula/calibration draft retention. The local planner/manual exchange passed eight desktop/phone cases, and guided measurement passed six. These focused checks overlap the 120-case catalog and are not additional unique workflows. Old selectors were updated for the new inspector/dialog navigation. The final PWA run passed six cases directly; its update case used an obsolete expected message, then passed on rerun after the assertion was aligned with the explicit saving-paused message, without a production-code change.

The checks include:

- Numerical mechanics: signed contributions, force conventions, energy derivatives, segment lengths, rigid grip closure, support constraints and distinct isolated/compound paths.
- Machine models: levers, cable/belt transmission, cams, four-bar closure, supplied profiles, lifting/lowering domains, editable bounded formulas, singularity gaps, raw calibration statistics and explicit human-joint mappings.
- Persistence: old comparison migration, profiles and measurement provenance, exercise drafts, framing, libraries, research/calibration snapshots, whole-workspace restoration, lifecycle saves, external-storage-change guards and malformed-original preservation.
- Browser workflows: desktop, 360 px portrait and 844 × 390 landscape; catalog, A/B editing, curve compatibility, geometry controls, libraries, notes, search and recovery.
- Local planning/manual exchange: selected-context disclosure, controlled B application, invalid proposal rejection, stale-review rejection and draft guards; no provider request is implemented.
- Production offline behavior: verified precache, disconnected reload/editing/example loading, explicit update with state preservation, install-status accuracy and cache repair.

The browser runs use system Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Interactive tests exercise Vite's development server; the offline suite exercises the built production assets. Browser emulation does not replace physical-device acceptance.

## Collision and unavailable-result checks

Backrest regressions include a contact interval around 196.100°–196.175° missed by regular 0.5° samples and exact tangency. The expanded body/equipment suite checks a narrow obstacle contact at 160.173°, between regular samples, through evaluation, curves and usable intervals. Body capsules rendered in the scene use the same geometry as the collision calculations. Continuous conservative classification marks unresolved boundary cells unavailable rather than declaring them clear.

Travel-limit regressions include an unavailable interval narrower than the ordinary sample step. Unknown resistance, unsupported geometry, contact and singular cable directions are not filled in with zero values. These checks establish behavior for represented shapes and prescribed paths, not clearance against omitted structures or soft tissue.

## Timing observation

Ten pulley-input updates per viewport were measured in development Chromium after visiting all six workspaces, without CPU throttling, from the dispatched input event through the second animation frame. At 1440 px the median was **71.9 ms** and maximum **261.8 ms**; at 360 px the median was **65.6 ms** and maximum **307.5 ms**. The final persisted pulley value was checked, so this measured actual model updates. No browser tests ran concurrently with this observation. The inspector was open and full detailed analysis was closed.

All six workspaces were also checked at 1440 × 1000 and 360 × 800: no horizontal page overflow or uncaught errors, and the common self-hosted typography remained active after lazy module loading. Desktop/phone screenshots were inspected; chart-axis legibility was checked separately during renderer integration.

These are limited development-environment observations. Tail latency still exceeds the 100 ms target; no claim of smooth performance on the user's physical Android device is made. An earlier observation of 66.7/91.3 ms medians belonged to the previous interface and a different mounted-workspace state, so it is not a controlled before/after benchmark.

## Evidence still requiring real-world input

- Installation, OS cache retention, touch behavior and sustained performance on a particular physical Android phone.
- Personal anthropometry, mobility, comfort and repeatability measurements.
- Actual commercial-machine geometry, force calibration, friction and lifting/lowering measurements.
- Anatomical realism, individual muscle-force sharing and hypertrophy outcomes.

The hosted app is the user's testing route; fetching source or building locally is not required. The deployment service must confirm the published source version before delivery. The Site remains owner-private.
