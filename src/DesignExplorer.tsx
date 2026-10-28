import { useEffect, useMemo, useRef, useState } from 'react';
import { getDefinition } from './engine';
import { regionSummary } from './analysis';
import { forceValue, type LabState } from './state';
import { ResearchNotebook } from './ResearchNotebook';
import { candidateComparison, evaluateCandidate, explorerCoordinates, explorerGrid, outletHeight, paretoCandidates, prescribedPower, representativeCandidates, type ExplorerCandidate, type ExplorerConfig, type ExplorerObjective, type UncertainDimension } from './designExplorer';
import './design-explorer.css';

type Props = { state: LabState; onApply: (next: LabState) => void; onResearchRestore?: (source: 'compound' | 'machine') => void };
const dimensions: Record<UncertainDimension, string> = { upperArm: 'Upper-arm length', forearm: 'Forearm length', torso: 'Torso length', thigh: 'Thigh length', shank: 'Shank length', hipX: 'Pelvis distance', pulleyHeight: 'Pulley height', backWidth: 'Backrest width' };
const objectives: Record<ExplorerObjective, string> = { mean: 'Higher mean resistance', minimum: 'Higher minimum resistance', evenness: 'More even resistance' };
function targetRegion(state: LabState, side: 0 | 1): [number, number] {
  const range = state.setups[side].range;
  if (!state.region) return [...range];
  const low = Math.max(range[0], state.region[0]), high = Math.min(range[1], state.region[1]);
  return low < high ? [low, high] : [...range];
}
function defaults(state: LabState, side: 0 | 1): ExplorerConfig {
  const setup = state.setups[side];
  return { distance: [Math.max(-5, setup.hipX - .3), Math.min(5, setup.hipX + .3)], height: [Math.max(.01, outletHeight(setup) - .4), Math.min(5, outletHeight(setup) + .4)], steps: 7, region: targetRegion(state, side), objective: 'mean', requireClear: true, avoidAssistance: true, minimumMean: 0, uncertainty: { dimension: 'upperArm', lower: .02, upper: .02 }, requireRobust: false };
}
function Numeric({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Number(value.toFixed(5)))), [value]);
  return <label>{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => { const parsed = Number(draft); if (draft.trim() && Number.isFinite(parsed)) onChange(Math.max(min, Math.min(max, parsed))); else setDraft(String(value)); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></label>;
}
const fmt = (value: number | null | undefined, unit = '') => value === null || value === undefined ? 'Unavailable' : `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;

export function DesignExplorer({ state, onApply, onResearchRestore }: Props) {
  const [side, setSide] = useState<0 | 1>(0);
  const [config, setConfig] = useState(() => defaults(state, 0));
  const [speed, setSpeed] = useState(30);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [candidates, setCandidates] = useState<ExplorerCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [run, setRun] = useState<{ state: LabState; side: 0 | 1; config: ExplorerConfig; signature: string } | null>(null);
  const [notice, setNotice] = useState('');
  const token = useRef(0);
  useEffect(() => () => { token.current++; }, []);
  const source = state.setups[side], profile = state.profiles[side].values;
  const definition = getDefinition(source), coordinates = explorerCoordinates(source);
  const region = targetRegion(state, side);
  const activeConfig: ExplorerConfig = { ...config, region };
  const signature = JSON.stringify([source, state.profiles[side], activeConfig]);
  const stale = !!run && run.signature !== signature;
  const supported = (source.resistance ?? 'cable') === 'cable' && source.model !== 'machine' && forceValue(source) !== null;
  const baselineKey = JSON.stringify([source, profile, region]);
  const baseline = useMemo(() => regionSummary(source, profile, region), [baselineKey]);
  const frontier = useMemo(() => paretoCandidates(candidates), [candidates]);
  const representatives = useMemo(() => representativeCandidates(frontier), [frontier]);
  const selected = candidates.find(candidate => candidate.id === selectedId) ?? null;
  const resultCoordinates = run ? explorerCoordinates(run.state.setups[run.side]) : coordinates;
  const power = prescribedPower(!stale && selected ? selected.metrics : baseline, region, speed, coordinates.scale);
  const finiteScores = candidates.filter(candidate => candidate.feasible && candidate.score !== null).map(candidate => candidate.score!);
  const scoreLow = Math.min(...finiteScores), scoreHigh = Math.max(...finiteScores);
  function change<K extends keyof ExplorerConfig>(key: K, value: ExplorerConfig[K]) { setConfig(previous => ({ ...previous, [key]: value })); }
  async function search() {
    const id = ++token.current;
    try {
      const grid = explorerGrid(activeConfig);
      const snapshot = structuredClone(state), settings = structuredClone(activeConfig), sourceSide = side;
      setBusy(true); setNotice(''); setCompleted(0); setCandidates([]); setSelectedId(null);
      setRun({ state: snapshot, config: settings, side: sourceSide, signature });
      const output: ExplorerCandidate[] = [];
      for (const point of grid) {
        if (token.current !== id) return;
        output.push(evaluateCandidate(snapshot.setups[sourceSide], snapshot.profiles[sourceSide].values, settings, point));
        setCompleted(output.length);
        if (output.length % 3 === 0 || output.length === grid.length) setCandidates([...output]);
        // Yield between candidates so dragging, cancellation and phone scrolling remain responsive.
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      if (token.current !== id) return;
      const best = paretoCandidates(output)[0] ?? output.find(candidate => candidate.feasible);
      setSelectedId(best?.id ?? output[0]?.id ?? null);
      setNotice(`${output.filter(candidate => candidate.feasible).length} of ${output.length} sampled placements satisfy the selected checks.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The search could not be calculated.');
    } finally { if (token.current === id) setBusy(false); }
  }
  function cancel() { token.current++; setBusy(false); setNotice('Search stopped. The completed cells remain available; this is an incomplete map.'); }
  function apply(candidate: ExplorerCandidate) {
    if (!run || stale) return;
    onApply(candidateComparison(run.state, run.side, candidate, run.config));
    setNotice('Baseline and candidate loaded with the same body, force and original movement range. Compare their geometry and constraints before drawing a training conclusion.');
  }
  function exportMap() {
    if (!run) return;
    const blob = new Blob([JSON.stringify({ type: 'biomechanics-placement-exploration', version: 1, exportedAt: new Date().toISOString(), modelVersion: run.state.modelVersion, source: run.state, sourceSide: run.side, settings: run.config, complete: candidates.length === run.config.steps ** 2, candidates, note: 'Finite grid and sampled uncertainty scenarios; not a global optimum, confidence interval, muscle-force or hypertrophy estimate.' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'biomechanics-placement-exploration.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="design-explorer" aria-label="Design exploration and research">
    <details className="design-drawer" id="design-explorer">
      <summary><strong>Explore equipment placements</strong><span>Map, constrained search, uncertainty and prescribed-speed power</span></summary>
      <div className="design-content">
        <p>Choose a mechanical objective, then compare several placements. The search varies pulley height and signed pelvis X position only. It keeps the selected body, actual force, force convention, posture and original movement range fixed. With explicit outlets, height shifts all outlets together while preserving their relative positions.</p>
        <fieldset disabled={busy} className="design-controls">
          <label>Search configuration<select aria-label="Search configuration" value={side} onChange={event => { const next = Number(event.target.value) as 0 | 1; setSide(next); setConfig(defaults(state, next)); }}><option value={0}>A</option><option value={1}>B</option></select></label>
          <label>Search objective<select aria-label="Search objective" value={config.objective} onChange={event => change('objective', event.target.value as ExplorerObjective)}>{Object.entries(objectives).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <Numeric label="Minimum pelvis distance (cm)" value={config.distance[0] * 100} min={-500} max={499} onChange={value => change('distance', [value / 100, config.distance[1]])}/>
          <Numeric label="Maximum pelvis distance (cm)" value={config.distance[1] * 100} min={-499} max={500} onChange={value => change('distance', [config.distance[0], value / 100])}/>
          <Numeric label="Minimum pulley height (cm)" value={config.height[0] * 100} min={1} max={499} onChange={value => change('height', [value / 100, config.height[1]])}/>
          <Numeric label="Maximum pulley height (cm)" value={config.height[1] * 100} min={2} max={500} onChange={value => change('height', [config.height[0], value / 100])}/>
          <label>Map resolution<select aria-label="Map resolution" value={config.steps} onChange={event => change('steps', Number(event.target.value))}><option value={5}>5 × 5 · quick</option><option value={7}>7 × 7</option><option value={9}>9 × 9</option><option value={13}>13 × 13 · finer</option></select></label>
          <Numeric label={`Minimum mean resistance (${coordinates.unit})`} value={config.minimumMean} min={0} max={5000} step={.1} onChange={value => change('minimumMean', value)}/>
          <label className="design-check"><input type="checkbox" checked={config.requireClear} onChange={event => change('requireClear', event.target.checked)}/>Require clear represented geometry throughout original ROM</label>
          <label className="design-check"><input type="checkbox" checked={config.avoidAssistance} onChange={event => change('avoidAssistance', event.target.checked)}/>Reject assistance detected throughout original ROM</label>
        </fieldset>
        <p className="design-method">Fixed actual force: {fmt(forceValue(source), 'N per attachment')}. Original movement: {source.range.join('–')}{coordinates.coordinateUnit}. Objective region: {region.join('–')}{coordinates.coordinateUnit}, from your selected analysis region. Search cannot improve its score by adding load or shortening this range. “Even” means a smaller maximum–minimum spread; it does not imply a better training stimulus.</p>
        <fieldset disabled={busy} className="design-controls">
          <legend>Measurement uncertainty scenarios</legend>
          <label>Uncertain measurement<select aria-label="Uncertain measurement" value={config.uncertainty.dimension} onChange={event => change('uncertainty', { ...config.uncertainty, dimension: event.target.value as UncertainDimension })}>{Object.entries(dimensions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <Numeric label="Plausible lower offset (cm)" value={config.uncertainty.lower * 100} min={0} max={30} step={.1} onChange={value => change('uncertainty', { ...config.uncertainty, lower: value / 100 })}/>
          <Numeric label="Plausible upper offset (cm)" value={config.uncertainty.upper * 100} min={0} max={30} step={.1} onChange={value => change('uncertainty', { ...config.uncertainty, upper: value / 100 })}/>
          <label className="design-check"><input type="checkbox" checked={config.requireRobust} onChange={event => change('requireRobust', event.target.checked)}/>Require constraints in every sampled measurement scenario</label>
        </fieldset>
        <p className="design-method">These are your plausible offsets, not measured confidence intervals. The baseline and up to five evenly spaced measurement scenarios are checked; an asymmetric interval can give six scenarios, while a zero-width interval checks only the baseline. Intermediate unsampled values may behave differently. Robust search uses the worst sampled objective, with body uncertainty varied only for this sensitivity check.</p>
        {!supported && <p className="design-message">Choose a defined cable model with a known actual force. Unknown mechanisms and dumbbell placements cannot produce a meaningful pulley map.</p>}
        <div className="design-actions"><button onClick={() => void search()} disabled={busy || !supported}>Calculate placement map</button>{busy && <button onClick={cancel}>Stop search</button>}{run && <button onClick={exportMap} disabled={busy}>Export map and assumptions</button>}</div>
        {busy && <progress aria-label="Placement search progress" max={config.steps ** 2} value={completed}/>}
        {notice && <p role="status" className="design-message">{notice}</p>}
        {stale && <p className="design-message">The inputs have changed since this map was calculated. Run it again before applying a candidate.</p>}
        {run && candidates.length > 0 && <>
          <h3>Pulley height × pelvis distance</h3><p className="design-method">Each square is an evaluated placement. Darker teal scores higher for your objective; × fails a selected check. Select a cell to inspect its trade-offs; scroll the map sideways when needed. This finite grid does not establish a global optimum.</p>
          <div className="design-map-shell"><span className="design-map-axis">Pulley height: {(run.config.height[1] * 100).toFixed(0)} → {(run.config.height[0] * 100).toFixed(0)} cm</span><div className="design-map" role="group" aria-label="Placement map" style={{ gridTemplateColumns: `repeat(${run.config.steps}, minmax(44px, 1fr))` }}>{candidates.map(candidate => {
            const intensity = candidate.feasible ? scoreHigh > scoreLow ? (candidate.score! - scoreLow) / (scoreHigh - scoreLow) : .5 : 0;
            return <button key={candidate.id} className={`${candidate.feasible ? 'feasible' : 'excluded'} ${candidate.id === selectedId ? 'selected' : ''}`} style={candidate.feasible ? { background: `hsl(174 55% ${89 - intensity * 58}%)`, color: intensity > .55 ? 'white' : '#163e3c' } : undefined} aria-label={`Distance ${(candidate.hipX * 100).toFixed(1)} cm, pulley ${(candidate.pulleyHeight * 100).toFixed(1)} cm: ${candidate.feasible ? fmt(candidate.metrics.mean, resultCoordinates.unit) : candidate.reasons.join('; ')}`} aria-pressed={candidate.id === selectedId} title={`${candidate.feasible ? 'Eligible' : 'Excluded'} · mean ${fmt(candidate.metrics.mean, resultCoordinates.unit)}`} onClick={() => setSelectedId(candidate.id)}>{candidate.feasible ? '·' : '×'}</button>;
          })}</div><span className="design-map-axis">Pelvis X position: {(run.config.distance[0] * 100).toFixed(0)} → {(run.config.distance[1] * 100).toFixed(0)} cm</span></div>
          {selected && <article className="design-selection"><h3>Selected placement · {(selected.pulleyHeight * 100).toFixed(1)} cm high, {(selected.hipX * 100).toFixed(1)} cm distant</h3><p>Minimum / mean / maximum resistance: {fmt(selected.metrics.minimum, resultCoordinates.unit)} / {fmt(selected.metrics.mean, resultCoordinates.unit)} / {fmt(selected.metrics.maximum, resultCoordinates.unit)}.</p><p>Sampled mean envelope: {selected.envelope ? `${fmt(selected.envelope[0], resultCoordinates.unit)} to ${fmt(selected.envelope[1], resultCoordinates.unit)}` : 'Unavailable in at least one scenario'}. {selected.validScenarios}/{selected.scenarioCount} measurement scenarios satisfy all checks.</p>{selected.reasons.length > 0 && <ul>{selected.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}<button disabled={!selected.feasible || stale || busy} onClick={() => apply(selected)}>Compare selected placement with baseline</button></article>}
          <h3>Trade-off candidates</h3><p className="design-method">{frontier.length} non-dominated sampled placements trade the chosen objective against distance moved from the original equipment placement and the mean-resistance sensitivity spread. Shown below are up to six representatives, not a ranking of exercises.</p>
          <div className="design-table-wrap" tabIndex={0} role="region" aria-label="Scrollable placement tradeoffs"><table><thead><tr><th>Height / distance</th><th>Mean / minimum</th><th>Measurement envelope</th><th>Placement change</th><th>Inspect</th></tr></thead><tbody>{representatives.map(candidate => <tr key={candidate.id}><td>{(candidate.pulleyHeight * 100).toFixed(0)} / {(candidate.hipX * 100).toFixed(0)} cm</td><td>{fmt(candidate.metrics.mean)} / {fmt(candidate.metrics.minimum)} {resultCoordinates.unit}</td><td>{candidate.envelope?.map(value => value.toFixed(1)).join('–')} {resultCoordinates.unit}</td><td>{(candidate.movement * 100).toFixed(1)} cm</td><td><button onClick={() => setSelectedId(candidate.id)}>Inspect candidate {candidate.id + 1}</button></td></tr>)}</tbody></table></div>
          {!representatives.length && <p>No candidate has both a feasible baseline and a fully computable measurement envelope. Inspect excluded cells or revise the explicit constraints.</p>}
        </>}
        <details className="design-power"><summary>Power at a prescribed movement speed</summary><Numeric label={`Prescribed speed (${coordinates.coordinateUnit}/s)`} value={speed} min={.1} max={180} step={1} onChange={setSpeed}/><p>Reference action: {definition.action}. {!stale && selected ? 'Selected candidate' : 'Current baseline'} over {region.join('–')}{coordinates.coordinateUnit}.</p>{power ? <p>Duration {fmt(power.duration, 's')}; mean external-load power {fmt(power.mean, 'W')}; sampled range {fmt(power.minimum, 'W')} to {fmt(power.maximum, 'W')}.</p> : <p>Power is unavailable across an unknown or invalid interval.</p>}<p className="design-method">The chosen constant speed supplies the missing velocity. Signed external-load power is negative when the load resists the reference action. This quasi-static estimate excludes inertia and does not estimate muscle power, calories or hypertrophy.</p></details>
        <p className="design-method">Clearance uses the represented contact and support model. Assistance checks sample every 0.5 coordinate units plus contact event points; this is not a proof of sign between samples. Geometry and load assumptions remain those of the comparison. Official methods references: <a href="https://openstax.org/books/university-physics-volume-1/pages/10-8-work-and-power-for-rotational-motion" target="_blank" rel="noreferrer">OpenStax work and power</a> and <a href="https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089619" target="_blank" rel="noreferrer">OpenSim force-estimation assumptions</a>.</p>
      </div>
    </details>
    <ResearchNotebook state={state} onApply={onApply} onResearchRestore={onResearchRestore}/>
  </section>;
}
