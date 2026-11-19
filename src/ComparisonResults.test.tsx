import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { evaluate, defaultProfile, presets } from './engine';
import { evaluateCompound, type compoundCurve } from './compoundEngine';
import { initialCompound } from './compoundState';
import { CompoundComparisonResults } from './CompoundComparisonResults';
import { createInitialState, type LabState } from './state';
import { ComparisonResults } from './ComparisonResults';

function renderResults(state: LabState) {
  const results = state.setups.map((setup, index) => evaluate(setup, state.profiles[index].values, state.angles[index]));
  return renderToStaticMarkup(<ComparisonResults state={state} results={results} />);
}

test('the primary comparison withholds a point difference when the same progress produces different angles', () => {
  const state = createInitialState();
  state.setups[1] = { ...state.setups[0], range: [60, 180] };
  state.angles = [140, 150];
  state.sync = 'progress';
  const html = renderResults(state);
  expect(html).toContain('A and B are at different positions');
  expect(html).not.toContain('more resistance at');
  expect(html).toContain('Average resistance');
});

test('an unknown attachment force leaves the position and average unavailable while the other side has results', () => {
  const state = createInitialState();
  const cable = structuredClone(presets.find(preset => preset.preset === 'classic')!);
  state.setups = [cable, { ...cable, forceKnown: false }];
  state.angles = [160, 160];
  const html = renderResults(state);
  expect(html).toContain('Resistance is unavailable for B');
  expect(html).toContain('Load unknown');
  expect(html).toContain('Unavailable');
  expect(html).not.toContain('have the same resistance');
});

test('signed torque distinguishes assistance from resistance in a cross-zero comparison', () => {
  const state = createInitialState();
  const results = state.setups.map((setup, index) => evaluate(setup, state.profiles[index].values, state.angles[index]));
  const html = renderToStaticMarkup(<ComparisonResults state={state} results={[
    { ...results[0], moment: -5, status: 'assists' },
    { ...results[1], moment: 2, status: 'resists' },
  ]} />);
  expect(html).toContain('B resists while A assists');
  expect(html).toContain('7 N·m');
  expect(html).toContain('−5 N·m');
});

test('work against a compound load integrates signed resistance and preserves missing portions of a path', () => {
  const state = initialCompound([defaultProfile, defaultProfile]);
  const results = state.configs.map((config, index) => evaluateCompound(config, state.profiles[index], state.positions[index]));
  const curve: ReturnType<typeof compoundCurve> = [
    { progress: 0, value: 20, status: 'resists' },
    { progress: .5, value: 40, status: 'resists' },
    { progress: 1, value: 20, status: 'resists' },
  ];
  const withGap: typeof curve = [curve[0], { ...curve[1], value: null, status: 'invalid' }, curve[2]];
  const html = renderToStaticMarkup(<CompoundComparisonResults state={state} results={results} curves={[curve, withGap]} />);
  expect(html).toContain('+30 J</td><td>Unavailable</td>');
});
