import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from './state';
import { actualForce } from './engine';
import { analyticalLeverReference, applyMeasurement, CALIBRATION_KEY, createCalibrationNotebook, createMeasurementDraft, createMeasurementRecord, describeReadings, loadCalibrationNotebook, mergeCalibrationNotebooks, parseCalibrationNotebook, parseReadings, saveCalibrationNotebook, STANDARD_GRAVITY, summarizeMeasurement, validateCalibrationNotebook, type MeasurementDraft } from './calibrationGuide';

const measured = (patch: Partial<MeasurementDraft> = {}): MeasurementDraft => ({ ...createMeasurementDraft(), name: 'Observed upper arm', readings: '32\n33\n34', protocol: 'Same shoulder-to-elbow landmarks, tape removed and repositioned each time, seated, right side.', instrument: 'Tape, 1 mm divisions', source: 'User observations, 2026-10-28', ...patch });
let memory: Map<string, string>;
beforeEach(() => { memory = new Map(); vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('explicit measurement statistics and instrument checks', () => {
  it('converts centimetres and standard kgf without treating repeat variability as an uncertainty bound', () => {
    const result = summarizeMeasurement(measured());
    expect(result.stats.mean).toBeCloseTo(.33, 12);
    expect(result.stats.sampleSD).toBeCloseTo(.01, 12);
    expect(result.stats.range).toBeCloseTo(.02, 12);
    expect(result.instrumentBoundSI).toBeNull();
    const force = summarizeMeasurement(measured({ category: 'cable-force', target: 'tension', unit: 'kgf', readings: '10 10 10', instrumentBound: '.1' }));
    expect(force.stats.mean).toBeCloseTo(98.0665, 10);
    expect(force.instrumentBoundSI).toBeCloseTo(.980665, 10);
    expect(force.stats.sampleSD).toBe(0);
    expect(describeReadings([2]).sampleSD).toBeNull();
  });
  it('uses actual unloaded readings for explicit zero correction and keeps independent check disagreement', () => {
    const draft = measured({ category: 'cable-force', target: 'tension', unit: 'N', readings: '101 103', zeroReadings: '2 4', subtractZero: true, knownMassKg: '10', knownWeightReadings: String(10 * STANDARD_GRAVITY + 3), checkTolerance: '.01' });
    const result = summarizeMeasurement(draft);
    expect(result.zero!.mean).toBe(3); expect(result.stats.mean).toBe(99);
    expect(result.check!.pass).toBe(true); expect(result.check!.error).toBeCloseTo(0, 10);
    draft.knownWeightReadings = '110';
    expect(summarizeMeasurement(draft).check!.pass).toBe(false);
    const record = createMeasurementRecord(draft);
    expect(() => applyMeasurement(createInitialState(), record)).toThrow('known-weight check failed');
    expect(record.draft.knownWeightReadings).toBe('110');
  });
  it('never generates readings for blank drafts or interprets malformed tokens as measurements', () => {
    expect(() => summarizeMeasurement(createMeasurementDraft())).toThrow('Enter 1–200');
    for (const raw of ['1e999', 'NaN', '1 kg', '0x10', '1,Infinity', Array(201).fill('1').join(' ')]) expect(() => parseReadings(raw)).toThrow();
    expect(parseReadings('-1.5\n2e1; .4')).toEqual([-1.5, 20, .4]);
    expect(() => summarizeMeasurement(measured({ category: 'cable-force', target: 'tension', unit: 'N', subtractZero: true }))).toThrow('actual unloaded');
    expect(() => createMeasurementRecord(measured({ protocol: '' }))).toThrow('protocol');
  });
});

describe('applying measured values preserves comparison invariants', () => {
  it('applies a measured mean with linked body provenance while preserving other measured or locked dimensions', () => {
    const state = createInitialState(); state.profiles[0].values.forearm = .29; state.profiles[0].provenance.forearm = 'measured'; state.profiles[0].locked.foot = true; state.profiles[1] = structuredClone(state.profiles[0]);
    const next = applyMeasurement(state, createMeasurementRecord(measured()));
    expect(next.profiles[0].values.upperArm).toBeCloseTo(.33, 12); expect(next.profiles[0].provenance.upperArm).toBe('measured');
    expect(next.profiles[1]).toEqual(next.profiles[0]); expect(next.profiles[0].values.forearm).toBe(.29); expect(next.profiles[0].locked.foot).toBe(true);
    expect(state.profiles[0].provenance.upperArm).toBe('example');
    state.profiles[0].locked.upperArm = true;
    expect(() => applyMeasurement(state, createMeasurementRecord(measured()))).toThrow('locked');
  });
  it('applies actual force rather than stack mass and preserves equal-force barbell conventions', () => {
    const state = createInitialState(); state.sync = 'independent'; state.lockForce = true;
    state.setups[1] = { ...state.setups[0], resistance: 'dumbbell', loadMass: 20, freeWeightKind: 'barbell', loadedSides: 'bilateral' };
    const record = createMeasurementRecord(measured({ category: 'cable-force', target: 'tension', unit: 'N', readings: '99 101' }));
    const next = applyMeasurement(state, record);
    expect(next.setups[0].loadMode).toBe('force'); expect(next.setups[0].tension).toBe(100);
    expect(actualForce(next.setups[1])).toBeCloseTo(100, 10); expect(next.setups[1].loadMass).toBeCloseTo(200 / 9.81, 10);
    expect(next.notes).toContain(record.id);
  });
  it('does not silently replace independent outlet heights or truncate existing provenance notes', () => {
    const state = createInitialState(); state.setups[0].outletPositions = [[0, 0, 2]];
    const record = createMeasurementRecord(measured({ category: 'equipment', target: 'pulleyHeight', readings: '220 221' }));
    expect(() => applyMeasurement(state, record)).toThrow('explicit outlet');
    state.notes = 'x'.repeat(10000);
    expect(() => applyMeasurement(state, createMeasurementRecord(measured()))).toThrow('notes are full');
    expect(state.notes).toHaveLength(10000);
  });
});

describe('analytical reference versus real observations', () => {
  it('checks independent known-load cases without claiming measured validation', () => {
    const notebook = createCalibrationNotebook();
    notebook.reference = { mass: '10', radius: '.4', angle: '0', tolerance: '.000001', measuredTorque: '', protocol: '' };
    const horizontal = analyticalLeverReference(notebook.reference);
    expect(horizontal.expected).toBeCloseTo(39.24, 10); expect(horizontal.pass).toBe(true); expect(horizontal.measured).toBeNull();
    notebook.reference.angle = '90'; expect(analyticalLeverReference(notebook.reference).expected).toBeCloseTo(0, 10);
    notebook.reference.angle = '180'; expect(analyticalLeverReference(notebook.reference).expected).toBeCloseTo(-39.24, 10);
    notebook.reference.measuredTorque = '-30 -32'; expect(() => analyticalLeverReference(notebook.reference)).toThrow('protocol');
    notebook.reference.protocol = 'Actual independent sensor readings; test fixture and source retained by user.';
    const physical = analyticalLeverReference(notebook.reference); expect(physical.measured!.mean).toBe(-31); expect(physical.measuredDifference).toBeCloseTo(8.24, 10); expect(physical.pass).toBe(true);
  });
});

describe('portable calibration draft and records', () => {
  it('saves incomplete drafts exactly and round-trips recorded measurements and reference observations', () => {
    const notebook = createCalibrationNotebook(); notebook.draft.readings = '32, unfinished'; notebook.draft.protocol = 'Draft landmarks'; notebook.records = [createMeasurementRecord(measured())];
    saveCalibrationNotebook(notebook);
    expect(loadCalibrationNotebook()).toEqual({ notebook, error: null });
    expect(parseCalibrationNotebook(JSON.stringify(notebook))).toEqual(notebook);
  });
  it('merges colliding record identities without replacing an unfinished current draft', () => {
    const current = createCalibrationNotebook(); current.draft.name = 'Current unfinished reading'; current.records = [createMeasurementRecord(measured())];
    const incoming = structuredClone(current); incoming.draft.name = 'Imported draft';
    const result = mergeCalibrationNotebooks(current, incoming);
    expect(result.records).toHaveLength(2); expect(result.records[0].id).not.toBe(result.records[1].id); expect(result.draft.name).toBe('Current unfinished reading');
    expect(current.records).toHaveLength(1);
  });
  it('retains malformed originals and refuses replacement if the recovery copy fails', () => {
    memory.set(CALIBRATION_KEY, '{bad original'); expect(loadCalibrationNotebook().error).toContain('retained');
    saveCalibrationNotebook(createCalibrationNotebook()); expect([...memory.values()]).toContain('{bad original');
    let overwritten = false;
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === CALIBRATION_KEY ? '{bad' : null, setItem: (key: string) => { if (key === CALIBRATION_KEY) overwritten = true; throw new Error('Quota'); } });
    expect(() => saveCalibrationNotebook(createCalibrationNotebook())).toThrow('could not be saved'); expect(overwritten).toBe(false);
  });
  it('rejects malformed saved records, unit mismatches and oversized imports before mutation', () => {
    const notebook = createCalibrationNotebook(); notebook.records = [createMeasurementRecord(measured())];
    const bad = structuredClone(notebook); bad.records[0].draft.readings = 'NaN'; expect(() => validateCalibrationNotebook(bad)).toThrow();
    expect(() => validateCalibrationNotebook({ ...notebook, draft: { ...notebook.draft, unit: 'kgf' } })).toThrow('unit');
    expect(() => parseCalibrationNotebook(' '.repeat(1000001))).toThrow('1 MB');
    expect(memory.size).toBe(0);
  });
});
