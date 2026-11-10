/** Bounded arithmetic expressions. This module never evaluates JavaScript source. */
export type FormulaParameter = { name: string; value: number; unit: string; description: string };
export type MachineFormula = {
  expression: string;
  angleUnit: 'radians' | 'degrees';
  quantity: 'moment' | 'force';
  forceMomentArm: number | null;
  parameters: FormulaParameter[];
};
export type FormulaEvaluator = (q: number, parameters: Readonly<Record<string, number>>) => number | null;

const MAX_VALUE = 1e12;
const MAX_DEPTH = 32;
const MAX_TOKENS = 512;
const CACHE_LIMIT = 64;
const RAD = Math.PI / 180;
const bounded = (value: number): number | null => Number.isFinite(value) && Math.abs(value) <= MAX_VALUE ? value : null;
type ArithmeticFunction = { min: number; max: number; run: (...args: number[]) => number };
const unary = (run: (value: number) => number): ArithmeticFunction => ({ min: 1, max: 1, run });
const functions = new Map<string, ArithmeticFunction>([
  ['sin', unary(Math.sin)], ['cos', unary(Math.cos)], ['tan', unary(Math.tan)],
  ['sind', unary(value => Math.sin(value * RAD))], ['cosd', unary(value => Math.cos(value * RAD))], ['tand', unary(value => Math.tan(value * RAD))],
  ['abs', unary(Math.abs)], ['sqrt', unary(Math.sqrt)], ['exp', unary(Math.exp)], ['log', unary(Math.log)],
  ['min', { min: 1, max: MAX_TOKENS, run: Math.min }], ['max', { min: 1, max: MAX_TOKENS, run: Math.max }],
  ['pow', { min: 2, max: 2, run: Math.pow }],
  ['clamp', { min: 3, max: 3, run: (value, low, high) => low <= high ? Math.max(low, Math.min(high, value)) : NaN }],
]);
const reserved = new Set(['q', 'pi', 'e', '__proto__', 'prototype', 'constructor', ...functions.keys()]);
type Token = { kind: 'number' | 'name' | 'symbol' | 'end'; text: string; position: number };
type Ast = (
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'unary'; sign: '+' | '-'; child: Ast }
  | { kind: 'binary'; operator: string; left: Ast; right: Ast }
  | { kind: 'call'; name: string; arguments: Ast[] }
) & { depth: number };

function tokenize(expression: string): Token[] {
  if (typeof expression !== 'string' || expression.length < 1 || expression.length > 2048 || !expression.trim()) throw new Error('Formula needs 1–2048 characters.');
  const tokens: Token[] = [];
  let position = 0;
  while (position < expression.length) {
    const rest = expression.slice(position);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { position += whitespace[0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    const text = number?.[0] ?? name?.[0] ?? rest[0];
    if (!number && !name && !'()+-*/^,'.includes(text)) throw new Error(`Unsupported character at position ${position + 1}.`);
    if (number && bounded(Number(text)) === null) throw new Error('Formula numeric literals must be finite and no larger than 1e12.');
    tokens.push({ kind: number ? 'number' : name ? 'name' : 'symbol', text, position });
    if (tokens.length > MAX_TOKENS) throw new Error('Formula exceeds 512 tokens.');
    position += text.length;
  }
  tokens.push({ kind: 'end', text: '', position });
  return tokens;
}

class Parser {
  private cursor = 0;
  constructor(private readonly tokens: Token[], private readonly variables: Set<string>) {}
  private peek(): Token { return this.tokens[this.cursor]; }
  private take(text: string): boolean { if (this.peek().text !== text) return false; this.cursor++; return true; }
  private expect(text: string): void { if (!this.take(text)) throw new Error(`Expected '${text}' at position ${this.peek().position + 1}.`); }
  private checkDepth(depth: number): void { if (depth > MAX_DEPTH) throw new Error('Formula exceeds nesting depth 32.'); }
  private binary(operator: string, left: Ast, right: Ast): Ast {
    const depth = 1 + Math.max(left.depth, right.depth); this.checkDepth(depth);
    return { kind: 'binary', operator, left, right, depth };
  }
  parse(): Ast {
    const result = this.sum(0);
    if (this.peek().kind !== 'end') throw new Error(`Unexpected '${this.peek().text}' at position ${this.peek().position + 1}; multiplication must be explicit.`);
    return result;
  }
  private sum(nesting: number): Ast {
    let result = this.product(nesting);
    while (this.peek().text === '+' || this.peek().text === '-') {
      const operator = this.tokens[this.cursor++].text;
      result = this.binary(operator, result, this.product(nesting));
    }
    return result;
  }
  private product(nesting: number): Ast {
    let result = this.signed(nesting);
    while (this.peek().text === '*' || this.peek().text === '/') {
      const operator = this.tokens[this.cursor++].text;
      result = this.binary(operator, result, this.signed(nesting));
    }
    return result;
  }
  // Exponentiation binds before a leading sign, while its RHS may itself be signed.
  private signed(nesting: number): Ast {
    this.checkDepth(nesting);
    if (this.peek().text === '+' || this.peek().text === '-') {
      const sign = this.tokens[this.cursor++].text as '+' | '-';
      const child = this.signed(nesting + 1), depth = child.depth + 1; this.checkDepth(depth);
      return { kind: 'unary', sign, child, depth };
    }
    return this.power(nesting);
  }
  private power(nesting: number): Ast {
    const left = this.primary(nesting);
    return this.take('^') ? this.binary('^', left, this.signed(nesting + 1)) : left;
  }
  private primary(nesting: number): Ast {
    this.checkDepth(nesting);
    const token = this.peek();
    if (token.kind === 'number') { this.cursor++; return { kind: 'number', value: Number(token.text), depth: 1 }; }
    if (this.take('(')) { const value = this.sum(nesting + 1); this.expect(')'); return value; }
    if (token.kind !== 'name') throw new Error(`Expected a number, parameter or function at position ${token.position + 1}.`);
    this.cursor++;
    if (!this.take('(')) {
      if (!this.variables.has(token.text)) throw new Error(`Unknown parameter '${token.text}'.`);
      return { kind: 'variable', name: token.text, depth: 1 };
    }
    const fn = functions.get(token.text);
    if (!fn) throw new Error(`Unknown function '${token.text}'.`);
    const args: Ast[] = [];
    if (!this.take(')')) {
      do { args.push(this.sum(nesting + 1)); } while (this.take(','));
      this.expect(')');
    }
    if (args.length < fn.min || args.length > fn.max) throw new Error(`Function '${token.text}' requires ${fn.min === fn.max ? fn.min : `at least ${fn.min}`} argument(s).`);
    const depth = 1 + Math.max(0, ...args.map(arg => arg.depth)); this.checkDepth(depth);
    return { kind: 'call', name: token.text, arguments: args, depth };
  }
}

function parameterName(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value) || reserved.has(value)) throw new Error('Parameter names need 1–64 letters, digits or underscores, must begin with a letter or underscore, and cannot be reserved names.');
  return value;
}
function parameterNames(names: readonly string[]): string[] {
  if (!Array.isArray(names) || names.length > 32) throw new Error('Formula supports at most 32 parameters.');
  const result = names.map(parameterName);
  if (new Set(result).size !== result.length) throw new Error('Formula parameter names must be unique.');
  return result;
}

function evaluateNode(node: Ast, q: number, values: Readonly<Record<string, number>>): number | null {
  if (node.kind === 'number') return node.value;
  if (node.kind === 'variable') {
    if (node.name === 'q') return bounded(q);
    if (node.name === 'pi') return Math.PI;
    if (node.name === 'e') return Math.E;
    return Object.hasOwn(values, node.name) && typeof values[node.name] === 'number' ? bounded(values[node.name]) : null;
  }
  if (node.kind === 'unary') {
    const value = evaluateNode(node.child, q, values);
    return value === null ? null : bounded(node.sign === '-' ? -value : value);
  }
  if (node.kind === 'call') {
    const valuesOfArguments = node.arguments.map(arg => evaluateNode(arg, q, values));
    if (valuesOfArguments.some(value => value === null)) return null;
    return bounded(functions.get(node.name)!.run(...valuesOfArguments as number[]));
  }
  const left = evaluateNode(node.left, q, values), right = evaluateNode(node.right, q, values);
  if (left === null || right === null) return null;
  switch (node.operator) {
    case '+': return bounded(left + right);
    case '-': return bounded(left - right);
    case '*': return bounded(left * right);
    case '/': return right === 0 ? null : bounded(left / right);
    case '^': return bounded(Math.pow(left, right));
    default: return null;
  }
}

const compiled = new Map<string, FormulaEvaluator>();
const syntaxTrees = new WeakMap<FormulaEvaluator, Ast>();
/** q is already in the caller's declared units. Parameter values are never cached. */
export function compileFormula(expression: string, names: readonly string[] = []): FormulaEvaluator {
  const checkedNames = parameterNames(names).sort();
  const key = JSON.stringify([expression, checkedNames]);
  const cached = compiled.get(key);
  if (cached) { compiled.delete(key); compiled.set(key, cached); return cached; }
  const root = new Parser(tokenize(expression), new Set(['q', 'pi', 'e', ...checkedNames])).parse();
  const evaluator: FormulaEvaluator = (q, values) => {
    if (typeof q !== 'number' || bounded(q) === null || !values || typeof values !== 'object') return null;
    if (checkedNames.some(name => !Object.hasOwn(values, name) || typeof values[name] !== 'number' || bounded(values[name]) === null)) return null;
    return evaluateNode(root, q, values);
  };
  if (compiled.size >= CACHE_LIMIT) compiled.delete(compiled.keys().next().value!);
  syntaxTrees.set(evaluator, root);
  compiled.set(key, evaluator);
  return evaluator;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
function finite(value: unknown, label: string, limit = MAX_VALUE): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) throw new Error(`${label} must be finite with magnitude at most ${limit}.`);
  return value;
}
export function validateMachineFormula(input: unknown): MachineFormula {
  const source = object(input, 'Formula');
  if (source.angleUnit !== 'radians' && source.angleUnit !== 'degrees') throw new Error('Formula angle unit must be radians or degrees.');
  if (source.quantity !== 'moment' && source.quantity !== 'force') throw new Error('Formula quantity must be moment or force.');
  if (!Array.isArray(source.parameters) || source.parameters.length > 32) throw new Error('Formula supports at most 32 parameters.');
  const parameters = source.parameters.map(item => {
    const parameter = object(item, 'Formula parameter');
    return { name: parameterName(parameter.name), value: finite(parameter.value, 'Parameter value'), unit: text(parameter.unit, 'Parameter unit', 80), description: text(parameter.description, 'Parameter description', 2000) };
  });
  const expression = text(source.expression, 'Expression', 2048);
  const forceMomentArm = source.forceMomentArm === null ? null : finite(source.forceMomentArm, 'Signed force moment arm', 5);
  compileFormula(expression, parameters.map(parameter => parameter.name));
  return { expression, angleUnit: source.angleUnit, quantity: source.quantity, forceMomentArm, parameters };
}

/** Returns the declared raw quantity. The caller applies any force-to-moment mapping. */
export function evaluateMachineFormula(formula: MachineFormula, angleDegrees: number): number | null {
  try {
    if (typeof angleDegrees !== 'number' || bounded(angleDegrees) === null) return null;
    const checked = validateMachineFormula(formula);
    const values = Object.fromEntries(checked.parameters.map(parameter => [parameter.name, parameter.value]));
    const result = compileFormula(checked.expression, checked.parameters.map(parameter => parameter.name))(checked.angleUnit === 'radians' ? angleDegrees * RAD : angleDegrees, values);
    return result === null || (checked.quantity === 'force' && result < 0) ? null : result;
  } catch { return null; }
}

type Interval = [number, number];
// IEEE-754 neighbors make arithmetic ranges outward-rounded rather than optimistic.
const roundingBuffer = new DataView(new ArrayBuffer(8));
function neighbor(value: number, direction: -1 | 1): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return direction * Number.MIN_VALUE;
  roundingBuffer.setFloat64(0, value);
  const bits = roundingBuffer.getBigUint64(0);
  roundingBuffer.setBigUint64(0, bits + BigInt((value > 0 ? 1 : -1) * direction));
  return roundingBuffer.getFloat64(0);
}
function interval(low: number, high: number, transcendental = false, nonnegative = false): Interval | null {
  const error = transcendental ? 8 * Number.EPSILON * Math.max(1, Math.abs(low), Math.abs(high)) : 0;
  const lo = nonnegative && low === 0 ? 0 : neighbor(low - error, -1);
  const hi = neighbor(high + error, 1);
  return bounded(lo) === null || bounded(hi) === null || lo > hi ? null : [lo, hi];
}
function multiplication(a: Interval, b: Interval): Interval | null {
  const products = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
  return interval(Math.min(...products), Math.max(...products));
}
function division(a: Interval, b: Interval): Interval | null {
  if (b[0] <= 0 && b[1] >= 0) return null;
  const quotients = [a[0] / b[0], a[0] / b[1], a[1] / b[0], a[1] / b[1]];
  return interval(Math.min(...quotients), Math.max(...quotients));
}
function powerInterval(base: Interval, exponent: Interval): Interval | null {
  const [low, high] = base, [powerLow, powerHigh] = exponent;
  if (powerLow === powerHigh && Number.isInteger(powerLow)) {
    if (powerLow === 0) return [1, 1];
    if (powerLow < 0) {
      if (low <= 0 && high >= 0) return null;
      // Compute negative powers directly: a tiny positive denominator is not
      // itself an evaluated intermediate in the original expression.
      const ends = [Math.pow(low, powerLow), Math.pow(high, powerLow)];
      return interval(Math.min(...ends), Math.max(...ends), true);
    }
    const ends = [Math.pow(low, powerLow), Math.pow(high, powerLow)];
    const positiveEven = powerLow % 2 === 0;
    return interval(positiveEven && low <= 0 && high >= 0 ? 0 : Math.min(...ends), Math.max(...ends), true, positiveEven);
  }
  if (low < 0 || (low === 0 && powerLow < 0)) return null;
  const corners = [Math.pow(low, powerLow), Math.pow(low, powerHigh), Math.pow(high, powerLow), Math.pow(high, powerHigh)];
  if (low <= 1 && high >= 1 || powerLow <= 0 && powerHigh >= 0) corners.push(1);
  if (low === 0 && powerHigh > 0) corners.push(0);
  return interval(Math.min(...corners), Math.max(...corners), true, true);
}
function includesPeriodicPoint(range: Interval, phase: number, period: number): boolean {
  const error = 8 * Number.EPSILON * Math.max(1, Math.abs(range[0]), Math.abs(range[1]));
  return Math.ceil((range[0] - error - phase) / period) <= Math.floor((range[1] + error - phase) / period);
}
function trigInterval(name: 'sin' | 'cos' | 'tan', range: Interval): Interval | null {
  if (name === 'tan') {
    if (includesPeriodicPoint(range, Math.PI / 2, Math.PI)) return null;
    return interval(Math.tan(range[0]), Math.tan(range[1]), true);
  }
  if (range[1] - range[0] >= 2 * Math.PI) return [-1, 1];
  const fn = name === 'sin' ? Math.sin : Math.cos;
  const phase = name === 'sin' ? Math.PI / 2 : 0;
  const low = includesPeriodicPoint(range, phase + Math.PI, 2 * Math.PI) ? -1 : Math.min(fn(range[0]), fn(range[1]));
  const high = includesPeriodicPoint(range, phase, 2 * Math.PI) ? 1 : Math.max(fn(range[0]), fn(range[1]));
  const result = interval(low, high, true);
  return result ? [Math.max(-1, result[0]), Math.min(1, result[1])] : null;
}
function functionInterval(name: string, args: Interval[]): Interval | null {
  const a = args[0];
  if (name === 'sin' || name === 'cos' || name === 'tan') return trigInterval(name, a);
  if (name === 'sind' || name === 'cosd' || name === 'tand') {
    const radians = multiplication(a, [RAD, RAD]);
    return radians ? trigInterval(name.slice(0, -1) as 'sin' | 'cos' | 'tan', radians) : null;
  }
  switch (name) {
    case 'abs': return [a[0] <= 0 && a[1] >= 0 ? 0 : Math.min(Math.abs(a[0]), Math.abs(a[1])), Math.max(Math.abs(a[0]), Math.abs(a[1]))];
    case 'sqrt': return a[0] < 0 ? null : interval(Math.sqrt(a[0]), Math.sqrt(a[1]), true, true);
    case 'log': return a[0] <= 0 ? null : interval(Math.log(a[0]), Math.log(a[1]), true);
    case 'exp': return interval(Math.exp(a[0]), Math.exp(a[1]), true, true);
    case 'pow': return powerInterval(a, args[1]);
    case 'min': return [Math.min(...args.map(value => value[0])), Math.min(...args.map(value => value[1]))];
    case 'max': return [Math.max(...args.map(value => value[0])), Math.max(...args.map(value => value[1]))];
    case 'clamp': return args[1][1] > args[2][0] ? null : [Math.max(args[1][0], Math.min(args[2][0], a[0])), Math.max(args[1][1], Math.min(args[2][1], a[1]))];
    default: return null;
  }
}
function evaluateInterval(node: Ast, q: Interval, values: Readonly<Record<string, number>>): Interval | null {
  if (node.kind === 'number') return [node.value, node.value];
  if (node.kind === 'variable') {
    if (node.name === 'q') return q;
    const value = node.name === 'pi' ? Math.PI : node.name === 'e' ? Math.E : values[node.name];
    return [value, value];
  }
  if (node.kind === 'unary') {
    const child = evaluateInterval(node.child, q, values);
    return child && (node.sign === '-' ? [-child[1], -child[0]] : child);
  }
  if (node.kind === 'call') {
    const args = node.arguments.map(arg => evaluateInterval(arg, q, values));
    return args.some(arg => arg === null) ? null : functionInterval(node.name, args as Interval[]);
  }
  const left = evaluateInterval(node.left, q, values), right = evaluateInterval(node.right, q, values);
  if (!left || !right) return null;
  switch (node.operator) {
    case '+': return interval(left[0] + right[0], left[1] + right[1]);
    case '-': return interval(left[0] - right[1], left[1] - right[0]);
    case '*': return multiplication(left, right);
    case '/': return division(left, right);
    case '^': return powerInterval(left, right);
    default: return null;
  }
}

/**
 * A sufficient, conservative proof that every coordinate in a closed interval
 * evaluates to a valid declared quantity. False also means unresolved: correlated
 * terms (such as q-q) may need subdivision. Callers must never bridge that range.
 */
export function formulaIntervalSafe(formula: MachineFormula, loDegrees: number, hiDegrees: number): boolean {
  try {
    if (bounded(loDegrees) === null || bounded(hiDegrees) === null || loDegrees > hiDegrees) return false;
    const checked = validateMachineFormula(formula);
    const evaluator = compileFormula(checked.expression, checked.parameters.map(parameter => parameter.name));
    const q: Interval = checked.angleUnit === 'degrees' ? [loDegrees, hiDegrees] : [loDegrees * RAD, hiDegrees * RAD];
    const values = Object.fromEntries(checked.parameters.map(parameter => [parameter.name, parameter.value]));
    const result = evaluateInterval(syntaxTrees.get(evaluator)!, q, values);
    return result !== null && (checked.quantity !== 'force' || result[0] >= 0);
  } catch { return false; }
}
