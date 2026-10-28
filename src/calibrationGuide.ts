import { MODEL_VERSION, PROFILE_KEYS, PROFILE_BOUNDS, editMeasurement, validateState, type LabState } from './state';
import { actualForce, forceToSetup } from './engine';
import { createMachineProfile, evaluateMachine } from './machine';

export const CALIBRATION_KEY = 'biomechanics.calibration-guide.v1';
export const CALIBRATION_MAX_BYTES = 1_000_000;
export const STANDARD_GRAVITY = 9.80665;
export const EQUIPMENT_MEASUREMENTS = ['pulleyHeight', 'outletSpacing', 'attachmentSpacing', 'barLength', 'hipX', 'hipHeight'] as const;
export type MeasurementCategory = 'body' | 'equipment' | 'cable-force';
export type MeasurementUnit = 'm' | 'cm' | 'mm' | 'N' | 'kgf';
export type MeasurementDraft = {
  category: MeasurementCategory; side: 0 | 1; target: string; name: string; unit: MeasurementUnit;
  readings: string; protocol: string; instrument: string; source: string; notes: string;
  instrumentBound: string; zeroReadings: string; subtractZero: boolean;
  knownMassKg: string; knownWeightReadings: string; checkTolerance: string; gravity: string;
};
export type ReferenceDraft = { mass: string; radius: string; angle: string; tolerance: string; measuredTorque: string; protocol: string };
export type MeasurementRecord = { id: string; createdAt: string; draft: MeasurementDraft; modelVersion: string };
export type CalibrationNotebook = { format: 'biomechanics-calibration'; version: 1; draft: MeasurementDraft; reference: ReferenceDraft; records: MeasurementRecord[] };
export type DescriptiveStats = { count: number; mean: number; min: number; max: number; range: number; sampleSD: number | null };
export type MeasurementSummary = {
  stats: DescriptiveStats; rawStats: DescriptiveStats; valuesSI: number[]; unitSI: 'm' | 'N';
  zero: DescriptiveStats | null; instrumentBoundSI: number | null;
  check: { knownForce: number; measured: number; error: number; tolerance: number | null; pass: boolean | null } | null;
};
const clone = <T,>(value: T): T => structuredClone(value);
const object = (value: unknown, label: string): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value as Record<string, unknown>; };
const text = (value: unknown, label: string, max = 3000): string => { if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`); return value; };
const member = <T extends string | number>(value: unknown, label: string, values: readonly T[]): T => { if (!values.includes(value as T)) throw new Error(`${label} is not supported.`); return value as T; };
function scalar(value: string, label: string, min: number, max: number): number { if (!value.trim()) throw new Error(`Enter ${label}.`); const n = Number(value); if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`); return n; }
function size(raw: string): void { if (new TextEncoder().encode(raw).byteLength > CALIBRATION_MAX_BYTES) throw new Error('Calibration files must be under 1 MB.'); }
export function createMeasurementDraft(): MeasurementDraft { return { category: 'body', side: 0, target: 'upperArm', name: '', unit: 'cm', readings: '', protocol: '', instrument: '', source: '', notes: '', instrumentBound: '', zeroReadings: '', subtractZero: false, knownMassKg: '', knownWeightReadings: '', checkTolerance: '', gravity: String(STANDARD_GRAVITY) }; }
export function createCalibrationNotebook(): CalibrationNotebook { return { format: 'biomechanics-calibration', version: 1, draft: createMeasurementDraft(), reference: { mass: '10', radius: '0.4', angle: '30', tolerance: '0.000001', measuredTorque: '', protocol: '' }, records: [] }; }
export function unitFactor(unit: MeasurementUnit): number { return { m: 1, cm: .01, mm: .001, N: 1, kgf: STANDARD_GRAVITY }[unit]; }
/** Each number is one actual reading; no data is generated or filled in. */
export function parseReadings(raw: string): number[] {
  if (raw.length > 10000) throw new Error('Reading text is too long.');
  const tokens = raw.trim().split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length || tokens.length > 200) throw new Error('Enter 1–200 readings separated by spaces, commas or new lines.');
  return tokens.map(token => { if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) throw new Error(`Invalid reading: ${token.slice(0, 40)}.`); const n = Number(token); if (!Number.isFinite(n) || Math.abs(n) > 1e6) throw new Error('Each reading must be finite and within ±1,000,000.'); return n; });
}
export function describeReadings(values: number[]): DescriptiveStats {
  if (!values.length || values.some(value => !Number.isFinite(value))) throw new Error('Statistics require finite readings.');
  const origin = values[0], offsets = values.map(value => value - origin), meanOffset = offsets.reduce((sum, value) => sum + value, 0) / values.length;
  const mean = origin + meanOffset, min = Math.min(...values), max = Math.max(...values);
  return { count: values.length, mean, min, max, range: max - min, sampleSD: values.length < 2 ? null : Math.sqrt(offsets.reduce((sum, value) => sum + (value - meanOffset) ** 2, 0) / (values.length - 1)) };
}
export function validateMeasurementDraft(value: unknown): MeasurementDraft {
  const input = object(value, 'Measurement draft');
  const category = member(input.category, 'Measurement category', ['body', 'equipment', 'cable-force'] as const);
  const unit = member(input.unit, 'Measurement unit', category === 'cable-force' ? ['N', 'kgf'] as const : ['m', 'cm', 'mm'] as const);
  const target = member(input.target, 'Measurement target', category === 'body' ? PROFILE_KEYS : category === 'equipment' ? EQUIPMENT_MEASUREMENTS : ['tension']);
  if (typeof input.subtractZero !== 'boolean') throw new Error('Zero correction must be true or false.');
  const fields = Object.fromEntries(['readings', 'protocol', 'instrument', 'source', 'notes', 'instrumentBound', 'zeroReadings', 'knownMassKg', 'knownWeightReadings', 'checkTolerance', 'gravity'].map(key => [key, text(input[key], key, ['readings', 'zeroReadings', 'knownWeightReadings'].includes(key) ? 10000 : 3000)]));
  return { ...fields, category, unit, target, side: member(input.side, 'Measurement side', [0, 1]), name: text(input.name, 'Measurement name', 120), subtractZero: input.subtractZero } as MeasurementDraft;
}
export function summarizeMeasurement(input: MeasurementDraft): MeasurementSummary {
  const draft = validateMeasurementDraft(input), factor = unitFactor(draft.unit), raw = parseReadings(draft.readings).map(value => value * factor), rawStats = describeReadings(raw);
  const zero = draft.category === 'cable-force' && draft.zeroReadings.trim() ? describeReadings(parseReadings(draft.zeroReadings).map(value => value * factor)) : null;
  if (draft.subtractZero && !zero) throw new Error('Zero correction requires actual unloaded instrument readings.');
  const correction = draft.subtractZero ? zero!.mean : 0, valuesSI = raw.map(value => value - correction);
  if (draft.category !== 'cable-force' && valuesSI.some(value => value < 0) && draft.target !== 'hipX') throw new Error('Lengths cannot be negative.');
  if (draft.category === 'cable-force' && valuesSI.some(value => value < 0)) throw new Error('Corrected attachment-force magnitudes cannot be negative. Check zero and sign.');
  const stats = describeReadings(valuesSI), instrumentBoundSI = draft.instrumentBound.trim() ? scalar(draft.instrumentBound, 'declared instrument bound', 0, 1e6) * factor : null;
  let check: MeasurementSummary['check'] = null;
  if (draft.category === 'cable-force' && (draft.knownMassKg.trim() || draft.knownWeightReadings.trim())) {
    const knownForce = scalar(draft.knownMassKg, 'independently known check mass (kg)', .000001, 1000) * scalar(draft.gravity, 'gravity for the check (m/s²)', 9, 10.5);
    const measured = describeReadings(parseReadings(draft.knownWeightReadings).map(value => value * factor - correction)).mean;
    const tolerance = draft.checkTolerance.trim() ? scalar(draft.checkTolerance, 'chosen check tolerance', 0, 1e6) * factor : null;
    check = { knownForce, measured, error: measured - knownForce, tolerance, pass: tolerance === null ? null : Math.abs(measured - knownForce) <= tolerance };
  }
  return { stats, rawStats, valuesSI, unitSI: draft.category === 'cable-force' ? 'N' : 'm', zero, instrumentBoundSI, check };
}
export function createMeasurementRecord(draft: MeasurementDraft): MeasurementRecord {
  const valid = validateMeasurementDraft(draft); summarizeMeasurement(valid);
  if (!valid.name.trim() || !valid.protocol.trim() || !valid.instrument.trim() || !valid.source.trim()) throw new Error('Recording requires a name, protocol, instrument and source/date.');
  return { id: `measurement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), draft: clone(valid), modelVersion: MODEL_VERSION };
}
export function applyMeasurement(state: LabState, record: MeasurementRecord): LabState {
  const summary = summarizeMeasurement(record.draft), draft = record.draft, next = clone(state), side = draft.side, value = summary.stats.mean;
  if (summary.check?.pass === false) throw new Error('The known-weight check failed its declared tolerance. Resolve or explicitly revise that check before applying the reading.');
  if (draft.category === 'body') {
    const key = draft.target as typeof PROFILE_KEYS[number];
    if (next.profiles[side].locked[key]) throw new Error('This body dimension is locked. Unlock it explicitly before applying a measurement.');
    if (value < PROFILE_BOUNDS[key][0] || value > PROFILE_BOUNDS[key][1]) throw new Error('The measured mean is outside the supported dimension range. Check units and landmarks.');
    next.profiles[side] = editMeasurement(next.profiles[side], key, value);
    if (next.lockBody) next.profiles[side === 0 ? 1 : 0] = clone(next.profiles[side]);
  } else if (draft.category === 'equipment') {
    const key = draft.target as typeof EQUIPMENT_MEASUREMENTS[number];
    if (key === 'pulleyHeight' && next.setups[side].outletPositions) throw new Error('This setup uses explicit outlet coordinates. Apply the measured height in its equipment geometry editor.');
    Object.assign(next.setups[side], { [key]: value });
    if (next.lockEquipment && !['hipX', 'hipHeight'].includes(key)) Object.assign(next.setups[side === 0 ? 1 : 0], { [key]: value });
  } else {
    if (next.setups[side].resistance === 'dumbbell' || next.setups[side].model === 'machine') throw new Error('Select a cable setup before applying a measured attachment force.');
    next.setups[side] = { ...next.setups[side], resistance: 'cable', loadMode: 'force', forceKnown: true, slack: false, tension: value };
    if (next.lockForce) {
      const other = side === 0 ? 1 : 0, matched = actualForce(next.setups[other]) === null ? null : forceToSetup(next.setups[other], value);
      if (!matched) throw new Error('The other setup cannot match the measured force. Disable same-force locking explicitly first.');
      next.setups[other] = matched;
    }
  }
  next.notes = `${next.notes ? next.notes + '\n' : ''}Applied measurement ${record.id}: ${draft.name}; mean ${value.toPrecision(7)} ${summary.unitSI}; source ${draft.source}; instrument ${draft.instrument}.`;
  if (next.notes.length > 10000) throw new Error('Comparison notes are full. Export or shorten them explicitly before appending measurement provenance.');
  return validateState(next);
}
export function validateCalibrationNotebook(value: unknown): CalibrationNotebook {
  const input = object(value, 'Calibration notebook');
  if (input.format !== 'biomechanics-calibration' || input.version !== 1 || !Array.isArray(input.records) || input.records.length > 200) throw new Error('Unsupported calibration notebook or more than 200 records.');
  const reference = object(input.reference, 'Analytical reference draft');
  const records = input.records.map(value => {
    const row = object(value, 'Measurement record'), draft = validateMeasurementDraft(row.draft);
    summarizeMeasurement(draft);
    if (!draft.name.trim() || !draft.protocol.trim() || !draft.instrument.trim() || !draft.source.trim()) throw new Error('Saved measurement records require complete provenance.');
    const id = text(row.id, 'Measurement identifier', 120), createdAt = text(row.createdAt, 'Measurement date', 40), modelVersion = text(row.modelVersion, 'Originating model version', 120);
    if (!/^[\w-]{1,120}$/.test(id) || !Number.isFinite(Date.parse(createdAt)) || !modelVersion.trim()) throw new Error('Measurement identity, date or origin is invalid.');
    return { id, createdAt, draft, modelVersion };
  });
  if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('Measurement identifiers must be unique.');
  return { format: 'biomechanics-calibration', version: 1, draft: validateMeasurementDraft(input.draft), reference: Object.fromEntries(['mass', 'radius', 'angle', 'tolerance', 'measuredTorque', 'protocol'].map(key => [key, text(reference[key], `Reference ${key}`, key === 'measuredTorque' ? 10000 : 3000)])) as ReferenceDraft, records };
}
export function analyticalLeverReference(draft: ReferenceDraft) {
  const mass = scalar(draft.mass, 'reference mass (kg)', 0, 1000), radius = scalar(draft.radius, 'reference radius (m)', .001, 5), angle = scalar(draft.angle, 'reference angle (degrees)', -180, 180), tolerance = scalar(draft.tolerance, 'numerical comparison tolerance (N·m)', 0, 1000);
  const expected = mass * 9.81 * radius * Math.cos(angle * Math.PI / 180), profile = createMachineProfile('lever');
  profile.domain = [-180, 180]; profile.lever = { mass, radius, phase: 0 };
  const calculated = evaluateMachine(profile, angle).moment;
  const measured = draft.measuredTorque.trim() ? describeReadings(parseReadings(draft.measuredTorque)) : null;
  if (measured && !draft.protocol.trim()) throw new Error('Describe the real torque measurement protocol before comparing real readings.');
  return { expected, calculated, error: calculated === null ? null : calculated - expected, pass: calculated !== null && Math.abs(calculated - expected) <= tolerance, measured, measuredDifference: measured ? measured.mean - expected : null };
}
export function parseCalibrationNotebook(raw: string): CalibrationNotebook { size(raw); let input: unknown; try { input = JSON.parse(raw); } catch { throw new Error('Calibration file is not valid JSON.'); } return validateCalibrationNotebook(input); }
export function loadCalibrationNotebook(): { notebook: CalibrationNotebook; error: string | null } {
  try { const raw = localStorage.getItem(CALIBRATION_KEY); return { notebook: raw ? parseCalibrationNotebook(raw) : createCalibrationNotebook(), error: null }; }
  catch (error) { return { notebook: createCalibrationNotebook(), error: `Saved calibration data was retained but could not be read. ${error instanceof Error ? error.message : ''}` }; }
}
export function saveCalibrationNotebook(notebook: CalibrationNotebook): void {
  const valid = validateCalibrationNotebook(notebook), raw = JSON.stringify(valid); size(raw);
  try {
    const previous = localStorage.getItem(CALIBRATION_KEY);
    if (previous) { let invalid = false; try { parseCalibrationNotebook(previous); } catch { invalid = true; } if (invalid) { const base = `${CALIBRATION_KEY}.recovery.${Date.now()}`; let key = base, i = 0; while (localStorage.getItem(key) !== null && localStorage.getItem(key) !== previous) key = `${base}.${++i}`; localStorage.setItem(key, previous); } }
    localStorage.setItem(CALIBRATION_KEY, raw);
  } catch { throw new Error('Calibration data could not be saved. Export a copy; any unreadable original remains protected.'); }
}
export function mergeCalibrationNotebooks(current: CalibrationNotebook, incoming: CalibrationNotebook): CalibrationNotebook {
  const next = clone(validateCalibrationNotebook(current)), valid = validateCalibrationNotebook(incoming), used = new Set(next.records.map(record => record.id));
  for (const record of valid.records) { let id = record.id, i = 1; while (used.has(id)) id = `${record.id.slice(0,100)}-import-${i++}`; used.add(id); next.records.push({ ...record, id }); }
  // Keep the current draft: importing records must not silently overwrite unfinished measurements.
  return validateCalibrationNotebook(next);
}
