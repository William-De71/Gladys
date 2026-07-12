const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const { fake } = sinon;

const loadModule = () =>
  proxyquire('../../../../services/thermostat/lib/thermostat.onWindowOpen', {
    './thermostat.applySchedules': {
      getThermostatBoxConfigs: () => Promise.resolve({}),
    },
    '../../../utils/logger': {
      debug: fake.returns(null),
      info: fake.returns(null),
      warn: fake.returns(null),
    },
  });

const buildGladys = ({ switchOn = true } = {}) => {
  const switchDevice = {
    features: [{ selector: 'heater-switch', last_value: switchOn ? 1 : 0 }],
  };
  const thermostatDevice = {
    features: [{ selector: 'thermostat-living-room' }],
    params: [
      { name: 'THERMOSTAT_WINDOW_FEATURE', value: 'window-sensor' },
      { name: 'THERMOSTAT_SWITCH_FEATURE', value: 'heater-switch' },
    ],
  };
  const setValue = fake.resolves(null);
  return {
    gladys: {
      device: {
        get: fake((query) => {
          if (query && query.service === 'thermostat') {
            return Promise.resolve([thermostatDevice]);
          }
          if (query && query.device_feature_selectors === 'heater-switch') {
            return Promise.resolve([switchDevice]);
          }
          return Promise.resolve([]);
        }),
        setValue,
      },
      stateManager: {
        get: fake((type, externalId) => {
          if (type === 'deviceFeatureByExternalId' && externalId === 'zigbee2mqtt:window:contact') {
            return { selector: 'window-sensor' };
          }
          return null;
        }),
      },
    },
    setValue,
  };
};

describe('thermostat.onDeviceNewState (window open)', () => {
  beforeEach(() => {
    sinon.reset();
  });

  it('should cut the switch on the service event shape { device_feature_external_id, state }', async () => {
    const mod = loadModule();
    const { gladys, setValue } = buildGladys({ switchOn: true });
    await mod.onDeviceNewState.call({ gladys }, {
      device_feature_external_id: 'zigbee2mqtt:window:contact',
      state: 0,
    });
    expect(setValue.calledOnce).to.equal(true);
    expect(setValue.firstCall.args[2]).to.equal(0);
  });

  it('should cut the switch on the legacy event shape { device_feature, last_value }', async () => {
    const mod = loadModule();
    const { gladys, setValue } = buildGladys({ switchOn: true });
    await mod.onDeviceNewState.call({ gladys }, {
      device_feature: 'window-sensor',
      last_value: 0,
    });
    expect(setValue.calledOnce).to.equal(true);
    expect(setValue.firstCall.args[2]).to.equal(0);
  });

  it('should do nothing when the window closes (state 1)', async () => {
    const mod = loadModule();
    const { gladys, setValue } = buildGladys({ switchOn: true });
    await mod.onDeviceNewState.call({ gladys }, {
      device_feature_external_id: 'zigbee2mqtt:window:contact',
      state: 1,
    });
    expect(setValue.called).to.equal(false);
  });

  it('should do nothing when the changed feature is not a configured window sensor', async () => {
    const mod = loadModule();
    const { gladys, setValue } = buildGladys({ switchOn: true });
    await mod.onDeviceNewState.call({ gladys }, {
      device_feature: 'some-other-sensor',
      last_value: 0,
    });
    expect(setValue.called).to.equal(false);
  });

  it('should not send a command when the switch is already OFF', async () => {
    const mod = loadModule();
    const { gladys, setValue } = buildGladys({ switchOn: false });
    await mod.onDeviceNewState.call({ gladys }, {
      device_feature_external_id: 'zigbee2mqtt:window:contact',
      state: 0,
    });
    expect(setValue.called).to.equal(false);
  });
});
