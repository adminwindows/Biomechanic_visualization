import { useEffect, useMemo, useRef, useState } from 'react';
import type { Profile, Vec3 } from './engine';
import { Field } from './Field';
import { CompoundOrbit } from './compoundOrbit';
import { compoundCurve, compoundGeometry, compoundPresets, createCompoundConfig, evaluateCompound, getCompoundPreset, representedBodyMass, type CompoundConfig } from './compoundEngine';
import { COMPOUND_KEY, COMPOUND_LIBRARY_KEY, parseCompoundLibrary, type CompoundLibraryEntry, compoundBounds, initialCompound, parseCompound, switchCompoundExercise, type CompoundSnapshot } from './compoundState';
import './compound.css';

type Props = { profiles: [Profile, Profile]; selection?: { preset: string; side: 0 | 1; nonce: number } };
const directions: Record<string, string> = { pullover: 'Bring arms toward torso while changing elbow flexion', pulldown: 'Pull handles down', row: 'Pull handles toward torso', press: 'Press handles away', pullup: 'Raise the body toward fixed hands', dip: 'Raise the body between fixed hands', pushup: 'Press the body away from the floor', hinge: 'Lower torso into the hinge', 'back-extension': 'Lower torso over the hip pad', bridge: 'Raise the pelvis', squat: 'Lower into the squat', lunge: 'Lower between planted feet', 'step-up': 'Raise the body onto the step', 'calf-standing': 'Raise heels', 'calf-seated': 'Raise heels while seated', 'leg-press': 'Extend legs along the sled path', crunch: 'Flex the trunk toward the pelvis', woodchop: 'Move hands through the diagonal arc', pallof: 'Extend hands forward while holding torso fixed', sidebend: 'Move from the left-bent to right-bent pose', nordic: 'Lower the body about the supported knees' };

function PathChart({ data, extent, shared, progress, label }: { data: ReturnType<typeof compoundCurve>; extent: number; shared: boolean; progress: number; label: string }) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(480);
  useEffect(() => { const svg = chartRef.current; if (!svg) return; const resize = () => setWidth(Math.max(260, svg.getBoundingClientRect().width)); resize(); const observer = new ResizeObserver(resize); observer.observe(svg); return () => observer.disconnect(); }, []);
  const max = extent;
  const color = label === 'A' ? '#007c78' : '#c96b28';
  const x = (p: number) => 40 + p * (width - 58), y = (v: number) => 90 - v / max * 58;
  let active = false;
  const path = data.map(point => { if (point.value === null) { active = false; return ''; } const command = active ? 'L' : 'M'; active = true; return `${command}${x(point.progress)},${y(point.value)}`; }).join(' ');
  return <svg ref={chartRef} className="compound-curve" data-y-extent={max} data-shared-scale={shared} viewBox={`0 0 ${width} 180`} style={{height:180,padding:0}} role="img" aria-label={`${label} external path resistance in joules per unit progress`}>
    <title>External contribution along this path · J per unit progress</title><rect x="40" y="30" width={width - 58} height="60" fill="#edf4e9"/><rect x="40" y="90" width={width - 58} height="60" fill="#faf2e8"/>
    {[-1, 0, 1].map(f => <g key={f}><line x1="40" x2={width - 18} y1={y(f * max)} y2={y(f * max)} stroke="#cbd7c9" strokeDasharray={f ? '3 4' : undefined}/><text x="34" y={y(f * max) + 4} textAnchor="end" fontSize="11" fill="#6b8072">{Math.round(f * max)}</text></g>)}
    {[0, .25, .5, .75, 1].map(p => <text key={p} x={x(p)} y="166" textAnchor="middle" fontSize="11" fill="#6b8072">{p * 100}%</text>)}
    <path d={path} fill="none" stroke={color} strokeWidth="2.4"/><line x1={x(progress)} x2={x(progress)} y1="30" y2="150" stroke={color} strokeDasharray="3 4"/>
    <text x="40" y="17" fontSize="11" fill="#536d5e">Path resistance · J / unit progress</text>
    {!data.some(p => p.value !== null) && <text x={width / 2} y="82" textAnchor="middle" fontSize="12" fill="#7c7160">No calculated profile</text>}
  </svg>;
}

export function CompoundLab({ profiles, selection }: Props) {
  const loadError = useRef('');
  const recovery = useRef<Record<string, string>>({});
  const [state, setState] = useState<CompoundSnapshot>(() => {
    let text: string | null = null;
    try { text = localStorage.getItem(COMPOUND_KEY); return text ? parseCompound(text) : initialCompound(profiles); }
    catch (error) { if (text !== null) recovery.current[COMPOUND_KEY] = text; loadError.current = `Saved workspace could not be read. The original is preserved: ${error instanceof Error ? error.message : 'unknown error'}`; return initialCompound(profiles); }
  });
  const [library, setLibrary] = useState<CompoundLibraryEntry[]>(() => {
    let text: string | null = null;
    try { text = localStorage.getItem(COMPOUND_LIBRARY_KEY); return parseCompoundLibrary(text ?? '[]'); }
    catch (error) { if (text !== null) recovery.current[COMPOUND_LIBRARY_KEY] = text; loadError.current += ` Saved library could not be read; its original is preserved. ${error instanceof Error ? error.message : ''}`; return []; }
  });
  const stateRef = useRef(state); stateRef.current = state;
  const libraryRef = useRef(library); libraryRef.current = library;
  const history = useRef<{ past: CompoundSnapshot[]; future: CompoundSnapshot[] }>({ past: [], future: [] });
  const [, setRevision] = useState(0);
  const [notice, setNotice] = useState(loadError.current), [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fileRef = useRef<HTMLInputElement>(null), libraryFileRef = useRef<HTMLInputElement>(null), lastSelection = useRef<number | undefined>(undefined);
  const persistState = (next: CompoundSnapshot) => {
    stateRef.current = next; setState(next);
    if (COMPOUND_KEY in recovery.current) return;
    try { localStorage.setItem(COMPOUND_KEY, JSON.stringify(next)); } catch { setNotice('This browser could not save the compound workspace. Export a file to keep it.'); }
  };
  const apply = (change: (next: CompoundSnapshot) => void, record = true) => {
    const previous = stateRef.current, next = structuredClone(previous); change(next);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    if (JSON.stringify(previous.configs) === JSON.stringify(next.configs)) next.configs = previous.configs;
    if (JSON.stringify(previous.profiles) === JSON.stringify(next.profiles)) next.profiles = previous.profiles;
    if (record) { history.current.past.push(structuredClone(previous)); history.current.past = history.current.past.slice(-80); history.current.future = []; setRevision(value => value + 1); }
    persistState(next);
  };
  const undo = (redo = false) => {
    const source = redo ? history.current.future : history.current.past, target = redo ? history.current.past : history.current.future;
    const next = source.pop(); if (!next) return; target.push(structuredClone(stateRef.current)); persistState(next); setPlaying(false); setRevision(value => value + 1);
  };
  useEffect(() => {
    const flush = (event: Event) => {
      try {
        if (Object.keys(recovery.current).length) throw new Error('The unreadable compound originals are protected; back them up before replacing them.');
        localStorage.setItem(COMPOUND_KEY, JSON.stringify(stateRef.current));
        localStorage.setItem(COMPOUND_LIBRARY_KEY, JSON.stringify(libraryRef.current));
      } catch (error) {
        const message = `Compound workspace: ${error instanceof Error ? error.message : 'current edits could not be saved.'}`;
        (event as CustomEvent<{ errors: string[] }>).detail?.errors.push(message);
        setNotice(message);
      }
    };
    window.addEventListener('biomechanics:flush-workspaces', flush);
    return () => window.removeEventListener('biomechanics:flush-workspaces', flush);
  }, []);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const changed = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); }; media.addEventListener('change', changed); return () => media.removeEventListener('change', changed); }, []);
  useEffect(() => { if (stateRef.current.useMainProfiles && JSON.stringify(stateRef.current.profiles) !== JSON.stringify(profiles)) apply(next => { next.profiles = structuredClone(profiles); }); }, [profiles]);
  useEffect(() => {
    if (!selection || lastSelection.current === selection.nonce) return;
    lastSelection.current = selection.nonce;
    apply(next => switchCompoundExercise(next, selection.side, selection.preset));
  }, [selection?.nonce]);
  useEffect(() => {
    const restore = (event: Event) => {
      if (event instanceof StorageEvent && event.key && ![COMPOUND_KEY, COMPOUND_LIBRARY_KEY].includes(event.key)) return;
      const raw: Record<string, string | null> = {};
      try {
        raw[COMPOUND_LIBRARY_KEY] = localStorage.getItem(COMPOUND_LIBRARY_KEY); raw[COMPOUND_KEY] = localStorage.getItem(COMPOUND_KEY);
        const savedLibrary = parseCompoundLibrary(raw[COMPOUND_LIBRARY_KEY] ?? '[]');
        const next = raw[COMPOUND_KEY] ? parseCompound(raw[COMPOUND_KEY]!) : initialCompound(profiles);
        libraryRef.current = savedLibrary; setLibrary(savedLibrary); stateRef.current = next; setState(next); setPlaying(false); history.current = { past: [], future: [] }; recovery.current = {}; setRevision(value => value + 1);
      } catch (error) {
        for (const [key, text] of Object.entries(raw)) if (text !== null) { try { key === COMPOUND_KEY ? parseCompound(text) : parseCompoundLibrary(text); } catch { recovery.current[key] = text; } }
        setNotice(error instanceof Error ? error.message : 'Could not restore compound workspace.'); setRevision(value => value + 1);
      }
    };
    window.addEventListener('biomechanics:workspace-restored', restore); window.addEventListener('storage', restore);
    return () => { window.removeEventListener('biomechanics:workspace-restored', restore); window.removeEventListener('storage', restore); };
  }, []);
  useEffect(() => { if (!playing) return; let id = 0, last = 0, direction = 1; const frame = (time: number) => { if (!last) last = time; const step = Math.min(.04, (time - last) / 12000); last = time; let next = stateRef.current.positions[0] + direction * step; if (next >= 1 || next <= 0) { direction *= -1; next = Math.max(0, Math.min(1, next)); } apply(state => { state.positions[0] = next; if (state.sync) state.positions[1] = next; }, false); id = requestAnimationFrame(frame); }; id = requestAnimationFrame(frame); return () => cancelAnimationFrame(id); }, [playing]);
  const results = state.configs.map((config, i) => evaluateCompound(config, state.profiles[i], state.positions[i]));
  const curves = useMemo(() => state.configs.map((config, i) => compoundCurve(config, state.profiles[i])), [state.configs, state.profiles]);
  const sharedChartScale = getCompoundPreset(state.configs[0]).movement === getCompoundPreset(state.configs[1]).movement;
  const extents = curves.map(data => Math.max(10, ...data.map(point => Math.abs(point.value ?? 0))));
  const chartExtents = sharedChartScale ? [Math.max(...extents), Math.max(...extents)] : extents;
  const bounds = useMemo(() => { const points: Vec3[] = [[-1.2, -1, 0], [1.2, 1, 2.4]]; state.configs.forEach((config, i) => { for (let j = 0; j <= 10; j++) points.push(...Object.values(compoundGeometry(config, state.profiles[i], j / 10).points)); }); return points; }, [state.configs, state.profiles]);
  const groups = [...new Set(compoundPresets.map(p => p.family))];
  const setPosition = (side: 0 | 1, value: number) => { setPlaying(false); apply(next => { next.positions[side] = value; if (next.sync) next.positions[1 - side] = value; }); };
  const saveLibrary = (items: CompoundLibraryEntry[]) => { if (COMPOUND_LIBRARY_KEY in recovery.current) { setNotice('The original unreadable library is protected. Back it up and explicitly replace it before saving new entries.'); return; } libraryRef.current = items; setLibrary(items); try { localStorage.setItem(COMPOUND_LIBRARY_KEY, JSON.stringify(items)); } catch { setNotice('Could not save the named comparison library. Export it before leaving.'); } };
  const download = (text: string, filename: string) => { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const exportFile = () => { const blob = new Blob([JSON.stringify(stateRef.current, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'compound-comparison.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <section className="compound-lab" id="compound-lab" aria-label="Compound movement workbench">
    <header className="compound-heading"><div><p className="eyebrow">LINKED MOVEMENT CHAINS</p><h2>Explore a compound movement.</h2><p>Coordinate shoulders, elbows, hips and knees with explicit loads and supports.</p></div><div className="compound-actions"><button onClick={exportFile}>Export pair</button><button onClick={() => fileRef.current?.click()}>Import pair</button></div></header>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 1_000_000) throw new Error('Comparison file exceeds 1 MB.'); const next = parseCompound(await file.text()); next.useMainProfiles = false; apply(state => { delete state.drafts; Object.assign(state, next); }); setPlaying(false); setNotice('Imported both configurations and their body snapshots.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Invalid comparison.'); } event.target.value = ''; }}/>
    <input ref={libraryFileRef} hidden type="file" accept="application/json,.json" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 5_000_000) throw new Error('Library exceeds 5 MB.'); const imported = parseCompoundLibrary(await file.text()); const merged = [...library]; imported.forEach(entry => { const index = merged.findIndex(item => item.id === entry.id); if (index >= 0) merged.push({ ...entry, id: crypto.randomUUID(), name: `${entry.name.slice(0, 88)} (imported)` }); else merged.push(entry); }); if (merged.length > 100) throw new Error('Library limit is 100 comparisons.'); saveLibrary(merged); setNotice(`Imported ${imported.length} saved compound comparisons.`); } catch (error) { setNotice(error instanceof Error ? error.message : 'Invalid library.'); } event.target.value = ''; }}/>
    {Object.keys(recovery.current).length > 0 && <div className="compound-recovery" role="status"><strong>Original saved data is protected.</strong><p>Edits remain in memory until you preserve the unreadable original and explicitly replace it.</p>{Object.entries(recovery.current).map(([key, raw]) => <div key={key}><span>{key === COMPOUND_KEY ? 'Workspace' : 'Named library'}</span><button onClick={() => download(raw, key === COMPOUND_KEY ? 'compound-workspace-recovery.json' : 'compound-library-recovery.json')}>Download original</button><button onClick={() => { try { const recoveryKey = `${key}.recovery.${Date.now()}`; localStorage.setItem(recoveryKey, raw); localStorage.setItem(key, JSON.stringify(key === COMPOUND_KEY ? stateRef.current : library)); delete recovery.current[key]; setRevision(value => value + 1); setNotice('Original copied to a separate recovery key; the current data is now saved.'); } catch { setNotice('Could not make a recovery copy. The original remains untouched. Download it before clearing browser data.'); } }}>Back up original and use current</button></div>)}</div>}
    {notice && <p className="compound-notice" role="status">{notice}<button aria-label="Dismiss compound notice" onClick={() => setNotice('')}>×</button></p>}
    <div className="compound-toolbar"><label>Comparison <input value={state.name} maxLength={100} aria-label="Compound comparison name" onChange={event => apply(next => { next.name = event.target.value; })}/></label><button disabled={!history.current.past.length} onClick={() => undo()}>Undo compound edit</button><button disabled={!history.current.future.length} onClick={() => undo(true)}>Redo compound edit</button><button onClick={() => apply(next => { next.configs[1] = structuredClone(next.configs[0]); next.profiles[1] = structuredClone(next.profiles[0]); next.positions[1] = next.positions[0]; })}>Copy A → B</button><button onClick={() => apply(next => { next.configs.reverse(); next.profiles.reverse(); next.positions.reverse(); })}>Swap A / B</button></div>
    <details className="compound-library"><summary>Saved compound comparisons · {library.length}</summary><div className="compound-library-actions"><button onClick={() => { if (library.length >= 100) { setNotice('The library is limited to100 comparisons. Export and remove older items first.'); return; } saveLibrary([...library, { id: crypto.randomUUID(), name: state.name.trim() || 'Compound comparison', updatedAt: new Date().toISOString(), snapshot: structuredClone(state) }]); }}>Save named copy</button><button onClick={() => download(JSON.stringify(library, null, 2), 'compound-library.json')}>Export library</button><button onClick={() => libraryFileRef.current?.click()}>Import library</button></div>{library.map(entry => <div className="compound-library-row" key={entry.id}><span><strong>{entry.name}</strong><small>{new Date(entry.updatedAt).toLocaleDateString()}</small></span><button onClick={() => { const snapshot = structuredClone(entry.snapshot); snapshot.useMainProfiles = false; apply(next => { delete next.drafts; Object.assign(next, snapshot); }); setPlaying(false); }}>Load</button><button aria-label={`Delete compound comparison ${entry.name}`} onClick={() => saveLibrary(library.filter(item => item.id !== entry.id))}>Delete</button></div>)}{!library.length && <p>Save configurations, body dimensions, movement positions and assumptions together.</p>}</details>
    <div className="compound-toolbar"><label><input type="checkbox" checked={state.sync} onChange={event => apply(next => { next.sync = event.target.checked; if (next.sync) next.positions[1] = next.positions[0]; })}/>Same progress</label><label><input type="checkbox" checked={state.useMainProfiles} onChange={event => apply(next => { next.useMainProfiles = event.target.checked; if (next.useMainProfiles) next.profiles = structuredClone(profiles); })}/>Use main A/B body profiles</label><span>Shared scale · equal progress does not imply equal joint angles</span></div>
    <div className="compound-camera"><button onClick={() => apply(next => { next.camera = [0, 0]; })}>Side</button><button onClick={() => apply(next => { next.camera = [90, 0]; })}>Front</button><button onClick={() => apply(next => { next.camera = [25, 18]; })}>Orbit</button><label>Yaw <input aria-label="Compound camera yaw" type="range" min="-180" max="180" value={state.camera[0]} onChange={event => apply(next => { next.camera[0] = Number(event.target.value); })}/></label><label>Tilt <input aria-label="Compound camera pitch" type="range" min="-70" max="70" value={state.camera[1]} onChange={event => apply(next => { next.camera[1] = Number(event.target.value); })}/></label></div>
    <div className="compound-grid">{state.configs.map((config, index) => {
      const side = index as 0 | 1, label = side === 0 ? 'A' : 'B', definition = getCompoundPreset(config), result = results[side];
      const change = (patch: Partial<CompoundConfig>) => apply(next => { next.configs[side] = { ...next.configs[side], ...patch }; });
      const numberField = (key: keyof typeof compoundBounds, name: string, unit = '', scale = 1) => <Field key={key} label={`${label} · ${name}`} value={config[key] * scale} min={compoundBounds[key][0] * scale} max={compoundBounds[key][1] * scale} step={unit === 'cm' ? 1 : unit === 'kg' ? .5 : key === 'depth' ? .01 : 1} unit={unit} onChange={value => change({ [key]: value / scale })}/>;
      return <article key={side} className={`compound-card compound-${label.toLowerCase()}`}><div className="compound-card-heading"><span className="letter-badge">{label}</span><select aria-label={`${label} compound exercise`} value={config.preset} onChange={event => apply(next => switchCompoundExercise(next, side, event.target.value))}>{groups.map(group => <optgroup key={group} label={group}>{compoundPresets.filter(p => p.family === group).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}</select></div>
        <CompoundOrbit pose={result.pose} bounds={bounds} camera={state.camera} onCamera={camera => apply(next => { next.camera = camera; }, false)} label={label}/>
        <div className="compound-results"><p className="overline">{definition.mechanics === 'unknown' ? 'GEOMETRIC ILLUSTRATION' : 'EXPERIMENTAL · DECLARED MECHANICS'}</p><div className="compound-value">{result.pathResistance === null ? 'Unavailable' : result.pathResistance.toFixed(1)}{result.pathResistance !== null && <small> J / unit progress</small>}</div><strong>{result.status === 'invalid' ? 'Pose cannot satisfy the entered geometry' : result.status === 'geometry' ? 'Force model unavailable' : result.status === 'near-zero' ? 'Near-zero path contribution' : `${result.status === 'resists' ? 'Resists' : 'Assists'} the 0 → 100% direction`}</strong><p>{directions[definition.movement]}</p></div>
        <div className="compound-position"><Field label={`${label} · Movement progress`} value={state.positions[side] * 100} min={0} max={100} step={.5} unit="%" onChange={value => setPosition(side, value / 100)}/></div>
        <PathChart data={curves[side]} extent={chartExtents[side]} shared={sharedChartScale} progress={state.positions[side]} label={label}/>
        <div className="compound-details"><details><summary>Results, assumptions and joint moments</summary><p>{result.explanation}</p><p>{result.supportStatus}</p>{definition.note && <p>{definition.note}</p>}{result.jointMoments ? <div className="compound-joint-table">{result.jointMoments.map(moment => <div key={moment.label}><span>{moment.label}</span><strong>{moment.value.toFixed(1)} N·m</strong></div>)}</div> : <p>Individual joint moments: unavailable. Complete support reactions and force sharing have not been determined.</p>}<p>Positive path resistance means external forces oppose movement from 0% to 100%. This quantity uses normalized progress and is not a joint torque. {sharedChartScale ? 'Both charts use the same vertical scale for this named movement. The prescribed paths may still differ.' : 'Different movements use separately labeled vertical scales; their normalized progress does not represent the same action.'}</p></details>
          <details open><summary>External load and body weights</summary><div className="compound-fields"><label className="compound-select">Resistance <select aria-label={`${label} compound resistance`} disabled={definition.mechanics === 'unknown'} value={config.resistance} onChange={event => change({ resistance: event.target.value as CompoundConfig['resistance'] })}><option value="cable">Known cable force</option><option value="gravity">Known external mass</option><option value="bodyweight">Body weights only</option><option value="unknown">Unknown mechanism</option></select></label>{config.resistance === 'cable' && <>{numberField('tension', 'Force per active cable', 'N')}{(['X', 'Y', 'Z'] as const).map((axis, i) => <Field key={axis} label={`${label} · Outlet ${axis}`} value={config.outlet[i] * 100} min={i === 2 ? 0 : -400} max={400} unit="cm" onChange={value => { const outlet = [...config.outlet] as Vec3; outlet[i] = value / 100; change({ outlet }); }}/>)}</>}{config.resistance === 'gravity' && <>{numberField('loadMass', 'External load · total', 'kg')}{definition.mechanics !== 'open-arm' && !['leg-press', 'calf-seated'].includes(definition.movement) && <label className="compound-select">Load location <select aria-label={`${label} compound load location`} value={config.loadPosition} onChange={event => change({ loadPosition: event.target.value as CompoundConfig['loadPosition'] })}><option value="hands">Hands</option><option value="shoulders">Shoulders</option><option value="pelvis">Pelvis</option></select></label>}{definition.movement === 'leg-press' && <p>The external mass acts at the sled/footplate point along the declared guide.</p>}{definition.movement === 'calf-seated' && <p>The declared external mass acts at the midpoint between the knees.</p>}<p>For two loaded hands, total external mass is split equally. This is an explicit symmetric load-sharing assumption.</p></>}{['pullup', 'nordic'].includes(definition.movement) && numberField('assistance', 'Upward assistance', 'N')}<label><input type="checkbox" checked={config.bodyGravity} onChange={event => change({ bodyGravity: event.target.checked })}/>Include declared body-segment weights</label><p>Body masses start as fictional examples ({representedBodyMass(config.masses).toFixed(1)} kg represented), not estimates from your height.</p></div></details>
          <details><summary>Pose, supports and movement path</summary><div className="compound-fields">{['pullover', 'pulldown', 'row', 'press', 'pallof', 'crunch', 'back-extension', 'pullup', 'dip', 'calf-seated', 'leg-press'].includes(definition.movement) && numberField('hipHeight', 'Pelvis/seat anchor height', 'cm', 100)}{['pullover', 'pulldown', 'row', 'press', 'squat', 'pullup', 'dip'].includes(definition.movement) && numberField('torsoAngle', 'Reference torso angle above floor', '°')}{numberField('gripWidth', 'Grip spacing', 'cm', 100)}{['row-tbar', 'landmine-press'].includes(config.preset) && (['X', 'Y', 'Z'] as const).map((axis, i) => <Field key={axis} label={`${label} · Lever pivot ${axis}`} value={config.outlet[i] * 100} min={i === 2 ? 0 : -400} max={400} unit="cm" onChange={value => { const outlet = [...config.outlet] as Vec3; outlet[i] = value / 100; change({ outlet }); }}/>) }{['row', 'press', 'leg-press'].includes(definition.movement) && numberField('supportAngle', 'Handle / guide inclination', '°')}{['hinge', 'back-extension', 'squat', 'lunge', 'calf-standing', 'calf-seated', 'crunch', 'woodchop', 'sidebend', 'nordic', 'pushup'].includes(definition.movement) && numberField('depth', 'Path amplitude factor')}{['lunge', 'pushup', 'bridge'].includes(definition.movement) && numberField('stance', 'Foot / support separation', 'cm', 100)}{['lunge', 'step-up'].includes(definition.movement) && numberField('stepHeight', 'Elevated foot support', 'cm', 100)}{definition.movement === 'pullover' && <>{numberField('shoulderStart', 'Shoulder elevation at 0%', '°')}{numberField('shoulderEnd', 'Shoulder elevation at 100%', '°')}{numberField('elbowStart', 'Elbow flexion at 0%', '°')}{numberField('elbowEnd', 'Elbow flexion at 100%', '°')}</>}<label><input type="checkbox" checked={config.unilateral} onChange={event => change({ unilateral: event.target.checked })}/>Load one arm / use the unilateral variant</label><p>Foot and hand supports are prescribed. Physical clearance, friction limits, balance and individual reaction forces remain outside these models.</p><button onClick={() => change(createCompoundConfig(config.preset))}>Reset this setup</button></div></details>
          <details><summary>Explicit segment masses</summary><div className="compound-fields">{(Object.keys(config.masses) as (keyof CompoundConfig['masses'])[]).map(key => <Field key={key} label={`${label} · ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} mass${['trunk', 'head'].includes(key) ? '' : ' per side'}`} value={config.masses[key]} min={0} max={100} step={.1} unit="kg" onChange={value => change({ masses: { ...config.masses, [key]: value } })}/>)}<p>Uniform segment centers of mass are used. Forearm mass includes the hand; trunk and head are lumped segments. No demographic or muscle-force inference is made.</p></div></details>
        </div>
      </article>;
    })}</div>
    <div className="compound-toolbar compound-bottom"><button disabled={reducedMotion} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause movement' : 'Animate movement'}</button><span>{reducedMotion ? 'Reduced motion enabled: use the position sliders.' : 'Quasi-static: playback speed does not change the calculations.'}</span></div>
    <label className="compound-notes">Comparison objective and observations<textarea aria-label="Compound comparison notes" maxLength={10000} rows={3} value={state.notes} onChange={event => apply(next => { next.notes = event.target.value; })} placeholder="Which setup question are you comparing, and what assumptions matter?"/></label>
    <p className="compound-footer">The workbench separates calculated external effects from unavailable support/joint results. It does not estimate muscle tension, joint contact forces, injury risk or hypertrophy.</p>
  </section>;
}
