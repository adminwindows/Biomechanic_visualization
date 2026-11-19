# Handoff acceptance map

This map connects the preserved [handoff](../EXERCISE_BIOMECHANICS_HANDOFF.md) to the current workspace. The target-family and tool matrix is in [COVERAGE.md](COVERAGE.md). Observed check results belong in [VERIFICATION.md](VERIFICATION.md); links to implementation or tests do not establish that every device, real machine or physiological interpretation has been validated.

The application has separate contracts for isolated coordinates, compound paths and machine profiles. Coverage includes quantitative calculations where their inputs and assumptions permit, and explicit geometry-only states where they do not. No common exercise-name count is used as a substitute for that distinction.

| ID | Required behavior | Implemented route and acceptance boundary |
|---|---|---|
| R01 | Set the classic torso horizontal | Standing pullover inclination reaches 90° from vertical; pelvis remains the anchor. Geometry checks retain segment lengths. |
| R02 | Shoulders behind outlets, hands in front | Signed placement, separate shoulder/elbow/grip geometry and explicit outlet coordinates represent this arrangement. Inspect side and top/front projections. |
| R03 | Continue beyond 180° | Pullover elevation continues to the declared exploratory limit without inverse-cosine folding or silently changing elbow bend. This is not a personal anatomical ROM measurement. |
| R04 | Move the bench upright to flat | Backrest inclination is measured above the floor. Body support, forces and contact geometry are recalculated from the same pose. |
| R05 | See A/B at one scale | Joint/exercise panels share view framing, zoom and pan; compound scenes share an orbit camera and spatial bounds. Narrow-screen panels stack. Quantitative charts retain labeled units/scales. |
| R06 | Edit independently and synchronize selectively | Separate A/B snapshots; independent movement, body, actual-force and equipment controls; copy/swap and undo/redo. Per-exercise drafts retain work when switching. |
| R07 | Equal coordinates and equal progress | Same-coordinate mode requires compatible definitions and overlapping ranges. Equal progress follows each declared action, without claiming equal joint positions. Compounds synchronize prescribed progress; machine coordinate equivalence requires an explicit confirmation. |
| R08 | Resisting, neutral and assisting regions | Signed results name the reference action. Zero force, explicit slack, unknown force, singular direction and small net resistance are distinct. Curves retain unavailable gaps. |
| R09 | Return motion keeps the status definition | Playback changes position, not the named reference action. Machine lifting/lowering branches are separately supplied data, not a relabeling of the sign convention. |
| R10 | Edit body, bench and attachments | Refined dimensions/provenance, grip and bar dimensions, explicit outlets, movement planes, equipment constraints and optional segment masses. Editing geometry is distinct from editing labels such as grip style. |
| R11 | Projected crossing versus spatial contact | Three-dimensional tests use the represented obstacle and cable/bar volumes. A projected crossing is insufficient. Optional body capsules and named box/capsule seat/frame obstacles have conservative interval checks; unresolved cells remain unavailable. Only enabled, represented objects participate; no comprehensive real-machine clearance claim follows. |
| R12 | Exercise changes correspond to model changes | The unified catalog routes isolated coordinates, coupled paths and machine illustrations to their actual engines. [COVERAGE.md](COVERAGE.md) maps all target families and distinguishes shared presets from new mechanics. |
| R13 | Save/reload every supported parameter | Validated comparison snapshots, per-exercise drafts, view framing, compound/machine workspaces and named libraries. Research notes capture validated joint, compound or machine snapshots. Unfinished note text and unapplied machine-curve edits explicitly block whole-workspace export/restore and managed update reload until resolved. |
| R14 | Portable export/import | Individual JSON exports and whole-workspace backup preserve settings/provenance. Import validates schema, limits and coordinate meaning; replacement previews affected sections and retains recovery data. |
| R15 | Touch and keyboard operation | Numeric controls, keyboard alternatives to dragging, responsive layouts, focusable map/table controls and reduced-motion behavior. Physical Android behavior remains device acceptance. |
| R16 | Prepared offline application | Production precaching, readiness status, install guidance, explicit updates and cache repair. Offline availability starts only after successful preparation. |
| R17 | Recognize unknown/hypothetical/out-of-model results | Textual status, null curve gaps, per-workspace assumptions, model versions and provenance. Compound path contributions are labeled J/progress, not generic joint moments. |
| R18 | Inspect unknown machines honestly | Unknown mechanisms stay geometric. The machine workspace accepts specified mechanisms or supplied/measured profiles with domains, branches and provenance; it does not create a real machine's missing curve. |
| R19 | Criterion and controlled variables | Editable criterion, differences table, independent locks and controlled/practical comparison labels. Placement search fixes body, actual force and original ROM while varying the named dimensions. |
| R20 | Separate calculation, estimate, study and hypothesis | Analysis categories and saved research-note classifications. Empirical-study entries require citations; a citation does not itself verify a claim. Personal observations remain separate. |
| R21 | Interpret the comparison and choose a next analysis | Region summaries, work, events, maps, constrained trade-offs, sampled uncertainty and prescribed-speed power. Worked questions identify what a result establishes and which measurement would test it next. |
| R22 | Same height, different proportions | Independent segment values alter modeled reach, geometry and loading. An importable example demonstrates equal stature with different arm proportions. |
| R23 | Height changes preserve measurements | Provenance and locks control estimate regeneration. User measurements and locked dimensions are not silently replaced by height scaling. |
| R24 | Body changes affect mechanics | Geometry, force application points, leverage and represented constraints are recalculated, rather than merely resizing a drawing. |
| R25 | Body edits do not move equipment implicitly | Pelvis/equipment anchors and explicit outlets remain independent inputs. Changes to a body can therefore make support/grip/contact constraints infeasible. |
| R26 | Restore body provenance and locks | Body snapshots and portable libraries include units/conventions, measurements, provenance, reference model and locks; workspace backup includes the corresponding saved data. |

## Requirements beyond the acceptance rows

The handoff's exploration and usable-range modes are separate controls. A usable interval is one connected portion of represented geometric validity, including declared cable travel. Same-coordinate and same-progress constraints account for both panels; an unavailable route is not called a collision. Original ranges remain available when returning to exploration.

The broader catalog, machine categories and analysis extensions are described in [COVERAGE.md](COVERAGE.md). They are part of the workspace, rather than a deferred exercise-name wishlist. Several commercial mechanisms still require user data, and some compound results deliberately stop at path mechanics because support reactions and joint sharing are unresolved.

Persistence includes working drafts, comparison framing, named libraries, research snapshots, favorites and confirmed exercise-list mappings. Whole-workspace import can replace included sections, including empty sections, only after showing its restore summary; original stored data is retained for recovery. Research notes select their source explicitly and restore that workbench; editing the prose preserves its immutable snapshot. Open note/curve drafts survive navigation but an ordinary browser reload is not guaranteed to preserve unfinished text. Persistence does not create automatic cloud synchronization.

## Verification routes

- Numerical contracts: [isolated engine tests](../src/engine.test.ts), [compound tests](../src/compoundEngine.test.ts), [machine tests](../src/machine.test.ts), [analysis](../src/analysis.test.ts), [usable ranges](../src/usableRange.test.ts) and [search constraints](../src/designExplorer.test.ts).
- Portable state: comparison, draft, library, machine, compound, notebook and [whole-workspace backup tests](../src/workspaceBackup.test.ts).
- Interaction: [browser workflows](../e2e), including comparison editing, model selection, mobile layouts, machine data, research/search and offline behavior. The final verification record specifies what was actually executed.

The application does not establish muscle-force sharing, activation, personal joint tolerance, physiological equivalence or hypertrophy superiority. Native packaging and cloud accounts/synchronization are not promised by the chosen browser/PWA architecture. Device installation/performance and a particular machine's measured calibration remain separate evidence.
