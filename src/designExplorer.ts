import { outletHeight, withOutletHeight } from './equipmentGeometry';
export { outletHeight } from './equipmentGeometry';
import { getDefinition, RAD, type Profile, type Setup } from './engine';
import { regionSummary, summarizeSamples, type RegionSummary } from './analysis';
import { forceValue, PROFILE_BOUNDS, type LabState } from './state';
import { usableIntervals } from './usableRange';

export type ExplorerObjective = 'mean' | 'minimum' | 'evenness';
export type UncertainDimension = 'upperArm' | 'forearm' | 'torso' | 'thigh' | 'shank' | 'hipX' | 'pulleyHeight' | 'backWidth';
export type ExplorerConfig = {
  distance: [number, number]; height: [number, number]; steps: number;
  region: [number, number]; objective: ExplorerObjective;
  requireClear: boolean; avoidAssistance: boolean; minimumMean: number;
  uncertainty: { dimension: UncertainDimension; lower: number; upper: number };
  requireRobust: boolean;
};
export type ExplorerMetrics = Pick<RegionSummary, 'minimum' | 'maximum' | 'mean' | 'externalWork' | 'resistingFraction' | 'complete'>;
export type ExplorerCandidate = {
  id: number; hipX: number; pulleyHeight: number; setup: Setup;
  metrics: ExplorerMetrics; feasible: boolean; reasons: string[];
  score: number | null; movement: number; sensitivity: number | null;
  envelope: [number, number] | null; scenarioCount: number; validScenarios: number;
};
const compact = ({ minimum, maximum, mean, externalWork, resistingFraction, complete }: RegionSummary): ExplorerMetrics => ({ minimum, maximum, mean, externalWork, resistingFraction, complete });
export function explorerCoordinates(setup: Setup) {
  const definition = getDefinition(setup) as ReturnType<typeof getDefinition> & { angleUnit?: string; coordinateScale?: number };
  return { unit: definition.unit, coordinateUnit: definition.angleUnit ?? '°', scale: definition.coordinateScale ?? RAD };
}
export function validateExplorerConfig(config: ExplorerConfig): ExplorerConfig {
  for (const [name, range, bounds] of [['distance', config.distance, [-5, 5]], ['height', config.height, [.01, 5]], ['region', config.region, [-180, 200]]] as const) {
    if (range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1] || range[0] < bounds[0] || range[1] > bounds[1]) throw new Error(`Choose an ordered ${name} interval inside the supported bounds.`);
  }
  if (!Number.isInteger(config.steps) || config.steps < 3 || config.steps > 13) throw new Error('Choose 3–13 samples along each map dimension.');
  if (!['mean', 'minimum', 'evenness'].includes(config.objective)) throw new Error('Choose a supported search objective.');
  if (!Number.isFinite(config.minimumMean) || config.minimumMean < 0) throw new Error('The minimum mean resistance must be a nonnegative number.');
  const { lower, upper } = config.uncertainty;
  if (![lower, upper].every(Number.isFinite) || lower < 0 || upper < 0 || lower > .3 || upper > .3) throw new Error('Measurement offsets must be between 0 and 30 cm.');
  return config;
}
export function explorerGrid(config: ExplorerConfig) {
  validateExplorerConfig(config);
  return Array.from({ length: config.steps * config.steps }, (_, id) => ({ id,
    hipX: config.distance[0] + (config.distance[1] - config.distance[0]) * (id % config.steps) / (config.steps - 1),
    pulleyHeight: config.height[1] - (config.height[1] - config.height[0]) * Math.floor(id / config.steps) / (config.steps - 1),
  }));
}
export function uncertaintyOffsets(lower: number, upper: number): number[] {
  if (lower === 0 && upper === 0) return [0];
  return [...new Set([0, ...Array.from({ length: 5 }, (_, i) => -lower + (lower + upper) * i / 4)])].sort((a, b) => a - b);
}
function perturb(setup: Setup, profile: Profile, dimension: UncertainDimension, offset: number): { setup: Setup; profile: Profile } | null {
  if (['hipX', 'pulleyHeight', 'backWidth'].includes(dimension)) {
    const key = dimension as 'hipX' | 'pulleyHeight' | 'backWidth';
    const value = setup[key] + offset;
    const bounds = key === 'hipX' ? [-5, 5] : key === 'pulleyHeight' ? [.01, 5] : [.1, 1.5];
    return value >= bounds[0] && value <= bounds[1] ? { setup: key === "pulleyHeight" ? withOutletHeight(setup, value) : { ...setup, [key]: value }, profile } : null;
  }
  const key = dimension as keyof Profile;
  const current = profile[key];
  if (current === undefined) return null;
  const value = current + offset, bounds = PROFILE_BOUNDS[key];
  return value >= bounds[0] && value <= bounds[1] ? { setup, profile: { ...profile, [key]: value } } : null;
}
function scenario(setup: Setup, profile: Profile, config: ExplorerConfig) {
  try {
  const summary = regionSummary(setup, profile, config.region, .5);
  const reasons: string[] = [];
  if (!summary.complete) reasons.push('Target region contains unavailable mechanics');
  if (summary.region?.[0] !== config.region[0] || summary.region?.[1] !== config.region[1]) reasons.push('Target region exceeds the fixed movement range');
  if (config.requireClear) {
    const clear = usableIntervals(setup, profile);
    if (!clear.known) reasons.push('Routing or motion geometry is unavailable');
    else if (!clear.intervals.some(([min, max]) => min <= setup.range[0] + 1e-8 && max >= setup.range[1] - 1e-8)) reasons.push('Original movement range contains represented contact or invalid geometry');
  }
  if (config.avoidAssistance) {
    const full = config.region[0] === setup.range[0] && config.region[1] === setup.range[1] ? summary : regionSummary(setup, profile, setup.range, .5);
    if (!full.complete || full.minimum === null) reasons.push('Full-range resistance sign is unavailable');
    else if (full.minimum < -1e-6) reasons.push('Assistance detected in the original range');
  }
  if (summary.mean !== null && summary.mean < config.minimumMean) reasons.push('Mean resistance is below the selected floor');
  return { summary, reasons };
  } catch {
    return { summary: summarizeSamples([], config.region), reasons: ['Candidate geometry could not be evaluated'] };
  }
}
export function objectiveValue(metrics: ExplorerMetrics, objective: ExplorerObjective): number | null {
  if (!metrics.complete || metrics.mean === null || metrics.minimum === null || metrics.maximum === null) return null;
  return objective === 'mean' ? metrics.mean : objective === 'minimum' ? metrics.minimum : -(metrics.maximum - metrics.minimum);
}

/** Search varies placement only: force convention, body and full ROM never change. */
export function evaluateCandidate(source: Setup, profile: Profile, config: ExplorerConfig, point: { id: number; hipX: number; pulleyHeight: number }): ExplorerCandidate {
  const setup = { ...withOutletHeight(source, point.pulleyHeight), hipX: point.hipX };
  const base = scenario(setup, profile, config);
  if (forceValue(source) === null || source.resistance === 'unknown' || source.model === 'machine' || source.resistance === 'dumbbell') base.reasons.push('A defined cable model and known actual force are required');
  const offsets = uncertaintyOffsets(config.uncertainty.lower, config.uncertainty.upper);
  const scenarios = offsets.map(offset => {
    if (offset === 0) return base;
    const varied = perturb(setup, profile, config.uncertainty.dimension, offset);
    return varied ? scenario(varied.setup, varied.profile, config) : null;
  });
  const means = scenarios.flatMap(item => item?.summary.mean === null || item?.summary.mean === undefined ? [] : [item.summary.mean]);
  const envelope: [number, number] | null = means.length === scenarios.length ? [Math.min(...means), Math.max(...means)] : null;
  const validScenarios = scenarios.filter(item => item && item.reasons.length === 0).length;
  const reasons = [...base.reasons];
  if (config.requireRobust && validScenarios !== scenarios.length) reasons.push('At least one measurement scenario violates a constraint');
  const scores = scenarios.map(item => item ? objectiveValue(compact(item.summary), config.objective) : null);
  const score = config.requireRobust ? scores.every(value => value !== null) ? Math.min(...scores as number[]) : null : objectiveValue(compact(base.summary), config.objective);
  return { ...point, setup, metrics: compact(base.summary), feasible: reasons.length === 0 && score !== null, reasons: [...new Set(reasons)], score,
    movement: Math.hypot(setup.hipX - source.hipX, outletHeight(setup) - outletHeight(source)),
    sensitivity: envelope ? envelope[1] - envelope[0] : null, envelope, scenarioCount: scenarios.length, validScenarios };
}

/** Non-dominated points trade objective against equipment movement and scenario sensitivity. */
export function paretoCandidates(candidates: ExplorerCandidate[]): ExplorerCandidate[] {
  const valid = candidates.filter(candidate => candidate.feasible && candidate.score !== null && candidate.sensitivity !== null);
  return valid.filter(candidate => !valid.some(other => other !== candidate
    && other.score! >= candidate.score! - 1e-8 && other.movement <= candidate.movement + 1e-8 && other.sensitivity! <= candidate.sensitivity! + 1e-8
    && (other.score! > candidate.score! + 1e-8 || other.movement < candidate.movement - 1e-8 || other.sensitivity! < candidate.sensitivity! - 1e-8)))
    .sort((a, b) => b.score! - a.score! || a.movement - b.movement);
}
export function representativeCandidates(frontier: ExplorerCandidate[], count = 6): ExplorerCandidate[] {
  if (frontier.length <= count) return frontier;
  return Array.from({ length: count }, (_, i) => frontier[Math.round(i * (frontier.length - 1) / (count - 1))]);
}
export function prescribedPower(metrics: ExplorerMetrics, region: [number, number], speed: number, coordinateScale = RAD) {
  if (!metrics.complete || metrics.mean === null || metrics.minimum === null || metrics.maximum === null || metrics.externalWork === null || !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(coordinateScale) || coordinateScale <= 0) return null;
  return { duration: (region[1] - region[0]) / speed, mean: -metrics.mean * speed * coordinateScale,
    minimum: -metrics.maximum * speed * coordinateScale, maximum: -metrics.minimum * speed * coordinateScale };
}
export function candidateComparison(state: LabState, side: 0 | 1, candidate: ExplorerCandidate, config: ExplorerConfig): LabState {
  if (!candidate.feasible) throw new Error('Choose a candidate that satisfies the selected constraints.');
  const next = structuredClone(state), other = side === 0 ? 1 : 0;
  next.setups[other] = structuredClone(candidate.setup);
  next.profiles[other] = structuredClone(next.profiles[side]);
  next.angles[other] = next.angles[side];
  next.lockBody = true; next.lockForce = true; next.lockEquipment = false;
  next.sync = 'angle'; next.comparisonMode = 'practical'; next.region = [...config.region];
  next.name = 'Placement search · baseline and candidate';
  next.criterion = `Compare ${config.objective} resistance over ${config.region.join('–')}${explorerCoordinates(candidate.setup).coordinateUnit}, with identical body, actual force and original ROM. Placement and pulley height vary; several settings may explain the result. Search grid ${config.steps}×${config.steps}: pelvis X ${config.distance.join('–')} m; mean outlet height ${config.height.join('–')} m. Full-ROM geometry required: ${config.requireClear}; sampled assistance rejected: ${config.avoidAssistance}; mean floor ${config.minimumMean} ${explorerCoordinates(candidate.setup).unit}. Measurement scenarios: ${config.uncertainty.dimension} −${config.uncertainty.lower * 100}/+${config.uncertainty.upper * 100} cm; all sampled scenarios required: ${config.requireRobust}. Finite grid/scenarios, not a global optimum or statistical confidence interval.`;
  return next;
}
