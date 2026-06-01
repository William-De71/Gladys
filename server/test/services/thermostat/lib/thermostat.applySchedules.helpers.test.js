const { expect } = require('chai');

const {
  parseEnd,
  findMatchingPreset,
  getSetpointForPreset,
  computeSwitchActive,
} = require('../../../../services/thermostat/lib/thermostat.applySchedules');

describe('thermostat.applySchedules - parseEnd', () => {
  it('should convert HH:MM to minutes', () => {
    expect(parseEnd('08:30')).to.equal(510);
  });

  it('should treat 00:00 as end of day (1440)', () => {
    expect(parseEnd('00:00')).to.equal(1440);
  });

  it('should handle 23:59', () => {
    expect(parseEnd('23:59')).to.equal(1439);
  });
});

describe('thermostat.applySchedules - findMatchingPreset', () => {
  it('should match a normal same-day slot', () => {
    const today = [{ start_time: '08:00', end_time: '12:00', preset: 'comfort' }];
    expect(findMatchingPreset(today, [], 9 * 60)).to.equal('comfort');
  });

  it('should return null when no slot matches', () => {
    const today = [{ start_time: '08:00', end_time: '12:00', preset: 'comfort' }];
    expect(findMatchingPreset(today, [], 13 * 60)).to.equal(null);
  });

  it('should be inclusive of slot start and exclusive of slot end', () => {
    const today = [{ start_time: '08:00', end_time: '12:00', preset: 'comfort' }];
    expect(findMatchingPreset(today, [], 8 * 60)).to.equal('comfort');
    expect(findMatchingPreset(today, [], 12 * 60)).to.equal(null);
  });

  it('should match a slot ending at midnight (00:00 = end of day)', () => {
    const today = [{ start_time: '22:00', end_time: '00:00', preset: 'night' }];
    expect(findMatchingPreset(today, [], 23 * 60)).to.equal('night');
  });

  it('should match the start portion of an overnight slot on the same day', () => {
    // 22:00 -> 07:00 covers 22:00..23:59 on the start day
    const today = [{ start_time: '22:00', end_time: '07:00', preset: 'night' }];
    expect(findMatchingPreset(today, [], 23 * 60)).to.equal('night');
  });

  it('should match the tail of yesterday overnight slot after midnight', () => {
    // yesterday 22:00 -> 07:00 covers 00:00..07:00 today
    const yesterday = [{ start_time: '22:00', end_time: '07:00', preset: 'night' }];
    expect(findMatchingPreset([], yesterday, 5 * 60)).to.equal('night');
  });

  it('should not match yesterday overnight slot after its end', () => {
    const yesterday = [{ start_time: '22:00', end_time: '07:00', preset: 'night' }];
    expect(findMatchingPreset([], yesterday, 8 * 60)).to.equal(null);
  });

  it('should prefer a same-day normal slot over yesterday overnight', () => {
    const today = [{ start_time: '06:00', end_time: '09:00', preset: 'comfort' }];
    const yesterday = [{ start_time: '22:00', end_time: '07:00', preset: 'night' }];
    expect(findMatchingPreset(today, yesterday, 6 * 60 + 30)).to.equal('comfort');
  });
});

describe('thermostat.applySchedules - getSetpointForPreset', () => {
  it('should return null for off preset', () => {
    expect(getSetpointForPreset('off', {})).to.equal(null);
  });

  it('should return config value when present', () => {
    expect(getSetpointForPreset('comfort', { preset_comfort: 21 })).to.equal(21);
  });

  it('should fall back to default when config missing the preset', () => {
    expect(getSetpointForPreset('eco', {})).to.equal(18);
  });

  it('should fall back to default when config is null', () => {
    expect(getSetpointForPreset('frost', null)).to.equal(7);
  });

  it('should coerce a string config value to number', () => {
    expect(getSetpointForPreset('night', { preset_night: '19' })).to.equal(19);
  });

  it('should use generic 20 default for an unknown preset', () => {
    expect(getSetpointForPreset('unknown', {})).to.equal(20);
  });
});

describe('thermostat.applySchedules - computeSwitchActive', () => {
  const config = { hysteresis_start: 0.5, hysteresis_stop: 0.5 };

  it('should return false when current temp is null', () => {
    expect(computeSwitchActive(null, 20, 'heating', config, false)).to.equal(false);
  });

  describe('heating mode', () => {
    it('should turn ON when temp is below setpoint minus hysteresis', () => {
      expect(computeSwitchActive(19, 20, 'heating', config, false)).to.equal(true);
    });

    it('should turn OFF when temp is above setpoint plus hysteresis', () => {
      expect(computeSwitchActive(21, 20, 'heating', config, true)).to.equal(false);
    });

    it('should keep current state (ON) in the neutral zone', () => {
      expect(computeSwitchActive(20, 20, 'heating', config, true)).to.equal(true);
    });

    it('should keep current state (OFF) in the neutral zone', () => {
      expect(computeSwitchActive(20, 20, 'heating', config, false)).to.equal(false);
    });
  });

  describe('cooling mode', () => {
    it('should turn ON when temp is above setpoint plus hysteresis', () => {
      expect(computeSwitchActive(25, 24, 'cooling', config, false)).to.equal(true);
    });

    it('should turn OFF when temp is below setpoint minus hysteresis', () => {
      expect(computeSwitchActive(23, 24, 'cooling', config, true)).to.equal(false);
    });

    it('should keep current state in the neutral zone', () => {
      expect(computeSwitchActive(24, 24, 'cooling', config, true)).to.equal(true);
    });
  });

  it('should use default hysteresis of 0.5 when config missing', () => {
    expect(computeSwitchActive(19, 20, 'heating', {}, false)).to.equal(true);
    expect(computeSwitchActive(19.6, 20, 'heating', {}, false)).to.equal(false);
  });
});
