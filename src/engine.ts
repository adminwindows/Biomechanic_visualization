/** Pure quasi-static exercise models. Distances: m; forces: N; public angles: degrees. */
export type Vec3 = [number, number, number];
export type Profile = {
  height: number;
  upperArm: number;
  forearm: number;
  hand: number;
  torso: number;
  shoulderWidth: number;
  thigh?: number;
  shank?: number;
  foot?: number;
  pelvisWidth?: number;
  headNeck?: number;
};
export type Model = 'pullover' | 'curl' | 'extension' | 'raise' | 'fly' | 'hip' | 'machine';
export type Setup = {
  preset: string;
  name: string;
  kind: "standing" | "bench";
  facing: 1 | -1;
  /** Standing: inclination from vertical. Bench: backrest angle above floor. */
  tilt: number;
  hipX: number;
  hipHeight: number;
  pulleyHeight: number;
  outletSpacing: number;
  attachmentSpacing: number;
  cables: 1 | 2;
  /** Actual, constant tension at EACH attachment, not selected stack mass. */
  tension: number;
  elbow: number;
  backLength: number;
  backWidth: number;
  backThickness: number;
  range: [number, number];
  model?: Model;
  resistance?: 'cable' | 'dumbbell' | 'unknown';
  loadMass?: number;
  upperArmAngle?: number;
  planeOffset?: number;
  posture?: 'standing' | 'kneeling' | 'seated';
  gripWidth?: number;
  barLength?: number;
  slack?: boolean;
  forceKnown?: boolean;
  transmissionFactor?: number;
  loadMode?: 'force' | 'mass';
  segmentGravity?: boolean;
  upperArmMass?: number;
  forearmMass?: number;
  thighMass?: number;
  shankMass?: number;
};
export type Status =
  | "resists"
  | "assists"
  | "near-zero"
  | "no-force"
  | "singular"
  | "contact"
  | "invalid"
  | 'unknown'
  | 'slack';
export type Cable = {
  attachment: Vec3;
  outlet: Vec3;
  force: Vec3 | null;
  length: number;
  derivative?: Vec3;
};
export type Limb = {from:Vec3; to:Vec3; kind:'body'|'upperArm'|'forearm'|'thigh'|'shank'|'foot'};
export type AppliedLoad = {point:Vec3;force:Vec3;derivative:Vec3;kind:'gravity'|'cable'};
export type Geometry = {
  hip: Vec3;
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
  hand: Vec3;
  head: Vec3;
  backBase: Vec3;
  backTop: Vec3;
  torsoDirection: Vec3;
  normal: Vec3;
  axis: Vec3;
  handDerivative: Vec3;
  grips: [Vec3, Vec3];
  elbows: [Vec3, Vec3];
  shoulders: [Vec3, Vec3];
  wrists?: [Vec3,Vec3];
  barEnds: [Vec3, Vec3];
  backCorners: Vec3[];
  cables: Cable[];
  limbs?: Limb[];
  loads?: AppliedLoad[];
  jointOrigin?: Vec3;
  jointAxis?: Vec3;
  angleLabel?: string;
  supportValid?: boolean;
  validityReason?: string;
  gripCompatible?: boolean;
  gravityKnown?: boolean;
  hasBar?: boolean;
  supportPoints?: Vec3[];
};
export type Evaluation = {
  geometry: Geometry;
  /** Total generalized cable moment for the symmetric movement, not per shoulder. */
  moment: number | null;
  status: Status;
  contact: Vec3 | null;
  contactKind: string | null;
  cableMoment?: number | null;
  gravityMoment?: number | null;
  assumptions?: string[];
  metricLabel?: string;
  referenceAction?: string;
  outputLevel?: 'external-mechanics'|'geometry';
  validityReason?: string;
};
export type CurvePoint = {
  angle: number;
  moment: number | null;
  status: Status;
};

export const MODEL_VERSION = "biomechanics-2";
export const RAD = Math.PI / 180;
export const NUMERIC_EPSILON = 1e-9;
export const CABLE_RADIUS = 0.003;
export const BAR_RADIUS = 0.015;
export const ANKLE_HEIGHT = 0.06;

export type ExerciseDefinition = {
  id:Model; family:string; label:string; angleLabel:string; action:string;
  metricKey:string; plane:'side'|'front'|'top'; minAngle:number;maxAngle:number;
  unit:'N·m';forceConvention:string;actionDirection:1|-1;
};
export const definitions: ExerciseDefinition[] = [
  {id:'pullover',family:'Pullover',label:'Cable pullover',angleLabel:'Upper-arm elevation from torso',action:'Bring the arms toward the torso',metricKey:'symmetric-pullover-resistance',plane:'side',minAngle:0,maxAngle:200,unit:'N·m',forceConvention:'Actual force per attachment; total symmetric contribution',actionDirection:-1},
  {id:'curl',family:'Elbow flexion',label:'Cable curl',angleLabel:'Elbow flexion',action:'Flex the elbow',metricKey:'elbow-flexion-resistance',plane:'side',minAngle:0,maxAngle:160,unit:'N·m',forceConvention:'Actual force per loaded handle',actionDirection:1},
  {id:'extension',family:'Elbow extension',label:'Triceps extension',angleLabel:'Elbow flexion',action:'Extend the elbow',metricKey:'elbow-extension-resistance',plane:'side',minAngle:0,maxAngle:160,unit:'N·m',forceConvention:'Actual force per loaded handle',actionDirection:-1},
  {id:'raise',family:'Lateral raise',label:'Lateral raise',angleLabel:'Arm elevation from torso',action:'Raise the arm away from the torso',metricKey:'unilateral-shoulder-elevation-resistance',plane:'front',minAngle:0,maxAngle:160,unit:'N·m',forceConvention:'One loaded arm; cable force or dumbbell weight',actionDirection:1},
  {id:'fly',family:'Shoulder fly',label:'Cable fly',angleLabel:'Horizontal adduction from lateral',action:'Bring the hands forward and together',metricKey:'bilateral-shoulder-adduction-resistance',plane:'top',minAngle:0,maxAngle:120,unit:'N·m',forceConvention:'Independent handles; sum of two mirrored shoulder contributions',actionDirection:1},
  {id:'hip',family:'Hip movement',label:'Cable hip extension',angleLabel:'Hip extension from neutral',action:'Move the thigh backward',metricKey:'unilateral-hip-extension-resistance',plane:'side',minAngle:-30,maxAngle:90,unit:'N·m',forceConvention:'One ankle attachment; hip contribution',actionDirection:1},
  {id:'machine',family:'Machine illustration',label:'Unknown pullover machine',angleLabel:'Upper-arm elevation from torso',action:'Bring the arms toward the torso',metricKey:'unknown-machine',plane:'side',minAngle:0,maxAngle:200,unit:'N·m',forceConvention:'Unknown mechanism; no quantitative resistance',actionDirection:-1},
];
export function getDefinition(setup:Setup):ExerciseDefinition {
  const definition = definitions.find(item => item.id === (setup.model ?? 'pullover'));
  if (!definition) throw new RangeError('Unsupported exercise model.');
  return definition;
}
export function compatible(a:Setup,b:Setup):boolean {
  return getDefinition(a).metricKey === getDefinition(b).metricKey
    && (a.model ?? 'pullover') !== 'machine'
    && (!(a.model === 'curl' || a.model === 'extension') || a.cables === b.cables);
}
export function getTension(setup:Setup):number|null {
  if (setup.resistance === 'unknown' || setup.model === 'machine') return null;
  if (setup.slack) return 0;
  if (setup.forceKnown === false) return null;
  return setup.loadMode === 'mass'
    ? setup.loadMass === undefined || setup.transmissionFactor === undefined ? null : attachmentForce(setup.loadMass,setup.transmissionFactor)
    : setup.tension;
}

export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const scale = (a: Vec3, k: number): Vec3 => [
  a[0] * k,
  a[1] * k,
  a[2] * k,
];
export const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3): number => Math.hypot(...a);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function cableForce(
  attachment: Vec3,
  outlet: Vec3,
  tension: number,
): Vec3 | null {
  if (
    !Number.isFinite(tension) ||
    tension < 0 ||
    ![...attachment, ...outlet].every(Number.isFinite)
  ) {
    throw new RangeError(
      "Cable inputs must be finite and tension non-negative.",
    );
  }
  const displacement = sub(outlet, attachment);
  const distance = length(displacement);
  return distance <= NUMERIC_EPSILON
    ? null
    : scale(displacement, tension / distance);
}

export function axisMoment(
  origin: Vec3,
  application: Vec3,
  force: Vec3,
  axis: Vec3,
): number {
  return dot(axis, cross(sub(application, origin), force));
}

export function attachmentForce(
  selectedMass: number,
  transmissionFactor: number,
): number {
  if (
    ![selectedMass, transmissionFactor].every(Number.isFinite) ||
    selectedMass < 0 ||
    transmissionFactor < 0
  ) {
    throw new RangeError(
      "Mass and transmission factor must be finite and non-negative.",
    );
  }
  return selectedMass * 9.81 * transmissionFactor;
}

function validate(setup: Setup, profile: Profile, angle: number): void {
  const values = [
    angle,
    ...Object.values(profile),
    setup.tilt,
    setup.hipX,
    setup.hipHeight,
    setup.pulleyHeight,
    setup.outletSpacing,
    setup.attachmentSpacing,
    setup.tension,
    setup.elbow,
    setup.backLength,
    setup.backWidth,
    setup.backThickness,
    ...setup.range,
    ...[setup.loadMass,setup.upperArmAngle,setup.planeOffset,setup.gripWidth,setup.barLength,setup.transmissionFactor,setup.upperArmMass,setup.forearmMass,setup.thighMass,setup.shankMass].filter((v):v is number=>v!==undefined),
  ];
  if (
    !values.every(Number.isFinite) ||
    Object.values(profile).some((value) => value <= 0) ||
    setup.tension < 0 ||
    setup.outletSpacing < 0 ||
    setup.attachmentSpacing < 0 ||
    setup.backLength <= 0 ||
    setup.backWidth <= 0 ||
    setup.backThickness <= 0 ||
    setup.range[0] > setup.range[1] ||
    ![1, 2].includes(setup.cables) ||
    ![-1, 1].includes(setup.facing) ||
    !["standing", "bench"].includes(setup.kind)
    || (setup.loadMass !== undefined && setup.loadMass < 0)
    || (setup.transmissionFactor !== undefined && setup.transmissionFactor < 0)
    || (setup.gripWidth !== undefined && setup.gripWidth <= 0)
    || (setup.barLength !== undefined && setup.barLength <= 0)
    || (setup.upperArmMass !== undefined && setup.upperArmMass < 0)
    || (setup.forearmMass !== undefined && setup.forearmMass < 0)
    || (setup.thighMass !== undefined && setup.thighMass < 0)
    || (setup.shankMass !== undefined && setup.shankMass < 0)
  ) {
    throw new RangeError(
      "Invalid pullover configuration. All lengths must be positive and numeric inputs finite.",
    );
  }
}

/** q is continuous elevation from the hipward torso direction; elbow flexion is fixed. */
function pulloverGeometry(
  setup: Setup,
  profile: Profile,
  qDegrees: number,
): Geometry {
  validate(setup, profile, qDegrees);
  const q = qDegrees * RAD;
  const beta = (setup.kind === "bench" ? setup.tilt - 90 : setup.tilt) * RAD;
  const d = setup.facing;
  const torsoDirection: Vec3 = [d * Math.sin(beta), 0, Math.cos(beta)];
  const normal: Vec3 = [d * Math.cos(beta), 0, -Math.sin(beta)];
  const axis: Vec3 = [0, -d, 0];
  const hip: Vec3 = [setup.hipX, 0, setup.hipHeight];
  const shoulder = add(hip, scale(torsoDirection, profile.torso));
  const direction = (angle: number): Vec3 =>
    add(
      scale(normal, Math.sin(angle)),
      scale(torsoDirection, -Math.cos(angle)),
    );
  const derivative = (angle: number): Vec3 =>
    add(scale(normal, Math.cos(angle)), scale(torsoDirection, Math.sin(angle)));
  const distalLength=profile.forearm+profile.hand;
  const requestedGrip=setup.gripWidth??profile.shoulderWidth;
  const lateralDelta=(requestedGrip-profile.shoulderWidth)/2;
  const bend=setup.elbow*RAD;
  const barWidth=setup.barLength??Math.max(0.6,setup.attachmentSpacing+0.08);
  const gripCompatible=Math.abs(lateralDelta)<=distalLength*Math.abs(Math.sin(bend))+NUMERIC_EPSILON
    && requestedGrip<=barWidth+NUMERIC_EPSILON
    && (setup.cables===1||setup.attachmentSpacing<=barWidth+NUMERIC_EPSILON);
  const gripWidth=gripCompatible?requestedGrip:profile.shoulderWidth;
  const sagittalReach=gripCompatible?Math.sqrt(Math.max(0,distalLength*distalLength-lateralDelta*lateralDelta)):distalLength;
  const sagittalBend=sagittalReach>NUMERIC_EPSILON?Math.acos(Math.max(-1,Math.min(1,distalLength*Math.cos(bend)/sagittalReach))):0;
  const forearmAngle = q + (gripCompatible?sagittalBend:bend);
  const elbow = add(shoulder, scale(direction(q), profile.upperArm));
  const wrist = add(elbow, scale(direction(forearmAngle), sagittalReach*profile.forearm/distalLength));
  const hand = add(elbow, scale(direction(forearmAngle), sagittalReach));
  const handDerivative = add(
    scale(derivative(q), profile.upperArm),
    scale(derivative(forearmAngle), sagittalReach),
  );
  const head = add(
    add(shoulder, scale(torsoDirection, (profile.headNeck??0.24)-0.1)),
    scale(normal, 0.1),
  );
  // Bench placement is independent of torso length: changing body proportions never moves it.
  const backBase = sub(hip, scale(normal, setup.backThickness / 2 + 0.08));
  const backTop = add(backBase, scale(torsoDirection, setup.backLength));
  const pair = (point: Vec3, width: number): [Vec3, Vec3] => [
    add(point, [0, -width / 2, 0]),
    add(point, [0, width / 2, 0]),
  ];
  const grips = pair(hand, gripWidth);
  const elbows = pair(elbow, profile.shoulderWidth);
  const shoulders = pair(shoulder, profile.shoulderWidth);
  const barEnds = pair(hand, barWidth);
  const backCorners: Vec3[] = [];
  for (const along of [0, setup.backLength]) {
    for (const [lateral, depth] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      backCorners.push(
        add(
          add(add(backBase, scale(torsoDirection, along)), [
            0,
            (lateral * setup.backWidth) / 2,
            0,
          ]),
          scale(normal, (depth * setup.backThickness) / 2),
        ),
      );
    }
  }
  const sides = setup.cables === 1 ? [0] : [-1, 1];
  const cables = sides.map((side) => {
    const attachment: Vec3 = [
      hand[0],
      (side * setup.attachmentSpacing) / 2,
      hand[2],
    ];
    const outlet: Vec3 = [
      setup.planeOffset??0,
      (side * setup.outletSpacing) / 2,
      setup.pulleyHeight,
    ];
    return {
      attachment,
      outlet,
      force: getTension(setup) === null ? null : cableForce(attachment, outlet, getTension(setup)!),
      length: length(sub(outlet, attachment)),
    };
  });
  return {
    hip,
    shoulder,
    elbow,
    wrist,
    hand,
    head,
    backBase,
    backTop,
    torsoDirection,
    normal,
    axis,
    handDerivative,
    grips,
    elbows,
    shoulders,
    barEnds,
    backCorners,
    cables,
    gripCompatible,
    validityReason:gripCompatible?undefined:'Grip width, fixed elbow bend and measured segment lengths cannot close on this rigid bar. Narrow the grip or increase elbow bend.',
  };
}

/** Exact two-link planar inverse kinematics, with the forward knee branch. */
export function solveKnee(hip:Vec3,ankle:Vec3,thigh:number,shank:number,facing:1|-1):Vec3|null {
  const delta=sub(ankle,hip),distance=length(delta);
  if(distance<NUMERIC_EPSILON || distance>thigh+shank+NUMERIC_EPSILON || distance<Math.abs(thigh-shank)-NUMERIC_EPSILON) return null;
  const along=(thigh*thigh-shank*shank+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(0,thigh*thigh-along*along));
  const unit=scale(delta,1/distance);
  let perpendicular:Vec3=[-unit[2],0,unit[0]];
  if(perpendicular[0]*facing<0) perpendicular=scale(perpendicular,-1);
  return add(add(hip,scale(unit,along)),scale(perpendicular,height));
}

function addLegs(g:Geometry,setup:Setup,profile:Profile,q:number):void {
  const thigh=profile.thigh??0.43,shank=profile.shank??0.43,foot=profile.foot??0.24;
  const width=profile.pelvisWidth??0.30, posture=setup.posture??(setup.kind==='bench'?'seated':'standing');
  g.supportValid=true; g.supportPoints=[];
  for(const side of [-1,1]) {
    const hip=add(g.hip,[0,side*width/2,0]);
    let knee:Vec3|null=null,ankle:Vec3;
    if(setup.model==='hip' && side===1) {
      const direction=add(scale(g.torsoDirection,-Math.cos(q)),scale(g.normal,-Math.sin(q)));
      const derivative=add(scale(g.torsoDirection,Math.sin(q)),scale(g.normal,-Math.cos(q)));
      knee=add(hip,scale(direction,thigh)); ankle=add(knee,scale(direction,shank));
      g.hand=ankle;g.elbow=knee;g.wrist=ankle;g.handDerivative=scale(derivative,thigh+shank);
      g.jointOrigin=hip;g.jointAxis=cross(g.torsoDirection,g.normal);g.axis=g.jointAxis;
      if(ankle[2]<ANKLE_HEIGHT-NUMERIC_EPSILON) {g.supportValid=false;g.validityReason='The moving foot crosses the floor. Adjust pelvis height or range; leg lengths are preserved.';}
    } else if(posture==='kneeling') {
      const vertical=hip[2]-ANKLE_HEIGHT;
      if(vertical>=0 && vertical<=thigh) knee=add(hip,[setup.facing*Math.sqrt(Math.max(0,thigh*thigh-vertical*vertical)),0,-vertical]);
      ankle=knee?add(knee,[-setup.facing*shank,0,0]):add(hip,[0,0,-thigh-shank]);
      if(knee) g.supportPoints.push(knee);
    } else {
      const forward=posture==='seated'?0.48:setup.model==='hip'?0:0.06;
      ankle=[hip[0]+setup.facing*forward,hip[1],ANKLE_HEIGHT];
      knee=solveKnee(hip,ankle,thigh,shank,setup.facing);
      if(knee)g.supportPoints.push(ankle);
    }
    if(!knee) {
      g.supportValid=false;
      g.validityReason='Pelvis height and support position are incompatible with the measured thigh/shank lengths. Adjust placement or posture; segments are not stretched.';
      knee=add(hip,[0,0,-thigh]);ankle=add(knee,[0,0,-shank]);
    }
    const heel:Vec3=[ankle[0],ankle[1],ankle[2]-ANKLE_HEIGHT];
    g.limbs!.push({from:hip,to:knee,kind:'thigh'},{from:knee,to:ankle,kind:'shank'},
      {from:ankle,to:heel,kind:'foot'},{from:heel,to:add(heel,[setup.facing*foot,0,0]),kind:'foot'});
  }
}

/** Each family defines its own joint, motion plane, derivatives and application points. */
export function geometry(setup:Setup,profile:Profile,qDegrees:number):Geometry {
  const model=setup.model??'pullover',definition=getDefinition(setup),q=qDegrees*RAD;
  const g=pulloverGeometry(setup,profile,qDegrees);
  g.hasBar=model==='pullover'||model==='machine';g.loads=[];g.gravityKnown=true;
  g.angleLabel=definition.angleLabel;g.jointOrigin=g.shoulder;g.jointAxis=g.axis;
  if(!g.hasBar)g.gripCompatible=true;
  // A lateral raise leans in its frontal motion plane, unlike sagittal torso lean.
  if(model==='raise') {
    const beta=setup.tilt*RAD,d=setup.facing;
    g.torsoDirection=[0,d*Math.sin(beta),Math.cos(beta)];g.normal=[d,0,0];
    g.shoulder=add(g.hip,scale(g.torsoDirection,profile.torso));
    const lateral:Vec3=[0,d*Math.cos(beta),-Math.sin(beta)];
    g.shoulders=[add(g.shoulder,scale(lateral,-profile.shoulderWidth/2)),add(g.shoulder,scale(lateral,profile.shoulderWidth/2))];
    g.head=add(g.shoulder,scale(g.torsoDirection,(profile.headNeck??0.24)*0.65));
  }
  // Rebuild equipment from the same orthonormal basis after any family-specific torso rotation.
  g.backBase=sub(g.hip,scale(g.normal,setup.backThickness/2+0.08));
  g.backTop=add(g.backBase,scale(g.torsoDirection,setup.backLength));
  g.backCorners=[];
  for(const along of [0,setup.backLength])for(const [side,depth] of [[-1,-1],[1,-1],[1,1],[-1,1]])
    g.backCorners.push(add(add(add(g.backBase,scale(g.torsoDirection,along)),scale(cross(g.torsoDirection,g.normal),side*setup.backWidth/2)),scale(g.normal,depth*setup.backThickness/2)));
  g.limbs=[{from:g.hip,to:g.shoulder,kind:'body'},{from:g.shoulders[0],to:g.shoulders[1],kind:'body'}];
  const sagittal=(angle:number):Vec3=>add(scale(g.normal,Math.sin(angle)),scale(g.torsoDirection,-Math.cos(angle)));
  const sagittalDerivative=(angle:number):Vec3=>add(scale(g.normal,Math.cos(angle)),scale(g.torsoDirection,Math.sin(angle)));
  const movingSides=model==='pullover'||model==='machine'||model==='fly'||((model==='curl'||model==='extension')&&setup.cables===2)?[-1,1]:[1];
  const handDerivatives:Vec3[]=[];
  const armAxes:Vec3[]=[];
  if(model!=='pullover'&&model!=='machine') {
    for(let i=0;i<2;i++) {
      const side=i===0?-1:1,S=g.shoulders[i];
      let upper:Vec3,distal:Vec3,upperDerivative:Vec3,distalDerivative:Vec3,axis:Vec3;
      if(model==='curl'||model==='extension') {
        const upperAngle=(setup.upperArmAngle??(model==='extension'?0:0))*RAD;
        upper=sagittal(upperAngle);distal=sagittal(upperAngle+q);
        upperDerivative=[0,0,0];distalDerivative=sagittalDerivative(upperAngle+q);axis=[0,-setup.facing,0];
      } else if(model==='raise') {
        const beta=setup.tilt*RAD,lateral:Vec3=[0,setup.facing*Math.cos(beta),-Math.sin(beta)];
        const u=(angle:number)=>add(scale(lateral,Math.sin(angle)),scale(g.torsoDirection,-Math.cos(angle)));
        const du=(angle:number)=>add(scale(lateral,Math.cos(angle)),scale(g.torsoDirection,Math.sin(angle)));
        const active=side===1;
        upper=u(active?q:0);distal=u(active?q+setup.elbow*RAD:0);
        upperDerivative=active?du(q):[0,0,0];distalDerivative=active?du(q+setup.elbow*RAD):[0,0,0];axis=g.normal;
      } else if(model==='fly') {
        const lateral:Vec3=[0,side,0];
        const u=(angle:number)=>add(scale(lateral,Math.cos(angle)),scale(g.normal,Math.sin(angle)));
        const du=(angle:number)=>add(scale(lateral,-Math.sin(angle)),scale(g.normal,Math.cos(angle)));
        upper=u(q);distal=u(q+setup.elbow*RAD);upperDerivative=du(q);distalDerivative=du(q+setup.elbow*RAD);
        axis=scale(g.torsoDirection,-side*setup.facing);
      } else {
        upper=sagittal(0);distal=sagittal(0);upperDerivative=[0,0,0];distalDerivative=[0,0,0];axis=[0,-setup.facing,0];
      }
      const E=add(S,scale(upper,profile.upperArm)),H=add(E,scale(distal,profile.forearm+profile.hand));
      g.elbows[i]=E;g.grips[i]=H;
      handDerivatives[i]=add(scale(upperDerivative,profile.upperArm),scale(distalDerivative,profile.forearm+profile.hand));
      armAxes[i]=axis;
    }
    g.elbow=g.elbows[1];g.hand=g.grips[1];g.wrist=add(g.elbow,scale(sub(g.hand,g.elbow),profile.forearm/(profile.forearm+profile.hand)));
    g.handDerivative=handDerivatives[1];g.axis=armAxes[1];g.jointAxis=g.axis;
    g.jointOrigin=model==='curl'||model==='extension'?g.elbows[1]:g.shoulders[1];
    g.barEnds=[g.grips[0],g.grips[1]];
  } else {
    handDerivatives.push(g.handDerivative,g.handDerivative);armAxes.push(g.axis,g.axis);
  }
  for(let i=0;i<2;i++) {
    g.limbs.push({from:g.shoulders[i],to:g.elbows[i],kind:'upperArm'},{from:g.elbows[i],to:g.grips[i],kind:'forearm'});
  }
  g.wrists=g.elbows.map((E,i)=>add(E,scale(sub(g.grips[i],E),profile.forearm/(profile.forearm+profile.hand)))) as [Vec3,Vec3];
  addLegs(g,setup,profile,q);
  const resistance=setup.resistance??(model==='machine'?'unknown':'cable');
  if(model==='machine'||resistance==='unknown'||resistance==='dumbbell')g.cables=[];
  else if(model!=='pullover') {
    const sides=model==='fly'?[-1,1]:model==='raise'||model==='hip'?[1]:movingSides;
    g.cables=sides.map(side=>{
      const i=side===-1?0:1,attachment=model==='hip'?g.hand:g.grips[i];
      const outlet:Vec3=[setup.planeOffset??0,side*setup.outletSpacing/2,setup.pulleyHeight];
      const tension=getTension(setup),force=tension===null?null:cableForce(attachment,outlet,tension);
      return {attachment,outlet,force,length:length(sub(outlet,attachment)),derivative:model==='hip'?g.handDerivative:handDerivatives[i]};
    });
  }
  for(const cable of g.cables)if(cable.force)g.loads.push({point:cable.attachment,force:cable.force,derivative:cable.derivative??g.handDerivative,kind:'cable'});
  if(resistance==='dumbbell') {
    if(setup.loadMass===undefined)g.gravityKnown=false;
    else for(const side of movingSides) {
      const i=side===-1?0:1,point=model==='hip'?g.hand:g.grips[i];
      g.loads.push({point,force:[0,0,-setup.loadMass*9.81],derivative:model==='hip'?g.handDerivative:handDerivatives[i],kind:'gravity'});
    }
  }
  if(setup.segmentGravity) {
    if(model==='hip') {
      if(setup.thighMass===undefined||setup.shankMass===undefined)g.gravityKnown=false;
      else {
        const origin=g.jointOrigin!,thighCenter=scale(add(origin,g.elbow),0.5),shankCenter=scale(add(g.elbow,g.hand),0.5);
        g.loads.push({point:thighCenter,force:[0,0,-setup.thighMass*9.81],derivative:cross(g.axis,sub(thighCenter,origin)),kind:'gravity'},
          {point:shankCenter,force:[0,0,-setup.shankMass*9.81],derivative:cross(g.axis,sub(shankCenter,origin)),kind:'gravity'});
      }
    }
    else if(setup.upperArmMass===undefined||setup.forearmMass===undefined)g.gravityKnown=false;
    else for(const side of movingSides) {
      const i=side===-1?0:1,S=g.shoulders[i],E=g.elbows[i],H=g.grips[i],axis=armAxes[i];
      const upperCenter=scale(add(S,E),0.5),distalCenter=scale(add(E,H),0.5);
      const elbowModel=model==='curl'||model==='extension';
      g.loads.push({point:upperCenter,force:[0,0,-setup.upperArmMass*9.81],derivative:elbowModel?[0,0,0]:cross(axis,sub(upperCenter,S)),kind:'gravity'},
        {point:distalCenter,force:[0,0,-setup.forearmMass*9.81],derivative:cross(axis,sub(distalCenter,elbowModel?E:S)),kind:'gravity'});
    }
  }
  return g;
}

/** Segment vs oriented box, conservatively expanded by radius (including its corners). */
export function segmentBoxContact(
  start: Vec3,
  end: Vec3,
  origin: Vec3,
  axes: [Vec3, Vec3, Vec3],
  minimum: Vec3,
  maximum: Vec3,
  radius = 0,
): Vec3 | null {
  const local = (point: Vec3): Vec3 =>
    axes.map((axis) => dot(sub(point, origin), axis)) as Vec3;
  const a = local(start);
  const delta = sub(local(end), a);
  let enter = 0;
  let leave = 1;
  for (let i = 0; i < 3; i++) {
    const low = minimum[i] - radius;
    const high = maximum[i] + radius;
    if (Math.abs(delta[i]) <= NUMERIC_EPSILON) {
      if (a[i] < low - NUMERIC_EPSILON || a[i] > high + NUMERIC_EPSILON)
        return null;
    } else {
      const t1 = (low - a[i]) / delta[i];
      const t2 = (high - a[i]) / delta[i];
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave + NUMERIC_EPSILON) return null;
    }
  }
  return add(start, scale(sub(end, start), Math.max(0, Math.min(1, enter))));
}

export function backrestContact(
  start: Vec3,
  end: Vec3,
  g: Geometry,
  setup: Setup,
  radius = 0,
): Vec3 | null {
  return segmentBoxContact(
    start,
    end,
    g.backBase,
    [g.torsoDirection, cross(g.torsoDirection,g.normal), g.normal],
    [0, -setup.backWidth / 2, -setup.backThickness / 2],
    [setup.backLength, setup.backWidth / 2, setup.backThickness / 2],
    radius,
  );
}

export function evaluate(setup:Setup,profile:Profile,qDegrees:number):Evaluation {
  const g=geometry(setup,profile,qDegrees),definition=getDefinition(setup),model=setup.model??'pullover';
  const resistance=setup.resistance??(model==='machine'?'unknown':'cable');
  const knownCable=resistance==='dumbbell'?true:getTension(setup)!==null;
  const sign=-definition.actionDirection;
  let cableMoment:number|null=knownCable?g.cables.reduce((sum,cable)=>sum+(cable.force?sign*dot(cable.force,cable.derivative??g.handDerivative):0),0):null;
  let gravityMoment:number|null=g.gravityKnown?g.loads!.filter(load=>load.kind==='gravity').reduce((sum,load)=>sum+sign*dot(load.force,load.derivative),0):null;
  const assumptions=[
    definition.forceConvention,
    'Quasi-static: inertia and friction excluded; no muscle forces or growth prediction.',
    resistance==='dumbbell'?'Dumbbell weight acts vertically downward.':setup.slack?'Cable explicitly slack; its hanging route is not predicted.':'Tension and cable travel assumed available.',
    setup.segmentGravity?'Explicit segment masses, uniform-rod centres of mass.':'Body segment and bar weight excluded.',
    'Ground supports are kinematic constraints; reaction forces and balance are not calculated.',
  ];
  if(model==='pullover')assumptions.push('Symmetric upper arms with a solved rigid grip; fixed anatomical elbow bend; no individual shoulder force-sharing estimate.');
  if(model==='raise'&&setup.tilt!==0)assumptions.push('Frontal torso lean is prescribed; an external support is assumed, with its reaction excluded from the arm calculation.');
  const result=(status:Status,moment:number|null=null,contact:Vec3|null=null,contactKind:string|null=null,reason?:string):Evaluation=>({
    geometry:g,moment,status,contact,contactKind,cableMoment,gravityMoment,assumptions,
    metricLabel:model==='pullover'?'Total symmetric external contribution':model==='fly'?'Total bilateral shoulder-adduction contribution':`${definition.family} external contribution`,
    referenceAction:definition.action,outputLevel:status==='unknown'?'geometry':'external-mechanics',validityReason:reason,
  });
  if(resistance==='cable'&&((model==='fly'&&setup.cables!==2)||((model==='raise'||model==='hip')&&setup.cables!==1))) {
    cableMoment=null;gravityMoment=null;
    return result('invalid',null,null,null,model==='fly'?'The bilateral fly model requires two independent cable handles.':'This unilateral model requires one cable attachment.');
  }
  if(!g.supportValid||!g.gripCompatible){cableMoment=null;gravityMoment=null;return result('invalid',null,null,null,g.validityReason);}
  if([g.hip,g.shoulder,g.elbow,g.hand].some(point=>point[2]<-NUMERIC_EPSILON)||g.hand[2]<(model==='hip'?ANKLE_HEIGHT:BAR_RADIUS)-NUMERIC_EPSILON||g.cables.some(cable=>cable.outlet[2]<0)) {
    cableMoment=null;gravityMoment=null;return result('invalid',null,null,null,'A represented body segment or load crosses the floor.');
  }
  if(setup.kind==='bench') {
    for(const cable of setup.slack?[]:g.cables) {
      const contact=backrestContact(cable.attachment,cable.outlet,g,setup,CABLE_RADIUS);
      if(contact){cableMoment=null;return result('contact',null,contact,'cable–backrest','The backrest redirects the cable; direct-line mechanics are invalid.');}
    }
    if(g.hasBar) {
      const contact=backrestContact(g.barEnds[0],g.barEnds[1],g,setup,BAR_RADIUS);
      if(contact){cableMoment=null;return result('contact',null,contact,'bar–backrest','The rigid bar contacts the represented backrest.');}
    }
  }
  if(model==='machine'||resistance==='unknown'||!knownCable||!g.gravityKnown) return result('unknown',null,null,null,model==='machine'?'No mechanism or measured resistance profile has been supplied.':!knownCable?'Actual cable force or transmission factor is unknown.':'Gravity requires an explicit load mass and, when enabled, supported segment masses.');
  if(g.cables.some(cable=>cable.length<=NUMERIC_EPSILON)){cableMoment=null;return result('singular',null,null,null,'Cable attachment and outlet coincide.');}
  const moment=cableMoment!+gravityMoment!;
  const forceScale=g.loads!.reduce((sum,load)=>sum+length(load.force)*length(load.derivative),0);
  const nearZero=Math.max(1e-8,0.015*forceScale);
  const noExternalForce=g.loads!.every(load=>length(load.force)<=NUMERIC_EPSILON);
  const status:Status=noExternalForce?(resistance==='cable'&&setup.slack?'slack':'no-force'):Math.abs(moment)<=nearZero?'near-zero':moment>0?'resists':'assists';
  return result(status,moment);
}

type HarmonicPath={center:Vec3;cosine:Vec3;sine:Vec3};
function harmonicPath(zero:Vec3,ninety:Vec3,oneEighty:Vec3):HarmonicPath {
  const center=scale(add(zero,oneEighty),0.5);
  return {center,cosine:scale(sub(zero,oneEighty),0.5),sine:sub(ninety,center)};
}
function planeCrossingAngles(path:HarmonicPath,normal:Vec3,constant:number,range:[number,number]):number[] {
  const magnitude=length(normal);
  if(magnitude<1e-10)return [];
  const n=scale(normal,1/magnitude),a=dot(n,path.cosine),b=dot(n,path.sine),c=dot(n,path.center)-constant/magnitude;
  const amplitude=Math.hypot(a,b);
  if(amplitude<1e-10||Math.abs(c)>amplitude+1e-9)return [];
  const phase=Math.atan2(b,a),offset=Math.acos(Math.max(-1,Math.min(1,-c/amplitude))),angles:number[]=[];
  for(const root of [phase-offset,phase+offset])for(let turn=-2;turn<=2;turn++) {
    const angle=(root+turn*2*Math.PI)/RAD;
    if(angle>=range[0]-1e-8&&angle<=range[1]+1e-8)angles.push(Math.max(range[0],Math.min(range[1],angle)));
  }
  return angles;
}

/**
 * Exact candidate angles for the represented inflated-box contact model.
 * A rotating endpoint traces C+A cos(q)+B sin(q). First contact is either
 * on a box face or tangent to an edge (a plane through outlet and box edge).
 * Sampling every resulting interval therefore cannot skip a narrow contact.
 */
export function contactAngles(setup:Setup,profile:Profile):number[] {
  if(setup.kind!=='bench')return [];
  const poses=[0,90,180].map(q=>geometry(setup,profile,q)),g=poses[0],angles:number[]=[];
  const axes:[Vec3,Vec3,Vec3]=[g.torsoDirection,cross(g.torsoDirection,g.normal),g.normal];
  const candidatePlanes=(path:HarmonicPath,radius:number,outlet?:Vec3)=>{
    const minimum:Vec3=[-radius,-setup.backWidth/2-radius,-setup.backThickness/2-radius];
    const maximum:Vec3=[setup.backLength+radius,setup.backWidth/2+radius,setup.backThickness/2+radius];
    const corners:Vec3[]=[];
    for(let bits=0;bits<8;bits++) {
      let corner=g.backBase;
      for(let i=0;i<3;i++)corner=add(corner,scale(axes[i],bits&(1<<i)?maximum[i]:minimum[i]));
      corners.push(corner);
    }
    for(let i=0;i<3;i++)for(const bound of [minimum[i],maximum[i]])
      angles.push(...planeCrossingAngles(path,axes[i],dot(axes[i],g.backBase)+bound,setup.range));
    if(outlet)for(let i=0;i<corners.length;i++)for(let j=i+1;j<corners.length;j++) {
      const normal=cross(sub(corners[i],outlet),sub(corners[j],outlet));
      angles.push(...planeCrossingAngles(path,normal,dot(normal,outlet),setup.range));
    }
  };
  if(!setup.slack)g.cables.forEach((cable,i)=>candidatePlanes(harmonicPath(...poses.map(p=>p.cables[i].attachment) as [Vec3,Vec3,Vec3]),CABLE_RADIUS,cable.outlet));
  // Pullover bar translation has constant lateral span; longitudinal/depth faces determine entry.
  if(g.hasBar)candidatePlanes(harmonicPath(...poses.map(p=>p.hand) as [Vec3,Vec3,Vec3]),BAR_RADIUS);
  return [...new Set(angles.map(value=>Number(value.toFixed(10))))].sort((a,b)=>a-b);
}

/** Full ROM, including analytic contact candidates and samples inside every event interval. */
export function sampleCurve(setup: Setup, profile: Profile): CurvePoint[] {
  const [start, end] = setup.range;
  const point = (angle: number): CurvePoint => {
    const { moment, status } = evaluate(setup, profile, angle);
    return { angle, moment, status };
  };
  const points: CurvePoint[] = [point(start)];
  const subdivisions = Math.max(1, Math.ceil((end - start) / 0.5));
  const refine = (a: CurvePoint, b: CurvePoint, depth = 0): void => {
    const boundary = (a.moment === null) !== (b.moment === null);
    const reversal =
      a.moment !== null && b.moment !== null && a.moment * b.moment < 0;
    if ((boundary || reversal) && b.angle - a.angle > 0.02 && depth < 7) {
      const middle = point((a.angle + b.angle) / 2);
      refine(a, middle, depth + 1);
      refine(middle, b, depth + 1);
    } else points.push(b);
  };
  const candidates=[start,...contactAngles(setup,profile),end];
  const angles=new Set<number>();
  for(let i=1;i<=subdivisions;i++)angles.add(start+((end-start)*i)/subdivisions);
  for(let i=0;i<candidates.length;i++) {
    const q=candidates[i];
    angles.add(q);
    if(q-1e-5>start)angles.add(q-1e-5);
    if(q+1e-5<end)angles.add(q+1e-5);
    if(i>0)angles.add((q+candidates[i-1])/2);
  }
  for(const q of [...angles].filter(q=>q>start&&q<=end).sort((a,b)=>a-b))
    refine(points[points.length-1],point(q));
  return points;
}

/** Fictional example, not a population-derived anatomical prediction. */
export const defaultProfile: Profile = {
  height: 1.75,
  upperArm: 0.33,
  forearm: 0.27,
  hand: 0.1,
  torso: 0.59,
  shoulderWidth: 0.42,
  thigh:0.43,
  shank:0.43,
  foot:0.24,
  pelvisWidth:0.30,
  headNeck:0.24,
};

const base: Setup = {
  preset: "classic",
  model:'pullover',
  resistance:'cable',
  name: "Horizontal torso",
  kind: "standing",
  facing: -1,
  tilt: 90,
  hipX: 1.35,
  hipHeight: 0.90,
  pulleyHeight: 2.25,
  outletSpacing: 1.55,
  attachmentSpacing: 0.95,
  cables: 1,
  tension: 100,
  elbow: 0,
  backLength: 0.82,
  backWidth: 0.34,
  backThickness: 0.1,
  range: [40, 190],
};
const variant = (overrides: Partial<Setup>): Setup => ({
  ...base,
  ...overrides,
  range: overrides.range ? [...overrides.range] : [...base.range],
});
export const presets: Setup[] = [
  variant({}),
  variant({
    preset: "bench",
    name: "Bench · 60°",
    kind: "bench",
    facing: 1,
    tilt: 60,
    hipX: 1.145,
    hipHeight: 0.46,
    pulleyHeight: 1.35,
    cables: 2,
    range: [80, 190],
  }),
  variant({
    preset: "classic-far",
    name: "Horizontal torso · farther away",
    hipX: 2.25,
  }),
  variant({
    preset: "outside",
    name: "Facing away · outside",
    facing: 1,
    tilt: 0,
    hipX: 0.85,
    hipHeight: 0.90,
    pulleyHeight: 1.4,
    cables: 2,
  }),
  variant({
    preset: "inside",
    name: "Inside · leaning 60°",
    facing: 1,
    tilt: 60,
    hipX: -0.38 - 0.59 * Math.sin(60 * RAD),
    hipHeight: 0.8,
    pulleyHeight: 2.15,
    cables: 2,
  }),
  variant({
    preset: "inside-upright",
    name: "Inside · upright",
    facing: 1,
    tilt: 0,
    hipX: -0.35,
    hipHeight: 0.90,
    pulleyHeight: 2.25,
    cables: 2,
  }),
  variant({
    preset: "bench-flat",
    name: "Bench · flat",
    kind: "bench",
    facing: 1,
    tilt: 0,
    hipX: 1.55,
    hipHeight: 0.46,
    pulleyHeight: 1.35,
    cables: 2,
    range: [100, 190],
  }),
  variant({
    preset: "bench-75",
    name: "Bench · 75°",
    kind: "bench",
    facing: 1,
    tilt: 75,
    hipX: 1.145,
    hipHeight: 0.46,
    pulleyHeight: 1.35,
    cables: 2,
    range: [80, 190],
  }),
  variant({preset:'classic-kneeling',name:'Classic pullover · kneeling',model:'pullover',posture:'kneeling',facing:-1,tilt:45,hipHeight:0.49,hipX:1.25,pulleyHeight:2.1,range:[60,180]}),
  variant({preset:'curl-low',name:'Low-cable curl · arm at side',model:'curl',facing:1,tilt:0,hipX:0.75,hipHeight:0.90,pulleyHeight:0.10,outletSpacing:0.42,attachmentSpacing:0,upperArmAngle:0,range:[10,135]}),
  variant({preset:'curl-bayesian',name:'Bayesian curl · arm behind torso',model:'curl',facing:1,tilt:0,hipX:0.85,hipHeight:0.90,pulleyHeight:0.10,outletSpacing:0.42,attachmentSpacing:0,upperArmAngle:-35,range:[20,135]}),
  variant({preset:'extension-pushdown',name:'High-cable triceps pushdown',model:'extension',facing:-1,tilt:0,hipX:0.65,hipHeight:0.90,pulleyHeight:2.25,outletSpacing:0.42,upperArmAngle:0,range:[10,120]}),
  variant({preset:'extension-overhead',name:'Overhead cable triceps extension',model:'extension',facing:1,tilt:0,hipX:0.85,hipHeight:0.90,pulleyHeight:0.75,outletSpacing:0.42,upperArmAngle:180,range:[15,130]}),
  variant({preset:'raise-cable',name:'Unilateral cable lateral raise',model:'raise',facing:1,tilt:0,hipX:0.75,hipHeight:0.90,pulleyHeight:0.10,outletSpacing:0.10,planeOffset:-0.20,range:[5,120]}),
  variant({preset:'raise-dumbbell',name:'Dumbbell lateral raise · supported lean',model:'raise',resistance:'dumbbell',loadMass:5,facing:1,tilt:15,hipX:0.75,hipHeight:0.90,pulleyHeight:0.10,outletSpacing:0.10,range:[0,120]}),
  variant({preset:'fly-cable',name:'Cable fly · two independent handles',model:'fly',facing:1,tilt:0,hipX:0.75,hipHeight:0.90,pulleyHeight:1.49,outletSpacing:2.0,planeOffset:-0.40,attachmentSpacing:0,cables:2,elbow:15,range:[0,90]}),
  variant({preset:'hip-extension',name:'Cable hip extension · ankle attachment',model:'hip',facing:-1,tilt:0,hipX:0.85,hipHeight:0.92,pulleyHeight:0.10,outletSpacing:0.30,attachmentSpacing:0,range:[0,50]}),
  variant({preset:'machine-unknown',name:'Pullover machine · mechanism unknown',model:'machine',resistance:'unknown',forceKnown:false,kind:'bench',facing:1,tilt:75,hipX:1.1,hipHeight:0.46,range:[50,170]}),
];
