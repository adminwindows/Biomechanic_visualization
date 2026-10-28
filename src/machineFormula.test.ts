import { describe, expect, it } from 'vitest';
import { compileFormula, evaluateMachineFormula, formulaIntervalSafe, validateMachineFormula, type MachineFormula } from './machineFormula';

const formula = (expression: string, extra: Partial<MachineFormula> = {}): MachineFormula => ({ expression, angleUnit: 'radians', quantity: 'moment', forceMomentArm: null, parameters: [], ...extra });
const parameter = (name: string, value: number) => ({ name, value, unit: '', description: '' });

describe('safe machine formula arithmetic', () => {
  it('matches the theoretical gravitational lever and updates cached parameters', () => {
    const source = formula('mass * 9.81 * radius * cos(q + phase)', { parameters: [parameter('mass', 20), parameter('radius', .4), parameter('phase', Math.PI / 6)] });
    expect(evaluateMachineFormula(source, 30)).toBeCloseTo(39.24, 10);
    source.parameters[0].value = 40;
    expect(evaluateMachineFormula(source, 30)).toBeCloseTo(78.48, 10);
  });
  it('converts q explicitly and keeps normal trig in radians', () => {
    expect(evaluateMachineFormula(formula('q'), 180)).toBeCloseTo(Math.PI);
    expect(evaluateMachineFormula(formula('q', { angleUnit: 'degrees' }), 180)).toBe(180);
    expect(evaluateMachineFormula(formula('sin(q)'), 90)).toBe(1);
    expect(evaluateMachineFormula(formula('sind(q)', { angleUnit: 'degrees' }), 90)).toBe(1);
    expect(evaluateMachineFormula(formula('sin(q)', { angleUnit: 'degrees' }), 90)).toBeCloseTo(Math.sin(90));
    expect(evaluateMachineFormula(formula('cosd(60) + tand(45)'), 0)).toBeCloseTo(1.5);
  });
  it.each([['-2^2', -4], ['(-2)^2', 4], ['2^3^2', 512], ['2^-2', .25], ['-2^-2', -.25], ['2+3*4', 14], ['8/2*3', 12], ['1-2-3', -4], ['--2', 2], ['.5 + 1e-3 + 2E+1', 20.501]])('uses arithmetic precedence for %s', (expression, expected) => {
    expect(evaluateMachineFormula(formula(expression), 0)).toBeCloseTo(expected);
  });
  it('supports only named mathematical functions and constants', () => {
    expect(evaluateMachineFormula(formula('min(8,3,5)+max(2,4)+abs(-2)+sqrt(9)+pow(2,3)+clamp(20,0,10)+log(e)+exp(0)+sin(pi/2)'), 0)).toBeCloseTo(33);
  });
  it('returns a raw force without silently applying its signed arm', () => {
    for (const arm of [null, -.2, 0, .2]) expect(evaluateMachineFormula(formula('100', { quantity: 'force', forceMomentArm: arm }), 0)).toBe(100);
    expect(evaluateMachineFormula(formula('-100', { quantity: 'force' }), 0)).toBeNull();
    expect(evaluateMachineFormula(formula('-100'), 0)).toBe(-100);
  });
  it.each(['1/(q-pi/2)', 'tan(q)', 'tand(90)', 'sqrt(-1)', 'log(0)', 'log(-1)', 'exp(100)', '10^100', 'pow(-2,.5)', '1e12*2', '1e12*2-1e12', 'clamp(0,2,1)', '0/0'])('creates a gap at singular/domain/overflow input %s', expression => {
    expect(evaluateMachineFormula(formula(expression), 90)).toBeNull();
  });
  it('keeps values around a singularity independent', () => {
    const source = formula('1/(q-90)', { angleUnit: 'degrees' });
    expect(evaluateMachineFormula(source, 89)).toBe(-1);
    expect(evaluateMachineFormula(source, 90)).toBeNull();
    expect(evaluateMachineFormula(source, 91)).toBe(1);
  });
});

describe('formula validation and execution bounds', () => {
  it.each(['globalThis', 'process.exit()', 'Math.sin(q)', 'q=1', 'q[0]', 'q.constructor', 'sin.constructor(1)', '1;2', '(()=>1)()', '`hello`', '"text"', '2q', '2(q)', '(q)2', 'q q', 'unknown(q)', 'unknown', 'sin()', 'sin(1,2)', 'pow(2)', 'min()', 'clamp(1,2)', 'sin(1,)', '2**3', '1e999', '1e13', '', '   '])('rejects malformed or unauthorized syntax %s', expression => {
    expect(() => validateMachineFormula(formula(expression))).toThrow();
    expect(evaluateMachineFormula(formula(expression), 0)).toBeNull();
  });
  it('rejects excessive source, tokens and syntactic or AST depth', () => {
    for (const expression of ['1'.repeat(2049), `min(${Array(260).fill('1').join(',')})`, `${'('.repeat(34)}1${')'.repeat(34)}`, `${'-'.repeat(34)}1`, Array(34).fill('1').join('+'), Array(34).fill('1').join('^')]) expect(() => validateMachineFormula(formula(expression))).toThrow();
    expect(evaluateMachineFormula(formula(`${'('.repeat(30)}1${')'.repeat(30)}`), 0)).toBe(1);
  });
  it('rejects reserved, duplicate, invalid and oversized parameter definitions', () => {
    for (const name of ['q', 'pi', 'e', 'sin', 'pow', '__proto__', 'constructor', '1x', 'a.b', 'x y', 'x'.repeat(65)]) expect(() => validateMachineFormula(formula('1', { parameters: [parameter(name, 1)] }))).toThrow();
    expect(() => validateMachineFormula(formula('x', { parameters: [parameter('x', 1), parameter('x', 2)] }))).toThrow();
    expect(() => validateMachineFormula(formula('1', { parameters: Array.from({ length: 33 }, (_, i) => parameter(`x${i}`, 1)) }))).toThrow();
    for (const value of [NaN, Infinity, 1e12 + 1]) expect(() => validateMachineFormula(formula('x', { parameters: [parameter('x', value)] }))).toThrow();
  });
  it('rejects malformed quantity, unit and moment-arm metadata', () => {
    for (const input of [null, [], {}, { ...formula('1'), angleUnit: 'auto' }, { ...formula('1'), quantity: 'power' }, { ...formula('1'), forceMomentArm: 5.001 }, { ...formula('1'), forceMomentArm: -5.001 }, { ...formula('1'), parameters: null }]) expect(() => validateMachineFormula(input)).toThrow();
    expect(validateMachineFormula(formula('1', { forceMomentArm: -5 })).forceMomentArm).toBe(-5);
  });
  it('never reuses cached bindings when allowed parameter names change', () => {
    const run = compileFormula('value + q', ['value']);
    expect(run(2, { value: 3 })).toBe(5);
    expect(run(2, { value: 8 })).toBe(10);
    expect(run(2, Object.create({ value: 8 }))).toBeNull();
    expect(run(2, {})).toBeNull();
    expect(() => compileFormula('value + q', [])).toThrow();
    for (let i = 0; i < 80; i++) compileFormula(`${i}+q`);
    expect(compileFormula('value + q', ['value'])(2, { value: 4 })).toBe(6);
  });
  it('rejects nonfinite runtime input and preserves the input definition', () => {
    const source = formula('mass*q', { parameters: [parameter('mass', 2)] });
    const before = JSON.stringify(source);
    expect(evaluateMachineFormula(source, NaN)).toBeNull();
    expect(evaluateMachineFormula(source, Infinity)).toBeNull();
    expect(evaluateMachineFormula(source, 1e13)).toBeNull();
    const copy = validateMachineFormula(source);
    copy.parameters[0].value = 9;
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('conservative continuous formula validity', () => {
  it('rejects an off-grid pole even when both endpoints are finite', () => {
    const source = formula('1/(q-.173)', { angleUnit: 'degrees' });
    expect(evaluateMachineFormula(source, 0)).not.toBeNull();
    expect(evaluateMachineFormula(source, .5)).not.toBeNull();
    expect(formulaIntervalSafe(source, 0, .5)).toBe(false);
    expect(formulaIntervalSafe(source, 0, .17)).toBe(true);
    expect(formulaIntervalSafe(source, .18, .5)).toBe(true);
  });
  it('does not bridge a narrow interior domain gap or an overflow peak', () => {
    expect(formulaIntervalSafe(formula('sqrt((q-.173)^2-.000001)', { angleUnit: 'degrees' }), 0, .5)).toBe(false);
    expect(formulaIntervalSafe(formula('log((q-.173)^2)', { angleUnit: 'degrees' }), 0, .5)).toBe(false);
    expect(formulaIntervalSafe(formula('exp(30-(q-.173)^2)', { angleUnit: 'degrees' }), -10, 10)).toBe(false);
    expect(formulaIntervalSafe(formula('1/sin(q)'), 170, 190)).toBe(false);
  });
  it('detects tangent poles across unit conventions', () => {
    expect(formulaIntervalSafe(formula('tan(q)'), 80, 100)).toBe(false);
    expect(formulaIntervalSafe(formula('tan(q)'), 10, 70)).toBe(true);
    expect(formulaIntervalSafe(formula('tand(q)', { angleUnit: 'degrees' }), 260, 280)).toBe(false);
    expect(formulaIntervalSafe(formula('tand(q)', { angleUnit: 'degrees' }), -60, 60)).toBe(true);
  });
  it('certifies the ordinary lever, trigonometric and bounded nonlinear functions', () => {
    for (const expression of ['20*9.81*.4*cos(q)', 'sin(q)+cos(q)', 'min(q,1)+max(q,2)', 'abs(q)+sqrt(q^2)', 'log(q+10)', 'exp(q)', 'pow(q,2)', 'clamp(q,-1,1)', '2^q']) expect(formulaIntervalSafe(formula(expression), -30, 120), expression).toBe(true);
  });
  it('handles exponent domains and the interior extrema of even powers', () => {
    expect(formulaIntervalSafe(formula('q^-2'), -10, 10)).toBe(false);
    expect(formulaIntervalSafe(formula('q^-2'), 10, 20)).toBe(true);
    expect(formulaIntervalSafe(formula('q^.5'), -10, 10)).toBe(false);
    expect(formulaIntervalSafe(formula('q^.5'), 0, 10)).toBe(true);
    expect(formulaIntervalSafe(formula('(-2)^q'), 0, 10)).toBe(false);
    expect(formulaIntervalSafe(formula('(-2)^2'), 0, 10)).toBe(true);
    expect(formulaIntervalSafe(formula('0^q'), 10, 30)).toBe(true);
    expect(formulaIntervalSafe(formula('q^0'), -10, 10)).toBe(true);
  });
  it('rejects physically negative force regions and invalid interval metadata', () => {
    const source = formula('cos(q)', { quantity: 'force' });
    expect(formulaIntervalSafe(source, 0, 60)).toBe(true);
    expect(formulaIntervalSafe(source, 0, 180)).toBe(false);
    expect(formulaIntervalSafe(source, 10, 0)).toBe(false);
    expect(formulaIntervalSafe(source, NaN, 90)).toBe(false);
    expect(formulaIntervalSafe(source, 0, Infinity)).toBe(false);
  });
});
