# Verification record — 28 October 2026

The application covers the handoff's target exercise families and its comparison, machine, search, research and offline workflows. [COVERAGE.md](COVERAGE.md) describes the contract and limits of each model; [ACCEPTANCE.md](ACCEPTANCE.md) maps all 26 product acceptance criteria. A catalog entry is not a claim of validated anatomy or measured commercial-machine resistance.

## Automated checks

The TypeScript/production build passed. The numerical and persistence suite passed **378 tests across 18 files**. All **5 production offline checks** passed, and the production file hashes were unchanged after the suite. The full interactive run passed 95 of 96 desktop, phone and landscape cases. One new machine-notebook fixture incorrectly treated invented samples as supplied data without a source; the validator correctly rejected it. The fixture now explicitly labels its samples theoretical, and its desktop/phone rerun passed. All 96 current browser workflows are verified; application code did not change for this fixture correction.

The checks include:

- Numerical mechanics: signed contributions, force conventions, energy derivatives, segment lengths, rigid grip closure, support constraints and distinct isolated/compound paths.
- Machine models: levers, cable/belt transmission, cams, four-bar closure, supplied profiles, lifting/lowering domains, uncertainty and explicit human-joint mappings.
- Persistence: old comparison migration, profiles and measurement provenance, exercise drafts, framing, libraries, research snapshots, whole-workspace restoration and malformed-original preservation.
- Browser workflows: desktop, 360 px portrait and 844 × 390 landscape; catalog, A/B editing, curve compatibility, geometry controls, libraries, notes, search and recovery.
- Production offline behavior: verified precache, disconnected reload/editing/example loading, explicit update with state preservation, install-status accuracy and cache repair.

The browser runs use system Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Interactive tests exercise Vite's development server; the offline suite exercises the built production assets. Browser emulation does not replace physical-device acceptance.

## Collision and unavailable-result checks

Backrest regressions include a contact interval around 196.100°–196.175° missed by regular 0.5° samples and exact tangency. The expanded body/equipment suite checks a narrow obstacle contact at 160.173°, between regular samples, through evaluation, curves and usable intervals. Body capsules rendered in the scene use the same geometry as the collision calculations. Continuous conservative classification marks unresolved boundary cells unavailable rather than declaring them clear.

Travel-limit regressions include an unavailable interval narrower than the ordinary sample step. Unknown resistance, unsupported geometry, contact and singular cable directions are not filled in with zero values. These checks establish behavior for represented shapes and prescribed paths, not clearance against omitted structures or soft tissue.

## Timing observation

Ten pulley-input updates per viewport were measured in development Chromium, without CPU throttling, from the input event through the second animation frame. At 1440 px the median was 66.7 ms and the maximum 219.4 ms; at 360 px the median was 91.3 ms and maximum 216.1 ms. Neither viewport had horizontal page overflow. These are limited observations: some updates exceeded the 100 ms target, and they do not establish performance on the user's Android device.

## Evidence still requiring real-world input

- Installation, OS cache retention, touch behavior and sustained performance on a particular physical Android phone.
- Personal anthropometry, mobility, comfort and repeatability measurements.
- Actual commercial-machine geometry, force calibration, friction and lifting/lowering measurements.
- Anatomical realism, individual muscle-force sharing and hypertrophy outcomes.

The hosted app is the user's testing route; fetching source or building locally is not required. The deployment service must confirm the published source version before delivery. The Site remains owner-private.
