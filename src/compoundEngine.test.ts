import { describe, expect, it } from 'vitest';
import { defaultProfile } from './engine';
import { compoundGeometry, compoundPresets, createCompoundConfig, evaluateCompound, G, solveChain, vcross, vnorm, vsub } from './compoundEngine';
import { COMPOUND_VERSION } from './compoundEngine';
import { initialCompound, parseCompound, parseCompoundLibrary, switchCompoundExercise, validateCompoundConfig } from './compoundState';
import { rotateCompound } from './compoundOrbit';

const zeroMasses = { trunk: 0, head: 0, upperArm: 0, forearm: 0, thigh: 0, shank: 0, foot: 0 };

describe('compound chains and boundaries', () => {
  it('closes both segments exactly and rejects unreachable targets without stretching', () => {
    const root: [number,number,number] = [0,0,0], target: [number,number,number] = [.4,0,.2];
    const solved = solveChain(root, target, .33, .37);
    expect(solved.valid).toBe(true);
    expect(vnorm(vsub(solved.joint,root))).toBeCloseTo(.33, 10);
    expect(vnorm(vsub(target,solved.joint))).toBeCloseTo(.37, 10);
    expect(solveChain(root,[2,0,0],.33,.37).valid).toBe(false);
  });
  it('all declared default presets produce finite, reachable poses across their complete paths', () => {
    for (const preset of compoundPresets) for (let i=0;i<=20;i++) {
      const config=createCompoundConfig(preset.id), pose=compoundGeometry(config,defaultProfile,i/20);
      expect(pose.reasons, `${preset.id} at ${i/20}`).toEqual([]);
      for (const point of Object.values(pose.points)) expect(point.every(Number.isFinite)).toBe(true);
      for (const side of ['L','R']) {
        expect(vnorm(vsub(pose.points[`elbow${side}`],pose.points[`shoulder${side}`]))).toBeCloseTo(defaultProfile.upperArm, 8);
        expect(vnorm(vsub(pose.points[`hand${side}`],pose.points[`elbow${side}`]))).toBeCloseTo(defaultProfile.forearm+defaultProfile.hand, 8);
        expect(vnorm(vsub(pose.points[`knee${side}`],pose.points[`hip${side}`]))).toBeCloseTo(defaultProfile.thigh!, 8);
        expect(vnorm(vsub(pose.points[`ankle${side}`],pose.points[`knee${side}`]))).toBeCloseTo(defaultProfile.shank!, 8);
      }
    }
  });
  it('checks stationary supports before interpreting external path work', () => {
    for (const preset of compoundPresets) {
      const c=createCompoundConfig(preset.id), start=compoundGeometry(c,defaultProfile,0), end=compoundGeometry(c,defaultProfile,1);
      start.supports.forEach((support,index)=>expect(vnorm(vsub(end.supports[index].point,support.point)),preset.id).toBeLessThan(1e-9));
    }
  });
  it('changes actual geometry between squat, hinge, lunge, press and row models', () => {
    const poses=['squat-back','rdl','split-squat','bench-barbell','row-seated'].map(id=>compoundGeometry(createCompoundConfig(id),defaultProfile,.7));
    expect(new Set(poses.map(pose=>JSON.stringify([pose.points.hip,pose.points.shoulder,pose.points.handR,pose.points.kneeR]))).size).toBe(5);
  });
  it('preserves camera distance and leaves source world geometry unchanged', () => {
    const point: [number,number,number]=[.4,-.2,1.5];
    expect(vnorm(rotateCompound(point,[37,24]))).toBeCloseTo(vnorm(point),12);
    expect(point).toEqual([.4,-.2,1.5]);
  });
});

describe('external mechanics only where identified', () => {
  it('matches analytic potential-energy change for a vertically translating trunk and head', () => {
    const c=createCompoundConfig('pullup-assisted'); c.masses={...zeroMasses,trunk:32,head:5}; c.assistance=100;
    const result=evaluateCompound(c,defaultProfile,.5);
    expect(result.pathResistance).toBeCloseTo((37*G-100)*.32,6);
    expect(result.jointMoments).toBeNull();
  });
  it('scales cable path effects and fixed-torso arm moments with tension', () => {
    const c=createCompoundConfig('row-seated'); c.bodyGravity=false;
    const a=evaluateCompound(c,defaultProfile,.5), b=evaluateCompound({...c,tension:c.tension*2},defaultProfile,.5);
    expect(b.pathResistance).toBeCloseTo(a.pathResistance!*2,7);
    a.jointMoments!.forEach((moment,i)=>expect(b.jointMoments![i].value).toBeCloseTo(moment.value*2,7));
  });
  it('matches cable-length work independently of force projection along the coupled path', () => {
    const c=createCompoundConfig('pullover-coupled');c.bodyGravity=false;
    const epsilon=1e-5,q=.45;
    const cableLength=(progress:number)=>{const pose=compoundGeometry(c,defaultProfile,progress);return pose.loads.filter(load=>load.kind==='cable').reduce((sum,load)=>sum+vnorm(vsub(pose.points[`outlet${load.id.replace('cable','')}`],load.point)),0);};
    const expected=c.tension*(cableLength(q+epsilon)-cableLength(q-epsilon))/(2*epsilon);
    expect(evaluateCompound(c,defaultProfile,q).pathResistance).toBeCloseTo(expected,4);
  });
  it('reports known distal arm load moments independently of unknown trunk reactions', () => {
    const c=createCompoundConfig('row-unilateral'); c.bodyGravity=false;
    const result=evaluateCompound(c,defaultProfile,.5), force=result.pose.loads.find(load=>load.id==='cable0')!;
    const expected=vcross(vsub(force.point,result.pose.points.elbowR),force.force)[1];
    expect(result.jointMoments!.find(moment=>moment.label.startsWith('R elbow'))!.value).toBeCloseTo(expected,10);
    expect(result.jointMoments).toHaveLength(2);
  });
  it('does not invent joint torques from a bar load in squats or support-constrained presses', () => {
    for (const id of ['squat-back','deadlift','pushup','dip','nordic','leg-press']) expect(evaluateCompound(createCompoundConfig(id),defaultProfile,.5).jointMoments).toBeNull();
  });
  it('keeps an unknown machine unavailable even if the user changes the load selector', () => {
    const c=createCompoundConfig('press-machine'); c.resistance='gravity';c.loadMass=100;
    const result=evaluateCompound(c,defaultProfile,.5);
    expect(result.status).toBe('geometry');expect(result.pathResistance).toBeNull();expect(result.jointMoments).toBeNull();
  });
  it('distinguishes zero load from unknown force and impossible anatomy', () => {
    const c=createCompoundConfig('row-seated');c.bodyGravity=false;c.tension=0;
    expect(evaluateCompound(c,defaultProfile,.5).status).toBe('near-zero');
    expect(evaluateCompound({...c,resistance:'unknown'},defaultProfile,.5).status).toBe('geometry');
    expect(evaluateCompound({...c,gripWidth:2},defaultProfile,.5).status).toBe('invalid');
  });
  it('does not differentiate a fallback joint beyond a reachable-workspace boundary', () => {
    const c=createCompoundConfig('bench-barbell'),q=.9,arm=defaultProfile.upperArm+defaultProfile.forearm+defaultProfile.hand;
    c.gripWidth=defaultProfile.shoulderWidth+2*arm*Math.sqrt(1-(.32+.57*q)**2);
    expect(compoundGeometry(c,defaultProfile,q).valid).toBe(true);
    const result=evaluateCompound(c,defaultProfile,q);
    expect(result.pathResistance).toBeNull();expect(result.status).toBe('geometry');expect(result.explanation).toContain('kinematic boundary');
  });
  it('changes the coupled pullover hand path with elbow motion while preserving the upper arm', () => {
    const c=createCompoundConfig('pullover-coupled'), fixed={...c,elbowEnd:c.elbowStart};
    const a=compoundGeometry(c,defaultProfile,.75), b=compoundGeometry(fixed,defaultProfile,.75);
    expect(a.points.elbowR).toEqual(b.points.elbowR);expect(vnorm(vsub(a.points.handR,b.points.handR))).toBeGreaterThan(.1);
    expect(evaluateCompound(c,defaultProfile,.75).jointMoments).toHaveLength(4);
  });
  it('retains an external pelvis moment in Pallof press rather than equating small motion with no load', () => {
    const result=evaluateCompound(createCompoundConfig('pallof'),defaultProfile,.8);
    expect(Math.abs(result.jointMoments![0].value)).toBeGreaterThan(1);
    expect(result.jointMoments![0].label).toContain('not spinal joint torque');
  });
});

describe('portable compound snapshots', () => {
  it('accepts every declared default preset and keeps rigid lever lengths constant', () => {
    for (const preset of compoundPresets) expect(validateCompoundConfig(createCompoundConfig(preset.id))).toEqual(createCompoundConfig(preset.id));
    for (const id of ['row-tbar','landmine-press']) { const config=createCompoundConfig(id), a=compoundGeometry(config,defaultProfile,0), b=compoundGeometry(config,defaultProfile,1); expect(vnorm(vsub(a.points.leverHandle,a.points.leverPivot))).toBeCloseTo(vnorm(vsub(b.points.leverHandle,b.points.leverPivot)),10); }
  });
  it('round-trips all settings, dimensions and library snapshots', () => {
    const state=initialCompound([defaultProfile,{...defaultProfile,upperArm:.38}]);state.configs[1]=createCompoundConfig('pullover-coupled');state.notes='Declared fictional masses';
    const restored=parseCompound(JSON.stringify(state));expect(restored).toEqual(state);
    const library=[{id:'example',name:'Pair',updatedAt:'2026-10-28T01:00:00Z',snapshot:state}];
    expect(parseCompoundLibrary(JSON.stringify(library))).toEqual(library);
  });
  it('retains independent per-exercise configurations and positions through switching and serialization', () => {
    const state=initialCompound([defaultProfile,defaultProfile]);state.sync=false;
    state.configs[0].tension=175;state.configs[0].outlet=[1.2,.3,.8];state.positions[0]=.7;
    const original=structuredClone(state.configs[0]), other=structuredClone(state.configs[1]);
    switchCompoundExercise(state,0,'bench-barbell');state.configs[0].loadMass=63;
    const saved=parseCompound(JSON.stringify(state));
    switchCompoundExercise(saved,0,'row-seated');
    expect(saved.configs[0]).toEqual(original);expect(saved.positions).toEqual([.7,.5]);expect(saved.configs[1]).toEqual(other);
    switchCompoundExercise(saved,0,'bench-barbell');expect(saved.configs[0].loadMass).toBe(63);
    saved.sync=true;switchCompoundExercise(saved,0,'row-seated');expect(saved.positions).toEqual([.7,.7]);
  });
  it('validates every stored exercise draft and rejects mismatched identifiers', () => {
    const state=initialCompound([defaultProfile,defaultProfile]);switchCompoundExercise(state,0,'bench-barbell');
    state.drafts![0]['row-seated'].config.preset='press-machine';
    expect(()=>parseCompound(JSON.stringify(state))).toThrow();
  });
  it('rejects mismatched synchronized positions and fabricated known forces for unknown machines', () => {
    const state=initialCompound([defaultProfile,defaultProfile]);state.positions=[.2,.7];
    expect(()=>parseCompound(JSON.stringify(state))).toThrow('Synchronized');
    state.positions=[.5,.5];state.configs[0]=createCompoundConfig('press-machine');state.configs[0].resistance='gravity';
    expect(()=>parseCompound(JSON.stringify(state))).toThrow('unknown mechanism');
  });
  it('rejects non-finite/out-of-range settings, unsupported model versions and invalid library entries', () => {
    const state=initialCompound([defaultProfile,defaultProfile]);
    expect(()=>parseCompound(JSON.stringify({...state,modelVersion:'future'}))).toThrow();
    const bad=structuredClone(state);bad.configs[0].tension=Infinity;
    expect(()=>parseCompound(JSON.stringify(bad))).toThrow();
    expect(()=>parseCompoundLibrary(JSON.stringify([{id:'duplicate',name:'A',updatedAt:'bad',snapshot:state}]))).toThrow();
    expect(state.modelVersion).toBe(COMPOUND_VERSION);
  });
});
