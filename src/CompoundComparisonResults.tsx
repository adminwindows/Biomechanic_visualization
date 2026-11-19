import { summarizeSamples } from './analysis';
import { type CompoundConfig, type CompoundResult, type compoundCurve } from './compoundEngine';
import type { CompoundSnapshot } from './compoundState';
import { compoundPairFits } from './exercisePairs';
import { describeResistanceDifference, formatSigned, numberText } from './resistanceText';
import './ComparisonResults.css';

type Path = ReturnType<typeof compoundCurve>;
type Props = { state: CompoundSnapshot; results: readonly CompoundResult[]; curves: readonly Path[] };
const sides = [0, 1] as const;
const pathUnit = 'J/unit progress';

function workOverPath(curve: Path) {
  // The area under resistance versus 0–1 progress is work against the load.
  const samples = curve.map(point => ({
    angle: point.progress, moment: point.value,
    status: point.status === 'geometry' ? 'unknown' as const : point.status,
  }));
  const externalWork = summarizeSamples(samples, [0, 1], [0, 1], 1).externalWork;
  return externalWork === null ? null : -externalWork;
}

function appliedLoad(config: CompoundConfig, result: CompoundResult) {
  switch (config.resistance) {
    case 'gravity': return numberText(config.loadMass) + ' kg total';
    case 'cable': {
      const cables = result.pose.loads.filter(load => load.kind === 'cable').length;
      return (cables ? cables + ' × ' : '') + numberText(config.tension) + ' N';
    }
    case 'bodyweight': return config.bodyGravity ? 'Body weight' : 'No added load';
    case 'unknown': return 'Unknown';
  }
}

export function CompoundComparisonResults({ state, results, curves }: Props) {
  const positions = state.positions.map(p => numberText(p * 100) + '%');
  const samePosition = Math.abs(state.positions[0] - state.positions[1]) <= 1e-7;
  const sameMovement = compoundPairFits(...state.configs);
  let finding = 'Choose compatible variations to compare the resistance along these movements.';
  if (sameMovement) {
    finding = samePosition
      ? describeResistanceDifference(results[0].pathResistance, results[1].pathResistance, pathUnit, positions[0] + ' of each path')
      : 'A and B are at different points in the rep. Match their progress to compare resistance here.';
  }
  return <section className="comparison-results" aria-label="Compound resistance comparison">
    <h2>Resistance comparison</h2>
    <p className="comparison-results__finding">{finding}</p>
    <table>
      <thead><tr><th scope="col">Measure</th><th scope="col">A</th><th scope="col">B</th></tr></thead>
      <tbody>
        <tr><th scope="row">Resistance along the path<small>J per unit of rep progress</small></th>
          {sides.map(i => <td key={i}><strong>{formatSigned(results[i].pathResistance, '')}</strong><small>At {positions[i]} of the rep</small></td>)}
        </tr>
        <tr><th scope="row">Net work against load<small>Across the 0–100% path</small></th>
          {sides.map(i => <td key={i}>{formatSigned(workOverPath(curves[i]), 'J')}</td>)}
        </tr>
        <tr><th scope="row">Applied load</th>{sides.map(i => <td key={i}>{appliedLoad(state.configs[i], results[i])}
          {state.configs[i].assistance > 0 && results[i].pose.loads.some(load => load.kind === 'assistance') && <small>{numberText(state.configs[i].assistance)} N assistance</small>}</td>)}</tr>
      </tbody>
    </table>
    <p className="comparison-results__key">Each exercise follows its own path. Positive values oppose that movement. Work is estimated from the full sampled curve.</p>
  </section>;
}
