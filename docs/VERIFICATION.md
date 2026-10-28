# Verification record — 28 October 2026

The source implements the twelve specified exercise scenarios and the supporting comparison, profile, library, analysis and offline workflows. [ACCEPTANCE.md](ACCEPTANCE.md) maps the handoff's 26 acceptance criteria. This record distinguishes model/software checks from real-device or physiological evidence.

| Check | Observed result |
|---|---|
| TypeScript and production build | Passed; generated offline shell includes HTML, bundled model/catalog code, CSS, manifest and icons. |
| Numerical/state/library/analysis/parser tests | 144 passing tests: 74 engine, 28 state, 7 library, 13 analysis, 9 parser, 8 geometric usable-range and 5 movement-constraint tests. |
| Interactive browser workflows | 52 verified desktop/phone/landscape cases. The final full run passed 49; a four-case rerun covered the three failures after correcting a test's initial-save timing assumption and separating the suites' output folders. All affected cases then passed; application code did not change for these harness fixes. |
| Production offline workflows | 5 passing cases against the final production assets: complete cache/icons/examples, disconnected reload/editing/example loading, explicit update/state preservation, install-status accuracy, cache repair. The suite also passed alongside the affected interactive rerun after output-folder isolation. |
| Numerical contact regression | A contact interval around 196.100°–196.175° is detected even though regular 0.5° samples miss it; exact tangency is also checked. |
| Usable-range restriction | Preserves original ranges and respects clear connected portions in angle/progress synchronization. Geometric regressions cover narrow contact, tangency, between-sample floor crossings and singular cable endpoints; an independent scan found no invalid points among 5,398 returned-interval points/boundaries/candidates. |
| Browser errors and layout | No runtime errors or horizontal page overflow in the tested desktop, 360 px portrait and 844 × 390 landscape workflows. |
| Hosted access | Owner-private Site; native deployment status is checked before delivery. Interactive browser checks use the development server; the offline suite exercises the built production assets. |

## Timing observation

Ten pulley-input updates per viewport were measured in development Chromium, without CPU throttling, from the input event through the second animation frame. Desktop at 1440 px had a median 56.2 ms and maximum 203.8 ms; 360 px phone emulation had a median 70.4 ms and maximum 203.4 ms. These are limited development-environment observations. Some updates exceeded 100 ms, and neither this sample nor phone emulation establishes performance on the user's Android device.

## What these checks do not establish

- Android home-screen installation, OS cache retention, touch behavior or performance on a particular physical phone.
- Individual anatomy, mobility, comfort, balance, muscle-force sharing or hypertrophy outcomes.
- Clearance against unrepresented body/equipment surfaces, or behavior of unknown commercial-machine mechanisms.
- A complete catalog of every exercise named as a future extension in the handoff.

The hosted app is the testing route for user feedback; source fetching and local builds are not required. Measurements or equipment data can be entered directly without replacing inferred body values silently.
