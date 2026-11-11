const { expect, assert: chaiAssert } = require('chai');
const sinon = require('sinon').createSandbox();
const EventEmitter = require('events');

const { ACTIONS, EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../../utils/constants');
const { AbortScene, SceneStopped } = require('../../../../utils/coreErrors');
const actionsFunc = require('../../../../lib/scene/scene.actions');
const executeActionsFactory = require('../../../../lib/scene/scene.executeActions');
const { buildScriptApi } = require('../../../../lib/scene/script/script.run');
const { actionSchema } = require('../../../../models/scene');
const StateManager = require('../../../../lib/state');

const { executeAction } = executeActionsFactory(actionsFunc);

describe('scene action script.run', () => {
  afterEach(() => {
    sinon.restore();
  });

  let event;
  let stateManager;
  let self;

  beforeEach(() => {
    event = new EventEmitter();
    stateManager = new StateManager(event);
    stateManager.setState('deviceFeature', 'living-room-temperature', {
      id: 'feature-temperature',
      device_id: 'device-sensor',
      category: 'temperature-sensor',
      type: 'decimal',
      last_value: 21.5,
    });
    stateManager.setState('deviceFeature', 'living-room-lamp', {
      id: 'feature-lamp',
      device_id: 'device-lamp',
      category: 'light',
      type: 'binary',
      last_value: 0,
    });
    stateManager.setState('deviceFeature', 'empty-feature', {
      id: 'feature-empty',
      device_id: 'device-lamp',
      category: 'light',
      type: 'binary',
    });
    stateManager.setState('deviceById', 'device-lamp', { id: 'device-lamp', selector: 'lamp' });
    self = {
      stateManager,
      event: { emit: sinon.fake() },
      device: { setValue: sinon.fake.resolves(null) },
      message: { sendToUser: sinon.fake.resolves(null) },
      execute: sinon.fake(),
      house: { getBySelector: sinon.fake.resolves({ name: 'Main', alarm_mode: 'disarmed' }) },
    };
  });

  const run = (code, scope = { sceneSelector: 'my-scene' }) =>
    executeAction(self, { type: ACTIONS.SCRIPT.RUN, code }, scope, '0.0', { throwUnknownError: true });

  const scriptLogs = () =>
    self.event.emit.args
      .map(([, message]) => message)
      .filter((message) => message.type === WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_LOG)
      .map((message) => message.payload);

  it('should read and set device values, start a scene and send a message', async () => {
    await run(`
      const temperature = await gladys.device.getValue('living-room-temperature');
      const feature = await gladys.device.getFeature('living-room-temperature');
      if (temperature > 20) {
        await gladys.device.setValue('living-room-lamp', 1);
      }
      await gladys.scene.start('other-scene');
      await gladys.message.send('john', 'It is ' + temperature + ' °C in the ' + feature.category);
    `);
    sinon.assert.calledOnceWithExactly(
      self.device.setValue,
      { id: 'device-lamp', selector: 'lamp' },
      sinon.match({ id: 'feature-lamp' }),
      1,
    );
    sinon.assert.calledOnce(self.execute);
    expect(self.execute.args[0][0]).to.equal('other-scene');
    sinon.assert.calledOnceWithExactly(
      self.message.sendToUser,
      'john',
      'It is 21.5 °C in the temperature-sensor',
      null,
      {
        service: undefined,
      },
    );
  });

  it('should return null for a device feature without value', async () => {
    await run(`console.log(await gladys.device.getValue('empty-feature'));`);
    expect(scriptLogs()).to.deep.equal([{ sceneSelector: 'my-scene', level: 'info', message: 'null' }]);
  });

  it('should run any action, return its result and store it for the templates with saveAs', async () => {
    const scope = { sceneSelector: 'my-scene' };
    await run(
      `
      const result = await gladys.action('device.get-value', { device_feature: 'living-room-temperature' }, { saveAs: 'temperature' });
      console.log(result.last_value);
      await gladys.action('message.send', { user: 'john', text: 'Temperature: {{temperature.last_value}}' });
      const unsaved = await gladys.action('device.get-value', { device_feature: 'living-room-temperature' });
      console.log(unsaved.last_value);
      console.log(await gladys.action('scene.start', { scene: 'other' }));
    `,
      scope,
    );
    expect(scope.temperature.last_value).to.equal(21.5);
    // without saveAs, the result is kept under the path of the script action
    expect(scope[0][0].script[3].last_value).to.equal(21.5);
    sinon.assert.calledOnceWithExactly(self.message.sendToUser, 'john', 'Temperature: 21.5', null, {
      service: undefined,
    });
    expect(scriptLogs().map((log) => log.message)).to.deep.equal(['21.5', '21.5', 'null']);
  });

  it('should keep what a function block returns for the next actions', async () => {
    const scope = { sceneSelector: 'my-scene' };
    await executeAction(self, { type: ACTIONS.SCRIPT.RUN, code: 'return { ok: true };' }, scope, '1.0', {
      throwUnknownError: true,
    });
    expect(scope[1][0]).to.deep.equal({ result: { ok: true } });
    const silent = { sceneSelector: 'my-scene' };
    await executeAction(self, { type: ACTIONS.SCRIPT.RUN, code: 'const a = 1;' }, silent, '1.0', {
      throwUnknownError: true,
    });
    expect(silent).not.to.have.property('1');
  });

  it('should store a value for the templates, and refuse a bad name', async () => {
    const scope = { sceneSelector: 'my-scene' };
    await run(
      `
      await gladys.store('total', 21);
      await gladys.store('nothing');
      await gladys.action('message.send', { user: 'john', text: 'Total {{total}}' });
      try { await gladys.store('../bad', 1); } catch (e) { console.log(e.message); }
      try { await gladys.store(3, 1); } catch (e) { console.log(e.message); }
      try { await gladys.store('abortSignal', 1); } catch (e) { console.log(e.message); }
      try { await gladys.store('triggerEvent.key', 1); } catch (e) { console.log(e.message); }
      try {
        await gladys.action('device.get-value', { device_feature: 'living-room-lamp' }, { saveAs: 'sceneSelector' });
      } catch (e) { console.log(e.message); }
    `,
      scope,
    );
    expect(scope.total).to.equal(21);
    expect(scope.nothing).to.equal(null);
    sinon.assert.calledOnceWithExactly(self.message.sendToUser, 'john', 'Total 21', null, { service: undefined });
    expect(scriptLogs().map((log) => log.message)).to.deep.equal([
      'Invalid name "../bad": letters, digits, "_", "-", separated by dots',
      'Invalid name "3": letters, digits, "_", "-", separated by dots',
      'Invalid name "abortSignal": "abortSignal" is reserved by Gladys',
      'Invalid name "triggerEvent.key": "triggerEvent" is reserved by Gladys',
      'Invalid saveAs "sceneSelector": "sceneSelector" is reserved by Gladys',
    ]);
    expect(scope.sceneSelector).to.equal('my-scene');
  });

  it('should give the trigger event to the script', async () => {
    await run(`console.log(event.type, event.device_feature);`, {
      sceneSelector: 'my-scene',
      triggerEvent: { type: 'device.new-state', device_feature: 'living-room-temperature', date: new Date(0) },
    });
    expect(scriptLogs()[0].message).to.equal('device.new-state living-room-temperature');
  });

  it('should check a condition without stopping the scene', async () => {
    await run(`
      const armed = await gladys.check('alarm.check-alarm-mode', { house: 'main', alarm_mode: 'armed' });
      const disarmed = await gladys.check('alarm.check-alarm-mode', { house: 'main', alarm_mode: 'disarmed' });
      console.log(armed, disarmed);
    `);
    expect(scriptLogs()[0].message).to.equal('false true');
  });

  it('should stop the scene quietly on a condition run as an action', async () => {
    const promise = run(`
      await gladys.action('alarm.check-alarm-mode', { house: 'main', alarm_mode: 'armed' });
      console.log('never');
    `);
    await chaiAssert.isRejected(promise, AbortScene, 'SCRIPT_STOPPED');
    expect(scriptLogs()).to.deep.equal([]);
  });

  it('should stop the scene quietly on stop()', async () => {
    await chaiAssert.isRejected(run('stop();'), AbortScene, 'SCRIPT_STOPPED');
  });

  it('should throw an error into the script for an unknown action, a forbidden one or bad parameters', async () => {
    await run(`
      for (const [type, params, options] of [
        ['not.an-action', {}],
        ['condition.if-then-else', {}],
        ['script.run', { code: '' }],
        ['device.get-value', 'not an object'],
        ['device.get-value', []],
        ['device.get-value', { device_feature: 1 }],
        ['device.get-value', { device_feature: 'x' }, { saveAs: '../bad' }],
        ['device.get-value', { device_feature: 'x' }, { saveAs: 3 }],
      ]) {
        try {
          await gladys.action(type, params, options);
        } catch (e) {
          console.log(e.message);
        }
      }
    `);
    expect(scriptLogs().map((log) => log.message)).to.deep.equal([
      'Unknown action type "not.an-action"',
      'The action "condition.if-then-else" cannot be run from a script: use JavaScript instead',
      'The action "script.run" cannot be run from a script: use JavaScript instead',
      'The parameters of an action must be an object',
      'The parameters of an action must be an object',
      'Invalid parameters for "device.get-value": "device_feature" must be a string',
      'Invalid saveAs "../bad": letters, digits, "_", "-", separated by dots',
      'Invalid saveAs "3": letters, digits, "_", "-", separated by dots',
    ]);
  });

  it('should accept an action without parameters', async () => {
    await run(`console.log(await gladys.check('time.get-date'), await gladys.check('time.get-date', null, null));`);
    expect(scriptLogs()[0].message).to.equal('true true');
  });

  it('should throw an error into the script for an unknown device feature', async () => {
    await run(`
      try { await gladys.device.getValue('unknown'); } catch (e) { console.log(e.message); }
    `);
    expect(scriptLogs().map((log) => log.message)).to.deep.equal(['Device feature "unknown" not found']);
  });

  it('should fail the action, with the position, when the script throws', async () => {
    const promise = run('const a = 1;\nnull.x;');
    await chaiAssert.isRejected(
      promise,
      `Script of scene "my-scene" failed: TypeError: cannot read property 'x' of null (line 2, column 5)`,
    );
    expect(scriptLogs()).to.deep.equal([
      {
        sceneSelector: 'my-scene',
        level: 'error',
        message: "TypeError: cannot read property 'x' of null (line 2, column 5)",
      },
    ]);
  });

  it('should fail the action without position when the script throws a value', async () => {
    await chaiAssert.isRejected(run("throw 'boom';"), 'Script of scene "my-scene" failed: Error: boom');
  });

  it('should run an empty script', async () => {
    await executeAction(self, { type: ACTIONS.SCRIPT.RUN }, { sceneSelector: 'my-scene' }, '0.0', {
      throwUnknownError: true,
    });
    expect(scriptLogs()).to.deep.equal([]);
  });

  it('should stop the script when the scene is stopped during a sleep', async () => {
    const abortController = new AbortController();
    // stopped once the script is sleeping: it logs right before calling sleep()
    self.event.emit = sinon.fake(() => {
      setTimeout(() => abortController.abort(), 50);
    });
    const promise = run(`console.log('sleeping'); await sleep(10000); console.log('never');`, {
      sceneSelector: 'my-scene',
      abortSignal: abortController.signal,
    });
    await chaiAssert.isRejected(promise, SceneStopped);
    expect(scriptLogs().map((log) => log.message)).to.deep.equal(['sleeping']);
  });

  it('should sleep, and refuse a sleep that is not a number of milliseconds', async () => {
    const abortController = new AbortController();
    await run(
      `
      const start = Date.now();
      await sleep(30);
      console.log(Date.now() - start >= 25);
      try { await sleep(-1); } catch (e) { console.log(e.message); }
      try { await sleep('1'); } catch (e) { console.log(e.message); }
      try { await sleep(1e12); } catch (e) { console.log(e.message); }
    `,
      { sceneSelector: 'my-scene', abortSignal: abortController.signal },
    );
    await run(`await sleep(1); console.log('slept');`);
    expect(scriptLogs().map((log) => log.message)).to.deep.equal([
      'true',
      'sleep() takes a number of milliseconds, up to 2147483647',
      'sleep() takes a number of milliseconds, up to 2147483647',
      'sleep() takes a number of milliseconds, up to 2147483647',
      'slept',
    ]);
  });

  it('should cut long log lines and stop logging after 1000 lines', async () => {
    await run(`
      console.log('x'.repeat(3000));
      for (let i = 0; i < 1100; i += 1) {
        console.log(i);
      }
    `);
    const logs = scriptLogs();
    expect(logs).to.have.lengthOf(1000);
    expect(logs[0].message).to.have.lengthOf(2000);
    expect(logs[998].message).to.equal('997');
    expect(logs[999].message).to.equal('Log limit reached (1000 lines), the next lines are dropped');
  });

  it('should emit the logs on the websocket', async () => {
    await run(`console.warn('careful');`);
    sinon.assert.calledWith(self.event.emit, EVENTS.WEBSOCKET.SEND_ADMINS, {
      type: WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_LOG,
      payload: { sceneSelector: 'my-scene', level: 'warn', message: 'careful' },
    });
  });

  describe('buildScriptApi', () => {
    it('should rethrow an error of an action that does not stop the scene from check', async () => {
      const failingActions = {
        failing: () => {
          throw new Error('unexpected');
        },
        stopped: () => {
          throw new SceneStopped('SCENE_STOPPED');
        },
      };
      const api = buildScriptApi({
        self,
        scope: {},
        path: '0.0',
        actionsFunc: failingActions,
        schema: { validate: () => ({}) },
      });
      await chaiAssert.isRejected(api.check('failing', {}), 'unexpected');
      await chaiAssert.isRejected(api.check('stopped', {}), SceneStopped);
    });
    it('should validate the parameters with the action schema of the model', () => {
      expect(actionSchema.validate({ type: ACTIONS.LIGHT.TURN_ON, devices: ['lamp'] }).error).to.equal(undefined);
    });
  });
});
