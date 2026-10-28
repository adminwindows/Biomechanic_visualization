import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { evaluate, geometry, getDefinition, type Profile, type Setup, type Vec3 } from './engine';

type SceneProps = {
  setup: Setup; profile: Profile; angle: number;
  setups: [Setup, Setup]; profiles: [Profile, Profile];
  view: 'side' | 'top' | 'front'; label: 'A' | 'B'; annotations: boolean;
  onSetupChange?: (patch: Partial<Setup>) => void;
  onAngleChange?: (angle: number) => void;
  zoom?: number;
  /** Shared pan in displayed-plane metres, positive right/up. */
  pan?: [number, number];
  onPanChange?: (pan: [number, number]) => void;
};
type Point = [number, number];
type Drag = { kind: 'outlet' | 'anchor' | 'angle' | 'pan'; index: number; pointerId: number; start: Point; setup: Setup; pan: Point; scale: number };
const ink = '#334746', muted = '#71857a';
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function extent(setups: [Setup, Setup], profiles: [Profile, Profile]) {
  const points: Vec3[] = [[0, 0, 0], [0, 0, 2.25]];
  setups.forEach((setup, i) => {
    const definition = getDefinition(setup);
    for (let j = 0; j <= 40; j++) {
      const angle = definition.minAngle + (definition.maxAngle - definition.minAngle) * j / 40;
      const g = geometry(setup, profiles[i], angle);
      points.push(g.hip, g.shoulder, g.elbow, g.hand, g.head, ...g.grips);
      if (setup.kind === 'bench') points.push(...g.backCorners);
      g.cables.forEach(c => points.push(c.attachment, c.outlet));
      g.limbs?.forEach(limb => points.push(limb.from, limb.to));
      if (g.supportPoints) points.push(...g.supportPoints);
    }
  });
  return { min: [0, 1, 2].map(axis => Math.min(...points.map(p => p[axis])) - .22), max: [0, 1, 2].map(axis => Math.max(...points.map(p => p[axis])) + .22) };
}

function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (items: Point[]) => { const result: Point[] = []; for (const item of items) { while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], item) <= 0) result.pop(); result.push(item); } return result; };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}

export function Scene({ setup, profile, angle, setups, profiles, view, label, annotations, onSetupChange, onAngleChange, zoom = 1, pan = [0, 0], onPanChange }: SceneProps) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const [renderedWidth, setRenderedWidth] = useState(520);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const resize = () => setRenderedWidth(Math.max(240, svg.getBoundingClientRect().width));
    resize(); const observer = new ResizeObserver(resize); observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const fontScale = Math.max(1, 520 / renderedWidth);
  const color = label === 'A' ? '#007c78' : '#c96b28';
  const result = evaluate(setup, profile, angle), g = result.geometry;
  const definition = getDefinition(setup);
  const bounds = useMemo(() => extent(setups, profiles), [setups, profiles]);
  const width = 520, height = view === 'top' ? 270 : 350;
  const hAxis = view === 'front' ? 1 : 0, vAxis = view === 'top' ? 1 : 2;
  const center: Point = [(bounds.min[hAxis] + bounds.max[hAxis]) / 2, (bounds.min[vAxis] + bounds.max[vAxis]) / 2];
  const baseScale = Math.min(460 / Math.max(.5, bounds.max[0] - bounds.min[0]), 460 / Math.max(.5, bounds.max[1] - bounds.min[1]), 272 / Math.max(.5, bounds.max[2] - bounds.min[2]), 192 / Math.max(.5, bounds.max[1] - bounds.min[1]));
  const chartScale = baseScale * clamp(zoom, .5, 4);
  const p = (point: Vec3): Point => [width / 2 + (point[hAxis] - center[0] + pan[0]) * chartScale, height / 2 - (point[vAxis] - center[1] + pan[1]) * chartScale];
  const svgPoint = (event: PointerEvent<SVGElement>): Point => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return [0, 0];
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  };
  const worldAt = (point: Point): Point => [(point[0] - width / 2) / chartScale + center[0] - pan[0], -(point[1] - height / 2) / chartScale + center[1] - pan[1]];
  const startDrag = (event: PointerEvent<SVGElement>, kind: Drag['kind'], index = 0) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    dragRef.current = { kind, index, pointerId: event.pointerId, start: svgPoint(event), setup: { ...setup }, pan: [...pan], scale: chartScale };
    svgRef.current?.setPointerCapture(event.pointerId); setDragging(true);
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    const point = svgPoint(event), dx = (point[0] - drag.start[0]) / drag.scale, dy = -(point[1] - drag.start[1]) / drag.scale;
    if (drag.kind === 'pan') { onPanChange?.([drag.pan[0] + dx, drag.pan[1] + dy]); return; }
    if (drag.kind === 'anchor') {
      const patch: Partial<Setup> = {};
      if (view !== 'front') patch.hipX = clamp(drag.setup.hipX + dx, -2, 3);
      if (view !== 'top') patch.hipHeight = clamp(drag.setup.hipHeight + dy, .15, 1.8);
      onSetupChange?.(patch); return;
    }
    if (drag.kind === 'outlet') {
      const patch: Partial<Setup> = {};
      if (view !== 'top') patch.pulleyHeight = clamp(drag.setup.pulleyHeight + dy, .05, 3.5);
      if (view === 'front' || view === 'top') {
        const lateralDelta = view === 'front' ? dx : dy;
        if (setup.cables === 2 || !['pullover', 'machine'].includes(definition.id)) {
          const side = Math.sign(g.cables[drag.index]?.outlet[1] ?? 1) || 1;
          patch.outletSpacing = clamp(drag.setup.outletSpacing + side * 2 * lateralDelta, .05, 3.5);
        }
      }
      // X is the signed outlet offset; editing it never moves the body or bench.
      if (view !== 'front') patch.planeOffset = clamp((drag.setup.planeOffset ?? 0) + dx, -2, 3);
      onSetupChange?.(patch); return;
    }
    const target = worldAt(point);
    let bestAngle = angle, bestDistance = Infinity;
    // Inverse kinematics follows the same family geometry as the scene, including coupled paths.
    for (let q = definition.minAngle; q <= definition.maxAngle + .001; q += .5) {
      const hand = geometry(setup, profile, q).hand;
      const distance = (hand[hAxis] - target[0]) ** 2 + (hand[vAxis] - target[1]) ** 2;
      if (distance < bestDistance - 1e-10 || (Math.abs(distance - bestDistance) < 1e-10 && Math.abs(q - angle) < Math.abs(bestAngle - angle))) { bestDistance = distance; bestAngle = q; }
    }
    onAngleChange?.(bestAngle);
  };
  const endDrag = (event: PointerEvent<SVGSVGElement>) => { if (dragRef.current?.pointerId === event.pointerId) { dragRef.current = null; setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } };
  const line = (a: Vec3, b: Vec3, stroke = ink, strokeWidth = 2, extra: Record<string, string | number> = {}) => <line x1={p(a)[0]} y1={p(a)[1]} x2={p(b)[0]} y2={p(b)[1]} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" {...extra} />;
  const circle = (at: Vec3, r: number, fill: string, stroke = 'none', strokeWidth = 1) => <circle cx={p(at)[0]} cy={p(at)[1]} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  const path = (points: Vec3[]) => points.map((point, i) => `${i ? 'L' : 'M'}${p(point).join(',')}`).join(' ');
  const arrow = (point: Vec3, force: Vec3, gravity = false) => {
    const length = Math.hypot(...force); if (length < 1e-9) return null;
    const end = add(point, mul(force, .35 / length));
    if (Math.hypot(p(end)[0] - p(point)[0], p(end)[1] - p(point)[1]) < 3) return null;
    return line(point, end, gravity ? '#7762a5' : color, 2, { markerEnd: `url(#${id}-${gravity ? 'gravity' : 'arrow'})` });
  };
  const handle = (at: Vec3, kind: Drag['kind'], title: string, index = 0) => <g role="button" aria-label={`${label}: ${title}`} tabIndex={0} style={{ cursor: 'grab' }} onPointerDown={event => startDrag(event, kind, index)} onKeyDown={event => {
    const delta = event.shiftKey ? .05 : .01;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (kind === 'angle') onAngleChange?.(clamp(angle + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1), definition.minAngle, definition.maxAngle));
    const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    const shift = (event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1) * delta;
    if (kind === 'anchor') {
      if (vertical && view !== 'top') onSetupChange?.({ hipHeight: clamp(setup.hipHeight + shift, .15, 1.8) });
      if (!vertical && view !== 'front') onSetupChange?.({ hipX: clamp(setup.hipX + shift, -2, 3) });
    }
    if (kind === 'outlet') {
      if (vertical && view !== 'top') onSetupChange?.({ pulleyHeight: clamp(setup.pulleyHeight + shift, .05, 3.5) });
      else if ((!vertical && view === 'front') || (vertical && view === 'top')) { if (setup.cables === 2 || !['pullover', 'machine'].includes(definition.id)) { const side = Math.sign(g.cables[index]?.outlet[1] ?? 1) || 1; onSetupChange?.({ outletSpacing: clamp(setup.outletSpacing + side * 2 * shift, .05, 3.5) }); } }
      else if (!vertical) onSetupChange?.({ planeOffset: clamp((setup.planeOffset ?? 0) + shift, -2, 3) });
    }
  }}><title>{title} · drag or use arrow keys</title>{circle(at, 14 * fontScale, 'transparent')}{circle(at, 7 * fontScale, 'none', color, 1)}{circle(at, 2.2 * fontScale, color)}</g>;
  const handTrail = useMemo(() => Array.from({ length: 61 }, (_, i) => geometry(setup, profile, definition.minAngle + (definition.maxAngle - definition.minAngle) * i / 60).hand), [setup, profile, definition.minAngle, definition.maxAngle]);
  const limbs = g.limbs ?? [ { from: g.hip, to: g.shoulder, kind: 'body' as const }, ...g.shoulders.flatMap((shoulder, i) => [{ from: shoulder, to: g.elbows[i], kind: 'upperArm' as const }, { from: g.elbows[i], to: g.grips[i], kind: 'forearm' as const }]) ];
  const invalid = result.status === 'contact' || result.status === 'invalid';
  const title = `${label}: ${view} view. ${setup.name}. ${definition.angleLabel}: ${angle.toFixed(0)} degrees. ${result.status}.`;
  const interactive = !!(onSetupChange || onAngleChange || onPanChange);
  const backPolygon = hull(g.backCorners.map(p));
  const floorY = p([0, 0, 0])[1];
  return <svg ref={svgRef} className={`scene-svg scene-${view}`} viewBox={`0 0 ${width} ${height}`} role={interactive ? 'group' : 'img'} aria-label={title} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 'none', touchAction: interactive ? 'none' : 'auto', cursor: dragging ? 'grabbing' : 'default' }}>
    <title>{title}</title><desc>Orthographic projection of the same 3D geometry used for forces and contact. Outlined points can be dragged or adjusted with arrow keys; numerical controls remain available.</desc>
    <defs>
      <pattern id={`${id}-grid`} width={.5 * chartScale} height={.5 * chartScale} patternUnits="userSpaceOnUse" x={p([0, 0, 0])[0]} y={p([0, 0, 0])[1]}><path d={`M ${.5 * chartScale} 0 L 0 0 0 ${.5 * chartScale}`} fill="none" stroke="#dae2dc" strokeWidth=".65" /></pattern>
      {[['arrow', color], ['gravity', '#7762a5']].map(([name, fill]) => <marker key={name} id={`${id}-${name}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L6 3 L0 6 Z" fill={fill}/></marker>)}
      <clipPath id={`${id}-clip`}><rect x="12" y="29" width={width - 24} height={height - 69}/></clipPath>
    </defs>
    <rect width={width} height={height} fill="#f3f6f0" onPointerDown={onPanChange ? event => startDrag(event, 'pan') : undefined}/>
    <rect x="12" y="29" width={width - 24} height={height - 69} fill={`url(#${id}-grid)`} onPointerDown={onPanChange ? event => startDrag(event, 'pan') : undefined}/>
    <text x="17" y="19" fill={muted} fontSize={9 * fontScale} fontFamily="inherit" letterSpacing=".7">{view.toUpperCase()} VIEW · {view === 'side' ? 'X–Z' : view === 'front' ? 'Y–Z' : 'X–Y'}</text>
    <text x={width - 17} y="19" textAnchor="end" fill={ink} fontSize={10 * fontScale} fontFamily="inherit">{Math.round(angle)}°{angle > 180 ? ' · exploratory' : ''}</text>
    <g clipPath={`url(#${id}-clip)`}>
      {view !== 'top' && <line x1="12" y1={floorY} x2={width - 12} y2={floorY} stroke="#aab9ae" strokeWidth="1.2"/>}
      {g.cables.map((c, i) => <g key={`rail-${i}`}>{view === 'top' ? line([c.outlet[0], bounds.min[1], 0], [c.outlet[0], bounds.max[1], 0], '#a8b8af', 1, { strokeDasharray: '4 5' }) : <>{line([c.outlet[0], c.outlet[1], 0], [c.outlet[0], c.outlet[1], Math.max(c.outlet[2] + .13, 2.3)], '#a5b6a8', 3)}{line([c.outlet[0] - .04, c.outlet[1], 0], [c.outlet[0] - .04, c.outlet[1], Math.max(c.outlet[2] + .13, 2.3)], '#d3ddd3', 1)}</>}</g>)}
      {definition.id === 'machine' && <g>{line(add(g.shoulder, [-.1, 0, 0]), g.elbow, '#899a90', 5)}{circle(add(g.shoulder, [-.1, 0, 0]), 6, '#d2ddd3', '#81988c', 1.5)}{circle(g.elbow, 6, '#c3cdbf', '#81988c', 1)}<text x="18" y={height - 60} fill={muted} fontSize={9 * fontScale}>Mechanism illustrative · resistance unknown</text></g>}
      {setup.kind === 'bench' && <g><polygon points={backPolygon.map(point => point.join(',')).join(' ')} fill="#d2ddd3" stroke="#82988b" strokeWidth="1.5" strokeLinejoin="round"/>{line(add(g.hip, [-.09, 0, -.075]), add(g.hip, [.40 * setup.facing, 0, -.075]), '#91a497', 7)}{line(add(g.hip, [.15 * setup.facing, 0, -.09]), [g.hip[0] + .15 * setup.facing, 0, .035], '#9aac9f', 4)}{line([g.hip[0] - .2, 0, .035], [g.hip[0] + .5, 0, .035], '#9aac9f', 4)}</g>}
      {definition.id === 'raise' && setup.tilt !== 0 && <g>{line(g.grips[0], [g.grips[0][0], g.grips[0][1], 0], '#9aac9f', 4)}{annotations && <text x={clamp(p(g.grips[0])[0] - 10, 85 * fontScale, width - 18)} y={clamp(p(g.grips[0])[1] - 12, 44, height - 49)} textAnchor="end" fill={muted} fontSize={8 * fontScale}>Support assumed</text>}</g>}
      <path d={path(handTrail)} stroke={color} strokeWidth="1.1" strokeDasharray="3 5" fill="none" opacity=".28"/>
      <g opacity={invalid ? .4 : 1}>
        {g.cables.map((c, i) => <g key={`cable-${i}`}>{line(c.attachment, c.outlet, color, 1.6)}{circle(c.outlet, 5, '#f3f6f0', color, 1.6)}{c.force && arrow(c.attachment, c.force)}</g>)}
        {limbs.map((limb, i) => <g key={i}>{line(limb.from, limb.to, ink, limb.kind === 'body' ? Math.max(12, profile.shoulderWidth * .45 * chartScale) : limb.kind === 'thigh' ? 10 : limb.kind === 'shank' ? 7 : limb.kind === 'foot' ? 6 : 7)}{limb.kind === 'body' && line(limb.from, limb.to, '#64796d', Math.max(6, profile.shoulderWidth * .26 * chartScale))}{limb.kind !== 'body' && limb.kind !== 'foot' && circle(limb.from, 3.2, '#edf1e7', ink, 1.1)}</g>)}
        {line(g.shoulder, add(g.shoulder, mul(g.torsoDirection, .09)), ink, 6)}
        {view !== 'side' && line(g.shoulders[0], g.shoulders[1], ink, 7)}
        {circle(g.head, Math.max(5, .095 * chartScale), '#d8dfce', ink, 1.4)}
        {view !== 'front' && line(add(g.head, mul(g.normal, .07)), add(g.head, mul(g.normal, .13)), ink, 2)}
        {(g.hasBar ?? definition.id === 'pullover') && line(g.barEnds[0], g.barEnds[1], ink, 3.5)}
        {circle(g.hand, 4.5, color, '#f3f6f0', 1.2)}
        {g.loads?.filter(load => load.kind === 'gravity').map((load, i) => <g key={`gravity-${i}`}>{setup.resistance === 'dumbbell' && g.grips.some(grip => Math.hypot(...grip.map((value, axis) => value - load.point[axis])) < 1e-6) && <>{line(add(load.point, [0, -.045, 0]), add(load.point, [0, .045, 0]), '#756988', 6)}{circle(load.point, 4, '#756988')}</>}{arrow(load.point, load.force, true)}</g>)}
      </g>
      {result.contact && <g>{circle(result.contact, 8 * fontScale, '#fff1e4', '#b84c22', 1.7)}<text x={p(result.contact)[0]} y={p(result.contact)[1] + 3.5 * fontScale} textAnchor="middle" fontSize={12 * fontScale} fontWeight="700" fill="#b84c22">!</text></g>}
      {onSetupChange && g.cables.map((c, i) => <g key={`handle-${i}`}>{handle(c.outlet, 'outlet', 'Move cable outlet', i)}</g>)}
      {onSetupChange && handle(g.hip, 'anchor', setup.kind === 'bench' ? 'Move pelvis and bench anchor' : 'Move pelvis anchor')}
      {onAngleChange && handle(g.hand, 'angle', definition.id === 'hip' ? 'Move ankle through the exercise' : 'Move hand through the exercise')}
      {annotations && <><text x={clamp(p(g.hand)[0] + 13, 18, width - 80 * fontScale)} y={clamp(p(g.hand)[1] - 12, 44, height - 49)} fill={color} fontSize={10 * fontScale} fontFamily="inherit">{definition.id === 'hip' ? 'Ankle' : 'Grip'}</text>{g.cables.length > 0 && <text x={clamp(p(g.cables[0].outlet)[0] + 12, 18, width - 85 * fontScale)} y={clamp(p(g.cables[0].outlet)[1] - 14, 44, height - 49)} fill={muted} fontSize={9 * fontScale} fontFamily="inherit">Outlet</text>}</>}
    </g>
    <text x="17" y={height - 14} fill={muted} fontSize={9 * fontScale} fontFamily="inherit">{interactive ? 'Drag outlined points · drag background to pan' : view === 'top' ? 'Contact checked in 3D' : setup.facing === -1 ? 'Facing the outlets' : 'Facing into the room'}</text>
    <g stroke={muted} strokeWidth="1"><line x1={width - 23 - .5 * chartScale} x2={width - 23} y1={height - 32} y2={height - 32}/><line x1={width - 23 - .5 * chartScale} x2={width - 23 - .5 * chartScale} y1={height - 35} y2={height - 29}/><line x1={width - 23} x2={width - 23} y1={height - 35} y2={height - 29}/></g>
    <text x={width - 23 - .25 * chartScale} y={height - 41} textAnchor="middle" fontSize={8 * fontScale} fontFamily="inherit" fill={muted}>50 cm</text>
  </svg>;
}
