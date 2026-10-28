import type { MachinePoint } from './machine';
export type CalibrationOptions={
  quantity:'force'|'moment';valueUnit:'N'|'kgf'|'N·m'|'kgf·m';angleUnit:'degrees'|'radians';
  method:'sample-sd'|'standard-error'|'half-range'|'instrument-only';instrumentUncertainty:number;
  protocol:string;source:string;brand:string;model:string;
};
export type CalibrationGroup={angle:number;count:number;mean:number;sampleSD:number|null;standardError:number|null;halfRange:number;instrumentAllowance:number;displaySpread:number};
export type MachineCalibration={version:1;liftingCSV:string;loweringCSV:string;options:CalibrationOptions;groups:{lifting:CalibrationGroup[];lowering:CalibrationGroup[]};curveModified:boolean};
export type CalibrationBuild={lifting:MachinePoint[];lowering:MachinePoint[];domain:[number,number];calibration:MachineCalibration};
const G=9.80665; // Exact conventional kilogram-force, not the example engine's rounded g.
const fail=(message:string):never=>{throw new Error(message);};
const finite=(v:unknown,label:string,min=0,max=10000):number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail(`${label} must be finite and between ${min} and ${max}.`);
function text(v:unknown,label:string,max:number,required=true):string{return typeof v==='string'&&v.length<=max&&(!required||v.trim())?v:fail(`${label} is required and must be at most ${max} characters.`);}
function choice<T extends string>(v:unknown,label:string,allowed:T[]):T{return allowed.includes(v as T)?v as T:fail(`${label} is unsupported.`);}
export function validateCalibrationOptions(input:unknown):CalibrationOptions {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Calibration options must be an object.');
  const o=input as Record<string,unknown>;
  const quantity=choice(o.quantity,'Recorded quantity',['force','moment']),valueUnit=choice(o.valueUnit,'Recorded unit',['N','kgf','N·m','kgf·m']);
  if((quantity==='force')!==['N','kgf'].includes(valueUnit))fail('The recorded unit must match force or moment.');
  return {quantity,valueUnit,angleUnit:choice(o.angleUnit,'Angle unit',['degrees','radians']),method:choice(o.method,'Spread method',['sample-sd','standard-error','half-range','instrument-only']),instrumentUncertainty:finite(o.instrumentUncertainty,'Instrument allowance',0,1000),protocol:text(o.protocol,'Measurement protocol',4000),source:text(o.source,'Measurement source',2000),brand:text(o.brand,'Machine brand',120),model:text(o.model,'Machine model',120)};
}
/** Numeric CSV, semicolon or tab-separated rows; quoted fields are supported. */
function cells(line:string):string[] {
  const delimiter=line.includes('\t')?'\t':line.includes(';')?';':',';
  const result:string[]=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){result.push(value.trim());value='';}else value+=c;}
  if(quoted)fail('A CSV field has an unclosed quote.');result.push(value.trim());return result;
}
function branchData(csv:string,options:CalibrationOptions,label:string):{points:MachinePoint[];groups:CalibrationGroup[]} {
  if(typeof csv!=='string'||new TextEncoder().encode(csv).byteLength>100000)fail(`${label} CSV must be at most 100 kB.`);
  const lines=csv.split(/\r?\n/).filter(line=>line.trim());
  if(!lines.length)return {points:[],groups:[]};
  if(lines.length>5001)fail(`${label} supports at most 5000 raw readings.`);
  let indices={angle:0,value:1,uncertainty:2,repeat:3},start=0;
  const first=cells(lines[0]);
  if(first[0]===''||!Number.isFinite(Number(first[0]))) {
    const names=first.map(cell=>cell.toLowerCase());
    if(names.some(name=>!['angle','value','force','moment','uncertainty','repeat'].includes(name))||new Set(names).size!==names.length)fail(`${label}: header must use angle,value,uncertainty,repeat (uncertainty/repeat optional).`);
    if(names.filter(n=>['value','force','moment'].includes(n)).length!==1)fail(`${label} header must contain exactly one value, force or moment column.`);
    if(names.includes(options.quantity==='force'?'moment':'force'))fail(`${label} header quantity conflicts with the selected recorded quantity.`);
    indices={angle:names.indexOf('angle'),value:names.findIndex(n=>['value','force','moment'].includes(n)),uncertainty:names.indexOf('uncertainty'),repeat:names.indexOf('repeat')};
    if(indices.angle<0||indices.value<0)fail(`${label} header needs angle and value.`);start=1;
  }
  const factor=options.valueUnit.startsWith('kgf')?G:1,byAngle=new Map<number,{values:number[];allowances:number[];repeats:Set<string>}>();
  for(let index=start;index<lines.length;index++) {
    const row=cells(lines[index]);
    if(row.length<2||row.length>4)fail(`${label} row ${index+1}: expected 2–4 columns.`);
    const read=(column:number,name:string,optional=false)=>{const cell=column<0?undefined:row[column];if(optional&&(cell===undefined||cell===''))return 0;if(cell===undefined||cell===''||!Number.isFinite(Number(cell)))fail(`${label} row ${index+1}: ${name} must be numeric.`);return Number(cell);};
    let angle=read(indices.angle,'angle');if(options.angleUnit==='radians')angle*=180/Math.PI;
    angle=Number(angle.toFixed(10));finite(angle,'Converted angle',-180,360);
    const value=read(indices.value,'value')*factor,allowance=read(indices.uncertainty,'uncertainty',true)*factor;
    finite(value,'Converted value',options.quantity==='force'?0:-10000,10000);finite(allowance,'Converted uncertainty',0,10000);
    const group=byAngle.get(angle)??{values:[],allowances:[],repeats:new Set<string>()};
    const repeat=indices.repeat>=0?row[indices.repeat]:undefined;
    if(repeat){if(repeat.length>120||group.repeats.has(repeat))fail(`${label} angle ${angle}: repeat identifiers must be unique at each angle.`);group.repeats.add(repeat);}
    group.values.push(value);group.allowances.push(allowance);byAngle.set(angle,group);
  }
  if(byAngle.size<2||byAngle.size>500)fail(`${label} needs 2–500 distinct angles; repeated readings may share an angle.`);
  const groups=[...byAngle].sort(([a],[b])=>a-b).map(([angle,data]):CalibrationGroup=>{
    const count=data.values.length,mean=data.values.reduce((a,b)=>a+b,0)/count;
    const sampleSD=count>1?Math.sqrt(data.values.reduce((sum,value)=>sum+(value-mean)**2,0)/(count-1)):null;
    const standardError=sampleSD===null?null:sampleSD/Math.sqrt(count),halfRange=(Math.max(...data.values)-Math.min(...data.values))/2;
    const instrumentAllowance=Math.max(options.instrumentUncertainty*factor,...data.allowances);
    if(options.method!=='instrument-only'&&count<2)fail(`${label} at ${angle}° needs at least two repeated readings for the selected repeat statistic.`);
    if(options.method==='instrument-only'&&instrumentAllowance<=0)fail(`${label} at ${angle}° needs an explicit positive instrument allowance or row uncertainty.`);
    const statistic=options.method==='sample-sd'?sampleSD!:options.method==='standard-error'?standardError!:options.method==='half-range'?halfRange:0;
    const displaySpread=instrumentAllowance+statistic;
    finite(displaySpread,'Combined displayed spread',0,10000);
    return {angle,count,mean,sampleSD,standardError,halfRange,instrumentAllowance,displaySpread};
  });
  return {groups,points:groups.map(g=>({angle:g.angle,value:g.mean,uncertainty:g.displaySpread}))};
}
/** Repeated raw measurements are retained; no missing direction or angle is fabricated. */
export function buildCalibration(liftingCSV:string,loweringCSV:string,input:CalibrationOptions):CalibrationBuild {
  const options=validateCalibrationOptions(input),lifting=branchData(liftingCSV,options,'Lifting'),lowering=branchData(loweringCSV,options,'Lowering');
  const all=[...lifting.points,...lowering.points];if(!all.length)fail('Supply raw readings for at least one direction.');
  const domain:[number,number]=[Math.min(...all.map(p=>p.angle)),Math.max(...all.map(p=>p.angle))];
  return {lifting:lifting.points,lowering:lowering.points,domain,calibration:{version:1,liftingCSV,loweringCSV,options,groups:{lifting:lifting.groups,lowering:lowering.groups},curveModified:false}};
}
/** Reconstruct derived statistics from retained source rows when importing portable files. */
export function validateMachineCalibration(input:unknown):MachineCalibration {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Calibration record must be an object.');
  const c=input as Record<string,unknown>;if(c.version!==1)fail('Unsupported calibration record version.');
  if(typeof c.curveModified!=='boolean')fail('Calibration modification state must be true or false.');
  const built=buildCalibration(text(c.liftingCSV,'Lifting raw CSV',100000,false),text(c.loweringCSV,'Lowering raw CSV',100000,false),validateCalibrationOptions(c.options));
  return {...built.calibration,curveModified:c.curveModified as boolean};
}
