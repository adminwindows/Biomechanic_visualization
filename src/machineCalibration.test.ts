import { describe,expect,it } from 'vitest';
import { buildCalibration,validateMachineCalibration,type CalibrationOptions } from './machineCalibration';
import { createMachineProfile,evaluateMachine,validateMachineProfile } from './machine';
const options:CalibrationOptions={quantity:'force',valueUnit:'N',angleUnit:'degrees',method:'sample-sd',instrumentUncertainty:.5,protocol:'Synthetic regression fixture: repeated readings at fixed angles; not a real machine measurement.',source:'Analytical unit-test fixture only',brand:'Test rig',model:'Synthetic fixture'};
const lifting='angle,value,uncertainty,repeat\n10,10,.2,first\n10,12,.4,second\n30,20,.1,first\n30,24,.1,second';
const lowering='angle,value\n15,8\n15,10\n25,14\n25,16';
function profile(){const result=buildCalibration(lifting,lowering,options);const p=createMachineProfile('curve');p.domain=result.domain;p.provenance={kind:'measured',brand:options.brand,model:options.model,source:options.source,notes:'Synthetic test readings only'};p.curve={...p.curve,quantity:'force',lifting:result.lifting,lowering:result.lowering};p.calibration=result.calibration;return p;}
describe('explicit raw machine calibration',()=>{
  it('retains raw repeats and separates instrument allowance from variability',()=>{
    const result=buildCalibration(lifting,lowering,options),group=result.calibration.groups.lifting[0];
    expect(group.count).toBe(2);expect(group.mean).toBe(11);expect(group.sampleSD).toBeCloseTo(Math.sqrt(2));expect(group.standardError).toBeCloseTo(1);expect(group.halfRange).toBe(1);expect(group.instrumentAllowance).toBe(.5);expect(group.displaySpread).toBeCloseTo(.5+Math.sqrt(2));
    expect(result.calibration.liftingCSV).toBe(lifting);expect(result.calibration.options.protocol).toBe(options.protocol);expect(result.domain).toEqual([10,30]);
  });
  it('uses standard kgf conversion and converts radians explicitly',()=>{
    const csv=`angle,value\n${Math.PI/6},1\n${Math.PI/6},2\n${Math.PI/3},2\n${Math.PI/3},4`;
    const result=buildCalibration(csv,'',{...options,angleUnit:'radians',valueUnit:'kgf',instrumentUncertainty:.1,method:'half-range'});
    expect(result.domain).toEqual([30,60]);expect(result.lifting[0].value).toBeCloseTo(1.5*9.80665,9);expect(result.lifting[0].uncertainty).toBeCloseTo(.6*9.80665,9);expect(result.lowering).toEqual([]);
  });
  it('never synthesizes the return direction or extrapolates its narrower domain',()=>{
    const p=profile();expect(evaluateMachine(p,10,'lifting').status).toBe('valid');expect(evaluateMachine(p,10,'lowering').status).toBe('outside-domain');expect(evaluateMachine(p,20,'lowering').force).toBe(12);
    const result=buildCalibration(lifting,'',options);p.curve.lowering=[];p.calibration=result.calibration;expect(evaluateMachine(p,20,'lowering').status).toBe('unknown');
  });
  it('requires actual repeat information or an explicitly supplied instrument allowance',()=>{
    const single='10,12\n30,20';expect(()=>buildCalibration(single,'',options)).toThrow('at least two');
    expect(()=>buildCalibration(single,'',{...options,method:'instrument-only',instrumentUncertainty:0})).toThrow('explicit positive');
    const data=buildCalibration(single,'',{...options,method:'instrument-only'});expect(data.calibration.groups.lifting[0].sampleSD).toBeNull();expect(data.lifting[0].uncertainty).toBe(.5);
  });
  it('supports quoted/reordered headers, tabs and sorted grouping without mutating source',()=>{
    const csv='"repeat";"value";"angle"\n"r1";20;30\n"r1";10;10\n"r2";12;10\n"r2";24;30';
    const data=buildCalibration(csv,'',options);expect(data.lifting.map(p=>p.angle)).toEqual([10,30]);expect(data.lifting[0].value).toBe(11);expect(data.calibration.liftingCSV).toBe(csv);
    expect(buildCalibration('angle\tvalue\n10\t12\n30\t20','',{...options,method:'instrument-only'}).lifting[1].value).toBe(20);
  });
  it('rejects misleading or malformed input instead of silently repairing it',()=>{
    expect(()=>buildCalibration(lifting,'',{...options,valueUnit:'N·m'})).toThrow('match');
    expect(()=>buildCalibration(lifting,'',{...options,source:''})).toThrow('source');
    expect(()=>buildCalibration('10,Infinity\n20,30','',options)).toThrow('numeric');
    expect(()=>buildCalibration('10,-1\n10,1\n20,2\n20,3','',options)).toThrow('Converted value');
    expect(()=>buildCalibration('10,1,0,same\n10,2,0,same\n20,3\n20,4','',options)).toThrow('unique');
    expect(()=>buildCalibration('10,1\n10,2','',options)).toThrow('distinct');
    expect(()=>buildCalibration(' '.repeat(100001),'',options)).toThrow('100 kB');
  });
  it('preserves signed measured input moments without inventing a force moment arm',()=>{
    const data=buildCalibration('10,-2\n10,-4\n30,6\n30,8','',{...options,quantity:'moment',valueUnit:'N·m',method:'standard-error'});
    expect(data.lifting[0].value).toBe(-3);expect(data.lifting[0].uncertainty).toBeCloseTo(1.5);
  });
  it('recomputes statistics on import and detects curves detached from their raw data',()=>{
    const p=profile(),record=structuredClone(p.calibration!);record.groups.lifting[0].mean=999;
    expect(validateMachineCalibration(record).groups.lifting[0].mean).toBe(11);
    expect(validateMachineProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
    p.curve.lifting[0].value=999;expect(()=>validateMachineProfile(p)).toThrow('differ from retained');
    p.calibration!.curveModified=true;expect(validateMachineProfile(p).calibration!.groups.lifting[0].mean).toBe(11);
  });
});
