# Mechanics, coordinates and interpretation

The application has three mechanical contracts: isolated coordinates, prescribed compound paths and machine-input profiles. Their version constants live with their engines. They share a purpose—make an external mechanical comparison inspectable—but their outputs are not interchangeable. [COVERAGE.md](COVERAGE.md) maps the exercise families; [VERIFICATION.md](VERIFICATION.md) records observed checks.

## Isolated coordinates

The world frame is right handed: X runs from the nominal outlet plane into the room, Y is lateral and Z is vertical. Lengths are stored in metres and forces in newtons. Explicit outlet XYZ coordinates can replace the symmetric outlet arrangement. Body placement, equipment placement and measurement values remain independent inputs.

| Model | Coordinate and named reference action | Output |
|---|---|---|
| Pullover | Upper-arm elevation; bring the arms toward the torso | Total external contribution to the declared symmetric shoulder movement |
| Curl / triceps extension | Elbow flexion; flex / extend the elbow | External contribution about the declared elbow coordinate |
| Raises | Arm elevation in a selected plane; raise the arm | External contribution for the declared loaded side(s) |
| Fly / reverse fly | Adduction in the selected movement plane; adduct / open the arms | Declared unilateral or bilateral contribution, with per-load derivatives |
| Hip extension / abduction / adduction | Hip coordinate with the ankle attachment and pelvic frame | External contribution for the active leg |
| Knee extension / flexion | Knee coordinate with prescribed thigh placement | External contribution about that knee coordinate |
| Wrist flexion / extension | Wrist coordinate with an explicit hand/load lever | External wrist-axis contribution |
| Forearm rotation | Pronation/supination about a declared forearm axis and lever | External rotational contribution; not a grip-strength or muscle model |
| Shrug | Shoulder-girdle elevation in centimetres | External force in N, conjugate to translation in metres |

Rotational values are N·m. The public rotation controls use degrees, but derivatives use radians. Shrug derivatives use metres; its displayed centimetres are converted before integration. `getDefinition` declares `angleUnit`, `coordinateScale`, output unit, reference action and `metricKey`. Matching units alone does not make two coordinates or load conventions comparable.

Upper-arm elevation has 0° alongside the torso and 180° toward the head, continuing beyond alignment without inverse-cosine folding. It is simplified humerothoracic geometry, not an isolated glenohumeral measurement or an anatomical scapular model. Elbow flexion is zero at a straight elbow. The selected movement plane changes actual trajectories and derivatives; for example, inclined fly planes are distinct from changing only outlet height.

Standing torso tilt is measured from vertical; bench inclination is above the floor. Facing, body roll, proximal-joint placement and movement plane transform the represented geometry. Grip-style names are annotations unless the model explicitly uses a rotational coordinate; they do not alter inferred muscle recruitment.

## Force and sign conventions

For attachment H, final outlet P and nonnegative actual attachment tension T:

`F = T (P − H) / |P − H|`

A cable pulls toward the outlet. Coincident endpoints have an undefined direction. The engine retains a singular/unknown result instead of drawing an invented force vector.

In selected-mass mode:

`T = selectedMass × 9.81 × transmissionFactor`

The factor relates selected mass to actual attachment force. Its absence leaves force unknown. A stack/topology label does not independently determine that factor. Matching displayed kilograms can therefore fail to match actual force.

For the model's SI coordinate q:

`Q = Σ Fᵢ · dHᵢ/dq`

`R = −actionDirection × Q`

Positive displayed R resists the named action; negative R assists it. Playback direction does not redefine that action. For fixed outlets, `Q = −Σ Tᵢ dLᵢ/dq` supplies an independent virtual-work check. A rotational fixed-axis component can also be calculated as `a · ((H − O) × F)`.

Pullover rigid-bar output is a contribution to symmetric movement. It does not identify individual shoulder force sharing. Independent handles have their own application points and derivatives. Cable tensions, their scalar sum and the magnitude of the vector resultant remain different quantities.

The near-zero display tolerance scales with the represented forces and derivatives, with a numerical floor. It is not a physiological threshold. Specified zero loading, cable slack, unknown force, unavailable travel and singular geometry remain distinct states.

## Gravity, masses and load sharing

Gravity acts downward: `Fgravity = [0, 0, −mass × 9.81]`. In the isolated engine, dumbbell mass is per loaded hand; an explicitly shared implement/barbell mass is total and is counted once. This is a declared symmetric convention, not a solved hand-force distribution. Force locking uses the same convention as the engine.

Optional segment gravity requires the relevant explicit masses. Uniform segment centres are an assumption. A fixed upper arm does no generalized work about the elbow coordinate, while the moving forearm/hand can. The active thigh/shank and hand/forearm models use their corresponding masses. Requested but missing mass inputs make the total unavailable; they are not inferred from stature.

Cable and gravity contributions are exposed separately. A known gravity component does not make an unknown cable total known. Slack cable force is zero, but its hanging route is not predicted; straight-line cable clearance cannot be certified for it. Declared free-cable-length limits make attachment force unavailable outside their domain.

The isolated and compound calculations are quasi-static. Inertia, friction, elasticity and unspecified implement weights are excluded. A real apparatus needs the appropriate measured forces, dimensions and routing before its numbers describe that apparatus.

## Body dimensions, grips and supports

Default proportions are fictional editable examples. Height scaling is an illustrative estimate, not an individual anthropometric prediction. Profile storage records examples, estimates and user measurements, with locks. Changing height preserves measured/locked segments; explicit regeneration affects eligible estimates only.

A body edit recomputes reach, forces and represented constraints while keeping explicit equipment and pelvis anchors fixed. Shoulder width, grip spacing, attachment spacing and bar length are distinct inputs. Standing height is a reference stature; it is not the current pose's vertical extent. The model's ankle-to-floor offset is separate from heel-to-toe foot length.

Two-link support geometry preserves thigh/shank lengths. For segment lengths a and b and endpoint distance d, closure requires `|a − b| ≤ d ≤ a + b`. Standing, seated, kneeling and supported/lying poses have declared placement assumptions. An impossible constraint produces an invalid pose instead of stretching limbs. Support placement does not solve balance, joint reactions, comfort or stability.

For a symmetric rigid-bar pullover, distal length R, elbow bend β and lateral grip offset `δ = (gripWidth − shoulderWidth)/2` give:

`r = sqrt(R² − δ²)` and `γ = acos(R cos β / r)`.

The distal vector combines lateral offset ±δ with sagittal reach r. A solution needs `|δ| ≤ R |sin β|`; straight elbows therefore cannot accommodate arbitrary grip widths in this model. Hands and attachments must also fit the bar. Independent-handle models do not inherit that rigid-bar constraint.

## Contacts, limits and usable portions

Contact checks use the actual three-dimensional geometry, rather than a crossing in one projection. The backrest is an oriented box; cable/bar radii are explicit model dimensions. Radius-expanded box corners are conservative. Optional body collision uses illustrative segment capsules with a default radius of 0.06 m and a head sphere; feet and the small forearm-rotation lever are excluded. Named equipment obstacles are axis-aligned boxes or capsules representing seats, frames or other objects. Cable/bar checks use the full segment against equipment obstacles; only the terminal body/grip allowance is trimmed for body checks. Enabled body-versus-obstacle checks can exempt an explicitly declared intentional support through `allowBodyContact`. These are approximations, not scanned anatomy or a complete commercial-machine model. Body-body self-collision and soft-tissue deformation are not solved. Contact invalidates the relevant direct mechanical path; no cable sliding around an obstacle is invented.

For fixed rotational paths, moving points have the form `H(q) = C + A cos(q) + B sin(q)`. Analytic box-face and outlet/edge-plane candidates expose narrow represented backrest contacts and tangencies. Translational shrug paths use affine candidates. Declared cable-travel boundaries use the corresponding length equations. Candidate points and intervening intervals are re-evaluated by the ordinary engine; irrelevant roots do not themselves count as contact.

New body/equipment proxies use conservative continuous distance bounds and endpoint-speed bounds to subdivide possible contact intervals. Unresolved cells at or below 0.001 coordinate units remain unavailable, rather than being declared clear. A work-budget fallback can leave a wider interval unavailable. This conservatism can exclude a close passage; it does not establish personal safety.

User-declared equipment adjustment limits bound signed pelvis X and outlet height. The explicit exploration override relaxes these input bounds only; it does not disable contacts, support checks or cable-travel limits.

`usableRange.ts` also partitions represented floor and singularity boundaries. A small numerical inset keeps selected endpoints on the permitted side. It returns separate connected portions instead of joining across a narrow contact, travel violation or tangent barrier. Unknown routing/mechanisms and slack paths remain unavailable for this constraint. Unknown force magnitude can still have a known geometric route.

Same-coordinate mode intersects clear coordinate intervals. Equal-progress mode maps each original range in its declared action direction before intersecting. Original ranges remain unchanged; selecting another disconnected portion is explicit. Editing equipment/body values recomputes the constraints. A clear portion is not a personal range-of-motion or safety assessment.

Mechanical reversals are separate from contact and travel boundaries. Sampled extrema, sign changes and geometry checks have finite resolution and numerical tolerances. The harmonic/affine event methods do not automatically apply to arbitrary coupled paths, moving outlets or unrepresented obstacles. Compound collision clearance is not solved by the isolated engine's contact module.

## Compound paths and eligible arm moments

The compound workspace uses an explicitly prescribed progress coordinate `p ∈ [0,1]`. Segment lengths, support points, load positions, gravity and any assistance are inputs. Body-segment masses begin as editable fictional values, not estimates from height. Compound external mass is total; when split between two hands, equal sharing is an explicit convention. Cable tension is per active cable.

The displayed path resistance is:

`Rpath = −Σ Fᵢ · dHᵢ/dp`.

Its unit is **J per unit progress**, because progress is dimensionless. It describes the external contribution along that path. It is not a shoulder, hip, knee or spinal torque. Body-segment gravity and entered assistance participate in this sum. Finite differences estimate the path derivative; unavailable neighbouring poses leave the result unavailable.

Stationary represented supports do no work along their fixed points, but their reaction distribution can still matter for individual joints. If a prescribed support moves and its unknown reaction could do work, a total path contribution is not supplied. The workspace does not solve impact, friction, balance or force redistribution when a foot leaves or reaches a support.

Selected fixed-torso open-arm models also calculate external shoulder/elbow components about their declared sagittal axes, using distal applied loads and relevant arm weights. These axis components are separate from the named-action sign of path resistance. Trunk support reactions, joint contact forces and muscle sharing remain unresolved. Pallof's explicitly labeled cable moment about the pelvis is not a spinal joint torque.

Closed-chain pull-ups, push-ups, squats and related paths therefore do not acquire universal joint-moment readouts. Smith/hack/landmine/T-bar/leg-press examples retain their stated guide, lever or unknown-mechanism assumptions. An illustrative commercial name does not specify a transmission.

## Machine profiles

Machine A/B profiles use a separate input-angle contract. Supported mechanisms include a plate-loaded lever, ideal cable/belt transmission, supplied effective cam arm, specified four-bar linkage, supplied/measured data curves and user-defined resistance formulas.

- Lever moment follows plate gravity at the entered radius/offset.
- Cable/belt moment uses actual tension × drum radius × declared travel ratio, with winding sign.
- A cam uses supplied effective moment-arm samples; a schematic drawing does not reconstruct its physical outline.
- A four-bar mechanism requires closure and a nonsingular transmission derivative. Its load geometry is explicit; bearing friction and unspecified link mass are excluded.
- Data curves interpolate values and declared uncertainty linearly within each supplied branch. Lifting and lowering remain distinct; a missing branch and out-of-domain values stay unavailable.

A force profile stays in N until a signed machine-input moment arm is supplied. Directly entered moment-curve values already use the declared reference-action sign. Reversing that action reverses stored moment values, or the signed arm for a force curve. Machine pivot moment is not human-joint moment.

### Runtime resistance formulas

The profile domain and displayed input angle remain in degrees. A formula declares whether its variable `q` receives radians or degrees. `sin`, `cos` and `tan` take radians; `sind`, `cosd` and `tand` take degrees. Arithmetic, powers, parentheses, `abs`, `sqrt`, `exp`, `log`, `min`, `max`, `pow` and `clamp` are supported, with constants `pi` and `e`. Named parameters retain values, unit text and descriptions; unit text documents assumptions but does not perform dimensional analysis.

A moment expression returns signed input resistance in N·m **against increasing input angle**. The engine multiplies it by `referenceAction` to obtain resistance against the selected action. A force expression returns a nonnegative magnitude in N; with an explicit signed arm `r`, the displayed moment is `referenceAction × force × r`. The arm's sign also refers to increasing input angle. Without it, no shaft or human-joint moment is inferred.

[machineFormula.ts](../src/machineFormula.ts) parses a bounded arithmetic grammar without JavaScript evaluation, object access or arbitrary functions. Limits include 2,048 expression characters, 512 tokens, depth 32 and 32 parameters. Invalid syntax rejects the profile. Undefined operations, nonfinite/intermediate values exceeding magnitude `1e12`, and negative force outputs make the evaluated position unavailable. The declared domain is enforced without extrapolation.

The plot connects adjacent formula samples only when conservative interval arithmetic can establish that their entire span is defined and within the numerical/force constraints. This detects poles and domain holes between finite sampled endpoints. An unresolved interval also breaks the line: a gap alone does not prove a physical singularity, and the independently evaluated endpoint can still be valid. Formulas specify resistance, not machine geometry. The default `mass × gravity × radius × cos(q)` fixture is explicitly theoretical; a documented supplied formula is not a measured calibration.

### Raw calibration records

[machineCalibration.ts](../src/machineCalibration.ts) imports outward/lifting and return/lowering CSV independently. Columns are `angle,value,uncertainty,repeat`, with the last two optional. Each supplied branch needs at least two distinct angles. Values may be N or kgf for force, or N·m or kgf·m for moment; angles may be degrees or radians. Conversion uses the conventional **1 kgf = 9.80665 N**, separately from the example engines' rounded gravitational acceleration of 9.81 m/s². Stack mass in kg is not an attachment-force measurement. Moment readings must already use the declared machine-input axis and reference-action sign.

Readings at the same converted angle are averaged. The record separately retains count, mean, sample standard deviation (`n−1` denominator), standard error (`SD / sqrt(n)`), half-range and instrument allowance. The allowance is the maximum of the declared instrument value and that angle's supplied row uncertainties, after unit conversion. The user selects SD, standard error, half-range or instrument-only presentation. **Displayed spread = selected repeat statistic + instrument allowance**; it is neither a confidence interval nor a guaranteed error bound. Repeat statistics require at least two readings per angle. With one reading, instrument-only mode requires a positive supplied allowance, and SD/standard error remain unknown. Repeats do not establish instrument accuracy or independent sampling.

Raw rows, units, method, machine identity, source and measurement protocol travel with the profile, library and workspace export. Statistics are recomputed from those rows on import. A curve claiming to match its calibration must agree with the reconstructed means/spreads; manual curve or reference-sign edits mark the retained record as describing the original import. Reapplying raw calibration rebuilds both branches. No return branch, reading or measurement precision is invented. Unapplied curve, formula and raw-import drafts survive workspace navigation and block guarded capture/export until applied or discarded; ordinary browser reload does not preserve unfinished text.

An optional human-joint conversion uses `machineAngle = ratio × jointAngle + offset`, giving `jointMoment = machineMoment × ratio` by virtual work. Alignment/ratio and a justification are required. This is a conditional equivalent external contribution, not an internal joint load or a general model of human-machine contact. A/B overlays additionally require compatible units/action and confirmed coordinate equivalence.

## Integration, search and evidence

Region work integrates external contribution over radians for rotations or metres for translation. A consistently resisting load does negative external work in the reference action. Integration does not bridge unavailable samples. These results are not muscle work, metabolic energy expenditure or a hypertrophy dose.

Prescribed-speed power supplies a user-chosen velocity: `Pexternal = −R × speedSI` along the named action. It remains a quasi-static estimate; actual accelerations would require inertia. Compound progress is not substituted into an angular formula.

Placement search varies only the named equipment/body-placement coordinates. It fixes actual force, force convention, body profile and original ROM; full-ROM geometry and sampled assistance constraints are explicit. Height shifts explicit outlets together, retaining their relative positions. Multiple non-dominated sampled candidates trade objective value against relocation and measurement sensitivity. A finite grid is not a global optimum.

User-selected uncertainty intervals are explored through a baseline and discrete perturbation scenarios. The resulting envelope is not a measured confidence interval or a guaranteed bound between samples. Requiring every scenario to pass is a robustness check on those scenarios, not proof over all possible anatomy or equipment error.

Research notes distinguish calculations, assumption-dependent estimates, personal observations, empirical findings and hypotheses. An explicit source selector captures the joint, compound or machine workspace with its validated configuration, current coordinates, body dimensions where applicable, and supplied data/provenance. Compound/machine attachments travel with the notebook and whole-workspace backup; an older note without an attachment retains its joint snapshot. Source-specific restore preserves replaced workbench data in a recovery copy. Known joint-mechanics migrations are disclosed; unsupported compound/machine schemas are rejected rather than silently reinterpreted. A citation does not verify its interpretation automatically. Relevant training evidence must address the population, movement, range, volume/effort, duration, outcome measurement and uncertainty before a mechanical result is promoted to a growth claim.

## Sources and verification

Method references include [OpenStax torque](https://openstax.org/books/university-physics-volume-1/pages/10-6-torque), [rotational work and power](https://openstax.org/books/university-physics-volume-1/pages/10-8-work-and-power-for-rotational-motion), [OpenSim scaling](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089158) and [OpenSim static optimization](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619). They support the mechanics/modeling discussion, not a ranking of exercises for hypertrophy.

Analytical fixtures, finite-difference work checks, sign/axis tests, geometry invariants, validity boundaries, persistence tests and browser workflows test the declared software models. [VERIFICATION.md](VERIFICATION.md) reports the runs actually completed. [EXTENDING.md](EXTENDING.md) explains how to add a model without inheriting unsupported assumptions.
