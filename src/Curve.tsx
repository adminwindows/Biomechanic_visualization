import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { compatible, evaluate, getDefinition, sampleCurve, type Profile, type Setup } from './engine';

type CurveProps = {
  setups: [Setup, Setup]; profiles: [Profile, Profile]; angles: [number, number];
  onAngle?: (angle: number) => void;
  region?: [number, number];
  onRegionChange?: (region: [number, number]) => void;
};
type Series = { setup: Setup; profile: Profile; angle: number; index: number };
const colors = ['#007c78', '#c96b28'];
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function Plot({ series, onAngle, region, onRegionChange }: { series: Series[]; onAngle?: (angle: number) => void; region?: [number, number]; onRegionChange?: (region: [number, number]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(520);
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
  const minAngle = Math.min(...definitions.map(d => d.minAngle));
  const maxAngle = Math.max(...definitions.map(d => d.maxAngle));
  const span = Math.max(1, maxAngle - minAngle);
  const current = series.map(item => evaluate(item.setup, item.profile, item.angle));
  const height = 260, compact = width < 440;
  const left = 46, right = 20, top = 39, bottom = 53;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maximum = Math.max(10, ...curves.flatMap(curve => curve.map(point => Math.abs(point.moment ?? 0))), ...current.map(result => Math.abs(result.moment ?? 0)));
  const step = 10 ** Math.floor(Math.log10(maximum));
  const extent = Math.ceil(maximum / step) * step;
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
  const moveRegion = (event: PointerEvent<SVGSVGElement>) => {
    const drag = regionDrag.current; if (!drag || !selected || drag.pointerId !== event.pointerId) return;
    const q = pointerAngle(event);
    onRegionChange?.(drag.index === 0 ? [Math.min(q, selected[1] - 1), selected[1]] : [selected[0], Math.max(q, selected[0] + 1)]);
  };
  const stopRegion = (event: PointerEvent<SVGSVGElement>) => { if (regionDrag.current?.pointerId === event.pointerId) { regionDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } };
  const path = (curve: typeof curves[number]) => {
    let started = false;
    return curve.map(point => { if (point.moment === null || !Number.isFinite(point.moment)) { started = false; return ''; } const command = started ? 'L' : 'M'; started = true; return `${command}${x(point.angle).toFixed(2)},${y(point.moment).toFixed(2)}`; }).join(' ');
  };
  const hasResults = curves.some(curve => curve.some(point => point.moment !== null));
  const action = definitions[0].action;
  const coordinate = definitions[0].angleLabel;
  return <div>
    <svg ref={svgRef} className="curve-svg" viewBox={`0 0 ${width} ${height}`} role={onRegionChange ? 'group' : 'img'} aria-label={`External moment versus ${coordinate}. Positive values resist ${action}; negative values assist. Gaps indicate unavailable results.`} tabIndex={onAngle ? 0 : undefined} onPointerDown={event => onAngle?.(pointerAngle(event))} onPointerMove={moveRegion} onPointerUp={stopRegion} onPointerCancel={stopRegion} onKeyDown={event => {
      if (onAngle && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onAngle(clamp(series[0].angle + (event.key === 'ArrowRight' ? 1 : -1), minAngle, maxAngle)); }
    }} style={{ display: 'block', width: '100%', height: `${height}px`, maxHeight: 'none', cursor: onAngle ? 'crosshair' : 'default' }}>
      <title>{series.length === 1 ? `${series[0].index === 0 ? 'A' : 'B'}: ${series[0].setup.name}` : 'Comparable external moment profiles'}</title>
      <desc>Signed external contributions in newton metres. A solid line represents A and a dashed line represents B. Contact or unknown mechanisms leave gaps. Selected-region boundaries can be dragged or adjusted using the numeric inputs below.</desc>
      <defs><clipPath id={`${id}-plot`}><rect x={left} y={top} width={plotWidth} height={plotHeight}/></clipPath></defs>
      <rect x={left} y={top} width={plotWidth} height={plotHeight / 2} fill="#f4f8f2"/><rect x={left} y={top + plotHeight / 2} width={plotWidth} height={plotHeight / 2} fill="#fcf7ee"/>
      {selected && <rect data-region-shade="true" x={x(selected[0])} y={top} width={Math.max(0, x(selected[1]) - x(selected[0]))} height={plotHeight} fill="#b8d4c6" opacity=".25"/>}
      {[-extent, -extent / 2, 0, extent / 2, extent].map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#96a69f' : '#dce5de'} strokeWidth={tick === 0 ? 1.2 : .75} strokeDasharray={tick === 0 ? undefined : '3 5'}/><text x={left - 9} y={y(tick) + 3.5} fill="#718177" textAnchor="end" fontFamily="inherit" fontSize="10">{tick > 0 ? '+' : ''}{tick.toFixed(tick % 1 ? 1 : 0)}</text></g>)}
      {xTicks.map(tick => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={top} y2={height - bottom} stroke="#dfe6df" strokeWidth=".6"/><text x={x(tick)} y={height - bottom + 18} fill="#718177" textAnchor="middle" fontFamily="inherit" fontSize="11">{Math.round(tick)}°</text></g>)}
      <text x={left} y="20" fill="#60766c" fontSize="11" fontFamily="inherit">{series.length === 1 ? `${series[0].index === 0 ? 'A' : 'B'} · External moment · N·m` : 'External moment · N·m'}</text>
      {!compact && <text x={width - right} y="20" textAnchor="end" fill="#60766c" fontSize="10" fontFamily="inherit">{series.length === 1 ? 'Individual profile' : 'Same joint coordinate'}</text>}
      <text x={left + 9} y={top + 15} fill="#859a83" fontSize="9" fontFamily="inherit" letterSpacing=".5">+ RESISTS</text><text x={left + 9} y={height - bottom - 10} fill="#a38c6b" fontSize="9" fontFamily="inherit" letterSpacing=".5">− ASSISTS</text>
      <g clipPath={`url(#${id}-plot)`}>
        {curves.map((curve, i) => <path key={i} data-curve={series[i].index === 0 ? 'A' : 'B'} d={path(curve)} stroke={colors[series[i].index]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={series[i].index === 1 ? '7 3' : undefined}/>)}
        {series.map((item, i) => <g key={item.index}><line x1={x(item.angle)} x2={x(item.angle)} y1={top} y2={height - bottom} stroke={colors[item.index]} strokeWidth="1" strokeDasharray="3 4" opacity=".4"/>{current[i].moment !== null && <><circle cx={x(item.angle)} cy={y(current[i].moment!)} r="5" fill={colors[item.index]} stroke="white" strokeWidth="2"/><text x={clamp(x(item.angle) + (item.index === 0 ? -10 : 10), left + 8, width - right - 8)} y={clamp(y(current[i].moment!) - 9, top + 12, height - bottom - 5)} textAnchor={item.index === 0 ? 'end' : 'start'} fill={colors[item.index]} fontSize="11" fontWeight="700" fontFamily="inherit">{item.index === 0 ? 'A' : 'B'}</text></>}</g>)}
      </g>
      {selected?.map((q, index) => <g key={index} role={onRegionChange ? 'slider' : undefined} aria-label={index === 0 ? 'Selected region start' : 'Selected region end'} aria-valuemin={index === 0 ? minAngle : selected[0] + 1} aria-valuemax={index === 0 ? selected[1] - 1 : maxAngle} aria-valuenow={q} tabIndex={onRegionChange ? 0 : undefined} style={{ cursor: onRegionChange ? 'ew-resize' : undefined, touchAction: 'none' }} onPointerDown={event => { if (!onRegionChange) return; event.stopPropagation(); event.preventDefault(); regionDrag.current = { index: index as 0 | 1, pointerId: event.pointerId }; svgRef.current?.setPointerCapture(event.pointerId); }} onKeyDown={event => { if (!onRegionChange || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const value = clamp(q + (event.key === 'ArrowRight' ? 1 : -1), minAngle, maxAngle); onRegionChange(index === 0 ? [Math.min(value, selected[1] - 1), selected[1]] : [selected[0], Math.max(value, selected[0] + 1)]); }}><line x1={x(q)} x2={x(q)} y1={top} y2={height - bottom} stroke="#6c9582" strokeWidth="1" strokeDasharray="4 3"/><rect x={x(q) - 11} y={top - 5} width="22" height="28" fill="transparent"/><rect x={x(q) - 4} y={top - 3} width="8" height="12" rx="2" fill="#6c9582"/></g>)}
      {!hasResults && <text x={left + plotWidth / 2} y={height / 2 - 8} textAnchor="middle" fill="#718177" fontSize="11" fontFamily="inherit">No calculated profile in this range</text>}
      <text x={left + plotWidth / 2} y={height - 13} textAnchor="middle" fill="#718177" fontSize="10" fontFamily="inherit">{coordinate}</text>
    </svg>
    {selected && onRegionChange && <div className="curve-region-controls" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', fontSize: 11, color: '#60766c', marginTop: 2 }}><span>Inspect region</span>{(['Start', 'End'] as const).map((label, i) => <label key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{label}<input aria-label={`Region ${label.toLowerCase()} angle`} type="number" min={i === 0 ? minAngle : selected[0] + 1} max={i === 0 ? selected[1] - 1 : maxAngle} step="1" value={selected[i]} style={{ width: 54, padding: '4px 6px', border: '1px solid #ccd7cd', borderRadius: 4, background: '#fafbf6', color: '#334746' }} onChange={event => { if (event.target.value === '' || !Number.isFinite(event.target.valueAsNumber)) return; const value = clamp(event.target.valueAsNumber, minAngle, maxAngle); onRegionChange(i === 0 ? [Math.min(value, selected[1] - 1), selected[1]] : [selected[0], Math.max(value, selected[0] + 1)]); }}/><span>°</span></label>)}</div>}
  </div>;
}

export function Curve({ setups, profiles, angles, onAngle, region, onRegionChange }: CurveProps) {
  const series = useMemo(() => setups.map((setup, index) => ({ setup, profile: profiles[index], angle: angles[index], index })), [setups, profiles, angles]);
  if (!compatible(setups[0], setups[1])) return <div className="individual-curves" data-comparison="incompatible"><p style={{ fontSize: 11, lineHeight: 1.6, color: '#718177', marginTop: 14 }}>Different joint coordinates: inspect each profile separately. Their heights are not an A/B comparison.</p>{series.map(item => <div key={item.index}><p style={{ fontSize: 12, fontWeight: 600, marginTop: 14, color: colors[item.index] }}>{item.index === 0 ? 'A' : 'B'} · {item.setup.name}</p><Plot series={[item]} onAngle={item.index === 0 ? onAngle : undefined}/></div>)}</div>;
  return <Plot series={series} onAngle={onAngle} region={region} onRegionChange={onRegionChange}/>;
}
