const { expect } = require('chai');
const sinon = require('sinon').createSandbox();
const EventEmitter = require('events');

const { ACTIONS } = require('../../../../utils/constants');
const { AbortScene, BadParameters } = require('../../../../utils/coreErrors');
const actionsFunc = require('../../../../lib/scene/scene.actions');
const executeActionsFactory = require('../../../../lib/scene/scene.executeActions');
const { generateScript, toJsLiteral, isPathReferenced } = require('../../../../lib/scene/script/script.generate');
const { compileScript } = require('../../../../lib/scene/script/script.sandbox');
const StateManager = require('../../../../lib/state');

const { executeActions } = executeActionsFactory(actionsFunc);

const body = (code) =>
  code
    .split('\n')
    .slice(3)
    .join('\n');

describe('scene script generation', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('generateScript', () => {
    it('should write a header only for a scene without actions', () => {
      expect(generateScript([])).to.equal(
        '// Converted from the blocks of this scene.\n// `gladys.action(type, params)` runs an action exactly as its block did.\n\n',
      );
      expect(body(generateScript([[], [{ type: null }]]))).to.equal('');
    });

    it('should write each action, with saveAs only when a later template reads its result', () => {
      const code = generateScript([
        [{ type: ACTIONS.DEVICE.GET_VALUE, device_feature: 'temperature' }],
        [{ type: ACTIONS.DEVICE.GET_VALUE, device_feature: 'humidity' }],
        [{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'It is {{ 0.0.last_value }} °C' }],
      ]);
      expect(body(code)).to.equal(
        [
          "await gladys.action('device.get-value', { device_feature: 'temperature' }, { saveAs: '0.0' });",
          "await gladys.action('device.get-value', { device_feature: 'humidity' });",
          "await gladys.action('message.send', { user: 'john', text: 'It is {{ 0.0.last_value }} °C' });",
          '',
        ].join('\n'),
      );
    });

    it('should write parallel actions, conditions and blocks of a step with Promise.all', () => {
      const code = generateScript([
        [
          { type: ACTIONS.LIGHT.TURN_ON, devices: ['lamp'] },
          { type: ACTIONS.HOUSE.IS_EMPTY, house: 'main' },
          {
            type: ACTIONS.CONDITION.IF_THEN_ELSE,
            if: [{ type: ACTIONS.HOUSE.IS_EMPTY, house: 'main' }],
            then: [[{ type: ACTIONS.LIGHT.TURN_OFF, devices: ['lamp'] }]],
            else: [[]],
          },
        ],
      ]);
      expect(body(code)).to.equal(
        [
          '// At the same time',
          'await Promise.all([',
          "  gladys.action('light.turn-on', { devices: ['lamp'] }),",
          "  gladys.check('house.is-empty', { house: 'main' }).then((ok) => ok || stop()),",
          '  (async () => {',
          "    if (await gladys.check('house.is-empty', { house: 'main' })) {",
          "      await gladys.action('light.turn-off', { devices: ['lamp'] });",
          '    }',
          '  })(),',
          ']);',
          '',
        ].join('\n'),
      );
    });

    it('should write an if block with several conditions, an else, and one without condition', () => {
      const code = generateScript([
        [
          {
            type: ACTIONS.CONDITION.IF_THEN_ELSE,
            if: [
              { type: ACTIONS.HOUSE.IS_EMPTY, house: 'main' },
              { type: null },
              { type: ACTIONS.ALARM.CHECK_ALARM_MODE, house: 'main', alarm_mode: 'armed' },
            ],
            then: [[{ type: ACTIONS.LIGHT.TURN_OFF, devices: ['lamp'] }]],
            else: [[{ type: ACTIONS.LIGHT.TURN_ON, devices: ['lamp'] }]],
          },
        ],
        [{ type: ACTIONS.CONDITION.IF_THEN_ELSE, then: [[{ type: ACTIONS.SCENE.START, scene: 'other' }]] }],
      ]);
      expect(body(code)).to.equal(
        [
          'const conditions0_0 = await Promise.all([',
          "  gladys.check('house.is-empty', { house: 'main' }),",
          "  gladys.check('alarm.check-alarm-mode', { house: 'main', alarm_mode: 'armed' }),",
          ']);',
          'if (conditions0_0.every(Boolean)) {',
          "  await gladys.action('light.turn-off', { devices: ['lamp'] });",
          '} else {',
          "  await gladys.action('light.turn-on', { devices: ['lamp'] });",
          '}',
          'if (true) {',
          "  await gladys.action('scene.start', { scene: 'other' });",
          '}',
          '',
        ].join('\n'),
      );
    });

    it('should write a while block as a bounded loop, and an empty one as a stop', () => {
      const code = generateScript([
        [
          {
            type: ACTIONS.CONDITION.WHILE,
            max_iterations: 50000,
            if: [{ type: ACTIONS.HOUSE.IS_EMPTY, house: 'main' }],
            then: [[{ type: ACTIONS.TIME.DELAY, value: 1, unit: 'seconds' }]],
          },
        ],
        [{ type: ACTIONS.CONDITION.WHILE, if: [], then: [[{ type: ACTIONS.TIME.DELAY, value: 1, unit: 'seconds' }]] }],
        [{ type: ACTIONS.CONDITION.WHILE, if: [{ type: ACTIONS.HOUSE.IS_EMPTY, house: 'main' }] }],
      ]);
      expect(body(code)).to.equal(
        [
          'for (let iteration0_0 = 0; iteration0_0 < 10000; iteration0_0 += 1) {',
          "  if (!(await gladys.check('house.is-empty', { house: 'main' }))) {",
          '    break;',
          '  }',
          '  const startedAt0_0 = Date.now();',
          "  await gladys.action('delay', { value: 1, unit: 'seconds' });",
          '  await sleep(Math.max(0, 100 - (Date.now() - startedAt0_0)));',
          '}',
          '// An empty "while" block stops the scene',
          'stop();',
          '// An empty "while" block stops the scene',
          'stop();',
          '',
        ].join('\n'),
      );
    });

    it('should write a function block as it is, keeping its result only when it is read', () => {
      const code = generateScript([
        [{ type: ACTIONS.SCRIPT.RUN, code: 'const x = 2;\n\nreturn x;' }],
        [{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'Result {{0.0.result}}' }, { type: ACTIONS.SCRIPT.RUN }],
      ]);
      expect(body(code)).to.equal(
        [
          '// Function block',
          "await gladys.store('0.0', {",
          '  result: await (async () => {',
          '    const x = 2;',
          '',
          '    return x;',
          '  })(),',
          '});',
          '// At the same time',
          'await Promise.all([',
          "  gladys.action('message.send', { user: 'john', text: 'Result {{0.0.result}}' }),",
          '  (async () => {',
          '    // Function block',
          '    await (async () => {',
          '',
          '    })();',
          '  })(),',
          ']);',
          '',
        ].join('\n'),
      );
    });

    it('should keep the default number of iterations of a while block', () => {
      const code = generateScript([
        [
          {
            type: ACTIONS.CONDITION.WHILE,
            if: [{ type: ACTIONS.HOUSE.IS_EMPTY, house: 'main' }],
            then: [[{ type: ACTIONS.TIME.DELAY, value: 1, unit: 'seconds' }]],
          },
        ],
      ]);
      expect(code).to.contain('iteration0_0 < 1000;');
    });

    it('should write a condition of the main flow as a check stopping the scene', () => {
      const code = generateScript([[{ type: ACTIONS.HOUSE.IS_EMPTY, house: 'main' }]]);
      expect(body(code)).to.equal(
        ["if (!(await gladys.check('house.is-empty', { house: 'main' }))) {", '  stop();', '}', ''].join('\n'),
      );
    });

    it('should always produce a script that compiles', async () => {
      const code = generateScript([
        [{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'It\'s "hot"\n\\ {{0.0.x}}\r' }],
        [{ type: ACTIONS.HTTP.REQUEST, method: 'post', url: 'http://x', headers: [{ key: 'a-b', value: 'c' }] }],
      ]);
      expect(await compileScript(code)).to.deep.equal({ valid: true });
    });
  });

  describe('toJsLiteral', () => {
    it('should write every kind of value', () => {
      expect(toJsLiteral(null, '')).to.equal('null');
      expect(toJsLiteral(undefined, '')).to.equal('null');
      expect(toJsLiteral(12.5, '')).to.equal('12.5');
      expect(toJsLiteral(true, '')).to.equal('true');
      expect(toJsLiteral([], '')).to.equal('[]');
      expect(toJsLiteral({}, '')).to.equal('{}');
      expect(toJsLiteral({ 'not-an-identifier': 1, skipped: undefined }, '')).to.equal("{ 'not-an-identifier': 1 }");
    });
    it('should break a long literal over several lines', () => {
      const literal = toJsLiteral({ text: 'x'.repeat(70), list: ['a', 'b'] }, '  ');
      expect(literal).to.equal(`{\n    text: '${'x'.repeat(70)}',\n    list: ['a', 'b'],\n  }`);
      expect(toJsLiteral(['y'.repeat(50), 'z'.repeat(50)], '')).to.equal(
        `[\n  '${'y'.repeat(50)}',\n  '${'z'.repeat(50)}',\n]`,
      );
    });
  });

  describe('shape of the steps', () => {
    it('should refuse what is not steps of actions, at any depth', () => {
      const refused = [
        undefined,
        'x',
        [{ type: 'delay' }],
        [[null]],
        [['delay']],
        [[[]]],
        [[{ type: 'condition.if-then-else', if: 'x' }]],
        [[{ type: 'condition.if-then-else', if: [], then: [{ type: 'delay' }] }]],
        [[{ type: 'condition.if-then-else', if: [], then: [], else: [[1]] }]],
      ];
      refused.forEach((actions) => {
        expect(() => generateScript(actions)).to.throw(BadParameters);
      });
    });
    it('should accept empty steps, untyped actions and blocks without branches', () => {
      expect(generateScript([[], [{ type: null }], [{ type: 'condition.if-then-else' }]])).to.contain('if (true) {');
    });
  });

  describe('isPathReferenced', () => {
    it('should find a template or a condition selector reading the path', () => {
      expect(isPathReferenced(['{{0.0.last_value}}'], '0.0')).to.equal(true);
      expect(isPathReferenced(['{{  1.0.then.0.0.value }}'], '1.0.then.0.0')).to.equal(true);
      expect(isPathReferenced(['0.0.last_value'], '0.0')).to.equal(true);
      expect(isPathReferenced(['{{10.0.last_value}}', '20.0.x'], '0.0')).to.equal(false);
    });
  });

  // The script must behave as the blocks it comes from: each scenario runs both ways, on the same
  // fakes, and the effects are compared.
  describe('same behavior as the blocks', () => {
    const runBothWays = async (actions, setup) => {
      const runOnce = async (runner) => {
        const event = new EventEmitter();
        const stateManager = new StateManager(event);
        const self = {
          stateManager,
          event: { emit: sinon.fake() },
          message: { sendToUser: sinon.fake.resolves(null) },
          device: {
            setValue: sinon.fake((device, feature, value) => {
              stateManager.setState('deviceFeature', feature.selector, { ...feature, last_value: value });
            }),
          },
          house: { getBySelector: sinon.fake.resolves({ name: 'Main', alarm_mode: 'disarmed' }) },
        };
        setup(stateManager);
        let stoppedBy = null;
        try {
          await runner(self);
        } catch (e) {
          stoppedBy = e instanceof AbortScene ? 'condition' : e.message;
        }
        return {
          messages: self.message.sendToUser.args.map((args) => args.slice(0, 2)),
          values: self.device.setValue.args.map(([, feature, value]) => [feature.selector, value]),
          stoppedBy,
        };
      };
      const blocks = await runOnce((self) => executeActions(self, actions, { sceneSelector: 'scene' }));
      const code = generateScript(actions);
      const script = await runOnce((self) =>
        executeActions(self, [[{ type: ACTIONS.SCRIPT.RUN, code }]], { sceneSelector: 'scene' }, null, {
          throwUnknownError: true,
        }),
      );
      return { blocks, script };
    };

    const addFeature = (stateManager, selector, lastValue) => {
      stateManager.setState('deviceFeature', selector, {
        selector,
        device_id: 'device',
        category: 'switch',
        type: 'binary',
        last_value: lastValue,
      });
      stateManager.setState('deviceById', 'device', { id: 'device', selector: 'device' });
    };

    it('should run an if / else reading a variable, and parallel actions', async () => {
      const actions = [
        [{ type: ACTIONS.DEVICE.GET_VALUE, device_feature: 'temperature' }],
        [
          {
            type: ACTIONS.CONDITION.IF_THEN_ELSE,
            if: [
              {
                type: ACTIONS.CONDITION.ONLY_CONTINUE_IF,
                conditions: [{ variable: '0.0.last_value', operator: '>', value: 20 }],
              },
            ],
            then: [
              [
                { type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'Hot: {{0.0.last_value}}' },
                { type: ACTIONS.DEVICE.SET_VALUE, device_feature: 'fan', value: 1 },
              ],
            ],
            else: [[{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'Cold: {{0.0.last_value}}' }]],
          },
        ],
        [{ type: ACTIONS.MESSAGE.SEND, user: 'jane', text: 'Done' }],
      ];
      const hot = await runBothWays(actions, (stateManager) => {
        addFeature(stateManager, 'temperature', 25);
        addFeature(stateManager, 'fan', 0);
      });
      expect(hot.blocks).to.deep.equal({
        messages: [
          ['john', 'Hot: 25'],
          ['jane', 'Done'],
        ],
        values: [['fan', 1]],
        stoppedBy: null,
      });
      expect(hot.script).to.deep.equal(hot.blocks);

      const cold = await runBothWays(actions, (stateManager) => {
        addFeature(stateManager, 'temperature', 15);
        addFeature(stateManager, 'fan', 0);
      });
      expect(cold.blocks.messages).to.deep.equal([
        ['john', 'Cold: 15'],
        ['jane', 'Done'],
      ]);
      expect(cold.script).to.deep.equal(cold.blocks);
    });

    it('should run a function block and give its result to the next actions', async () => {
      const actions = [
        [{ type: ACTIONS.DEVICE.GET_VALUE, device_feature: 'temperature' }],
        [
          {
            type: ACTIONS.SCRIPT.RUN,
            code: "const t = await gladys.device.getValue('temperature');\nreturn t > 20 ? 'hot' : 'cold';",
          },
        ],
        [{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'It is {{1.0.result}} ({{0.0.last_value}})' }],
      ];
      const { blocks, script } = await runBothWays(actions, (stateManager) =>
        addFeature(stateManager, 'temperature', 25),
      );
      expect(blocks).to.deep.equal({ messages: [['john', 'It is hot (25)']], values: [], stoppedBy: null });
      expect(script).to.deep.equal(blocks);
    });

    it('should stop the scene on an unmet condition of the main flow', async () => {
      const actions = [
        [{ type: ACTIONS.ALARM.CHECK_ALARM_MODE, house: 'main', alarm_mode: 'armed' }],
        [{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'never' }],
      ];
      const { blocks, script } = await runBothWays(actions, () => {});
      expect(blocks).to.deep.equal({ messages: [], values: [], stoppedBy: 'condition' });
      expect(script).to.deep.equal(blocks);
    });

    it('should stop the scene on an unmet condition of a parallel step', async () => {
      const actions = [
        [
          { type: ACTIONS.ALARM.CHECK_ALARM_MODE, house: 'main', alarm_mode: 'armed' },
          { type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'in parallel' },
        ],
        [{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'never' }],
      ];
      const { blocks, script } = await runBothWays(actions, () => {});
      expect(blocks).to.deep.equal({ messages: [['john', 'in parallel']], values: [], stoppedBy: 'condition' });
      expect(script).to.deep.equal(blocks);
    });

    it('should loop while the conditions are met, reading a variable of the loop', async () => {
      const actions = [
        [
          {
            type: ACTIONS.CONDITION.WHILE,
            if: [
              { type: ACTIONS.DEVICE.GET_VALUE, device_feature: 'counter' },
              {
                type: ACTIONS.CONDITION.ONLY_CONTINUE_IF,
                conditions: [{ variable: '0.0.if.0.last_value', operator: '<', value: 3 }],
              },
            ],
            then: [
              [
                {
                  type: ACTIONS.DEVICE.SET_VALUE,
                  device_feature: 'counter',
                  evaluate_value: '{{0.0.if.0.last_value}} + 1',
                },
              ],
            ],
          },
        ],
        [{ type: ACTIONS.MESSAGE.SEND, user: 'john', text: 'Counted to {{0.0.if.0.last_value}}' }],
      ];
      const { blocks, script } = await runBothWays(actions, (stateManager) => addFeature(stateManager, 'counter', 0));
      expect(blocks).to.deep.equal({
        messages: [['john', 'Counted to 3']],
        values: [
          ['counter', 1],
          ['counter', 2],
          ['counter', 3],
        ],
        stoppedBy: null,
      });
      expect(script).to.deep.equal(blocks);
    }).timeout(5000);
  });
});
