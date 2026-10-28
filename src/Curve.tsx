import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { compatible, evaluate, getDefinition, sampleCurve, type Profile, type Setup } from './engine';
import './instrument.css';

type CurveProps = {
  setups: [Setup, Setup]; profiles: [Profile, Profile]; angles: [number, number];
  onAngle?: (angle: number) => void;
  region?: [number, number]; onRegionChange?: (region: [number, number]) => void;
};
type Series = { setup: Setup; profile: Profile; angle: number; index: number };
const colors = ['#087f8c', '#d66a45'];
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
const signed = (v: number | null) => v === null ? 'Unavailable' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
const tickLabel = (v: number) => `${v > 0 ? '+' : ''}${Math.abs(v) >= 1e6 ? v.toExponential(1) : Math.abs(v) >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : Number(v.toFixed(1))}`;
const csvCell = (value: string | number) => typeof value === 'number' ? String(value) : `"${(/^[=+@-]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Plot({ series, onAngle, region, onRegionChange }: { series: Series[]; onAngle?: (angle: number) => void; region?: [number, number]; onRegionChange?: (region: [number, number]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(520), [inspection, setInspection] = useState<number | null>(null);
  const regionDrag = useRef<{ index: 0 | 1; pointerId: number } | null>(null);
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const resize = () => setWidth(Math.max(260, Math.round(svg.getBoundingClientRect().width)));
    resize(); const observer = new ResizeObserver(resize); observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const curves = useMemo(() => series.map(item => sampleCurve(item.setup, item.profile)), [series[0]?.setup, series[0]?.profile, series[1]?.setup, series[1]?.profile]);
  const definitions = series.map(item => getDefinition(item.setup));
  const minAngle = Math.min(...definitions.map(d => d.minAngle)), maxAngle = Math.max(...definitions.map(d => d.maxAngle));
  const span = Math.max(1, maxAngle - minAngle);
  const current = series.map(item => evaluate(item.setup, item.profile, item.angle));
  const inspected = inspection === null ? [] : series.map(item => inspection < item.setup.range[0] || inspection > item.setup.range[1] ? null : evaluate(item.setup, item.profile, inspection));
  const height = 288, compact = width < 440;
  const left = compact ? 46 : 54, right = 18, top = 34, bottom = 53;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maximum = Math.max(10, ...curves.flatMap(curve => curve.map(point => Math.abs(point.moment ?? 0))), ...current.map(result => Math.abs(result.moment ?? 0)));
  const step = 10 ** Math.floor(Math.log10(maximum)), extent = Math.ceil(maximum / step) * step;
  const x = (angle: number) => left + (angle - minAngle) / span * plotWidth;
  const y = (moment: number) => top + (extent - moment) / (2 * extent) * plotHeight;
  const regionStart = region ? clamp(region[0], minAngle, maxAngle - 1) : minAngle;
  const selected: [number, number] | undefined = region ? [regionStart, clamp(region[1], regionStart + 1, maxAngle)] : undefined;
  const tickCount = compact ? 5 : 7;
  const xTicks = Array.from({ length: tickCount }, (_, i) => minAngle + span * i / (tickCount - 1));
  const pointerAngle = (event: PointerEvent<SVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM(); if (!matrix) return minAngle;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return Math.round(clamp(minAngle + (point.x - left) / plotWidth * span, minAngle, maxAngle));
  };
  const movePointer = (event: PointerEvent<SVGSVGElement>) => {
    const q = pointerAngle(event), drag = regionDrag.current;
    if (!drag) { setInspection(q); return; }
    if (!selected || drag.pointerId !== event.pointerId) return;
    onRegionChange?.(drag.index === 0 ? [Math.min(q, selected[1] - 1), selected[1]] : [selected[0], Math.max(q, selected[0] + 1)]);
  };
  const stopRegion = (event: PointerEvent<SVGSVGElement>) => { if (regionDrag.current?.pointerId === event.pointerId) { regionDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } };
  const path = (curve: typeof curves[number]) => {
    let started = false;
    return curve.map(point => { if (point.moment === null || !Number.isFinite(point.moment)) { started = false; return ''; } const command = started ? 'L' : 'M'; started = true; return `${command}${x(point.angle).toFixed(2)},${y(point.moment).toFixed(2)}`; }).join(' ');
  };
  const hasResults = curves.some(curve => curve.some(point => point.moment !== null));
  const action = definitions[0].action, coordinate = definitions[0].angleLabel;
  const coordinateUnit = definitions[0].angleUnit ?? '°', metricUnit = definitions[0].unit;
  const metricName = metricUnit === 'N' ? 'External force' : 'External moment';
  const exportCSV = () => {
    const rows: (string | number)[][] = [['configuration', 'exercise', 'model', 'coordinate', 'coordinate_unit', 'position', 'external_contribution', 'contribution_unit', 'status']];
    curves.forEach((curve, i) => curve.forEach(point => rows.push([series[i].index === 0 ? 'A' : 'B', series[i].setup.name, definitions[i].id, coordinate, coordinateUnit, point.angle, point.moment ?? '', metricUnit, point.status])));
    download(rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'biomechanics-resistance-profile.csv', 'text/csv;charset=utf-8');
  };
  const exportSVG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current.cloneNode(true) as SVGSVGElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
    svg.setAttribute('font-family', 'Arial, sans-serif'); svg.removeAttribute('style');
    svg.querySelectorAll('[data-inspection]').forEach(node => node.remove());
    const desc = svg.querySelector('desc');
    if (desc) desc.textContent += ` ${series.map(item => `${item.index === 0 ? 'A' : 'B'}: ${item.setup.name}`).join('; ')}. Exported from the current model; geometry assumptions are not anatomical validation.`;
    download(new XMLSerializer().serializeToString(svg), 'biomechanics-resistance-profile.svg', 'image/svg+xml');
  };
  const tooltipWidth = Math.min(158, plotWidth - 12), tooltipX = inspection === null ? 0 : clamp(x(inspection) + 13, left + 5, width - right - tooltipWidth - 5);
  return <div className="instrument-plot">
    <div className="instrument-series" aria-label="Current profile values">{series.map((item, i) => <div key={item.index} className="instrument-series-item" style={{ '--series-color': colors[item.index] } as React.CSSProperties}>
      <span className={`instrument-series-line ${item.index === 1 ? 'is-dashed' : ''}`} aria-hidden="true"/>
      <span className="instrument-series-label">{item.index === 0 ? 'A' : 'B'}</span>
      <strong>{signed(current[i].moment)}{current[i].moment !== null && <small>{metricUnit}</small>}</strong>
      <span className="instrument-series-position">at {Number(item.angle.toFixed(1))}{coordinateUnit}</span>
    </div>)}</div>
    <svg ref={svgRef} className="curve-svg" viewBox={`0 0 ${width} ${height}`} role={onRegionChange ? 'group' : 'img'} aria-label={`${metricName} versus ${coordinate}. Positive values resist ${action}; negative values assist. Gaps indicate unavailable results.`} tabIndex={onAngle ? 0 : undefined} onPointerDown={event => { if (event.button === 0) onAngle?.(pointerAngle(event)); }} onPointerMove={movePointer} onPointerLeave={() => { if (!regionDrag.current) setInspection(null); }} onPointerUp={stopRegion} onPointerCancel={stopRegion} onKeyDown={event => {
      if (onAngle && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const next = clamp(series[0].angle + (event.key === 'ArrowRight' ? 1 : -1), minAngle, maxAngle); onAngle(next); setInspection(next); }
    }} style={{ display: 'block', width: '100%', height: `${height}px`, maxHeight: 'none', cursor: onAngle ? 'crosshair' : 'default' }}>
      <title>{series.length === 1 ? `${series[0].index === 0 ? 'A' : 'B'}: ${series[0].setup.name}` : 'Comparable external contribution profiles'}</title>
      <desc>Signed external contributions in {metricUnit}. A solid line represents A and a dashed line represents B. Contact or unknown mechanisms leave gaps. Hover to inspect values; select a position or use arrow keys. Selected-region boundaries can be dragged or adjusted using the numeric inputs below.</desc>
      <defs><clipPath id={`${id}-plot`}><rect x={left} y={top} width={plotWidth} height={plotHeight}/></clipPath></defs>
      <rect width={width} height={height} fill="#ffffff"/>
      <rect x={left} y={top} width={plotWidth} height={plotHeight / 2} fill="#f5f8fa"/><rect x={left} y={top + plotHeight / 2} width={plotWidth} height={plotHeight / 2} fill="#fbfcfd"/>
      {selected && <rect data-region-shade="true" x={x(selected[0])} y={top} width={Math.max(0, x(selected[1]) - x(selected[0]))} height={plotHeight} fill="#087f8c" opacity=".065"/>}
      {[-extent, -extent / 2, 0, extent / 2, extent].map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#9baebc' : '#dce4eb'} strokeWidth={tick === 0 ? 1.2 : .7} strokeDasharray={tick === 0 ? undefined : '2 4'}/><text x={left - 9} y={y(tick) + 3.5} fill="#607383" textAnchor="end" fontFamily="inherit" fontSize="10">{tickLabel(tick)}</text></g>)}
      {xTicks.map(tick => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={top} y2={height - bottom} stroke="#e5ebf0" strokeWidth=".7"/><text x={x(tick)} y={height - bottom + 19} fill="#607383" textAnchor="middle" fontFamily="inherit" fontSize="11">{Math.round(tick)}{coordinateUnit}</text></g>)}
      <text x={left} y="18" fill="#425d70" fontSize="11" fontWeight="600" fontFamily="inherit">{metricName} · {metricUnit}</text>
      {!compact && <text x={width - right} y="18" textAnchor="end" fill="#718492" fontSize="10" fontFamily="inherit">{series.length === 1 ? 'Individual profile' : 'Shared coordinate & scale'}</text>}
      <text x={left + 10} y={top + 16} fill="#718492" fontSize="9" fontFamily="inherit" letterSpacing="1">+ RESISTS</text><text x={left + 10} y={height - bottom - 10} fill="#718492" fontSize="9" fontFamily="inherit" letterSpacing="1">− ASSISTS</text>
      <g clipPath={`url(#${id}-plot)`}>
        {curves.map((curve, i) => <path key={i} data-curve={series[i].index === 0 ? 'A' : 'B'} d={path(curve)} stroke={colors[series[i].index]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={series[i].index === 1 ? '7 4' : undefined}/>)}
        {series.map((item, i) => <g key={item.index}><line x1={x(item.angle)} x2={x(item.angle)} y1={top} y2={height - bottom} stroke={colors[item.index]} strokeWidth="1" strokeDasharray="3 4" opacity=".35"/>{current[i].moment !== null && <><circle cx={x(item.angle)} cy={y(current[i].moment!)} r="5" fill={colors[item.index]} stroke="white" strokeWidth="2"/><text x={clamp(x(item.angle) + (item.index === 0 ? -11 : 11), left + 11, width - right - 11)} y={clamp(y(current[i].moment!) - 10, top + 13, height - bottom - 5)} textAnchor={item.index === 0 ? 'end' : 'start'} fill={colors[item.index]} fontSize="11" fontWeight="700" fontFamily="inherit">{item.index === 0 ? 'A' : 'B'}</text></>}</g>)}
        {inspection !== null && <g data-inspection="true" pointerEvents="none"><line x1={x(inspection)} x2={x(inspection)} y1={top} y2={height - bottom} stroke="#172b3a" strokeWidth="1" strokeDasharray="2 3"/>{inspected.map((result, i) => result?.moment !== null && result?.moment !== undefined && <circle key={i} cx={x(inspection)} cy={y(result.moment)} r="4" fill="white" stroke={colors[series[i].index]} strokeWidth="2"/>)}</g>}
      </g>
      {selected?.map((q, index) => <g key={index} role={onRegionChange ? 'slider' : undefined} aria-label={index === 0 ? 'Selected region start' : 'Selected region end'} aria-valuemin={index === 0 ? minAngle : selected[0] + 1} aria-valuemax={index === 0 ? selected[1] - 1 : maxAngle} aria-valuenow={q} tabIndex={onRegionChange ? 0 : undefined} style={{ cursor: onRegionChange ? 'ew-resize' : undefined, touchAction: 'none' }} onPointerDown={event => { if (!onRegionChange) return; event.stopPropagation(); event.preventDefault(); setInspection(null); regionDrag.current = { index: index as 0 | 1, pointerId: event.pointerId }; svgRef.current?.setPointerCapture(event.pointerId); }} onKeyDown={event => { if (!onRegionChange || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const value = clamp(q + (event.key === 'ArrowRight' ? 1 : -1), minAngle, maxAngle); onRegionChange(index === 0 ? [Math.min(value, selected[1] - 1), selected[1]] : [selected[0], Math.max(value, selected[0] + 1)]); }}><line x1={x(q)} x2={x(q)} y1={top} y2={height - bottom} stroke="#6c939d" strokeWidth="1" strokeDasharray="4 3"/><rect x={x(q) - 11} y={top - 5} width="22" height="28" fill="transparent"/><rect x={x(q) - 4} y={top - 3} width="8" height="12" rx="2" fill="#6c939d"/></g>)}
      {!hasResults && <text x={left + plotWidth / 2} y={height / 2 - 8} textAnchor="middle" fill="#607383" fontSize="11" fontFamily="inherit">No calculated profile in this range</text>}
      {inspection !== null && <g data-inspection="true" pointerEvents="none"><rect x={tooltipX} y={top + 9} width={tooltipWidth} height={27 + series.length * 20} rx="4" fill="#fff" stroke="#cbd7e0"/><text x={tooltipX + 11} y={top + 27} fill="#172b3a" fontSize="11" fontWeight="600">{inspection}{coordinateUnit} · inspection</text>{series.map((item, i) => <text key={i} x={tooltipX + 11} y={top + 47 + i * 20} fill={colors[item.index]} fontSize="11">{item.index === 0 ? 'A' : 'B'}  {inspected[i] ? `${signed(inspected[i]!.moment)}${inspected[i]!.moment !== null ? ` ${metricUnit}` : ''}` : 'Outside range'}</text>)}</g>}
      <text x={left + plotWidth / 2} y={height - 12} textAnchor="middle" fill="#607383" fontSize="10" fontFamily="inherit">{coordinate}</text>
    </svg>
    <div className="instrument-plot-footer">
      {selected && onRegionChange ? <div className="curve-region-controls"><span>Region</span>{(['Start', 'End'] as const).map((label, i) => <label key={label}>{label}<input aria-label={`Region ${label.toLowerCase()} angle`} type="number" min={i === 0 ? minAngle : selected[0] + 1} max={i === 0 ? selected[1] - 1 : maxAngle} step="1" value={selected[i]} onChange={event => { if (event.target.value === '' || !Number.isFinite(event.target.valueAsNumber)) return; const value = clamp(event.target.valueAsNumber, minAngle, maxAngle); onRegionChange(i === 0 ? [Math.min(value, selected[1] - 1), selected[1]] : [selected[0], Math.max(value, selected[0] + 1)]); }}/><span>{coordinateUnit}</span></label>)}</div> : <span className="instrument-plot-hint">Hover or tap to inspect</span>}
      <div className="instrument-export-actions"><button type="button" onClick={exportSVG} aria-label={`Export ${series.length === 2 ? 'A and B' : series[0].index === 0 ? 'A' : 'B'} curve as SVG`}>SVG <span aria-hidden="true">↓</span></button><button type="button" onClick={exportCSV} aria-label={`Export ${series.length === 2 ? 'A and B' : series[0].index === 0 ? 'A' : 'B'} curve data as CSV`}>CSV <span aria-hidden="true">↓</span></button></div>
    </div>
  </div>;
}

export function Curve({ setups, profiles, angles, onAngle, region, onRegionChange }: CurveProps) {
  const series = useMemo(() => setups.map((setup, index) => ({ setup, profile: profiles[index], angle: angles[index], index })), [setups, profiles, angles]);
  if (!compatible(setups[0], setups[1])) return <div className="individual-curves" data-comparison="incompatible"><p className="instrument-comparison-note">Different joint coordinates: inspect each profile separately. Their heights are not an A/B comparison.</p>{series.map(item => <div key={item.index}><p className="instrument-profile-name" style={{ color: colors[item.index] }}>{item.index === 0 ? 'A' : 'B'} · {item.setup.name}</p><Plot series={[item]} onAngle={item.index === 0 ? onAngle : undefined}/></div>)}</div>;
  return <Plot series={series} onAngle={onAngle} region={region} onRegionChange={onRegionChange}/>;
}
