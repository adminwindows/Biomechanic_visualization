import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Vec3 } from './engine';
import { vadd, vmul, vnorm, type CompoundPose } from './compoundEngine';
import { instrumentPalette, taperedSegment } from './instrumentGraphics';
import './instrument.css';

type Props = { pose: CompoundPose; bounds: Vec3[]; camera: [number, number]; onCamera: (camera: [number, number]) => void; label: 'A' | 'B' };
/** Orthographic camera rotation affects projection only, never geometry or mechanics. */
export function rotateCompound(point: Vec3, camera: [number, number]): Vec3 {
  const yaw = camera[0] * Math.PI / 180, pitch = camera[1] * Math.PI / 180;
  const x = Math.cos(yaw) * point[0] - Math.sin(yaw) * point[1];
  const depth = Math.sin(yaw) * point[0] + Math.cos(yaw) * point[1];
  return [x, Math.cos(pitch) * depth - Math.sin(pitch) * point[2], Math.sin(pitch) * depth + Math.cos(pitch) * point[2]];
}
export function CompoundOrbit({ pose, bounds, camera, onCamera, label }: Props) {
  const svgRef = useRef<SVGSVGElement>(null), [renderedWidth, setRenderedWidth] = useState(500);
  useEffect(() => { const svg = svgRef.current; if (!svg) return; const resize = () => setRenderedWidth(Math.max(260, svg.getBoundingClientRect().width)); resize(); const observer = new ResizeObserver(resize); observer.observe(svg); return () => observer.disconnect(); }, []);
  const fontScale = Math.max(1, 500 / renderedWidth);
  const id = useId().replace(/:/g, ''), color = label === 'A' ? instrumentPalette.teal : instrumentPalette.coral;
  const drag = useRef<{ x: number; y: number; camera: [number, number] } | null>(null);
  const framing = useMemo(() => { const pts = bounds.map(point => rotateCompound(point, camera)); return { x0: Math.min(...pts.map(p => p[0])) - .2, x1: Math.max(...pts.map(p => p[0])) + .2, z0: Math.min(-.1, ...pts.map(p => p[2])) - .1, z1: Math.max(...pts.map(p => p[2])) + .2 }; }, [bounds, camera]);
  const scale = Math.min(450 / (framing.x1 - framing.x0), 254 / (framing.z1 - framing.z0));
  const project = (point: Vec3) => { const v = rotateCompound(point, camera); return [250 + (v[0] - (framing.x0 + framing.x1) / 2) * scale, 164 - (v[2] - (framing.z0 + framing.z1) / 2) * scale]; };
  const line = (a: Vec3, b: Vec3, stroke: string, width: number, dashed = false) => <line x1={project(a)[0]} y1={project(a)[1]} x2={project(b)[0]} y2={project(b)[1]} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={dashed ? '4 4' : undefined}/>;
  const finish = (event: PointerEvent<SVGSVGElement>) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const loads = pose.loads.filter(load => !load.id.startsWith('body-'));
  const hasCable = loads.some(load => load.kind === 'cable');
  const head = pose.points.head;
  const shoulderBreadth = pose.points.shoulderL && pose.points.shoulderR ? Math.abs(project(pose.points.shoulderR)[0] - project(pose.points.shoulderL)[0]) : .2 * scale;
  return <svg ref={svgRef} className="compound-scene" viewBox="0 0 500 350" role="img" aria-label={`${label} articulated 3D pose; drag to orbit`} onPointerDown={event => { if (event.button !== 0) return; drag.current = { x: event.clientX, y: event.clientY, camera: [...camera] }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const d = drag.current; if (d) onCamera([Math.max(-180, Math.min(180, d.camera[0] + (event.clientX - d.x) * .5)), Math.max(-70, Math.min(70, d.camera[1] - (event.clientY - d.y) * .35))]); }} onPointerUp={finish} onPointerCancel={finish} style={{ touchAction: 'none' }}>
    <title>{label}: shared-scale articulated pose</title><desc>Drag to orbit the camera. Numerical yaw and pitch controls provide a keyboard alternative. Support marks identify prescribed contacts; they do not show calculated reaction forces. Arrow lengths show load directions, not force magnitudes.</desc>
    <defs>{[['force', color], ['gravity', instrumentPalette.gravity]].map(([name, fill]) => <marker key={name} id={`${id}-${name}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill={fill}/></marker>)}<clipPath id={`${id}-scene`}><rect x="12" y="36" width="476" height="258"/></clipPath></defs>
    <rect width="500" height="350" fill={instrumentPalette.paper}/>
    <path d="M12 32H488M12 297H488" fill="none" stroke="#d9e2e9" strokeWidth=".8"/>
    <rect x="16" y="10" width="17" height="17" rx="3" fill={color}/><text x="24.5" y="22.3" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{label}</text>
    <text x="42" y="23" fontSize={9 * fontScale} letterSpacing=".8" fill={instrumentPalette.muted}>3D MODEL</text><text x="482" y="23" textAnchor="end" fontSize={9 * fontScale} fill={instrumentPalette.muted}>{Math.round(camera[0])}° yaw · {Math.round(camera[1])}° tilt</text>
    <g clipPath={`url(#${id}-scene)`}>
      {Array.from({ length: 21 }, (_, i) => { const a = (i - 10) * .2; return <g key={i}>{line([a, -2, 0], [a, 2, 0], i % 5 === 0 ? '#cdd9e2' : '#e0e7ed', i % 5 === 0 ? .9 : .5)}{line([-2, a, 0], [2, a, 0], i % 5 === 0 ? '#cdd9e2' : '#e0e7ed', i % 5 === 0 ? .9 : .5)}</g>; })}
      {pose.supports.map((support, i) => <g key={i}><title>{support.kind}: prescribed support; reaction unavailable</title>{support.end && <>{line(support.point, support.end, '#7f97a9', 8)}{line(support.point, support.end, '#c6d3dd', 4)}</>}{line(vadd(support.point, [-.11, 0, -.035]), vadd(support.point, [.11, 0, -.035]), '#7f97a9', 4)}{line(support.point, vadd(support.point, [0, 0, -.08]), '#7f97a9', 2)}<circle cx={project(support.point)[0]} cy={project(support.point)[1]} r="3" fill="#fff" stroke="#7f97a9" strokeWidth="1.2"/></g>)}
      {pose.points.leverPivot && pose.points.leverHandle && <g>{line(pose.points.leverPivot, pose.points.leverHandle, '#8fa4b4', 5)}<circle cx={project(pose.points.leverPivot)[0]} cy={project(pose.points.leverPivot)[1]} r="7" fill="#e3ebf0" stroke="#7a92a4" strokeWidth="1.5"/><circle cx={project(pose.points.leverPivot)[0]} cy={project(pose.points.leverPivot)[1]} r="2" fill="#7a92a4"/></g>}
      {loads.filter(load => load.kind === 'cable').map(load => { const outlet=pose.points[`outlet${load.id.replace('cable', '')}`]; return outlet && <g key={`cable-${load.id}`}>{line(load.point, outlet, color, 1.5)}{line(outlet,vadd(outlet,[0,0,-.16]),'#8fa4b4',4)}<circle cx={project(outlet)[0]} cy={project(outlet)[1]} r="6" fill="#fff" stroke={color} strokeWidth="1.8"/><circle cx={project(outlet)[0]} cy={project(outlet)[1]} r="2" fill={color}/></g>; })}
      {pose.segments.slice().sort((a, b) => rotateCompound(a.from, camera)[1] - rotateCompound(b.from, camera)[1]).map(segment => {
        const body=segment.massKey==='trunk', arm=['upperArm','forearm'].includes(segment.massKey);
        const breadth=body?Math.max(.17*scale,shoulderBreadth*.8):Math.max(4,segment.width*scale);
        if(segment.massKey==='head') return <g key={segment.id}>{line(segment.from,segment.to,'#425d70',Math.max(3,.06*scale))}</g>;
        return <g key={segment.id} opacity={pose.valid ? 1 : .42}><path d={taperedSegment(project(segment.from),project(segment.to),body?breadth*.72:breadth,body?breadth:breadth*.7)} fill={body?'#c9d6e0':arm?'#3c586d':'#bacbd8'} stroke="#425d70" strokeWidth="1.1"/>{body?line(segment.from,segment.to,'#edf3f7',.7):<circle cx={project(segment.from)[0]} cy={project(segment.from)[1]} r={Math.max(2,breadth*.17)} fill="#f5f8fa" stroke="#425d70" strokeWidth="1"/>}</g>;
      })}
      {head && <g opacity={pose.valid ? 1 : .42}><circle cx={project(head)[0]} cy={project(head)[1]} r={Math.max(6,.095*scale)} fill="#dce5eb" stroke="#425d70" strokeWidth="1.3"/>{line(vadd(head,[.07,0,0]),vadd(head,[.13,0,0]),'#425d70',1.5)}</g>}
      {loads.map(load => { const from = project(load.point), length = vnorm(load.force); if (!length) return null; const to = project(vadd(load.point, vmul(load.force, .3 / length))), gravity=load.kind==='gravity', stroke=gravity?instrumentPalette.gravity:color; return <g key={load.id}><title>{gravity?'Gravity':'Applied force'}: {length.toFixed(1)} N; arrow length indicates direction only</title><circle cx={from[0]} cy={from[1]} r="4" fill={stroke} stroke="#fff" strokeWidth="1"/><line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={stroke} strokeWidth="2" markerEnd={`url(#${id}-${gravity?'gravity':'force'})`}/></g>; })}
    </g>
    <g aria-hidden="true" opacity=".8">{([[1,0,0],[0,1,0],[0,0,1]] as Vec3[]).map((axis,i)=>{const end=rotateCompound(axis,camera),x=448+end[0]*23,y=269-end[2]*23;return <g key={i}><line x1="448" y1="269" x2={x} y2={y} stroke="#718a9d" strokeWidth="1.1"/><text x={x+(i===2?4:5)} y={y+3} fontSize={8*fontScale} fill="#607383">{['X','Y','Z'][i]}</text></g>;})}<circle cx="448" cy="269" r="2" fill="#718a9d"/></g>
    {loads.length > 0 ? <line x1="18" x2="36" y1="313" y2="313" stroke={hasCable?color:instrumentPalette.gravity} strokeWidth="1.8" markerEnd={`url(#${id}-${hasCable?'force':'gravity'})`}/> : <path d="M18 316H36M27 308V316" fill="none" stroke="#7f97a9" strokeWidth="1.7"/>}<text x="44" y="317" fontSize={9*fontScale} fill={instrumentPalette.muted}>{loads.length?'Force direction':'Prescribed supports'}</text>
    <text x="18" y="338" fontSize={8.5 * fontScale} fill={instrumentPalette.muted}>Drag to orbit · reactions unavailable</text>
    <g stroke={instrumentPalette.muted} strokeWidth="1"><line x1={480-.5*scale} x2="480" y1="333" y2="333"/><line x1={480-.5*scale} x2={480-.5*scale} y1="330" y2="336"/><line x1="480" x2="480" y1="330" y2="336"/></g><text x={480 - .25 * scale} y="321" textAnchor="middle" fontSize={8 * fontScale} fill={instrumentPalette.muted}>50 cm</text>
  </svg>;
}
