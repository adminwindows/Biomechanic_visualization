# Change history

## 28 October 2026 — Instrument interface, measurement and editable models

Reworked the application into a coherent instrument interface: navy/ivory surfaces, teal A and orange B, self-hosted typography, shared icons and metric graphics. Persistent desktop navigation and phone tabs expose six workspaces. Setup inspectors, prepared-study/library dialogs and keyboard search keep detailed controls reachable without filling the comparison canvas. Responsive curves expose point inspection and SVG/CSV exports. Workspace navigation survives reload; numeric model references are retained for unrelated edits to avoid unnecessary recalculation.

Added guided body/equipment/force measurements with raw readings, provenance, repeat statistics and explicit zero/known-weight checks. Machine calibration accepts raw CSV with repeated observations and separate movement directions. An editable arithmetic formula model declares parameters, units and domains and refuses unsafe expression evaluation or plot interpolation across unresolved singularities. Real observations and fictional examples remain explicitly different.

Added a local, rule-based study planner and an optional manual AI context/proposal exchange. No model service or automatic upload is connected. The exchange previews selected data and accepts one supported geometry change for local recalculation and explicit application. These existing tools are retained; further AI expansion is paused for discussion with the user. See [SMART_TOOLS.md](docs/SMART_TOOLS.md).

Added a recoverable rendering boundary, calibration notebook backups, storage diagnostics and explicit storage-protection requests. Expanded draft guards across machine editors and the planner. Fixed rapid-reload data loss, protected restored/cleared comparisons from stale exit saves, and made recovery actions usable on narrow screens. See [MODEL_PROVENANCE.md](docs/MODEL_PROVENANCE.md) for the separation between physical laws, modeling choices, observations and validation.

## 28 October 2026 — Unified biomechanics workspaces

Expanded the application around the handoff's whole target catalog. A shared searchable catalog now routes isolated coordinates, compound movements and machine illustrations into their appropriate workspaces. The family-by-family [coverage map](docs/COVERAGE.md) explains what is quantitative, conditional or unknown instead of using a preset count as the measure of completion.

Added broad isolated configurations and movement planes, explicit outlets, unilateral/bilateral and shared-implement conventions, hip/knee/wrist/forearm models, and translational shrugs. Coordinate metadata carries units through curves, selected-region work and power: shrug force is N and work integrates centimetres converted to metres. Inclined fly planes change trajectories, not just names or outlet height.

Added optional body-capsule and named seat/frame obstacle contacts, conservative continuous clearance intervals, declared cable-travel bounds and equipment adjustment limits. Unresolved clearance remains unavailable; an input-limit exploration override does not disable collision or travel checks.

Added a compound A/B workspace with orbitable shared views, prescribed paths, body-segment masses, assistance, independent controls, saved comparisons and portable files. Path results are J per unit progress. Eligible open-arm models expose their declared external axis components; closed-chain support reactions and universal joint moments are not invented. Unknown lever and commercial-machine examples remain explicitly geometric.

Added machine A/B profiles for levers, cable/belt transmission, supplied cam arms, specified four-bar linkages and measured/supplied curves. Separate lifting/lowering branches, supported domains, absolute uncertainty, source identity and optional justified human-joint mappings remain explicit. A theoretical example is not presented as a calibration.

Added an interactive placement map and constrained search that keeps body, actual force and original ROM fixed. Multiple candidates expose objective/relocation/sensitivity trade-offs. User-specified measurement scenarios and prescribed-speed power retain their sampling and quasi-static limits. Search provenance follows an applied comparison into its research snapshot.

Added a research notebook with distinct evidence categories, scoped citations, immutable joint/compound/machine source snapshots, editing, recovery and portable import/export. Source capture flushes current workbench values; restoring a compound or machine source opens its workspace and preserves replaced data. Unsaved note forms and unapplied machine-curve edits block workspace export/restore and managed update reload until resolved. Per-exercise working drafts and view framing persist. Whole-workspace backup joins comparison/library data, drafts, machine/compound workspaces, saved research notes, favorites and training-list resolutions, with validated restore previews and recovery copies.

Updated the guides around counterfactual comparisons, measurement and uncertainty. The scientific question remains which mechanical conclusion the inputs support and what evidence would change it. No external-load curve is promoted to a muscle-force or hypertrophy result. Browser/PWA delivery remains the chosen architecture; native packaging and automatic cloud synchronization are not promised.

The entries below record earlier milestones and decisions; they do not define the current catalog limit. Actual verification and hosted-delivery status are recorded separately in [VERIFICATION.md](docs/VERIFICATION.md).


## 28 October 2026 — Exercise Biomechanics Lab

The pullover comparator now supports the handoff's twelve exercise scenarios through six mechanical families. Elbow curls/extensions, shoulder raises/flyes and ankle-loaded hip extension use their own motion paths, coordinates and load application points. The unknown-machine illustration remains explicitly non-quantitative.

Added complete body and equipment profiles, independent A/B states, movement synchronization, selected-region analysis, controlled comparison locks, named libraries, validated portable exports, exercise-list import and offline preparation with explicit updates. The interactive views include front/side/top projections, dragging and keyboard controls, shared framing, and mobile layouts.

Corrected rigid-grip and support constraints to preserve segment lengths. Added analytic contact candidates so narrow intervals and isolated tangencies are checked. Explicit force, mass, transmission, slack, segment gravity and unknown states remain distinct.

Added a usable-range mode with selectable clear portions and synchronized constraints. Switching back to Explore restores access to the original movement limits; the constraint describes represented geometry, not personal mobility or real-equipment safety.

The delivery now includes a hosted testing link, a requirement map, verification results, importable examples and guides for interpreting and extending the models. Every subsequent delivery must explain its changes, biomechanical meaning, validation and limits, and provide the current hosted link.

### Decisions and follow-up

- Use three-dimensional geometry with projected SVG views. Orbitable rendering is unnecessary for the supported comparisons.
- Treat body proportions as editable examples; preserve measured values and their provenance. Do not infer anatomy or physiological outcomes from height.
- Keep data in browser storage with portable exports. Hosting access is separate from application data storage.
- Keep unknown commercial mechanisms non-quantitative until a mechanism or measured resistance profile is supplied.
- Review the hosted interface on the user's actual phone and equipment. Physical Android installation, browser storage retention and device performance remain unverified. [Verification details](docs/VERIFICATION.md) distinguish those checks from emulation.
- Prioritize additional exercise families and measured equipment profiles using actual comparisons. Muscle estimates need a separate anatomical model and data; external moment alone does not establish muscle tension or growth.

## Earlier on 28 October 2026 — Initial pullover comparator

Established the repository, pullover geometry, A/B controls, body profiles, numerical fixtures and browser checks. This was partial coverage of the handoff; it did not include the complete exercise catalog, saved libraries or production offline support.
