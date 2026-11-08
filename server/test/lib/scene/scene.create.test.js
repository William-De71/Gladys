const { assert, expect } = require('chai');
const sinon = require('sinon').createSandbox();

const { fake } = sinon;
const EventEmitter = require('events');
const proxyquire = require('proxyquire').noCallThru();
const { ACTIONS, ANY_CHANGE_OPERATOR, EVENTS } = require('../../../utils/constants');
const SceneManager = require('../../../lib/scene');
const sceneModel = require('../../../models/scene');

const event = new EventEmitter();

describe('SceneManager', () => {
  const brain = {};
  let sceneManager;
  beforeEach(() => {
    brain.addNamedEntity = fake.returns(null);
    brain.removeNamedEntity = fake.returns(null);
    sceneManager = new SceneManager({}, event, {}, {}, {}, {}, {}, {}, {}, {}, brain);
  });
  it('should create one scene', async () => {
    const scene = await sceneManager.create({
      name: 'My living room',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.LIGHT.TURN_ON,
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector');
    expect(scene.selector).to.contain('my-living-room');
    // selector should have 4 random characters at the end + dash
    expect(scene.selector).to.have.lengthOf('my-living-room'.length + 5);
  });
  it('should create one scene with custom selector', async () => {
    const scene = await sceneManager.create({
      name: 'My living room',
      icon: 'bell',
      selector: 'my-custom-selector',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.LIGHT.TURN_ON,
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector', 'my-custom-selector');
  });
  it('should create one scene with a text value in a device.set-value action', async () => {
    const scene = await sceneManager.create({
      name: 'Send message to TV',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.DEVICE.SET_VALUE,
            device_feature: 'my-tv-text-feature',
            value: 'The meal is ready!',
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector');
  });
  it('should create one scene with a music.play-media action, and refuse a malformed media', async () => {
    const scene = await sceneManager.create({
      name: 'Morning playlist',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.MUSIC.PLAY_MEDIA,
            device: 'kitchen-speaker',
            media: { id: 'spotify:playlist:1', type: 'playlist', title: 'Morning' },
            mode: 'replace',
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector');
    const promise = sceneManager.create({
      name: 'Bad media',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.MUSIC.PLAY_MEDIA,
            device: 'kitchen-speaker',
            media: { id: 'spotify:podcast:1', type: 'podcast' },
          },
        ],
      ],
      tags: [],
    });
    await assert.isRejected(promise);
  });
  it('should return validation error, invalid actions', async () => {
    const promise = sceneManager.create({
      name: 'My living room',
      icon: 'bell',
      triggers: [],
      actions: [
        {
          type: ACTIONS.LIGHT.TURN_ON,
        },
      ],
      tags: [],
    });
    await assert.isRejected(promise);
  });

  it('should return validation error, invalid triggers', async () => {
    const promise = sceneManager.create({
      name: 'Invalid trigger scene',
      icon: 'bell',
      triggers: [
        {
          type: 'invalid-trigger-type',
        },
      ],
      actions: [
        [
          {
            type: ACTIONS.LIGHT.TURN_ON,
          },
        ],
      ],
      tags: [],
    });
    await assert.isRejected(promise);
  });

  it('should create one scene with an "any state change" trigger', async () => {
    const scene = await sceneManager.create({
      name: 'Any state change scene',
      icon: 'bell',
      triggers: [
        {
          type: EVENTS.DEVICE.NEW_STATE,
          device_features: ['my-thermostat-mode'],
          operator: ANY_CHANGE_OPERATOR,
        },
      ],
      actions: [
        [
          {
            type: ACTIONS.LIGHT.TURN_ON,
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector');
  });

  // A "changed" trigger compares the new state with the previous one: there is no value to
  // match, and neither the threshold nor the duration option applies to an instantaneous change
  const invalidAnyChangeProperties = [
    { key: 'value', value: 1 },
    { key: 'threshold_only', value: true },
    { key: 'for_duration', value: 2700000 },
  ];
  invalidAnyChangeProperties.forEach(({ key, value }) => {
    it(`should return validation error, "any state change" trigger with a ${key}`, async () => {
      const promise = sceneManager.create({
        name: `Invalid any state change scene with ${key}`,
        icon: 'bell',
        triggers: [
          {
            type: EVENTS.DEVICE.NEW_STATE,
            device_features: ['my-thermostat-mode'],
            operator: ANY_CHANGE_OPERATOR,
            [key]: value,
          },
        ],
        actions: [
          [
            {
              type: ACTIONS.LIGHT.TURN_ON,
            },
          ],
        ],
        tags: [],
      });
      await assert.isRejected(promise);
    });
  });

  it('should return validation error when http.request action has no headers', async () => {
    const promise = sceneManager.create({
      name: 'Invalid http request scene',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.HTTP.REQUEST,
            method: 'post',
            url: 'https://example.com/hook',
          },
        ],
      ],
      tags: [],
    });
    await assert.isRejected(promise);
  });

  it('should return validation error when variable.set action has both a text and a formula', async () => {
    const promise = sceneManager.create({
      name: 'Ambiguous variable scene',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.VARIABLE.SET,
            text: 'Hello',
            evaluate_value: '2 * 3',
          },
        ],
      ],
      tags: [],
    });
    await assert.isRejected(promise, /conflict between optional exclusive peers \[text, evaluate_value\]/);
  });

  it('should create one scene with a variable.set action', async () => {
    const scene = await sceneManager.create({
      name: 'Variable scene',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.VARIABLE.SET,
            evaluate_value: '2 * 3',
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector');
  });

  it('should create a scene with a calendar.get-events action', async () => {
    const scene = await sceneManager.create({
      name: 'Announce my agenda',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.CALENDAR.GET_EVENTS,
            calendars: ['test-calendar'],
            time_range: 'tomorrow',
            stop_scene_if_no_events: true,
            // Null is accepted so the action can be saved before the user
            // has filled the number of hours.
            duration: null,
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector');
  });

  it('should return validation error when calendar.get-events has an invalid time range', async () => {
    const promise = sceneManager.create({
      name: 'Invalid calendar scene',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.CALENDAR.GET_EVENTS,
            calendars: ['test-calendar'],
            time_range: 'next-week',
          },
        ],
      ],
      tags: [],
    });
    await assert.isRejected(promise);
  });

  it('should return validation error when calendar.get-events has a fractional duration', async () => {
    const promise = sceneManager.create({
      name: 'Invalid calendar scene',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.CALENDAR.GET_EVENTS,
            calendars: ['test-calendar'],
            time_range: 'next-x-hours',
            duration: 1.5,
          },
        ],
      ],
      tags: [],
    });
    await assert.isRejected(promise);
  });

  it('should create a scene with a time.get-date action', async () => {
    const scene = await sceneManager.create({
      name: 'What time is it',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.TIME.GET_DATE,
            precision: 'minute',
          },
        ],
      ],
      tags: [],
    });
    expect(scene).to.have.property('selector');
    expect(scene.actions[0][0]).to.include({
      type: ACTIONS.TIME.GET_DATE,
      precision: 'minute',
    });
  });

  it('should return validation error when time.get-date has an unknown precision', async () => {
    const promise = sceneManager.create({
      name: 'Invalid get date scene',
      icon: 'bell',
      triggers: [],
      actions: [
        [
          {
            type: ACTIONS.TIME.GET_DATE,
            precision: 'century',
          },
        ],
      ],
      tags: [],
    });
    await assert.isRejected(promise);
  });

  describe('conditions of a condition.only-continue-if action', () => {
    const createSceneWithCondition = (condition) =>
      sceneManager.create({
        name: 'Only continue if scene',
        icon: 'bell',
        triggers: [],
        actions: [[{ type: ACTIONS.CONDITION.ONLY_CONTINUE_IF, conditions: [condition] }]],
        tags: [],
      });

    it('should create a scene with a condition on a variable', async () => {
      const scene = await createSceneWithCondition({ variable: '0.0.last_value', operator: '>', value: 20 });
      expect(scene.actions[0][0].conditions).to.deep.equal([{ variable: '0.0.last_value', operator: '>', value: 20 }]);
    });

    it('should create a scene with a condition on the current state of a device feature', async () => {
      const scene = await createSceneWithCondition({ device_feature: 'mqtt-temperature', operator: '>', value: 20 });
      expect(scene.actions[0][0].conditions).to.deep.equal([
        { device_feature: 'mqtt-temperature', operator: '>', value: 20 },
      ]);
    });

    it('should return validation error when a condition has neither a variable nor a device feature', async () => {
      await assert.isRejected(
        createSceneWithCondition({ operator: '>', value: 20 }),
        /must contain at least one of \[variable, device_feature\]/,
      );
    });

    it('should return validation error when a condition has both a variable and a device feature', async () => {
      await assert.isRejected(
        createSceneWithCondition({
          variable: '0.0.last_value',
          device_feature: 'mqtt-temperature',
          operator: '>',
          value: 20,
        }),
        /conflict between exclusive peers \[variable, device_feature\]/,
      );
    });

    it('should return validation error when the device feature of a condition is empty', async () => {
      await assert.isRejected(createSceneWithCondition({ device_feature: '', operator: '>', value: 20 }));
    });
  });

  it('should format joi error fallback when details are absent', () => {
    expect(sceneModel.formatJoiValidationError()).to.equal('Invalid schema');
    expect(sceneModel.formatJoiValidationError({ message: 'Validation failed' })).to.equal('Validation failed');
  });

  it('should create a scene in code mode', async () => {
    const scene = await sceneManager.create({
      name: 'My code scene',
      icon: 'bell',
      triggers: [],
      editor: { mode: 'code' },
      actions: [[{ type: ACTIONS.SCRIPT.RUN, code: 'await sleep(1);' }]],
    });
    expect(scene.editor).to.deep.equal({ mode: 'code' });
  });
  it('should refuse a scene in code mode whose script does not compile', async () => {
    const promise = sceneManager.create({
      name: 'My broken code scene',
      icon: 'bell',
      triggers: [],
      editor: { mode: 'code' },
      actions: [[{ type: ACTIONS.SCRIPT.RUN, code: 'const a = 1;\nlet b = ;' }]],
    });
    await assert.isRejected(promise, "Script syntax error at line 2, column 9: unexpected token in expression: ';'");
  });
  it('should refuse a script whose syntax error has no position', async () => {
    const { assertScriptCompiles } = proxyquire('../../../lib/scene/script/script.assertCompiles', {
      './script.sandbox': {
        compileScript: fake.resolves({ valid: false, message: 'broken', line: null, column: null }),
      },
    });
    await assert.isRejected(assertScriptCompiles([[{ type: ACTIONS.SCRIPT.RUN }]]), 'Script syntax error: broken');
  });
  it('should refuse a function block which does not compile, naming it', async () => {
    const promise = sceneManager.create({
      name: 'My scene with a broken function',
      icon: 'bell',
      triggers: [],
      actions: [
        [{ type: ACTIONS.LIGHT.TURN_ON }],
        [
          {
            type: ACTIONS.CONDITION.IF_THEN_ELSE,
            if: [],
            then: [[{ type: ACTIONS.SCRIPT.RUN, code: 'return ;;(' }]],
            else: [[]],
          },
        ],
      ],
    });
    await assert.isRejected(promise, 'Script syntax error in the function block 1.0.then.0.0 at line');
  });
  it('should create a scene with function blocks that compile', async () => {
    const scene = await sceneManager.create({
      name: 'My scene with functions',
      icon: 'bell',
      triggers: [],
      actions: [
        [{ type: ACTIONS.SCRIPT.RUN, code: 'return 1;' }],
        [
          {
            type: ACTIONS.CONDITION.WHILE,
            if: [{ type: ACTIONS.SCRIPT.RUN }],
            then: [[{ type: ACTIONS.LIGHT.TURN_ON }]],
          },
        ],
      ],
    });
    expect(scene.actions[0][0].code).to.equal('return 1;');
  });
});
