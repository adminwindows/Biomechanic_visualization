import { Field } from './Field';
import { getOutletPosition, type Profile, type Setup, type Vec3 } from './engine';

type Props={setup:Setup;profile:Profile;letter:string;change:(key:keyof Setup,value:unknown)=>void};
/** Explicit apparatus geometry and declared travel constraints; no hidden machine assumptions. */
export function AdvancedExerciseControls({setup:s,letter:L,change}:Props) {
  const cable=s.resistance!=='dumbbell'&&s.resistance!=='unknown'&&s.model!=='machine';
  const obstacles=s.obstacles??[],limits=s.equipmentLimits;
  const number=(key:keyof Setup,label:string,value:number,min:number,max:number,scale=1,unit='cm',step=1,note?:string)=><Field key={key} label={`${L} · ${label}`} value={value*scale} min={min} max={max} unit={unit} step={step} note={note} onChange={v=>change(key,v/scale)}/>;
  const vector=(label:string,value:Vec3,onChange:(value:Vec3)=>void,positive=false)=>value.map((v,i)=><Field key={`${label}-${i}`} label={`${L} · ${label} ${['X','Y','Z'][i]}`} value={v*100} min={positive?0.1:label.startsWith('Outlet')&&i===2?0:-1000} max={positive?2000:1000} unit="cm" step={1} onChange={next=>onChange(value.map((x,k)=>k===i?next/100:x) as Vec3)}/>);
  const updateObstacle=(index:number,patch:object)=>change('obstacles',obstacles.map((o,i)=>i===index?{...o,...patch}:o));
  const addObstacle=(type:'box'|'capsule')=>change('obstacles',[...obstacles,type==='box'?{id:crypto.randomUUID(),name:'Seat / frame box',type,center:[s.hipX,s.hipY??0,.25],size:[.5,.5,.1],allowBodyContact:true}:{id:crypto.randomUUID(),name:'Frame rail',type,a:[s.hipX-.5,s.hipY??0,0],b:[s.hipX-.5,s.hipY??0,1],radius:.03}]);
  return <details><summary>Equipment geometry & clearance</summary><div className="details-content">
    {number('hipY','Body lateral offset',s.hipY??0,-500,500,100)}
    {cable&&<>
      {number('planeOffset','Outlet fore–aft offset',s.planeOffset??0,-200,200,100,'cm',1,'Nominal outlet X; explicit outlet coordinates below override it.')}
      <label className="select-field">Stack arrangement<select aria-label={`${L} stack arrangement`} value={s.stackArrangement??'independent'} onChange={e=>change('stackArrangement',e.target.value)}><option value="independent">Independent stacks</option><option value="shared">One shared stack</option></select></label>
      <p className="small-note">Enter actual force at each attachment. For selected mass, the transmission factor is force at one attachment divided by total selected weight; a shared stack is not counted twice.</p>
      {number('cableRadius','Cable radius',s.cableRadius??.003,.1,50,1000,'mm',.1)}
      <label className="inline-check"><input type="checkbox" checked={Boolean(s.outletPositions)} onChange={e=>change('outletPositions',e.target.checked?Array.from({length:s.cables},(_,i)=>getOutletPosition(s,i,s.cables===1?0:i===0?-1:1)):undefined)}/>Set each outlet independently</label>
      {s.outletPositions?.map((outlet,i)=><div key={i}>{vector(`Outlet ${i+1}`,outlet,v=>change('outletPositions',s.outletPositions!.map((p,j)=>i===j?v:p)))}</div>)}
      <label className="inline-check"><input type="checkbox" checked={s.cableTravelMin!==undefined} onChange={e=>change('cableTravelMin',e.target.checked?0:undefined)}/>Declare minimum free cable length</label>
      {s.cableTravelMin!==undefined&&number('cableTravelMin','Minimum cable length',s.cableTravelMin,0,(s.cableTravelMax??20)*100,100)}
      <label className="inline-check"><input type="checkbox" checked={s.cableTravelMax!==undefined} onChange={e=>change('cableTravelMax',e.target.checked?Math.max(s.cableTravelMin??0,5):undefined)}/>Declare maximum free cable length</label>
      {s.cableTravelMax!==undefined&&number('cableTravelMax','Maximum cable length',s.cableTravelMax,(s.cableTravelMin??0)*100,2000,100)}
      <p className="small-note">Free segment length is a declared routing constraint. Beyond a stop the assumed direct cable force is unavailable; this is not a modeled stack mechanism.</p>
    </>}
    {number('barRadius','Rigid bar radius',s.barRadius??.015,1,100,1000,'mm',1)}
    <label className="inline-check"><input type="checkbox" checked={Boolean(limits)} onChange={e=>change('equipmentLimits',e.target.checked?{pulleyMin:.05,pulleyMax:3,distanceMin:0,distanceMax:3}:undefined)}/>Declare apparatus adjustment limits</label>
    {limits&&<>{(['pulleyMin','pulleyMax','distanceMin','distanceMax'] as const).map(key=><Field key={key} label={`${L} · ${{pulleyMin:'Minimum outlet height',pulleyMax:'Maximum outlet height',distanceMin:'Minimum pelvis X',distanceMax:'Maximum pelvis X'}[key]}`} value={limits[key]*100} min={key.startsWith('pulley')?1:-1000} max={key.startsWith('pulley')?500:1000} unit="cm" onChange={v=>{const n={...limits,[key]:v/100};if(n.pulleyMin<=n.pulleyMax&&n.distanceMin<=n.distanceMax)change('equipmentLimits',n);}}/>)}<label className="inline-check"><input type="checkbox" checked={s.exploration??false} onChange={e=>change('exploration',e.target.checked)}/>Explore outside declared adjustment limits</label><p className="small-note">Pelvis X uses the displayed world origin. These input limits describe the represented installation, not anatomical limits or collision surfaces.</p></>}
    <label className="inline-check"><input type="checkbox" checked={s.bodyCollision??false} onChange={e=>change('bodyCollision',e.target.checked)}/>Check represented body capsules</label>
    {s.bodyCollision&&<>{number('bodyRadius','Illustrative body capsule radius',s.bodyRadius??.06,.5,30,100,'cm',.5)}{number('collisionAttachmentClearance','Attachment contact allowance',s.collisionAttachmentClearance??.1,2,30,100,'cm',.5)}<p className="small-note">Uniform capsule radii are explicit geometric approximations. A short attachment allowance excludes intended hand/ankle contact; it does not solve soft tissue or routing around the body.</p></>}
    <p className="small-note">Add measured seat or frame shapes to check contact. An omitted structure is not assumed clear.</p>
    <div className="button-row"><button disabled={obstacles.length>=20} onClick={()=>addObstacle('box')}>Add seat / frame box</button><button disabled={obstacles.length>=20} onClick={()=>addObstacle('capsule')}>Add frame capsule</button></div>
    {obstacles.map((o,i)=><details key={o.id}><summary>{o.name||`Obstacle ${i+1}`}</summary><div className="details-content"><label className="select-field">Obstacle name<input aria-label={`${L} obstacle ${i+1} name`} maxLength={120} value={o.name} onChange={e=>updateObstacle(i,{name:e.target.value})}/></label>{o.type==='box'?<>{vector(`Obstacle ${i+1} center`,o.center,v=>updateObstacle(i,{center:v}))}{vector(`Obstacle ${i+1} size`,o.size,v=>updateObstacle(i,{size:v}),true)}</>:<>{vector(`Obstacle ${i+1} endpoint A`,o.a,v=>updateObstacle(i,{a:v}))}{vector(`Obstacle ${i+1} endpoint B`,o.b,v=>updateObstacle(i,{b:v}))}<Field label={`${L} · Obstacle ${i+1} radius`} value={o.radius*100} min={.1} max={500} unit="cm" step={.1} onChange={v=>updateObstacle(i,{radius:v/100})}/></>}<label className="inline-check"><input type="checkbox" checked={o.allowBodyContact??false} onChange={e=>updateObstacle(i,{allowBodyContact:e.target.checked})}/>Allow intended body support on this shape</label><button onClick={()=>change('obstacles',obstacles.filter((_,j)=>i!==j))}>Remove {o.name||'obstacle'}</button></div></details>)}
  </div></details>;
}
