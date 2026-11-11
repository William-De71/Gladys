const { expect, assert: chaiAssert } = require('chai');
const EventEmitter = require('events');
const { fake } = require('sinon').createSandbox();

const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../utils/constants');
const { BadParameters, NotFoundError } = require('../../../utils/coreErrors');
const SceneManager = require('../../../lib/scene');
const StateManager = require('../../../lib/state');

describe('scene.testScript', () => {
  let event;
  let sceneManager;
  let allUsers;
  let admins;

  beforeEach(() => {
    event = new EventEmitter();
    const brain = { addNamedEntity: fake.returns(null), removeNamedEntity: fake.returns(null) };
    sceneManager = new SceneManager(new StateManager(event), event, {}, {}, {}, {}, {}, {}, {}, {}, brain);
    allUsers = [];
    admins = [];
    event.on(EVENTS.WEBSOCKET.SEND_ALL, (message) => allUsers.push(message));
    event.on(EVENTS.WEBSOCKET.SEND_ADMINS, (message) => admins.push(message));
  });

  const finished = () =>
    new Promise((resolve) => {
      event.on(EVENTS.WEBSOCKET.SEND_ADMINS, (message) => {
        if (message.type === WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_TEST_FINISHED) {
          resolve(message.payload);
        }
      });
    });

  it('should run the script as an execution of the scene and tell how it ended', async () => {
    const end = finished();
    const execution = await sceneManager.testScript('test-scene', "console.log('hello'); return { total: 2 };");
    expect(execution).to.have.property('execution_id');
    expect(sceneManager.runningScenes.has(execution.execution_id)).to.equal(true);
    expect(allUsers[0].type).to.equal(WEBSOCKET_MESSAGE_TYPES.SCENE.STARTED);
    expect(allUsers[0].payload).to.include({ sceneSelector: 'test-scene', name: 'Test scene' });
    expect(await end).to.deep.equal({
      executionId: execution.execution_id,
      sceneSelector: 'test-scene',
      status: 'success',
      result: { total: 2 },
    });
    expect(sceneManager.runningScenes.size).to.equal(0);
    expect(allUsers[1]).to.deep.equal({
      type: WEBSOCKET_MESSAGE_TYPES.SCENE.STOPPED,
      payload: { executionId: execution.execution_id, sceneSelector: 'test-scene' },
    });
    expect(admins[0].payload).to.deep.equal({ sceneSelector: 'test-scene', level: 'info', message: 'hello' });
  });

  it('should tell when the script failed, and when it stopped itself', async () => {
    let end = finished();
    await sceneManager.testScript('test-scene', "throw new Error('boom');");
    expect(await end).to.include({ status: 'error', result: null });
    end = finished();
    await sceneManager.testScript('test-scene', 'stop();');
    expect(await end).to.include({ status: 'stopped', result: null });
  });

  it('should be stopped like a running scene', async () => {
    const end = finished();
    const execution = await sceneManager.testScript('test-scene', 'await sleep(60000);');
    expect(sceneManager.stop(execution.execution_id)).to.equal(true);
    expect(await end).to.include({ status: 'stopped' });
  });

  it('should refuse an unknown scene, a missing code and a script that does not compile', async () => {
    await chaiAssert.isRejected(sceneManager.testScript('unknown', 'return 1;'), NotFoundError);
    await chaiAssert.isRejected(sceneManager.testScript('test-scene', undefined), BadParameters);
    await chaiAssert.isRejected(sceneManager.testScript('test-scene', 'x'.repeat(100001)), BadParameters);
    await chaiAssert.isRejected(sceneManager.testScript('test-scene', 'let x = ;'), BadParameters, /line 1/);
    expect(sceneManager.runningScenes.size).to.equal(0);
  });
});
