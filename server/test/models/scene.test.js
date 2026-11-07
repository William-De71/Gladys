const { assert } = require('chai');

const db = require('../../models');
const { ACTIONS, ANY_CHANGE_OPERATOR, EVENTS } = require('../../utils/constants');

// db.Scene.build(...).validate() runs the model validators (and the beforeValidate
// hook building the selector) without touching the database: it exercises the Joi
// schemas of the model itself, where SceneManager.create goes through the whole
// create flow.
const buildScene = (trigger) =>
  db.Scene.build({
    name: 'Any state change scene',
    icon: 'bell',
    triggers: [trigger],
    actions: [
      [
        {
          type: ACTIONS.LIGHT.TURN_ON,
        },
      ],
    ],
  });

const buildSceneWithActions = (actions) =>
  db.Scene.build({
    name: 'Integration scene',
    icon: 'bell',
    triggers: [],
    actions,
  });

describe('models/scene', () => {
  it('should validate an external integration scene trigger and action', async () => {
    await buildScene({
      type: EVENTS.EXTERNAL_INTEGRATION.SCENE_EVENT,
      integration: 'ext-frigate',
      trigger_key: 'object_detected',
      fields: { camera: 'ext:frigate:front', label: ['person', 'car'], zone: null, min_score: 0.5, empty: '' },
    }).validate();
    await buildSceneWithActions([
      [
        {
          type: ACTIONS.EXTERNAL_INTEGRATION.SCENE_ACTION,
          integration: 'ext-frigate',
          action_key: 'create_snapshot',
          fields: { camera: 'ext:frigate:front', caption: 'Visitor: {{triggerEvent.data.label}}', hd: true },
        },
      ],
    ]).validate();
  });

  it('should validate a stored external integration trigger without fields', async () => {
    await buildScene({
      type: EVENTS.EXTERNAL_INTEGRATION.SCENE_EVENT,
      integration: 'ext-frigate',
      trigger_key: 'doorbell_pressed',
    }).validate();
  });

  // the manifest is never consulted at save time: the shape only is checked
  const invalidFields = [
    { name: 'a nested value', fields: { camera: { nested: true } } },
    { name: 'a bad key', fields: { 'Bad-Key': 'x' } },
    { name: 'an array of objects', fields: { label: [{ value: 'person' }] } },
    {
      name: 'more than 10 keys',
      fields: Object.fromEntries(Array.from({ length: 11 }, (value, index) => [`k${index}`, 'x'])),
    },
  ];
  invalidFields.forEach(({ name, fields }) => {
    it(`should reject an external integration trigger with ${name}`, async () => {
      const promise = buildScene({
        type: EVENTS.EXTERNAL_INTEGRATION.SCENE_EVENT,
        integration: 'ext-frigate',
        trigger_key: 'object_detected',
        fields,
      }).validate();
      await assert.isRejected(promise, '"[0].fields');
    });
  });

  it('should require the integration and the declared key on the external integration types', async () => {
    await assert.isRejected(
      buildScene({ type: EVENTS.EXTERNAL_INTEGRATION.SCENE_EVENT, trigger_key: 'object_detected' }).validate(),
      '"[0].integration" is required',
    );
    await assert.isRejected(
      buildScene({ type: EVENTS.EXTERNAL_INTEGRATION.SCENE_EVENT, integration: 'ext-frigate' }).validate(),
      '"[0].trigger_key" is required',
    );
    await assert.isRejected(
      buildSceneWithActions([
        [{ type: ACTIONS.EXTERNAL_INTEGRATION.SCENE_ACTION, action_key: 'create_snapshot' }],
      ]).validate(),
      '"[0][0].integration" is required',
    );
    await assert.isRejected(
      buildSceneWithActions([
        [{ type: ACTIONS.EXTERNAL_INTEGRATION.SCENE_ACTION, integration: 'ext-frigate' }],
      ]).validate(),
      '"[0][0].action_key" is required',
    );
    // the other types keep them optional
    await buildScene({ type: EVENTS.SYSTEM.START }).validate();
  });

  it('should reject a declared key outside the manifest key format', async () => {
    const triggerPromise = buildScene({
      type: EVENTS.EXTERNAL_INTEGRATION.SCENE_EVENT,
      integration: 'ext-frigate',
      trigger_key: 'Object Detected',
    }).validate();
    await assert.isRejected(triggerPromise, '"[0].trigger_key"');
    const actionPromise = buildSceneWithActions([
      [{ type: ACTIONS.EXTERNAL_INTEGRATION.SCENE_ACTION, integration: 'ext-frigate', action_key: 'Snap!' }],
    ]).validate();
    await assert.isRejected(actionPromise, '"[0][0].action_key"');
  });

  it('should validate an energy contract price trigger and condition', async () => {
    // they target a meter (its device selector), an empty one meaning any meter / the main meter
    await buildScene({ type: EVENTS.ENERGY_CONTRACT.PRICE_CHANGED, electric_meter: 'linky' }).validate();
    await buildScene({ type: EVENTS.ENERGY_CONTRACT.PRICE_CHANGED, electric_meter: '' }).validate();
    await buildSceneWithActions([
      [{ type: ACTIONS.ENERGY_CONTRACT.CURRENT_PRICE, electric_meter: 'linky', operator: '<', value: 0.2 }],
    ]).validate();
    await buildSceneWithActions([
      [{ type: ACTIONS.ENERGY_CONTRACT.CURRENT_PRICE, electric_meter: '', operator: '<', value: 0.2 }],
    ]).validate();
    // a trigger or a condition saved before the meter targeting names a contract
    await buildScene({ type: EVENTS.ENERGY_CONTRACT.PRICE_CHANGED, energy_contract: 'edf-tempo' }).validate();
    await buildScene({ type: EVENTS.ENERGY_CONTRACT.PRICE_CHANGED, energy_contract: '' }).validate();
    await buildSceneWithActions([
      [{ type: ACTIONS.ENERGY_CONTRACT.CURRENT_PRICE, energy_contract: 'edf-tempo', operator: '<', value: 0.2 }],
    ]).validate();
    const promise = buildSceneWithActions([
      [{ type: ACTIONS.ENERGY_CONTRACT.CURRENT_PRICE, energy_contract: 'edf-tempo', operator: 'changed', value: 1 }],
    ]).validate();
    await assert.isRejected(promise, /operator/);
  });

  it('should validate an "any state change" trigger', async () => {
    await buildScene({
      type: EVENTS.DEVICE.NEW_STATE,
      device_features: ['my-thermostat-mode'],
      operator: ANY_CHANGE_OPERATOR,
    }).validate();
  });

  // A "changed" trigger compares the new state with the previous one: there is no value to
  // match, and neither the threshold nor the duration option applies to an instantaneous change
  const invalidAnyChangeProperties = [
    { key: 'value', value: 1 },
    { key: 'threshold_only', value: true },
    { key: 'for_duration', value: 2700000 },
  ];
  invalidAnyChangeProperties.forEach(({ key, value }) => {
    it(`should reject an "any state change" trigger with a ${key}`, async () => {
      const promise = buildScene({
        type: EVENTS.DEVICE.NEW_STATE,
        device_features: ['my-thermostat-mode'],
        operator: ANY_CHANGE_OPERATOR,
        [key]: value,
      }).validate();
      await assert.isRejected(promise, `"[0].${key}" is not allowed`);
    });
  });

  describe('time-range trigger', () => {
    it('should validate a time-range trigger', async () => {
      await buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'time-range',
        days_of_the_week: ['monday', 'tuesday'],
        time_ranges: [
          { start: '12:00', end: '14:30' },
          { start: '16:00', end: '17:30' },
        ],
        resume_on_startup: true,
      }).validate();
    });

    // Shapes of earlier iterations of this feature, never released: a range carrying its
    // own days could be saved with none, then refused by addScene after the save.
    [
      { key: 'trigger_start', value: true },
      { key: 'trigger_end', value: false },
    ].forEach(({ key, value }) => {
      it(`should reject a time-range trigger holding "${key}"`, async () => {
        const promise = buildScene({
          type: EVENTS.TIME.CHANGED,
          scheduler_type: 'time-range',
          days_of_the_week: ['monday'],
          time_ranges: [{ start: '12:00', end: '14:30' }],
          [key]: value,
        }).validate();
        await assert.isRejected(promise, `"[0].${key}" is not allowed`);
      });
    });

    it('should reject days of the week carried by a range', async () => {
      const promise = buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'time-range',
        time_ranges: [{ start: '12:00', end: '14:30', days_of_the_week: [] }],
      }).validate();
      await assert.isRejected(promise, '"[0].time_ranges[0].days_of_the_week" is not allowed');
    });

    it('should reject a range without an end', async () => {
      const promise = buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'time-range',
        time_ranges: [{ start: '12:00' }],
      }).validate();
      await assert.isRejected(promise, '"[0].time_ranges[0].end" is required');
    });

    it('should reject a trigger without any range', async () => {
      const promise = buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'time-range',
        time_ranges: [],
      }).validate();
      await assert.isRejected(promise, 'at least one time range');
    });

    it('should reject a trigger where every day was unselected', async () => {
      const promise = buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'time-range',
        days_of_the_week: [],
        time_ranges: [{ start: '12:00', end: '14:30' }],
      }).validate();
      await assert.isRejected(promise, 'at least one day of the week');
    });

    it('should reject a range starting and ending at the same time', async () => {
      const promise = buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'time-range',
        time_ranges: [{ start: '12:00', end: '12:00' }],
      }).validate();
      await assert.isRejected(promise, 'cannot start and end at the same time');
    });

    // A loose HH:mm regex accepts these, and node-schedule then builds a rule which never
    // fires: the trigger would be silently dead.
    ['99:99', '12:75', '24:00'].forEach((time) => {
      it(`should reject the impossible time "${time}"`, async () => {
        const promise = buildScene({
          type: EVENTS.TIME.CHANGED,
          scheduler_type: 'time-range',
          time_ranges: [{ start: time, end: '20:00' }],
        }).validate();
        await assert.isRejected(promise, '"[0].time_ranges[0].start"');
      });
    });

    // The other trigger types must not be affected by the time-range rules.
    it('should still validate a classic every-day trigger', async () => {
      await buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'every-day',
        time: '09:00',
      }).validate();
    });

    it('should reject a badly formatted time', async () => {
      const promise = buildScene({
        type: EVENTS.TIME.CHANGED,
        scheduler_type: 'time-range',
        time_ranges: [{ start: '12h00', end: '14:30' }],
      }).validate();
      await assert.isRejected(promise, '"[0].time_ranges[0].start"');
    });
  });

  describe('editor and code mode', () => {
    const buildSceneWithEditor = (editor, actions) =>
      db.Scene.build({ name: 'Editor scene', icon: 'bell', triggers: [], actions, editor });
    const scriptActions = [[{ type: ACTIONS.SCRIPT.RUN, code: 'await sleep(1);', language: 'javascript' }]];

    it('should validate a scene without editor, in the classic mode', async () => {
      await buildSceneWithEditor(undefined, [[{ type: ACTIONS.LIGHT.TURN_ON }]]).validate();
      await buildSceneWithEditor(null, [[{ type: ACTIONS.LIGHT.TURN_ON }]]).validate();
      await buildSceneWithEditor({ mode: 'classic' }, [[{ type: ACTIONS.LIGHT.TURN_ON }]]).validate();
    });

    it('should validate a scene in graph mode with its layout', async () => {
      await buildSceneWithEditor(
        {
          mode: 'graph',
          graph: {
            signature: 't1|a[light.turn-on]',
            positions: { start: { x: 0, y: 0 }, 'trigger.0': { x: -200, y: 0 }, '0.0': { x: 200.5, y: -3 } },
          },
        },
        [[{ type: ACTIONS.LIGHT.TURN_ON }]],
      ).validate();
    });

    it('should reject an unknown mode, a position without coordinates or a bad node key', async () => {
      const actions = [[{ type: ACTIONS.LIGHT.TURN_ON }]];
      await assert.isRejected(buildSceneWithEditor({ mode: 'blocks' }, actions).validate(), '"mode" must be one of');
      await assert.isRejected(
        buildSceneWithEditor(
          { mode: 'graph', graph: { signature: '', positions: { '0.0': { x: 1 } } } },
          actions,
        ).validate(),
        '"graph.positions.0.0.y" is required',
      );
      await assert.isRejected(
        buildSceneWithEditor(
          { mode: 'graph', graph: { signature: '', positions: { 'Bad Key': { x: 1, y: 1 } } } },
          actions,
        ).validate(),
        'is not allowed',
      );
    });

    it('should validate a scene in code mode holding a script', async () => {
      await buildSceneWithEditor({ mode: 'code' }, scriptActions).validate();
      await buildSceneWithEditor({ mode: 'code' }, [[{ type: ACTIONS.SCRIPT.RUN, code: '' }]]).validate();
    });

    it('should reject a scene in code mode without a single script', async () => {
      const message = 'A scene in code mode must have a single "script.run" action';
      await assert.isRejected(
        buildSceneWithEditor({ mode: 'code' }, [[{ type: ACTIONS.LIGHT.TURN_ON }]]).validate(),
        message,
      );
      await assert.isRejected(
        buildSceneWithEditor({ mode: 'code' }, [...scriptActions, [{ type: ACTIONS.LIGHT.TURN_ON }]]).validate(),
        message,
      );
      await assert.isRejected(
        buildSceneWithEditor({ mode: 'code' }, [[...scriptActions[0], { type: ACTIONS.LIGHT.TURN_ON }]]).validate(),
        message,
      );
      await assert.isRejected(buildSceneWithEditor({ mode: 'code' }, []).validate(), message);
    });

    it('should reject a script outside of the code mode, even nested in a block', async () => {
      const message = 'A "script.run" action is only allowed in a scene in code mode';
      await assert.isRejected(buildSceneWithEditor(null, scriptActions).validate(), message);
      await assert.isRejected(buildSceneWithEditor({ mode: 'graph' }, scriptActions).validate(), message);
      await assert.isRejected(
        buildSceneWithEditor(null, [
          [{ type: ACTIONS.CONDITION.IF_THEN_ELSE, if: [], then: [[]], else: scriptActions }],
        ]).validate(),
        message,
      );
      await assert.isRejected(
        buildSceneWithEditor(null, [
          [{ type: ACTIONS.CONDITION.WHILE, if: [scriptActions[0][0]], then: [[]] }],
        ]).validate(),
        message,
      );
    });

    it('should refuse a script in another language or too long', async () => {
      await assert.isRejected(
        buildSceneWithEditor({ mode: 'code' }, [[{ type: ACTIONS.SCRIPT.RUN, code: '', language: 'lua' }]]).validate(),
        '"[0][0].language" must be [javascript]',
      );
      await assert.isRejected(
        buildSceneWithEditor({ mode: 'code' }, [[{ type: ACTIONS.SCRIPT.RUN, code: 'x'.repeat(100001) }]]).validate(),
        'length must be less than or equal to 100000',
      );
    });
  });

  describe('isScriptActions', () => {
    const { isScriptActions } = require('../../models/scene'); // eslint-disable-line global-require

    it('should only accept a single script.run action', () => {
      assert.equal(isScriptActions([[{ type: ACTIONS.SCRIPT.RUN }]]), true);
      assert.equal(isScriptActions(null), false);
      assert.equal(isScriptActions(['not a step']), false);
      assert.equal(isScriptActions([[null]]), false);
      assert.equal(isScriptActions([['not an action']]), false);
    });
  });
});
