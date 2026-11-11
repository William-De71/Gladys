const uuid = require('uuid');
const get = require('get-value');

const actionsFunc = require('./scene.actions');
const logger = require('../../utils/logger');
const { AbortScene, BadParameters } = require('../../utils/coreErrors');
const { ACTIONS, EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../utils/constants');
const { runSceneScript } = require('./script/script.run');
const { assertScriptCompiles } = require('./script/script.assertCompiles');
const { SCRIPT_MAX_CODE_LENGTH } = require('./script/constants');

// The path a script under test runs at: the one of the script of a scene in code mode.
const TEST_SCRIPT_PATH = '0.0';

/**
 * @description Run a script of a scene as it is being written, without saving the scene
 * (docs/specs/scene-editor-modes.md D.7). It runs for real, as an execution of the scene: it is
 * listed with the running scenes and can be stopped like them.
 * @param {string} sceneSelector - The selector of the scene the script belongs to.
 * @param {string} code - The JavaScript to run.
 * @returns {Promise<object>} The execution: `{ execution_id }`.
 * @example
 * await sceneManager.testScript('my-scene', "console.log('hello');");
 */
async function testScript(sceneSelector, code) {
  // throws when the scene does not exist
  const scene = await this.getBySelector(sceneSelector);
  if (typeof code !== 'string' || code.length > SCRIPT_MAX_CODE_LENGTH) {
    throw new BadParameters(`"code" must be a string of at most ${SCRIPT_MAX_CODE_LENGTH} characters`);
  }
  const action = { type: ACTIONS.SCRIPT.RUN, code };
  await assertScriptCompiles([[action]]);

  const executionId = uuid.v4();
  const abortController = new AbortController();
  const scope = {
    sceneSelector,
    alreadyExecutedScenes: new Set([sceneSelector]),
    abortSignal: abortController.signal,
  };
  const runningScene = {
    executionId,
    sceneSelector,
    name: scene.name,
    icon: scene.icon,
    startedAt: new Date(),
  };
  this.runningScenes.set(executionId, { ...runningScene, abortController });
  this.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
    type: WEBSOCKET_MESSAGE_TYPES.SCENE.STARTED,
    payload: runningScene,
  });

  const run = async () => {
    let status = 'success';
    try {
      await runSceneScript(this, action, scope, TEST_SCRIPT_PATH, actionsFunc);
    } catch (e) {
      // the error of a script is already in its logs
      status = e instanceof AbortScene ? 'stopped' : 'error';
      logger.debug(e);
    } finally {
      this.runningScenes.delete(executionId);
      this.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
        type: WEBSOCKET_MESSAGE_TYPES.SCENE.STOPPED,
        payload: { executionId, sceneSelector },
      });
      this.event.emit(EVENTS.WEBSOCKET.SEND_ADMINS, {
        type: WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_TEST_FINISHED,
        payload: {
          executionId,
          sceneSelector,
          status,
          result: get(scope, `${TEST_SCRIPT_PATH}.result`, { default: null }),
        },
      });
    }
  };
  run();

  return { execution_id: executionId };
}

module.exports = {
  testScript,
};
