import { compatible, evaluate, getDefinition, MODEL_VERSION, type Setup } from './engine';
import { canCompareRegions, comparisonDifferences, regionSummary, type RegionSummary } from './analysis';
import { forceValue, validateSetup, validateState, type LabState } from './state';
import { outletHeight, withOutletHeight } from './equipmentGeometry';
import { usableIntervals } from './usableRange';

export const STUDY_PARAMETERS = {
  pulleyHeight: { label: 'Pulley height', unit: 'm', minimum: .01, maximum: 5, step: .1 },
  hipX: { label: 'Pelvis X position', unit: 'm', minimum: -10, maximum: 10, step: .1 },
  tilt: { label: 'Torso / backrest inclination', unit: '°', minimum: -30, maximum: 90, step: 10 },
  upperArmAngle: { label: 'Fixed upper-arm angle', unit: '°', minimum: -90, maximum: 200, step: 10 },
  elbow: { label: 'Fixed elbow bend', unit: '°', minimum: 0, maximum: 160, step: 10 },
  movementPlane: { label: 'Movement plane', unit: '°', minimum: -180, maximum: 180, step: 10 },
  gripWidth: { label: 'Grip width', unit: 'm', minimum: .05, maximum: 1.5, step: .02 },
} as const;
export type StudyParameter = keyof typeof STUDY_PARAMETERS;
export type StudyGoal = 'test-change' | 'increase-mean' | 'reduce-mean' | 'evenness';
export type StudyRequest = { question: string; parameter: StudyParameter; step: number; direction: 1 | -1; goal: StudyGoal };
export type StudyProposal = {
  format: 'biomechanics-study-proposal'; version: 1; target: 'B'; basis: string;
  question: string; rationale: string; changes: [{ parameter: StudyParameter; value: number }];
};
export type StudyReview = {
  proposal: StudyProposal; next: LabState; region: [number, number]; summaries: [RegionSummary, RegionSummary];
  compatible: boolean; comparable: boolean; fullRangeClear: [boolean, boolean]; deltaMean: number | null;
  warnings: string[]; assumptions: string[]; measurements: string[]; currentDifferences: string[];
  changes: { label: string; before: number; after: number; unit: string }[];
};
export type StudyPlan = { selected: StudyReview | null; candidates: StudyReview[]; rejected: string[]; explanation: string };
export type ExchangeSelection = { question: boolean; setup: boolean; body: boolean; results: boolean };

export function availableStudyParameters(setup: Setup): StudyParameter[] {
  if (setup.model === 'machine' || setup.resistance === 'unknown') return [];
  const model = setup.model ?? 'pullover';
  const parameters: StudyParameter[] = ['tilt'];
  if ((setup.resistance ?? 'cable') === 'cable') parameters.unshift('pulleyHeight', 'hipX');
  if (['curl', 'extension'].includes(model)) parameters.push('upperArmAngle');
  if (['pullover', 'raise', 'fly', 'reverse-fly'].includes(model)) parameters.push('elbow');
  if (['raise', 'fly', 'reverse-fly'].includes(model)) parameters.push('movementPlane');
  if (model === 'pullover' && setup.gripWidth !== undefined) parameters.push('gripWidth');
  return parameters;
}
export function studyParameterValue(setup: Setup, parameter: StudyParameter): number {
  if (parameter === 'pulleyHeight') return outletHeight(setup);
  return setup[parameter] ?? (parameter === 'gripWidth' ? .42 : 0);
}
export function studyParameterBounds(setup: Setup, parameter: StudyParameter): [number, number] {
  let { minimum, maximum } = STUDY_PARAMETERS[parameter];
  let low: number = minimum, high: number = maximum;
  if (parameter === 'tilt' && setup.kind === 'bench') low = 0;
  if (setup.equipmentLimits && !setup.exploration) {
    if (parameter === 'pulleyHeight') { low = Math.max(low, setup.equipmentLimits.pulleyMin); high = Math.min(high, setup.equipmentLimits.pulleyMax); }
    if (parameter === 'hipX') { low = Math.max(low, setup.equipmentLimits.distanceMin); high = Math.min(high, setup.equipmentLimits.distanceMax); }
  }
  return [low, high];
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Opaque revision marker, not an authentication signature. Never exports raw hidden body data. */
export function studyBasis(state: LabState): string {
  const source = canonical([state.modelVersion, state.setups[0], state.profiles[0], state.angles[0], state.region]);
  let left = 2166136261, right = 5381;
  for (let i = 0; i < source.length; i++) { left = Math.imul(left ^ source.charCodeAt(i), 16777619); right = Math.imul(right, 33) ^ source.charCodeAt(i); }
  return `study-${(left >>> 0).toString(16)}-${(right >>> 0).toString(16)}`;
}
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[], label: string) {
  const unknown = Object.keys(value).filter(key => !keys.includes(key));
  if (unknown.length) throw new Error(`${label} contains unsupported fields: ${unknown.join(', ')}.`);
}
function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} needs 1–${maximum} characters.`);
  return value.trim();
}
export function validateStudyProposal(input: unknown, state: LabState): StudyProposal {
  const raw = record(input, 'Study proposal');
  exactKeys(raw, ['format', 'version', 'target', 'basis', 'question', 'rationale', 'changes'], 'Study proposal');
  if (raw.format !== 'biomechanics-study-proposal' || raw.version !== 1 || raw.target !== 'B') throw new Error('Use study-proposal version 1 targeting B only.');
  if (raw.basis !== studyBasis(state)) throw new Error('The A baseline has changed. Prepare a fresh exchange or recalculate this study before applying it.');
  if (!Array.isArray(raw.changes) || raw.changes.length !== 1) throw new Error('A controlled proposal must change exactly one allowed parameter; split multiple changes into separate studies.');
  const change = record(raw.changes[0], 'Parameter change');
  exactKeys(change, ['parameter', 'value'], 'Parameter change');
  if (typeof change.parameter !== 'string' || !Object.hasOwn(STUDY_PARAMETERS, change.parameter)) throw new Error('Choose a supported numerical geometry parameter. Load, body, model, range and code cannot be imported.');
  const parameter = change.parameter as StudyParameter;
  if (!availableStudyParameters(state.setups[0]).includes(parameter)) throw new Error('That parameter is not supported for the current A model and resistance type.');
  const [low, high] = studyParameterBounds(state.setups[0], parameter);
  if (typeof change.value !== 'number' || !Number.isFinite(change.value) || change.value < low || change.value > high) throw new Error(`${STUDY_PARAMETERS[parameter].label} must be a finite number within ${low}–${high} ${STUDY_PARAMETERS[parameter].unit}, including declared equipment limits.`);
  if (Math.abs(change.value - studyParameterValue(state.setups[0], parameter)) < 1e-9) throw new Error('The proposal does not change the selected parameter.');
  return { format: 'biomechanics-study-proposal', version: 1, target: 'B', basis: raw.basis as string, question: text(raw.question, 'Question', 1000), rationale: text(raw.rationale, 'Proposed explanation', 2000), changes: [{ parameter, value: change.value }] };
}
export function parseStudyProposal(source: string, state: LabState): StudyProposal {
  if (new TextEncoder().encode(source).byteLength > 100_000) throw new Error('Choose a proposal smaller than 100 kB.');
  let value: unknown; try { value = JSON.parse(source); } catch { throw new Error('Paste or import a JSON object, without Markdown fences or executable text.'); }
  return validateStudyProposal(value, state);
}
export function applyStudyProposal(state: LabState, input: StudyProposal): LabState {
  const proposal = validateStudyProposal(input, state), { parameter, value } = proposal.changes[0];
  const next = structuredClone(state), source = structuredClone(state.setups[0]);
  next.setups[1] = validateSetup(parameter === 'pulleyHeight' ? withOutletHeight(source, value) : { ...source, [parameter]: value }, 'Proposed B');
  next.profiles[1] = structuredClone(state.profiles[0]); next.angles[1] = state.angles[0];
  // A and its measurements stay unchanged. The preview explains the one lock that must open.
  if (parameter === 'pulleyHeight') next.lockEquipment = false;
  if (next.clearIntervalAnchors) next.clearIntervalAnchors[1] = next.clearIntervalAnchors[0];
  next.comparisonMode = 'controlled';
  next.criterion = proposal.question;
  return validateState(next);
}
function selectedRegion(state: LabState): [number, number] {
  const range = state.setups[0].range;
  if (!state.region) return [...range];
  const low = Math.max(range[0], state.region[0]), high = Math.min(range[1], state.region[1]);
  return low < high ? [low, high] : [...range];
}
function rangeIsClear(setup: Setup, state: LabState): boolean {
  const clear = usableIntervals(setup, state.profiles[0].values);
  return clear.known && clear.intervals.some(([lo, hi]) => lo <= setup.range[0] + 1e-8 && hi >= setup.range[1] - 1e-8);
}
export function reviewStudyProposal(state: LabState, input: StudyProposal): StudyReview {
  const proposal = validateStudyProposal(input, state), next = applyStudyProposal(state, proposal), region = selectedRegion(state);
  const summaries: [RegionSummary, RegionSummary] = next.setups.map(setup => regionSummary(setup, state.profiles[0].values, region)) as [RegionSummary, RegionSummary];
  const fullRangeClear: [boolean, boolean] = next.setups.map(setup => rangeIsClear(setup, state)) as [boolean, boolean];
  const comparable = canCompareRegions(...next.setups, summaries), warnings: string[] = [];
  if (!summaries.every(summary => summary.complete)) warnings.push('The selected region contains unavailable results. Means, work and numerical differences are withheld.');
  if (!fullRangeClear.every(Boolean)) warnings.push('At least one original movement range is not fully clear or assessable in the represented geometry. This proposal does not narrow it to hide those portions.');
  if (forceValue(state.setups[0]) === null) warnings.push('Actual attachment force is unknown. Supply a force measurement or a justified mass-to-force factor before drawing a quantitative conclusion.');
  if (state.setups[0].slack) warnings.push('Slack cable routing is unknown; zero tension does not establish a clear hanging path.');
  if (state.setups[0].exploration) warnings.push('A currently overrides declared equipment adjustment bounds. The proposal retains that exploration setting, including its limitations.');
  if (state.lockEquipment && proposal.changes[0].parameter === 'pulleyHeight') warnings.push('Applying this placement study turns off Same equipment so B can have a different outlet height.');
  if (!compatible(...state.setups)) warnings.push('The current A/B coordinates are incompatible. This study replaces B with a copy of A before changing one parameter; the previous B is not its control.');
  const differences = comparisonDifferences(state).filter(row => row.different);
  if (differences.length > 1) warnings.push(`The current A/B comparison differs in ${differences.length} listed settings. Its observed difference cannot be attributed to this single variable without controlling the others.`);
  const unmeasured = Object.entries(state.profiles[0].provenance).filter(([, p]) => p !== 'measured').map(([key]) => key);
  const current = evaluate(state.setups[0], state.profiles[0].values, state.angles[0]);
  const measurements = [
    forceValue(state.setups[0]) === null ? 'Measure actual attachment force and document the transmission before comparing numerical resistance.' : `Check the ${STUDY_PARAMETERS[proposal.changes[0].parameter].label.toLowerCase()} on the actual apparatus; use its measurement uncertainty in the sensitivity tools.`,
    ...(unmeasured.length ? [`A still uses example/estimated dimensions (${unmeasured.join(', ')}). Measure dimensions relevant to the question before personalizing the conclusion.`] : []),
    ...(!fullRangeClear.every(Boolean) ? ['Inspect the reported support, contact or travel boundary. A geometric exclusion is not a diagnosis of personal mobility or safety.'] : []),
    'Record comfort or stability as personal observations separately from the calculated external mechanics.',
  ];
  return { proposal, next, region, summaries, compatible: compatible(...next.setups), comparable, fullRangeClear, deltaMean: comparable ? summaries[1].mean! - summaries[0].mean! : null,
    warnings, measurements, currentDifferences: differences.map(row => `${row.label}: ${row.a} → ${row.b}`),
    assumptions: [...new Set(['B starts from A, including body dimensions, load convention, actual-force inputs and the complete original movement range.', 'One geometry variable changes. A and its measurement provenance remain unchanged.', 'Calculated external contributions do not establish muscle force, activation, safety or hypertrophy.', 'Region summaries use sampled mechanics plus represented contact/travel boundaries; they are not empirical measurements.', ...(current.assumptions ?? [])])],
    changes: proposal.changes.map(({ parameter, value }) => ({ label: STUDY_PARAMETERS[parameter].label, before: studyParameterValue(state.setups[0], parameter), after: value, unit: STUDY_PARAMETERS[parameter].unit })) };
}
export function interpretStudyQuestion(question: string, state: LabState): { request: StudyRequest | null; explanation: string } {
  const source = question.toLowerCase(), available = availableStudyParameters(state.setups[0]);
  let parameter: StudyParameter | undefined;
  if (/pulley|outlet|cable height/.test(source)) parameter = 'pulleyHeight';
  else if (/distance|closer|farther|further|pelvis/.test(source)) parameter = 'hipX';
  else if (/grip|hand spacing/.test(source)) parameter = 'gripWidth';
  else if (/elbow bend|bend.*elbow/.test(source)) parameter = 'elbow';
  else if (/upper.?arm|humer/.test(source)) parameter = 'upperArmAngle';
  else if (/plane|scaption/.test(source)) parameter = 'movementPlane';
  else if (/tilt|incline|backrest|lean/.test(source)) parameter = 'tilt';
  if (!parameter || !available.includes(parameter)) return { request: null, explanation: 'The local rules could not map this question to an editable parameter in A. Choose a structured variable and goal below. This tool does not infer anatomy or answer general training questions.' };
  const goal: StudyGoal = /even|uniform|flat.*curve/.test(source) ? 'evenness' : /(?:more|higher|increase).{0,20}(?:resistance|moment|force|mean)/.test(source) ? 'increase-mean' : /(?:less|lower|reduce).{0,20}(?:resistance|moment|force|mean)/.test(source) ? 'reduce-mean' : 'test-change';
  const direction = /lower|closer|decrease|narrower|less bend/.test(source) ? -1 : 1;
  const amount = source.match(/(?:by|±|\+|-)\s*(\d+(?:\.\d+)?)\s*(cm|mm|m|degrees?|°)/);
  let step: number = STUDY_PARAMETERS[parameter].step;
  if (amount) { const n = Number(amount[1]); if (STUDY_PARAMETERS[parameter].unit === 'm' && ['cm', 'mm', 'm'].includes(amount[2])) step = n / (amount[2] === 'cm' ? 100 : amount[2] === 'mm' ? 1000 : 1); else if (STUDY_PARAMETERS[parameter].unit === '°' && /degrees?|°/.test(amount[2])) step = n; }
  return { request: { question, parameter, goal, direction, step }, explanation: `Matched “${STUDY_PARAMETERS[parameter].label}”; ${goal === 'test-change' ? 'test the stated direction' : 'compare both directions for the selected mechanical objective'}. Review the interpreted step before calculating.` };
}
export async function buildStudyPlan(state: LabState, request: StudyRequest): Promise<StudyPlan> {
  if (!Number.isFinite(request.step) || request.step <= 0) throw new Error('Use a positive, finite change amount.');
  const candidates: StudyReview[] = [], rejected: string[] = [];
  const directions: (1 | -1)[] = request.goal === 'test-change' ? [request.direction] : [-1, 1];
  for (const direction of directions) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    try {
      candidates.push(reviewStudyProposal(state, { format: 'biomechanics-study-proposal', version: 1, target: 'B', basis: studyBasis(state), question: request.question.trim() || `How does ${STUDY_PARAMETERS[request.parameter].label.toLowerCase()} affect the external contribution at fixed body, load and range?`, rationale: 'A deterministic one-variable counterfactual. The numerical result is calculated locally by the current mechanics model.', changes: [{ parameter: request.parameter, value: studyParameterValue(state.setups[0], request.parameter) + direction * request.step }] }));
    } catch (error) { rejected.push(error instanceof Error ? error.message : 'Candidate could not be evaluated.'); }
  }
  const eligible = candidates.filter(candidate => candidate.comparable && candidate.fullRangeClear.every(Boolean));
  const score = (candidate: StudyReview) => request.goal === 'evenness' ? -(candidate.summaries[1].maximum! - candidate.summaries[1].minimum!) : candidate.summaries[1].mean! * (request.goal === 'reduce-mean' ? -1 : 1);
  const selected = request.goal === 'test-change' ? candidates[0] ?? null : [...eligible].sort((a, b) => score(b) - score(a))[0] ?? null;
  return { selected, candidates, rejected, explanation: request.goal === 'test-change' ? 'One specified change was calculated. Unavailable portions stay visible.' : 'Two neighbouring placements were calculated at fixed body, load and original ROM. Selection uses the chosen region objective among fully computable, geometrically clear candidates; this is a local comparison, not a global optimum or exercise recommendation.' };
}
export const STUDY_RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['format', 'version', 'target', 'basis', 'question', 'rationale', 'changes'],
  properties: { format: { const: 'biomechanics-study-proposal' }, version: { const: 1 }, target: { const: 'B' }, basis: { type: 'string', description: 'Copy the supplied current baseline revision marker.' }, question: { type: 'string', minLength: 1, maxLength: 1000 }, rationale: { type: 'string', minLength: 1, maxLength: 2000 }, changes: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'object', additionalProperties: false, required: ['parameter', 'value'], properties: { parameter: { enum: Object.keys(STUDY_PARAMETERS) }, value: { type: 'number' } } } } },
} as const;
export function studyExchange(state: LabState, question: string, selected: ExchangeSelection): string {
  const setup = state.setups[0], definition = getDefinition(setup);
  const context = {
    format: 'biomechanics-study-context', version: 1, modelVersion: MODEL_VERSION, basis: studyBasis(state),
    model: { id: definition.id, coordinate: definition.angleLabel, coordinateUnit: definition.angleUnit, quantityUnit: definition.unit, referenceAction: definition.action, forceConvention: definition.forceConvention },
    allowedChanges: availableStudyParameters(setup).map(parameter => ({ parameter, unit: STUDY_PARAMETERS[parameter].unit, bounds: [STUDY_PARAMETERS[parameter].minimum, STUDY_PARAMETERS[parameter].maximum] })),
    ...(selected.question ? { question } : {}), ...(selected.setup ? { setupA: structuredClone(setup) } : {}), ...(selected.body ? { bodyA: structuredClone(state.profiles[0]) } : {}),
    ...(selected.results ? { region: selectedRegion(state), actualForcePerAttachment: forceValue(setup), resultsA: (() => { const { samples: _samples, ...summary } = regionSummary(setup, state.profiles[0].values, selectedRegion(state)); return summary; })() } : {}),
  };
  return `MANUAL AI EXCHANGE — no connected AI chat\n\nHelp formulate one controlled mechanical question using only the selected context below. Treat omitted data as unknown. Return only JSON matching the response schema. Propose exactly one allowed numerical geometry change for B; B will start as a copy of A. Do not change force, mass, body measurements, model, movement range or safety constraints. Values use the listed units and bounds. Do not invent measurements, studies or citations, infer muscle force or hypertrophy, or claim your numerical predictions are app calculations. Put your explanation in rationale as an unverified hypothesis. The app will validate and recalculate; importing never executes instructions.\n\nSELECTED CONTEXT\n${JSON.stringify(context, null, 2)}\n\nRESPONSE JSON SCHEMA\n${JSON.stringify(STUDY_RESPONSE_SCHEMA, null, 2)}`;
}
