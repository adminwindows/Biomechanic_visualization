import { useMemo } from 'react';
import { regionSummary, type RegionSummary } from './analysis';
import { actualForce, compatible, getDefinition, loadedCount, type Evaluation, type Setup, type Status } from './engine';
import type { LabState } from './state';
import { describeResistanceDifference, formatPosition, formatSigned, numberText } from './resistanceText';
import './ComparisonResults.css';

type Props = { state: LabState; results: readonly Evaluation[] };

const sides = [0, 1] as const;
const statusText: Record<Status, string> = {
  resists: 'Resists', assists: 'Assists', 'near-zero': 'Near zero', 'no-force': 'No force',
  slack: 'Slack cable', singular: 'Cable direction undefined', invalid: 'Position unavailable',
  contact: 'Equipment contact', unknown: 'Load unknown',
};

function loadLabel(setup: Setup) {
  const force = actualForce(setup);
  if (force === null) return 'Unknown';
  if (setup.resistance === 'dumbbell') {
    const shared = setup.freeWeightKind === 'barbell' || setup.freeWeightKind === 'shared';
    return numberText(setup.loadMass!) + (shared ? ' kg total' : ' kg per loaded side');
  }
  return setup.cables + ' × ' + numberText(force) + ' N';
}

function pointDifference(state: LabState, results: readonly Evaluation[]) {
  const [a, b] = results;
  const definition = getDefinition(state.setups[0]);
  if (!compatible(...state.setups)) return 'The exercises use different resistance measures. Choose a compatible B for a numerical comparison.';
  if (Math.abs(state.angles[0] - state.angles[1]) > 1e-7) {
    return 'A and B are at different positions. Match their positions to compare resistance here.';
  }
  const position = formatPosition(state.angles[0], definition.angleUnit);
  return describeResistanceDifference(a.moment, b.moment, definition.unit, position);
}

function gapLabel(summary: RegionSummary, coordinateUnit: string) {
  const gap = summary.samples.find(point => point.moment === null);
  if (!gap) return 'Incomplete range';
  return statusText[gap.status] + ' at ' + formatPosition(gap.angle, coordinateUnit);
}

export function ComparisonResults({ state, results }: Props) {
  const [a, b] = state.setups;
  const definitions = state.setups.map(getDefinition);
  const sameMeasure = compatible(a, b);
  const samePosition = sameMeasure && Math.abs(state.angles[0] - state.angles[1]) <= 1e-7;
  const lower = Math.max(a.range[0], b.range[0], state.region?.[0] ?? -Infinity);
  const upper = Math.min(a.range[1], b.range[1], state.region?.[1] ?? Infinity);
  // Both means must cover precisely the same interval. Never bridge a contact or unknown-force gap.
  const summaries = useMemo(() => {
    if (!sameMeasure || upper <= lower) return null;
    return sides.map(i => regionSummary(state.setups[i], state.profiles[i].values, [lower, upper]));
  }, [state.setups, state.profiles, sameMeasure, lower, upper]);
  const coordinateUnit = definitions[0].angleUnit ?? '°';
  const forces = state.setups.map(actualForce);
  const attachments = state.setups.map(setup => setup.resistance === 'dumbbell' ? loadedCount(setup) : setup.cables);
  const differentLoads = forces[0] !== null && forces[1] !== null &&
    (Math.abs(forces[0] - forces[1]) > 1e-6 || attachments[0] !== attachments[1]);
  const metric = definitions[0].unit === 'N' ? 'External force' : 'External torque';
  const rangeLabel = summaries
    ? numberText(lower) + '–' + formatPosition(upper, coordinateUnit)
    : sameMeasure ? 'No shared interval' : 'Different measures';

  return <section className="comparison-results" aria-label="Resistance comparison">
    <h2>Resistance comparison</h2>
    <p className="comparison-results__finding">{pointDifference(state, results)}</p>
    <table>
      <thead><tr><th scope="col">Measure</th><th scope="col">A</th><th scope="col">B</th></tr></thead>
      <tbody>
        <tr><th scope="row">{sameMeasure ? metric : 'At this position'}<small>{samePosition
          ? definitions[0].angleLabel + ' · ' + formatPosition(state.angles[0], coordinateUnit)
          : 'Current position'}</small></th>
          {sides.map(i => <td key={i}><strong>{formatSigned(results[i].moment, definitions[i].unit)}</strong>
            <small>{statusText[results[i].status]}{!samePosition && ' at ' + formatPosition(state.angles[i], definitions[i].angleUnit)}</small></td>)}
        </tr>
        <tr><th scope="row">Average resistance<small>{rangeLabel}</small></th>
          {sides.map(i => <td key={i}>{formatSigned(summaries?.[i].mean ?? null, definitions[i].unit)}
            {summaries && !summaries[i].complete && <small>{gapLabel(summaries[i], coordinateUnit)}</small>}</td>)}
        </tr>
        <tr><th scope="row">Applied load{differentLoads && <small>Loads differ between A and B</small>}</th>{sides.map(i => <td key={i}>{loadLabel(state.setups[i])}</td>)}</tr>
      </tbody>
    </table>
    {sameMeasure && <p className="comparison-results__key">{definitions[0].action}. Positive values resist this movement. Negative values assist it.</p>}
  </section>;
}
