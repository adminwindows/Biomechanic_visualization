# Smart tools and the AI discussion

The implemented tools do not connect to an AI provider. They have no API key, remote model, chat history, automatic upload or literature search. Further AI integration is paused for discussion; the existing local planner and manual exchange remain available.

## Local study planner

The planner uses explicit rules, not a language model. It recognizes a limited vocabulary for pulley height, pelvis position, torso inclination, fixed arm/elbow angles, movement plane and grip width, where the current joint model supports them. A question such as “lower the pulley by 20 cm” can populate the structured controls. Ambiguous or unsupported requests require choosing those controls directly. Review the interpreted variable, amount and direction: the parser is deliberately limited.

For a specified change, the planner builds one candidate. For higher/lower mean resistance or a more even curve, it compares two neighboring values at the selected step. This is neither a global optimizer nor an exercise recommendation. The calculation uses the existing geometry/force engine, selected movement region and original full range. It reports unavailable portions, current comparison differences, assumptions and suggested measurements. The ranking considers computability and represented clearance; neither establishes personal safety.

Nothing changes until **Apply reviewed proposal to B**. B is then replaced with a copy of A plus the selected geometry change. A, its body measurements, the load convention and original movement range remain unchanged. An outlet-height study releases the same-equipment lock, as disclosed in the review. Undo restores the previous comparison. A proposal must be recalculated if its baseline or planner inputs change.

The planner does not invent muscles, estimate muscle activation, infer hypertrophy, read research, learn from saved work or extend the underlying model. It currently operates on the joint/exercise workspace; compound and machine studies retain their own analysis and notebook workflows.

## Optional manual AI exchange

1. Choose which context to include: the question, A setup, A body dimensions/provenance, and/or A calculated summaries. Only the question is selected initially.
2. Prepare and inspect the exact text before copying or downloading it. Every exchange also includes model/coordinate metadata, permitted parameters and global bounds, a baseline revision marker and the response schema. The revision marker is a change detector, not authentication or encryption. Previous B, library entries and comparison notes are excluded; free text or names you select can still contain personal information.
3. If desired, manually give this text to an external assistant. This is the only step that would send it to that service. Its privacy policy and network requirements apply there.
4. Paste or import the assistant's JSON response. The app rejects unsupported fields, code, nonfinite/out-of-bounds values, changed baselines, unsupported parameters and multiple simultaneous changes. Body dimensions, load, exercise model and movement range cannot be changed through this proposal format.
5. Review the locally recalculated comparison. The external rationale is labeled an **unverified external explanation**; its statements are not treated as findings or verified citations. Apply explicitly if useful.

No imported instructions execute. Validation limits the proposed edit; it cannot make an incorrect explanation scientifically true. Omitting dimensions or setup details also limits what an external assistant can responsibly suggest. Its proposed numerical outcome is never substituted for the engine result.

Planner and exchange drafts stay in the current session while navigating. Unresolved drafts block managed workspace replacement/update reloads. Export a draft as a readable JSON record or a reviewed proposal for later reimport, or explicitly discard changes. Draft-record JSON is not itself a comparison backup or an importable proposal. Ordinary browser closure/reload can still lose unfinished session text; keep the exported record and save conclusions in the research notebook.

## Editable formulas and measured curves

The machine formula editor accepts arithmetic expressions with named parameters, declared units and a valid angle domain. A bounded parser supports approved mathematical operations; it does not run JavaScript. Conservative interval checks leave gaps across unresolved singularities. A force expression needs an explicit signed moment arm to become an equivalent moment. The software evaluates the supplied relationship but cannot establish that it describes a real machine.

Raw machine calibration imports repeated angle/force or angle/moment observations, preserves movement directions and units, and records the measurement protocol/source. Repeat variability and instrument allowances remain distinct. These capabilities permit new user-defined relationships and measured data without adding each machine to the source code; neither requires AI or internet.

## Decisions to discuss before adding AI

The most useful role would be an optional study assistant: turn a question into a proposed experiment, explain the app's actual computed results, identify missing measurements and organize source-backed notes. A later evidence assistant could retrieve papers and expose their population, methods, outcomes and limitations, with references the user can inspect. That would require retrieval/source infrastructure which does not exist today.

I would keep deterministic geometry and calculations authoritative, require a review of proposed changes, and prevent the language model from inventing measurements or declaring an exercise “best” from an external moment curve. Validated new mechanical model families need explicit equations, assumptions and tests; arbitrary generated code should not silently extend the simulator.

Deployment is a separate decision: a remote model usually offers stronger capability but needs internet, a provider, cost handling and an agreed data-sharing flow. An on-device model can work offline after installation, with download size, memory, speed and quality trade-offs on the target phone. Neither path has been implemented. The user should choose the useful role and acceptable data boundary before either is built.
