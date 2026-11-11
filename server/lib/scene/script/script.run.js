const cloneDeep = require('lodash.clonedeep');
const get = require('get-value');
const set = require('set-value');

const { ACTIONS, WEBSOCKET_MESSAGE_TYPES, EVENTS } = require('../../../utils/constants');
const { AbortScene, SceneStopped, NotFoundError } = require('../../../utils/coreErrors');
const logger = require('../../../utils/logger');
const { actionSchema } = require('../../../models/scene');
const { runScript } = require('./script.sandbox');

// Actions a script cannot run through `gladys.action`: their logic is JavaScript itself
// (docs/specs/scene-editor-modes.md D.3).
const FORBIDDEN_SCRIPT_ACTIONS = [ACTIONS.SCRIPT.RUN, ACTIONS.CONDITION.IF_THEN_ELSE, ACTIONS.CONDITION.WHILE];
// `saveAs`: a key of the scope, as the templates read it ({{saveAs.…}}).
const SAVE_AS_REGEX = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;
// What the engine keeps in the scope of an execution: a script cannot write over it.
const RESERVED_SCOPE_KEYS = ['abortSignal', 'sceneSelector', 'alreadyExecutedScenes', 'triggerEvent'];
// The longest delay of a Node timer: beyond it, the timer fires at once.
const MAX_SLEEP_MS = 2 ** 31 - 1;
// A runaway script must not flood the logs and the websocket.
const MAX_LOG_LINES_PER_EXECUTION = 1000;
const MAX_LOG_LINE_LENGTH = 2000;

/**
 * @description Copy a value so it can cross the sandbox boundary as JSON.
 * @param {any} value - The value.
 * @returns {any} A JSON-safe copy, null for undefined.
 * @example
 * toJsonValue({ a: new Date(0) }); // { a: '1970-01-01T00:00:00.000Z' }
 */
function toJsonValue(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * @description Check a name a script writes in the scope (`saveAs`, `gladys.store`).
 * @param {any} name - The name.
 * @param {string} label - What the name is, for the error.
 * @example
 * assertScopeName('living-room.temperature', 'name');
 */
function assertScopeName(name, label) {
  if (typeof name !== 'string' || !SAVE_AS_REGEX.test(name)) {
    throw new Error(`Invalid ${label} "${name}": letters, digits, "_", "-", separated by dots`);
  }
  if (RESERVED_SCOPE_KEYS.includes(name.split('.')[0])) {
    throw new Error(`Invalid ${label} "${name}": "${name.split('.')[0]}" is reserved by Gladys`);
  }
}

/**
 * @description Build the host methods of the scripting API for one execution.
 * @param {object} options - Options.
 * @param {object} options.self - The SceneManager.
 * @param {object} options.scope - The scope of the execution.
 * @param {string} options.path - The path of the "script.run" action.
 * @param {object} options.actionsFunc - The scene actions, by type.
 * @param {object} options.schema - The Joi schema of an action.
 * @returns {object} The host methods, by name.
 * @example
 * buildScriptApi({ self, scope, path: '0.0', actionsFunc, schema: actionSchema });
 */
function buildScriptApi({ self, scope, path, actionsFunc, schema }) {
  let callCount = 0;

  const runAction = async (type, params, options) => {
    if (typeof type !== 'string' || !actionsFunc[type]) {
      throw new Error(`Unknown action type "${type}"`);
    }
    if (FORBIDDEN_SCRIPT_ACTIONS.includes(type)) {
      throw new Error(`The action "${type}" cannot be run from a script: use JavaScript instead`);
    }
    // Absent arguments cross the sandbox boundary as null (JSON)
    if (params !== undefined && params !== null && (typeof params !== 'object' || Array.isArray(params))) {
      throw new Error('The parameters of an action must be an object');
    }
    const saveAs = options && options.saveAs !== null ? options.saveAs : undefined;
    if (saveAs !== undefined) {
      assertScopeName(saveAs, 'saveAs');
    }
    const action = { ...params, type };
    const { error } = schema.validate(action, { abortEarly: false });
    if (error) {
      throw new Error(`Invalid parameters for "${type}": ${error.details.map((detail) => detail.message).join('; ')}`);
    }
    callCount += 1;
    const resultPath = saveAs || `${path}.script.${callCount}`;
    await actionsFunc[type](self, action, scope, resultPath);
    return toJsonValue(get(scope, resultPath, { default: undefined }));
  };

  const getFeature = (selector) => {
    const deviceFeature = self.stateManager.get('deviceFeature', selector);
    if (!deviceFeature) {
      throw new NotFoundError(`Device feature "${selector}" not found`);
    }
    return deviceFeature;
  };

  return {
    action: runAction,
    check: async (type, params, options) => {
      try {
        await runAction(type, params, options);
        return true;
      } catch (e) {
        if (e instanceof AbortScene && !(e instanceof SceneStopped)) {
          return false;
        }
        throw e;
      }
    },
    'device.getValue': async (selector) => {
      const { last_value: lastValue } = getFeature(selector);
      return lastValue === undefined ? null : lastValue;
    },
    'device.getFeature': async (selector) => toJsonValue(cloneDeep(getFeature(selector))),
    'device.setValue': async (selector, value) => {
      await runAction(ACTIONS.DEVICE.SET_VALUE, { device_feature: selector, value });
      return null;
    },
    'scene.start': async (selector) => {
      await runAction(ACTIONS.SCENE.START, { scene: selector });
      return null;
    },
    'message.send': async (user, text) => {
      await runAction(ACTIONS.MESSAGE.SEND, { user, text });
      return null;
    },
    // keeps a value for the templates of the next actions ({{name.…}}), like `saveAs`
    store: async (name, value) => {
      assertScopeName(name, 'name');
      // an absent value crosses the sandbox boundary as null
      set(scope, name, value);
      return null;
    },
    sleep: (ms) =>
      new Promise((resolve, reject) => {
        if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0 || ms > MAX_SLEEP_MS) {
          reject(new Error(`sleep() takes a number of milliseconds, up to ${MAX_SLEEP_MS}`));
          return;
        }
        const { abortSignal } = scope;
        let timeout = null;
        const onAbort = () => {
          clearTimeout(timeout);
          reject(new SceneStopped('SCENE_STOPPED'));
        };
        timeout = setTimeout(() => {
          if (abortSignal) {
            abortSignal.removeEventListener('abort', onAbort);
          }
          resolve(null);
        }, ms);
        if (abortSignal) {
          abortSignal.addEventListener('abort', onAbort, { once: true });
        }
      }),
  };
}

/**
 * @description Run the "script.run" action of a scene in code mode.
 * @param {object} self - The SceneManager.
 * @param {object} action - The "script.run" action.
 * @param {object} scope - The scope of the execution.
 * @param {string} path - The path of the action.
 * @param {object} actionsFunc - The scene actions, by type.
 * @returns {Promise} Resolve when the script is finished.
 * @example
 * await runSceneScript(self, { type: 'script.run', code: '' }, scope, '0.0', actionsFunc);
 */
async function runSceneScript(self, action, scope, path, actionsFunc) {
  const { sceneSelector } = scope;
  let logLines = 0;

  const onLog = (level, message) => {
    logLines += 1;
    if (logLines > MAX_LOG_LINES_PER_EXECUTION) {
      return;
    }
    const line =
      logLines === MAX_LOG_LINES_PER_EXECUTION
        ? `Log limit reached (${MAX_LOG_LINES_PER_EXECUTION} lines), the next lines are dropped`
        : message.slice(0, MAX_LOG_LINE_LENGTH);
    logger[level](`Scene "${sceneSelector}" script: ${line}`);
    self.event.emit(EVENTS.WEBSOCKET.SEND_ADMINS, {
      type: WEBSOCKET_MESSAGE_TYPES.SCENE.SCRIPT_LOG,
      payload: { sceneSelector, level, message: line },
    });
  };

  const result = await runScript({
    code: action.code || '',
    api: buildScriptApi({ self, scope, path, actionsFunc, schema: actionSchema }),
    event: scope.triggerEvent === undefined ? undefined : toJsonValue(scope.triggerEvent),
    onLog,
    abortSignal: scope.abortSignal,
    isStopError: (error) => error instanceof AbortScene,
  });

  if (result.status === 'aborted') {
    throw new SceneStopped('SCENE_STOPPED');
  }
  if (result.status === 'stopped') {
    throw new AbortScene('SCRIPT_STOPPED');
  }
  if (result.status === 'success') {
    // What a function block returns is kept for the next actions: {{<path>.result}}
    if (result.value !== undefined) {
      set(scope, path, { result: toJsonValue(result.value) }, { merge: true });
    }
    return;
  }
  // status: error
  const { name, message, line, column } = result.error;
  const position = line === null ? '' : ` (line ${line}, column ${column})`;
  onLog('error', `${name}: ${message}${position}`);
  throw new Error(`Script of scene "${sceneSelector}" failed: ${name}: ${message}${position}`);
}

module.exports = {
  runSceneScript,
  buildScriptApi,
  FORBIDDEN_SCRIPT_ACTIONS,
};
