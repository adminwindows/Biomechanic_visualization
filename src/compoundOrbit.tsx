import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Vec3 } from './engine';
import { vadd, vmul, vnorm, type CompoundPose } from './compoundEngine';

type Props = { pose: CompoundPose; bounds: Vec3[]; camera: [number, number]; onCamera: (camera: [number, number]) => void; label: 'A' | 'B' };
/** Orthographic camera rotation affects projection only, never geometry or mechanics. */
export function rotateCompound(point: Vec3, camera: [number, number]): Vec3 {
  const yaw = camera[0] * Math.PI / 180, pitch = camera[1] * Math.PI / 180;
  const x = Math.cos(yaw) * point[0] - Math.sin(yaw) * point[1];
  const depth = Math.sin(yaw) * point[0] + Math.cos(yaw) * point[1];
  return [x, Math.cos(pitch) * depth - Math.sin(pitch) * point[2], Math.sin(pitch) * depth + Math.cos(pitch) * point[2]];
}
export function CompoundOrbit({ pose, bounds, camera, onCamera, label }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderedWidth, setRenderedWidth] = useState(500);
  useEffect(() => { const svg = svgRef.current; if (!svg) return; const resize = () => setRenderedWidth(Math.max(260, svg.getBoundingClientRect().width)); resize(); const observer = new ResizeObserver(resize); observer.observe(svg); return () => observer.disconnect(); }, []);
  const fontScale = Math.max(1, 500 / renderedWidth);
  const id = useId().replace(/:/g, ''), color = label === 'A' ? '#007c78' : '#c96b28';
  const drag = useRef<{ x: number; y: number; camera: [number, number] } | null>(null);
  const framing = useMemo(() => { const pts = bounds.map(point => rotateCompound(point, camera)); return { x0: Math.min(...pts.map(p => p[0])) - .2, x1: Math.max(...pts.map(p => p[0])) + .2, z0: Math.min(-.1, ...pts.map(p => p[2])) - .1, z1: Math.max(...pts.map(p => p[2])) + .2 }; }, [bounds, camera]);
  const scale = Math.min(450 / (framing.x1 - framing.x0), 280 / (framing.z1 - framing.z0));
  const project = (point: Vec3) => { const v = rotateCompound(point, camera); return [250 + (v[0] - (framing.x0 + framing.x1) / 2) * scale, 170 - (v[2] - (framing.z0 + framing.z1) / 2) * scale]; };
  const line = (a: Vec3, b: Vec3, stroke: string, width: number, dashed = false) => <line x1={project(a)[0]} y1={project(a)[1]} x2={project(b)[0]} y2={project(b)[1]} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={dashed ? '4 4' : undefined}/>;
  const finish = (event: PointerEvent<SVGSVGElement>) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <svg ref={svgRef} className="compound-scene" viewBox="0 0 500 340" role="img" aria-label={`${label} articulated 3D pose; drag to orbit`} onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY, camera: [...camera] }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const d = drag.current; if (d) onCamera([Math.max(-180, Math.min(180, d.camera[0] + (event.clientX - d.x) * .5)), Math.max(-70, Math.min(70, d.camera[1] - (event.clientY - d.y) * .35))]); }} onPointerUp={finish} onPointerCancel={finish} style={{ touchAction: 'none' }}>
    <title>{label}: shared-scale articulated pose</title><desc>Drag to orbit the camera. Numerical yaw and pitch controls provide a keyboard alternative. Support marks identify prescribed contacts; they do not show calculated reaction forces.</desc>
    <defs><marker id={`${id}-force`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5Z" fill={color}/></marker></defs>
    <rect width="500" height="340" fill="#f2f6ef"/>
    {Array.from({ length: 9 }, (_, i) => { const a = (i - 4) * .5; return <g key={i}>{line([a, -2, 0], [a, 2, 0], '#d6e0d5', .65)}{line([-2, a, 0], [2, a, 0], '#d6e0d5', .65)}</g>; })}
    <text x="18" y="22" fontSize={11 * fontScale} fill="#667e70">{label} · ORBIT VIEW</text><text x="482" y="22" textAnchor="end" fontSize={10 * fontScale} fill="#667e70">Drag to rotate · shared scale</text>
    {pose.supports.map((support, i) => <g key={i}>{support.end && line(support.point, support.end, '#a5b79e', 7)}{line(vadd(support.point, [-.10, 0, -.025]), vadd(support.point, [.10, 0, -.025]), '#91a68f', 5)}{line(support.point, vadd(support.point, [0, 0, -.08]), '#91a68f', 2)}</g>)}
    {pose.points.leverPivot && pose.points.leverHandle && <g>{line(pose.points.leverPivot, pose.points.leverHandle, '#829780', 5)}<circle cx={project(pose.points.leverPivot)[0]} cy={project(pose.points.leverPivot)[1]} r="6" fill="#d2ddca" stroke="#829780"/></g>}
    {pose.segments.slice().sort((a, b) => rotateCompound(a.from, camera)[1] - rotateCompound(b.from, camera)[1]).map(segment => <g key={segment.id} opacity={pose.valid ? 1 : .42}>{line(segment.from, segment.to, segment.massKey === 'head' ? '#a4b5a0' : '#354d45', Math.max(3, segment.width * scale))}<circle cx={project(segment.from)[0]} cy={project(segment.from)[1]} r={segment.massKey === 'trunk' ? 4 : 2.5} fill="#eff3e9" stroke="#354d45" strokeWidth="1"/></g>)}
    {pose.loads.filter(load => !load.id.startsWith('body-')).map(load => { const from = project(load.point), length = vnorm(load.force); if (!length) return null; const to = project(vadd(load.point, vmul(load.force, .3 / length))); const outlet = load.kind === 'cable' ? pose.points[`outlet${load.id.replace('cable', '')}`] : null; return <g key={load.id}>{outlet && <>{line(load.point, outlet, color, 1.5)}<circle cx={project(outlet)[0]} cy={project(outlet)[1]} r="5" fill="#f2f6ef" stroke={color} strokeWidth="2"/></>}<circle cx={from[0]} cy={from[1]} r="4" fill={color}/><line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={color} strokeWidth="2" markerEnd={`url(#${id}-force)`}/></g>; })}
    <text x="18" y="324" fontSize={10 * fontScale} fill="#667e70">Prescribed supports · reactions unavailable</text>
    <line x1={480 - .5 * scale} x2="480" y1="310" y2="310" stroke="#667e70"/><text x={480 - .25 * scale} y="303" textAnchor="middle" fontSize={9 * fontScale} fill="#667e70">50 cm</text>
  </svg>;
}
