const { expect, assert: chaiAssert } = require('chai');
const sinon = require('sinon').createSandbox();
const EventEmitter = require('events');

const { NotFoundError } = require('../../../../utils/coreErrors');
const { buildScriptShortcuts, VARIABLE_PREFIX } = require('../../../../lib/scene/script/script.shortcuts');
const { runScript } = require('../../../../lib/scene/script/script.sandbox');
const StateManager = require('../../../../lib/state');
const Variable = require('../../../../lib/variable');
const House = require('../../../../lib/house');

describe('scene script shortcuts', () => {
  let self;
  let runAction;
  let api;
  let clock;

  beforeEach(() => {
    const stateManager = new StateManager(new EventEmitter());
    const lamp = {
      id: 'device-lamp',
      selector: 'lamp',
      name: 'Lamp',
      room: { selector: 'living-room' },
      features: [
        {
          selector: 'lamp-binary',
          name: 'On / off',
          device_id: 'device-lamp',
          category: 'light',
          type: 'binary',
          last_value: 1,
        },
      ],
    };
    const sensor = {
      id: 'device-sensor',
      selector: 'sensor',
      name: 'Sensor',
      features: [
        {
          selector: 'sensor-temperature',
          device_id: 'device-sensor',
          category: 'temperature-sensor',
          type: 'decimal',
          unit: 'celsius',
        },
      ],
    };
    [lamp, sensor].forEach((device) => {
      stateManager.setState('device', device.selector, device);
      stateManager.setState('deviceById', device.id, device);
      device.features.forEach((feature) => stateManager.setState('deviceFeature', feature.selector, feature));
    });
    stateManager.setState('deviceFeature', 'orphan-feature', {
      selector: 'orphan-feature',
      device_id: 'unknown',
      category: 'light',
      type: 'binary',
    });
    const variables = {};
    self = {
      stateManager,
      timezone: 'Europe/Paris',
      variable: {
        getValue: sinon.spy(async (key) => (variables[key] === undefined ? null : variables[key])),
        setValue: sinon.spy(async (key, value) => {
          variables[key] = value;
        }),
        destroy: sinon.spy(async (key) => {
          delete variables[key];
        }),
      },
      house: {
        get: sinon.fake.resolves([{ selector: 'my-house' }]),
        isEmpty: sinon.fake.resolves(true),
        getUsersAtHome: sinon.fake.resolves([{ selector: 'john' }, { selector: 'jane' }]),
        getBySelector: sinon.fake.resolves({
          selector: 'my-house',
          alarm_mode: 'armed',
          latitude: 48.85,
          longitude: 2.35,
        }),
        getSunState: sinon.fake.resolves({
          dawn: new Date('2026-06-01T03:10:00.000Z'),
          sunrise: new Date('2026-06-01T03:50:00.000Z'),
          solar_noon: new Date('2026-06-01T11:50:00.000Z'),
          sunset: new Date('2026-06-01T19:45:00.000Z'),
          dusk: null,
          elevation: 12.5,
          azimuth: 100,
          curve: [],
        }),
      },
      http: { request: sinon.fake.resolves({ status: 200, data: { ok: true }, headers: { a: 'b' } }) },
    };
    runAction = sinon.fake.resolves(null);
    api = buildScriptShortcuts({ self, runAction });
  });

  afterEach(() => {
    if (clock) {
      clock.restore();
      clock = null;
    }
    sinon.restore();
  });

  it('should turn lights and switches on and off, for one device or several', async () => {
    expect(await api['light.turnOn']('lamp')).to.equal(null);
    await api['light.turnOff'](['lamp', 'other']);
    await api['light.toggle']('lamp');
    await api['switch.turnOn']('plug');
    await api['switch.turnOff']('plug');
    await api['switch.toggle']('plug');
    expect(runAction.args).to.deep.equal([
      ['light.turn-on', { devices: ['lamp'] }],
      ['light.turn-off', { devices: ['lamp', 'other'] }],
      ['light.toggle', { devices: ['lamp'] }],
      ['switch.turn-on', { devices: ['plug'] }],
      ['switch.turn-off', { devices: ['plug'] }],
      ['switch.toggle', { devices: ['plug'] }],
    ]);
    await chaiAssert.isRejected(api['light.turnOn']([]), '"devices" must be a selector or a list of selectors');
    await chaiAssert.isRejected(api['light.turnOn'](3), '"devices" must be a selector or a list of selectors');
    await chaiAssert.isRejected(api['light.turnOn'](['']), '"devices" must be a selector or a list of selectors');
  });

  it('should blink lights, fast for 5 seconds by default', async () => {
    await api['light.blink']('lamp', null, null);
    await api['light.blink'](['lamp'], 'slow', 2);
    expect(runAction.args).to.deep.equal([
      ['light.blink', { devices: ['lamp'], blinking_speed: 'fast', blinking_time: 5 }],
      ['light.blink', { devices: ['lamp'], blinking_speed: 'slow', blinking_time: 2 }],
    ]);
    await chaiAssert.isRejected(api['light.blink']('lamp', 'crazy'), 'Unknown blinking speed "crazy"');
    await chaiAssert.isRejected(api['light.blink']('lamp', 'fast', 0), 'The blinking time is a number of seconds');
    await chaiAssert.isRejected(api['light.blink']('lamp', 'fast', '2'), 'The blinking time is a number of seconds');
  });

  it('should keep variables from an execution to the next', async () => {
    expect(await api['variable.get']('counter')).to.equal(null);
    await api['variable.set']('counter', { count: 2 });
    await api['variable.set']('nothing', undefined);
    sinon.assert.calledWith(self.variable.setValue, `${VARIABLE_PREFIX}COUNTER`, '{"count":2}');
    // the names are not case sensitive
    expect(await api['variable.get']('COUNTER')).to.deep.equal({ count: 2 });
    expect(await api['variable.get']('nothing')).to.equal(null);
    await api['variable.remove']('counter');
    expect(await api['variable.get']('counter')).to.equal(null);
    await chaiAssert.isRejected(api['variable.get']('bad name'), 'Invalid variable name "bad name"');
    await chaiAssert.isRejected(api['variable.set'](3, 1), 'Invalid variable name "3"');
    await chaiAssert.isRejected(api['variable.set']('big', 'x'.repeat(10000)), 'at most 10000 characters');
  });

  it('should read and change the house, the only one when none is given', async () => {
    expect(await api['house.isEmpty']()).to.equal(true);
    sinon.assert.calledWith(self.house.isEmpty, 'my-house');
    expect(await api['house.getUsersAtHome']('other-house')).to.deep.equal(['john', 'jane']);
    sinon.assert.calledWith(self.house.getUsersAtHome, 'other-house');
    expect(await api['house.getAlarmMode'](null)).to.equal('armed');
    await api['house.setAlarmMode']('disarmed');
    await api['user.setAtHome']('john');
    await api['user.setAway']('john', 'other-house');
    expect(runAction.args).to.deep.equal([
      ['alarm.set-alarm-mode', { house: 'my-house', alarm_mode: 'disarmed' }],
      ['user.set-seen-at-home', { user: 'john', house: 'my-house' }],
      ['user.set-out-of-home', { user: 'john', house: 'other-house' }],
    ]);
    await chaiAssert.isRejected(api['house.setAlarmMode']('sleeping'), 'Unknown alarm mode "sleeping"');
    await chaiAssert.isRejected(api['house.isEmpty'](3), '"house" must be the selector of a house');
    self.house.get = sinon.fake.resolves([{ selector: 'a' }, { selector: 'b' }]);
    await chaiAssert.isRejected(api['house.isEmpty'](), 'Gladys has 2 houses: give the selector of the house');
  });

  it('should give the sun of the house, and whether it is day', async () => {
    clock = sinon.useFakeTimers({ now: new Date('2026-06-01T12:00:00.000Z'), toFake: ['Date'] });
    expect(await api['house.getSun']()).to.deep.equal({
      dawn: '2026-06-01T03:10:00.000Z',
      sunrise: '2026-06-01T03:50:00.000Z',
      solar_noon: '2026-06-01T11:50:00.000Z',
      sunset: '2026-06-01T19:45:00.000Z',
      dusk: null,
      elevation: 12.5,
      azimuth: 100,
      is_day: true,
    });
    clock.setSystemTime(new Date('2026-06-01T22:00:00.000Z'));
    expect((await api['house.getSun']()).is_day).to.equal(false);
    self.house.getBySelector = sinon.fake.resolves({ selector: 'my-house', latitude: null, longitude: null });
    await chaiAssert.isRejected(api['house.getSun'](), 'The house "my-house" has no location');
  });

  it('should describe a device and list the device features, filtered', async () => {
    expect(await api['device.get']('lamp')).to.deep.equal({
      selector: 'lamp',
      name: 'Lamp',
      room: 'living-room',
      features: [
        {
          selector: 'lamp-binary',
          name: 'On / off',
          category: 'light',
          type: 'binary',
          unit: null,
          last_value: 1,
          device: 'lamp',
          room: 'living-room',
        },
      ],
    });
    expect((await api['device.get']('sensor')).room).to.equal(null);
    self.stateManager.setState('device', 'bare', { selector: 'bare', name: 'Bare' });
    expect((await api['device.get']('bare')).features).to.deep.equal([]);
    await chaiAssert.isRejected(api['device.get']('unknown'), NotFoundError);

    const selectors = async (filter) => (await api['device.list'](filter)).map((feature) => feature.selector);
    expect(await selectors()).to.deep.equal(['lamp-binary', 'sensor-temperature', 'orphan-feature']);
    expect(await selectors({ room: 'living-room' })).to.deep.equal(['lamp-binary']);
    expect(await selectors({ category: 'light' })).to.deep.equal(['lamp-binary', 'orphan-feature']);
    expect(await selectors({ category: 'light', type: 'decimal' })).to.deep.equal([]);
    expect(await selectors({ type: 'decimal', room: null })).to.deep.equal(['sensor-temperature']);
    const [, sensor, orphan] = await api['device.list']();
    expect(sensor).to.include({ unit: 'celsius', last_value: null, name: null, device: 'sensor', room: null });
    expect(orphan).to.include({ device: null, room: null });
  });

  it('should make HTTP requests', async () => {
    expect(await api['http.get']('https://example.com/a')).to.deep.equal({
      status: 200,
      data: { ok: true },
      headers: { a: 'b' },
    });
    await api['http.post']('http://example.com/b', { value: 1 }, { headers: { authorization: 'token' } });
    await api['http.post']('http://example.com/c', null);
    await api['http.request']('PUT', 'https://example.com/d', { body: 'text', headers: null });
    expect(self.http.request.args).to.deep.equal([
      ['get', 'https://example.com/a', undefined, undefined],
      ['post', 'http://example.com/b', { value: 1 }, { authorization: 'token' }],
      ['post', 'http://example.com/c', undefined, undefined],
      ['put', 'https://example.com/d', 'text', undefined],
    ]);
    self.http.request = sinon.fake.resolves({ status: 204, headers: {} });
    expect((await api['http.get']('https://example.com')).data).to.equal(null);
    await chaiAssert.isRejected(api['http.request']('trace', 'https://example.com'), 'Unknown HTTP method "trace"');
    await chaiAssert.isRejected(api['http.request'](3, 'https://example.com'), 'Unknown HTTP method "3"');
    await chaiAssert.isRejected(api['http.get']('ftp://example.com'), 'must start with http:// or https://');
    await chaiAssert.isRejected(api['http.get'](3), 'must start with http:// or https://');
    await chaiAssert.isRejected(api['http.get']('https://a.b', { headers: 'x' }), 'must be an object of texts');
    await chaiAssert.isRejected(api['http.get']('https://a.b', { headers: { a: 1 } }), 'must be an object of texts');
  });

  it('should give the local time of the instance', async () => {
    clock = sinon.useFakeTimers({ now: new Date('2026-11-08T22:05:09.000Z'), toFake: ['Date'] });
    expect(await api['time.now']()).to.deep.equal({
      iso: '2026-11-08T22:05:09.000Z',
      date: '2026-11-08',
      time: '23:05',
      hour: 23,
      minute: 5,
      second: 9,
      // a Sunday
      day_of_week: 7,
      timestamp: new Date('2026-11-08T22:05:09.000Z').getTime(),
      timezone: 'Europe/Paris',
    });
    clock.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    expect((await api['time.now']()).day_of_week).to.equal(1);
  });

  it('should say a text on a speaker', async () => {
    await api['music.say']('speaker', 'Hello');
    await api['music.say']('speaker', 'Hello', 40);
    expect(runAction.args).to.deep.equal([
      ['music.play-notification', { device: 'speaker', text: 'Hello' }],
      ['music.play-notification', { device: 'speaker', text: 'Hello', volume: 40 }],
    ]);
  });

  it('should work on the real variables and houses of Gladys', async () => {
    const event = new EventEmitter();
    const variable = new Variable(event);
    const real = buildScriptShortcuts({
      self: { variable, house: new House(event, new StateManager(event), {}, variable), timezone: 'Europe/Paris' },
      runAction,
    });
    await real['variable.set']('lastRun', { at: 12, by: 'john' });
    expect(await real['variable.get']('lastrun')).to.deep.equal({ at: 12, by: 'john' });
    expect(await variable.getValue(`${VARIABLE_PREFIX}LASTRUN`)).to.equal('{"at":12,"by":"john"}');
    await real['variable.remove']('lastRun');
    await real['variable.remove']('lastRun');
    expect(await real['variable.get']('lastRun')).to.equal(null);

    // the test database has two houses: the selector is needed
    await chaiAssert.isRejected(real['house.isEmpty'](), 'Gladys has 2 houses');
    expect(await real['house.isEmpty']('test-house')).to.be.a('boolean');
    expect(await real['house.getUsersAtHome']('test-house')).to.be.an('array');
    expect(await real['house.getAlarmMode']('test-house')).to.be.a('string');
    const sun = await real['house.getSun']('test-house');
    expect(sun.sunrise).to.match(/^\d{4}-\d{2}-\d{2}T/);
    expect(sun.is_day).to.be.a('boolean');
    expect(sun).to.not.have.property('curve');
    await chaiAssert.isRejected(real['house.getSun']('pepper-house'), 'has no location');
    await chaiAssert.isRejected(real['house.getAlarmMode']('unknown-house'), NotFoundError);
  });

  it('should be reachable from a script, each shortcut under its name', async () => {
    const calls = [];
    const recorder = {};
    Object.keys(api).forEach((name) => {
      recorder[name] = async (...args) => {
        calls.push([name, ...args]);
        return null;
      };
    });
    const result = await runScript({
      code: `
        await gladys.light.turnOn('a'); await gladys.light.turnOff('a'); await gladys.light.toggle('a');
        await gladys.light.blink('a', 'slow', 2);
        await gladys.switch.turnOn('a'); await gladys.switch.turnOff('a'); await gladys.switch.toggle('a');
        await gladys.variable.get('n'); await gladys.variable.set('n', 1); await gladys.variable.remove('n');
        await gladys.house.isEmpty(); await gladys.house.getUsersAtHome('h'); await gladys.house.getAlarmMode('h');
        await gladys.house.setAlarmMode('armed', 'h'); await gladys.house.getSun('h');
        await gladys.user.setAtHome('u', 'h'); await gladys.user.setAway('u', 'h');
        await gladys.device.get('d'); await gladys.device.list({ room: 'r' });
        await gladys.http.request('get', 'u', { body: 1 }); await gladys.http.get('u'); await gladys.http.post('u', 1);
        await gladys.time.now();
        await gladys.music.say('d', 't', 30);
      `,
      api: recorder,
    });
    expect(result.status).to.equal('success');
    expect(calls.map(([name]) => name).sort()).to.deep.equal(Object.keys(api).sort());
    expect(calls).to.deep.include(['light.blink', 'a', 'slow', 2]);
    expect(calls).to.deep.include(['house.setAlarmMode', 'armed', 'h']);
    // an argument left out crosses the sandbox as null
    expect(calls).to.deep.include(['house.isEmpty', null]);
    expect(calls).to.deep.include(['http.post', 'u', 1, null]);
    expect(calls).to.deep.include(['music.say', 'd', 't', 30]);
  });
});
