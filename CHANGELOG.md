# Change history

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
