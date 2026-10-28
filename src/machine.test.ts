import { describe, expect, it } from 'vitest';
import { createMachineProfile, evaluateMachine, interpolateMachine, linkagePose, MACHINE_G, parseMachinePoints, sampleMachine, validateMachineProfile } from './machine';

describe('declared mechanism calculations', () => {
  it('computes signed plate-lever moment from the weight center and reference action', () => {
    const p = createMachineProfile('lever'); p.domain = [0, 180]; p.lever = { mass: 20, radius: .4, phase: 0 };
    expect(evaluateMachine(p, 0).moment).toBeCloseTo(78.48);
    expect(evaluateMachine(p, 90).moment).toBeCloseTo(0);
    expect(evaluateMachine(p, 180).moment).toBeCloseTo(-78.48);
    p.referenceAction = -1;
    expect(evaluateMachine(p, 0).moment).toBeCloseTo(-78.48);
    p.lever.phase = 90;
    expect(evaluateMachine(p, 0).moment).toBeCloseTo(0);
  });
  it('uses the explicit cable travel ratio without treating force as a shaft moment', () => {
    const p = createMachineProfile('cable'); p.cable = { tension: 100, radius: .1, ratio: .5, sign: 1 };
    expect(evaluateMachine(p, 30).moment).toBeCloseTo(5);
    expect(evaluateMachine(p, 30).force).toBe(100);
    p.cable.ratio = 2;
    expect(evaluateMachine(p, 80).moment).toBeCloseTo(20);
    p.cable.sign = -1;
    expect(evaluateMachine(p, 30).moment).toBeCloseTo(-20);
  });
  it('interpolates effective cam moment arm and propagates its explicit uncertainty', () => {
    const p = createMachineProfile('cam'); p.domain = [0, 120]; p.cam.tension = 100;
    p.cam.points = [{ angle: 20, value: .1, uncertainty: .01 }, { angle: 100, value: .3, uncertainty: .03 }];
    expect(evaluateMachine(p, 60).moment).toBeCloseTo(20);
    expect(evaluateMachine(p, 60).uncertainty).toBeCloseTo(2);
    expect(evaluateMachine(p, 0).status).toBe('outside-domain');
    expect(evaluateMachine(p, 120).moment).toBeNull();
  });
  it('matches four-bar input moment to an independent finite-difference potential energy', () => {
    const p = createMachineProfile('linkage');
    for (const angle of [20, 40, 65, 90]) {
      const pose = linkagePose(p, angle);
      expect('status' in pose).toBe(false);
      if ('status' in pose) continue;
      const eps = 1e-5, deltaDegrees = eps * 180 / Math.PI;
      const before = linkagePose(p, angle - deltaDegrees), after = linkagePose(p, angle + deltaDegrees);
      if ('status' in before || 'status' in after) throw new Error('Unexpected singular fixture');
      const numerical = p.linkage.mass * MACHINE_G * (after.points.load![1] - before.points.load![1]) / (2 * eps);
      expect(evaluateMachine(p, angle).moment).toBeCloseTo(numerical, 6);
      expect(Math.hypot(pose.points.coupler![0] - pose.points.input![0], pose.points.coupler![1] - pose.points.input![1])).toBeCloseTo(p.linkage.coupler);
      expect(Math.hypot(pose.points.coupler![0] - p.linkage.ground, pose.points.coupler![1])).toBeCloseTo(p.linkage.output);
    }
  });
  it('does not invent a result for impossible closure or dead-center linkage geometry', () => {
    const p = createMachineProfile('linkage'); p.domain = [0, 180]; p.linkage = { ...p.linkage, ground: 3, input: .1, coupler: .1, output: .1 };
    expect(evaluateMachine(p, 90).status).toBe('invalid');
    p.linkage = { ...p.linkage, ground: 1, input: .2, coupler: .4, output: .4 };
    expect(evaluateMachine(p, 0).status).toBe('singular');
    expect(evaluateMachine(p, 0).moment).toBeNull();
  });
});

describe('measured and supplied profiles', () => {
  const measured = () => {
    const p = createMachineProfile('curve'); p.domain = [0, 120];
    p.provenance = { kind: 'measured', brand: 'Test rig', model: 'Calibration fixture', source: 'Torque sensor at input; same load; repeated raising/return runs. Absolute bounds supplied by fixture.', notes: 'Synthetic test data, not a commercial machine claim.' };
    p.curve.lifting = [{ angle: 20, value: 20, uncertainty: 2 }, { angle: 100, value: 60, uncertainty: 4 }];
    p.curve.lowering = [{ angle: 30, value: 15, uncertainty: 1 }, { angle: 90, value: 35, uncertainty: 3 }];
    return p;
  };
  it('keeps lifting and lowering curves independent with their own valid domains', () => {
    const p = measured();
    expect(evaluateMachine(p, 60, 'lifting').moment).toBeCloseTo(40);
    expect(evaluateMachine(p, 60, 'lowering').moment).toBeCloseTo(25);
    expect(evaluateMachine(p, 25, 'lowering').status).toBe('outside-domain');
    expect(evaluateMachine(p, 25, 'lifting').status).toBe('valid');
    p.curve.lowering = [];
    expect(evaluateMachine(p, 60, 'lowering').status).toBe('unknown');
    expect(evaluateMachine(p, 60, 'lowering').moment).toBeNull();
  });
  it('requires actual provenance before accepting measured data and preserves unknown blank profiles', () => {
    const p = measured(); p.provenance.brand = '';
    expect(() => validateMachineProfile(p)).toThrow('brand and model');
    p.provenance.brand = 'Fixture'; p.provenance.source = '';
    expect(() => validateMachineProfile(p)).toThrow('source or measurement protocol');
    expect(evaluateMachine(createMachineProfile('curve'), 40).status).toBe('unknown');
    const theoretical = createMachineProfile('lever'); theoretical.provenance.kind = 'measured';
    expect(() => validateMachineProfile(theoretical)).toThrow('theoretical estimates');
  });
  it('retains a force profile in N until an explicit signed moment arm is supplied', () => {
    const p = measured(); p.curve.quantity = 'force';
    expect(evaluateMachine(p, 60).force).toBe(40);
    expect(evaluateMachine(p, 60).moment).toBeNull();
    expect(evaluateMachine(p, 60).jointMoment).toBeNull();
    p.curve.forceMomentArm = -.2;
    expect(evaluateMachine(p, 60).moment).toBeCloseTo(-8);
    expect(evaluateMachine(p, 60).uncertainty).toBeCloseTo(.6);
  });
  it('uses virtual work only after an explicit machine-to-joint mapping assumption', () => {
    const p = measured(); p.joint = { mode: 'ratio', ratio: 2, offset: 10, assumption: '' };
    expect(evaluateMachine(p, 60).status).toBe('invalid');
    p.joint.assumption = 'Ideal 2:1 shaft-to-joint angular mapping, axes and support fixed; illustrative only.';
    expect(evaluateMachine(p, 60).jointMoment).toBeCloseTo(80);
    expect(evaluateMachine(p, 60).jointAngle).toBeCloseTo(25);
    p.joint.mode = 'aligned';
    expect(evaluateMachine(p, 60).jointMoment).toBeCloseTo(40);
    p.joint.mode = 'none';
    expect(evaluateMachine(p, 60).jointMoment).toBeNull();
  });
  it('rejects nonfinite data and unordered/duplicate sample positions', () => {
    expect(parseMachinePoints('angle,value,uncertainty\n10,20,2\n30,40,3')).toEqual([{ angle: 10, value: 20, uncertainty: 2 }, { angle: 30, value: 40, uncertainty: 3 }]);
    expect(() => parseMachinePoints('10,20\n10,30')).toThrow('unique');
    expect(() => parseMachinePoints('30,20\n10,30')).toThrow('increasing');
    expect(() => parseMachinePoints('10,NaN\n20,30')).toThrow('row');
    expect(interpolateMachine([], 20)).toBeNull();
    const p = measured(); p.curve.lifting[0].value = Infinity;
    expect(() => validateMachineProfile(p)).toThrow('finite');
  });
  it('uses identical calculation rules for curve samples and the current position', () => {
    const p = measured();
    for (const row of sampleMachine(p, 'lowering', 13)) expect(row).toEqual({ angle: row.angle, ...evaluateMachine(p, row.angle, 'lowering') });
  });
});
