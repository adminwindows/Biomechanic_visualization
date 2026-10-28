import { useEffect, useId, useRef, useState } from 'react';
import type { Profile } from './engine';

type BodyDiagramProps = { profile: Profile; highlight?: keyof Profile };
const ink = '#334746', teal = '#007c78', muted = '#71857a';

/** Landmark illustration, not a stature-consistency or anatomical joint-centre measurement. */
export function BodyDiagram({ profile, highlight }: BodyDiagramProps) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [actualWidth, setActualWidth] = useState(360);
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const update = () => setActualWidth(Math.max(260, svg.getBoundingClientRect().width));
    update(); const observer = new ResizeObserver(update); observer.observe(svg); return () => observer.disconnect();
  }, []);
  const fontScale = Math.max(1, 360 / actualWidth);
  const thigh = profile.thigh ?? .43, shank = profile.shank ?? .43;
  const headNeck = profile.headNeck ?? .25, foot = profile.foot ?? .24;
  const hip = shank + thigh + .06, shoulder = hip + profile.torso;
  const top = Math.max(profile.height, shoulder + headNeck);
  const unit = 272 / top;
  type Point = [number, number];
  const p = ([x, z]: Point): Point => [176 + x * unit, 310 - z * unit];
  const points = (side: number) => {
    const s: Point = [side * profile.shoulderWidth / 2, shoulder];
    const e: Point = [s[0] + side * profile.upperArm * Math.sin(.18), s[1] - profile.upperArm * Math.cos(.18)];
    const w: Point = [e[0] + side * profile.forearm * Math.sin(.18), e[1] - profile.forearm * Math.cos(.18)];
    const h: Point = [w[0] + side * profile.hand * Math.sin(.18), w[1] - profile.hand * Math.cos(.18)];
    return { s, e, w, h };
  };
  const limb = (from: Point, to: Point, width: number, active = false) => <line x1={p(from)[0]} y1={p(from)[1]} x2={p(to)[0]} y2={p(to)[1]} stroke={active ? teal : ink} strokeWidth={width} strokeLinecap="round"/>;
  const dot = (at: Point) => <circle cx={p(at)[0]} cy={p(at)[1]} r="3" fill="#f3f6f0" stroke={ink} strokeWidth="1.2"/>;
  const cm = (value: number) => `${Math.round(value * 100)} cm`;
  const label = (name: string, value: number, at: Point, right: boolean, key: keyof Profile) => {
    const [x, y] = p(at), endpoint = right ? 252 : 95;
    return <g fill={highlight === key ? teal : muted}><path d={`M${x + (right ? 6 : -6)},${y} L${endpoint},${y}`} stroke={highlight === key ? teal : '#aabbb0'} strokeWidth=".75" fill="none"/><text x={right ? endpoint + 5 : endpoint - 5} y={y - 3} textAnchor={right ? 'start' : 'end'} fontSize={9 * fontScale} fontFamily="inherit">{name}</text><text x={right ? endpoint + 5 : endpoint - 5} y={y + 10 * fontScale} textAnchor={right ? 'start' : 'end'} fontSize={10 * fontScale} fontWeight="600" fontFamily="inherit">{cm(value)}</text></g>;
  };
  const left = points(-1), right = points(1);
  const pelvisHalf = (profile.pelvisWidth ?? .28) / 2;
  return <svg ref={svgRef} className="body-diagram" viewBox="0 0 360 355" role="img" aria-labelledby={`${id}-title ${id}-description`} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 7, background: '#f3f6f0' }}>
    <title id={`${id}-title`}>Body profile measurement landmarks</title>
    <desc id={`${id}-description`}>Lengths connect the model's shoulder, elbow, wrist, grip, pelvis, knee, and ankle landmarks. Entered standing height is {cm(profile.height)}. Home measurements approximate these reference points; this illustration does not verify total standing height.</desc>
    <text x="14" y="19" fontSize={9 * fontScale} fill={muted} fontFamily="inherit" letterSpacing=".5">BODY LANDMARKS</text>
    <text x="346" y="19" textAnchor="end" fontSize={9 * fontScale} fill={muted} fontFamily="inherit">Height entered: {cm(profile.height)}</text>
    <line x1="28" x2="332" y1="312" y2="312" stroke="#c6d3c8" strokeWidth="1"/>
    {limb([0, hip], [0, shoulder], Math.max(18, profile.shoulderWidth * unit * .5), highlight === 'torso')}
    {limb([-profile.shoulderWidth / 2, shoulder], [profile.shoulderWidth / 2, shoulder], 9, highlight === 'shoulderWidth')}
    {limb([0, shoulder], [0, shoulder + headNeck * .4], 6)}
    <ellipse cx={p([0, 0])[0]} cy={p([0, shoulder + headNeck * .64])[1]} rx={Math.max(7, headNeck * .34 * unit)} ry={Math.max(9, headNeck * .38 * unit)} fill="#d8dfce" stroke={ink} strokeWidth="1.4"/>
    {[-1, 1].map(side => { const arm = points(side); const h: Point = [side * pelvisHalf, hip], k: Point = [side * pelvisHalf, shank + .06], a: Point = [side * pelvisHalf, .06]; return <g key={side}>
      {limb(arm.s, arm.e, 7, highlight === 'upperArm')}{limb(arm.e, arm.w, 5.5, highlight === 'forearm')}{limb(arm.w, arm.h, 4, highlight === 'hand')}
      {limb([0, hip], h, 10)}{limb(h, k, 9, highlight === 'thigh')}{limb(k, a, 6, highlight === 'shank')}{limb(a, [a[0] + side * foot * .25, .035], 6, highlight === 'foot')}
      {[arm.s, arm.e, arm.w, arm.h, h, k, a].map((point, i) => <g key={i}>{dot(point)}</g>)}
    </g>; })}
    {label('Upper arm', profile.upperArm, [(right.s[0] + right.e[0]) / 2, (right.s[1] + right.e[1]) / 2], true, 'upperArm')}
    {label('Forearm', profile.forearm, [(right.e[0] + right.w[0]) / 2, (right.e[1] + right.w[1]) / 2], true, 'forearm')}
    {label('Wrist–grip', profile.hand, right.h, true, 'hand')}
    {label('Torso', profile.torso, [0, (shoulder + hip) / 2], false, 'torso')}
    {label(profile.thigh ? 'Thigh' : 'Thigh example', thigh, [-pelvisHalf, hip - thigh / 2], false, 'thigh')}
    {label(profile.shank ? 'Lower leg' : 'Leg example', shank, [-pelvisHalf, shank / 2 + .06], false, 'shank')}
    <path d={`M${p(left.s)[0]},${p(left.s)[1] - 12} v-4 H${p(right.s)[0]} v4`} stroke={highlight === 'shoulderWidth' ? teal : muted} strokeWidth=".8" fill="none"/>
    {label('Shoulders', profile.shoulderWidth, left.s, false, 'shoulderWidth')}
    <text x="180" y="337" textAnchor="middle" fontSize={9 * fontScale} fill={muted} fontFamily="inherit">Model landmarks · home measurements are approximate</text>
  </svg>;
}
