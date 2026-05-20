const { expect } = require('chai');
const { applySlotToDay, mergeIntoSlots } = require('../../../../services/thermostat/lib/scheduleUtils');

describe('scheduleUtils.applySlotToDay', () => {
  it('should assign the correct day_of_week when no existing slots (bug fix)', () => {
    const { fixedSlots } = applySlotToDay([], 3, 480, 600, 'comfort', 'k1', null);
    expect(fixedSlots).to.have.lengthOf(1);
    expect(fixedSlots[0].day_of_week).to.equal(3);
  });

  it('should assign day_of_week=0 correctly when targeting Monday', () => {
    const { fixedSlots } = applySlotToDay([], 0, 480, 600, 'eco', 'k2', null);
    expect(fixedSlots[0].day_of_week).to.equal(0);
  });

  it('should add slot with correct start/end times', () => {
    const { fixedSlots } = applySlotToDay([], 1, 8 * 60, 12 * 60, 'comfort', 'k3', null);
    expect(fixedSlots[0].start_time).to.equal('08:00');
    expect(fixedSlots[0].end_time).to.equal('12:00');
    expect(fixedSlots[0].preset).to.equal('comfort');
  });

  it('should truncate an existing slot that overlaps at the start', () => {
    const existing = [{ key: 'a', day_of_week: 2, start_time: '06:00', end_time: '10:00', preset: 'eco' }];
    const { fixedSlots } = applySlotToDay(existing, 2, 8 * 60, 12 * 60, 'comfort', 'k4', null);
    const eco = fixedSlots.find(s => s.preset === 'eco');
    expect(eco).to.not.equal(null);
    expect(eco.end_time).to.equal('08:00');
  });

  it('should truncate an existing slot that overlaps at the end', () => {
    const existing = [{ key: 'b', day_of_week: 2, start_time: '10:00', end_time: '14:00', preset: 'away' }];
    const { fixedSlots } = applySlotToDay(existing, 2, 8 * 60, 12 * 60, 'comfort', 'k5', null);
    const away = fixedSlots.find(s => s.preset === 'away');
    expect(away).to.not.equal(null);
    expect(away.start_time).to.equal('12:00');
  });

  it('should split an existing slot that fully contains the new slot', () => {
    const existing = [{ key: 'c', day_of_week: 4, start_time: '06:00', end_time: '20:00', preset: 'eco' }];
    const { fixedSlots } = applySlotToDay(existing, 4, 8 * 60, 12 * 60, 'comfort', 'k6', null);
    const ecoParts = fixedSlots.filter(s => s.preset === 'eco');
    expect(ecoParts).to.have.lengthOf(2);
    expect(ecoParts[0].end_time).to.equal('08:00');
    expect(ecoParts[1].start_time).to.equal('12:00');
  });

  it('should drop a slot fully covered by the new slot', () => {
    const existing = [{ key: 'd', day_of_week: 5, start_time: '09:00', end_time: '11:00', preset: 'frost' }];
    const { fixedSlots } = applySlotToDay(existing, 5, 8 * 60, 12 * 60, 'comfort', 'k7', null);
    const frost = fixedSlots.find(s => s.preset === 'frost');
    expect(frost).to.equal(undefined);
  });

  it('should produce an overflow slot when newEnd exceeds DAY_MINUTES', () => {
    const { fixedSlots, overflowSlot } = applySlotToDay([], 6, 23 * 60, 25 * 60, 'night', 'k8', null);
    expect(fixedSlots[0].end_time).to.equal('00:00');
    expect(overflowSlot).to.not.equal(null);
    expect(overflowSlot.start_time).to.eq('00:00');
    expect(overflowSlot.end_time).to.eq('01:00');
  });

  it('should not produce overflow when newEnd is exactly DAY_MINUTES', () => {
    const { overflowSlot } = applySlotToDay([], 0, 22 * 60, 24 * 60, 'night', 'k9', null);
    expect(overflowSlot).to.equal(null);
  });
});

describe('scheduleUtils.mergeIntoSlots', () => {
  it('should replace slots for the target day only', () => {
    const all = [
      { day_of_week: 0, start_time: '08:00', end_time: '12:00', preset: 'eco', key: 'x1' },
      { day_of_week: 1, start_time: '08:00', end_time: '12:00', preset: 'away', key: 'x2' }
    ];
    const newSlots = [{ day_of_week: 0, start_time: '09:00', end_time: '17:00', preset: 'comfort', key: 'x3' }];
    const result = mergeIntoSlots(all, 0, newSlots, null);
    expect(result.filter(s => s.day_of_week === 0)).to.have.lengthOf(1);
    expect(result.filter(s => s.day_of_week === 0)[0].key).to.equal('x3');
    expect(result.filter(s => s.day_of_week === 1)).to.have.lengthOf(1);
  });

  it('should place overflow slot on next day and remove next-day slots starting at 00:00', () => {
    const all = [
      { day_of_week: 1, start_time: '00:00', end_time: '02:00', preset: 'frost', key: 'y1' },
      { day_of_week: 1, start_time: '06:00', end_time: '08:00', preset: 'eco', key: 'y2' }
    ];
    const fixed = [{ day_of_week: 0, start_time: '22:00', end_time: '00:00', preset: 'night', key: 'y3' }];
    const overflow = { start_time: '00:00', end_time: '02:00', preset: 'night', key: 'overflow-y3' };
    const result = mergeIntoSlots(all, 0, fixed, overflow);
    const day1 = result.filter(s => s.day_of_week === 1);
    expect(day1).to.have.lengthOf(2);
    expect(day1.find(s => s.preset === 'night')).to.not.equal(undefined);
    expect(day1.find(s => s.key === 'y1')).to.equal(undefined);
    expect(day1.find(s => s.key === 'y2')).to.not.equal(undefined);
  });

  it('overflow on Sunday (day 6) should roll to day 0', () => {
    const all = [];
    const fixed = [{ day_of_week: 6, start_time: '23:00', end_time: '00:00', preset: 'night', key: 'z1' }];
    const overflow = { start_time: '00:00', end_time: '01:00', preset: 'night', key: 'overflow-z1' };
    const result = mergeIntoSlots(all, 6, fixed, overflow);
    const day0 = result.filter(s => s.day_of_week === 0);
    expect(day0).to.have.lengthOf(1);
    expect(day0[0].preset).to.equal('night');
  });
});
