const { newQuickJSWASMModuleFromVariant } = require('quickjs-emscripten-core');
const releaseSyncVariant = require('@jitl/quickjs-wasmfile-release-sync');

const logger = require('../../../utils/logger');
const { SCRIPT_MEMORY_LIMIT_BYTES, SCRIPT_MAX_STACK_SIZE_BYTES, SCRIPT_MAX_SYNC_EXECUTION_MS } = require('./constants');

// The sandbox of the code mode (docs/specs/scene-editor-modes.md D.2): the script runs in QuickJS
// compiled to WebAssembly, never in Node. It only sees the globals the prelude below builds over
// three host functions: `__host` (asynchronous, one call per API method), `__log` and `__stop`.
// Each execution gets its own WebAssembly instance (a few milliseconds): whatever happens inside
// it — even a crash of QuickJS itself — cannot reach Gladys or another running script.

// The script is the body of an async function, in strict mode. The opening is on the first line,
// so the line numbers of an error are those of the user's code; only the first line's columns are
// shifted.
// The wrapper evaluates to a function the host calls with two callbacks telling how the script
// ended. The host never holds a handle on the script's promise: a script left waiting forever
// (stopped scene) is then plain garbage, which QuickJS frees with the runtime.
const WRAPPER_START = "((__gladysDone, __gladysFail) => (async () => {'use strict';";
const WRAPPER_END = '\n})().then((value) => __gladysDone(value), __gladysFail))';
const SCRIPT_FILE_NAME = 'scene.js';

// Builds the API of D.3 inside the sandbox. Values cross the boundary as JSON strings.
const PRELUDE = `
'use strict';
(() => {
  const host = globalThis.__host;
  const hostLog = globalThis.__log;
  const hostStop = globalThis.__stop;
  delete globalThis.__host;
  delete globalThis.__log;
  delete globalThis.__stop;
  const call = (name, args) => host(name, JSON.stringify(args)).then((result) => JSON.parse(result));
  const format = (value) => {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.name + ': ' + value.message;
    }
    try {
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (e) {
      return String(value);
    }
  };
  const log = (level) => (...args) => hostLog(level, args.map(format).join(' '));
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  globalThis.gladys = freeze({
    action: (type, params, options) => call('action', [type, params, options]),
    check: (type, params, options) => call('check', [type, params, options]),
    device: {
      getValue: (feature) => call('device.getValue', [feature]),
      getFeature: (feature) => call('device.getFeature', [feature]),
      setValue: (feature, value) => call('device.setValue', [feature, value]),
    },
    scene: {
      start: (selector) => call('scene.start', [selector]),
    },
    message: {
      send: (user, text) => call('message.send', [user, text]),
    },
    store: (name, value) => call('store', [name, value]),
  });
  globalThis.sleep = (ms) => call('sleep', [ms]);
  globalThis.stop = () => {
    hostStop();
    throw new Error('The scene was stopped by the script');
  };
  globalThis.console = freeze({ log: log('info'), info: log('info'), warn: log('warn'), error: log('error') });
  globalThis.event = freeze(globalThis.__event === undefined ? undefined : JSON.parse(globalThis.__event));
  delete globalThis.__event;
})();
`;

/**
 * @description Create a fresh QuickJS WebAssembly instance.
 * @returns {Promise<object>} The QuickJS module.
 * @example
 * const QuickJS = await newQuickJS();
 */
function newQuickJS() {
  return newQuickJSWASMModuleFromVariant(releaseSyncVariant);
}

/**
 * @description Free a sandbox. A failure means QuickJS itself broke: its instance is dropped
 * with the sandbox, so it is only logged.
 * @param {object} context - The QuickJS context.
 * @param {object} runtime - The QuickJS runtime.
 * @example
 * freeSandbox(context, runtime);
 */
function freeSandbox(context, runtime) {
  try {
    context.dispose();
    runtime.dispose();
  } catch (e) {
    logger.warn(`Scene script: the sandbox could not be freed cleanly (${e.message})`);
  }
}

/**
 * @description Read the position of an error from its QuickJS stack, in the user's code.
 * @param {object} error - The error dumped from the sandbox.
 * @returns {{line: number|null, column: number|null}} The position, null when unknown.
 * @example
 * getErrorPosition({ stack: '    at scene.js:3:7' }); // { line: 3, column: 7 }
 */
function getErrorPosition(error) {
  const match = /scene\.js:(\d+):(\d+)/.exec((error && error.stack) || '');
  if (!match) {
    return { line: null, column: null };
  }
  const line = Number(match[1]);
  const column = Number(match[2]);
  return { line, column: line === 1 ? Math.max(column - WRAPPER_START.length, 1) : column };
}

/**
 * @description Turn an error dumped from the sandbox into a plain description.
 * @param {any} error - The dumped error (an object, or any thrown value).
 * @param {number} [maxSyncExecutionMs] - The time budget, for the message of an interruption.
 * @returns {{name: string, message: string, line: number|null, column: number|null}} The error.
 * @example
 * describeError({ name: 'Error', message: 'boom', stack: 'at scene.js:2:3' });
 */
function describeError(error, maxSyncExecutionMs = SCRIPT_MAX_SYNC_EXECUTION_MS) {
  const isObject = error !== null && typeof error === 'object';
  const name = isObject && error.name ? String(error.name) : 'Error';
  let message = isObject && error.message !== undefined ? String(error.message) : String(error);
  // QuickJS only says "interrupted" when the interrupt handler stopped a script hogging the CPU.
  if (name === 'InternalError' && message === 'interrupted') {
    message = `The script ran for more than ${maxSyncExecutionMs} ms without awaiting Gladys and was interrupted`;
  }
  return { name, message, ...getErrorPosition(isObject ? error : null) };
}

/**
 * @description Check that a script compiles, without running it.
 * @param {string} code - The JavaScript of the script.
 * @returns {Promise<object>} `{ valid: true }`, or `{ valid: false, message, line, column }`.
 * @example
 * await compileScript('await sleep(1000);'); // { valid: true }
 */
async function compileScript(code) {
  const QuickJS = await newQuickJS();
  const runtime = QuickJS.newRuntime({
    memoryLimitBytes: SCRIPT_MEMORY_LIMIT_BYTES,
    maxStackSizeBytes: SCRIPT_MAX_STACK_SIZE_BYTES,
  });
  const context = runtime.newContext();
  try {
    const result = context.evalCode(`${WRAPPER_START}${code}${WRAPPER_END}`, SCRIPT_FILE_NAME, {
      compileOnly: true,
    });
    if (result.error) {
      const error = describeError(context.dump(result.error));
      result.error.dispose();
      return { valid: false, message: error.message, line: error.line, column: error.column };
    }
    result.value.dispose();
    return { valid: true };
  } finally {
    freeSandbox(context, runtime);
  }
}

/**
 * @description Run a script in a fresh sandbox.
 * @param {object} options - Options.
 * @param {string} options.code - The JavaScript of the script.
 * @param {object} options.api - Host methods, by name: `async (...args) => JSON-serializable value`.
 * @param {any} [options.event] - The trigger event exposed as `event`.
 * @param {Function} [options.onLog] - Called with `(level, message)` for each `console.*` call.
 * @param {AbortSignal} [options.abortSignal] - Aborts the script (scene stopped).
 * @param {Function} [options.isStopError] - Tells whether an error thrown by a host method stops
 * the scene quietly (an unmet condition) rather than being thrown into the script.
 * @param {number} [options.maxSyncExecutionMs] - Longest run without awaiting the API.
 * @returns {Promise<object>} `{ status: 'success', value }` (what the script returned),
 * `{ status: 'stopped' | 'aborted' }`, or `{ status: 'error', error: { name, message, line, column } }`.
 * @example
 * await runScript({ code: 'console.log(1)', api: {} });
 */
async function runScript({
  code,
  api,
  event,
  onLog = () => {},
  abortSignal,
  isStopError = () => false,
  maxSyncExecutionMs = SCRIPT_MAX_SYNC_EXECUTION_MS,
}) {
  const isAborted = () => Boolean(abortSignal && abortSignal.aborted);
  const QuickJS = await newQuickJS();
  if (isAborted()) {
    return { status: 'aborted' };
  }
  const runtime = QuickJS.newRuntime({
    memoryLimitBytes: SCRIPT_MEMORY_LIMIT_BYTES,
    maxStackSizeBytes: SCRIPT_MAX_STACK_SIZE_BYTES,
  });
  const context = runtime.newContext();
  const pendingPromises = new Set();
  // `stopped`: the script called stop(), or an API call met an unmet condition.
  let stopped = false;
  // `finished`: the sandbox is being freed, nothing may enter it anymore.
  let finished = false;
  let deadline = Date.now() + maxSyncExecutionMs;

  // Run the jobs (promise callbacks) queued in the sandbox, with a fresh time budget. A job never
  // fails: the script's promise carries any error, so the result only needs to be freed.
  const executePendingJobs = () => {
    if (finished) {
      return;
    }
    deadline = Date.now() + maxSyncExecutionMs;
    runtime.executePendingJobs().dispose();
  };

  let abortListener = null;
  const abortPromise = new Promise((resolve) => {
    if (abortSignal) {
      abortListener = () => resolve({ aborted: true });
      abortSignal.addEventListener('abort', abortListener, { once: true });
    }
  });

  try {
    const hostFunction = context.newFunction('__host', (nameHandle, argsHandle) => {
      const name = context.getString(nameHandle);
      const args = JSON.parse(context.getString(argsHandle));
      const deferred = context.newPromise();
      pendingPromises.add(deferred);
      const method = Object.prototype.hasOwnProperty.call(api, name) ? api[name] : null;
      const settle = async () => {
        try {
          if (isAborted() || stopped) {
            throw new Error('The scene was stopped');
          }
          if (method === null) {
            throw new Error(`Unknown method "${name}"`);
          }
          const value = await method(...args);
          if (finished) {
            return;
          }
          const valueHandle = context.newString(JSON.stringify(value === undefined ? null : value));
          deferred.resolve(valueHandle);
          valueHandle.dispose();
        } catch (error) {
          if (isStopError(error)) {
            stopped = true;
          }
          if (finished) {
            return;
          }
          const errorHandle = context.newError({ name: 'Error', message: error.message || String(error) });
          deferred.reject(errorHandle);
          errorHandle.dispose();
        } finally {
          pendingPromises.delete(deferred);
        }
        // The script resumes from the settled call, with a fresh time budget.
        await deferred.settled;
        executePendingJobs();
      };
      settle();
      return deferred.handle;
    });
    context.setProp(context.global, '__host', hostFunction);
    hostFunction.dispose();

    const logFunction = context.newFunction('__log', (levelHandle, messageHandle) => {
      if (!stopped && !isAborted()) {
        onLog(context.getString(levelHandle), context.getString(messageHandle));
      }
    });
    context.setProp(context.global, '__log', logFunction);
    logFunction.dispose();

    const stopFunction = context.newFunction('__stop', () => {
      stopped = true;
    });
    context.setProp(context.global, '__stop', stopFunction);
    stopFunction.dispose();

    if (event !== undefined) {
      const eventHandle = context.newString(JSON.stringify(event));
      context.setProp(context.global, '__event', eventHandle);
      eventHandle.dispose();
    }

    context.unwrapResult(context.evalCode(PRELUDE, 'prelude.js')).dispose();
    // Set after the prelude, which always runs to its end.
    runtime.setInterruptHandler(() => stopped || isAborted() || Date.now() > deadline);

    let resolveOutcome;
    const outcomePromise = new Promise((resolve) => {
      resolveOutcome = resolve;
    });
    const doneFunction = context.newFunction('done', (valueHandle) => {
      resolveOutcome({ value: context.dump(valueHandle) });
    });
    const failFunction = context.newFunction('fail', (errorHandle) => {
      resolveOutcome({ error: context.dump(errorHandle) });
    });

    deadline = Date.now() + maxSyncExecutionMs;
    const evalResult = context.evalCode(`${WRAPPER_START}${code}${WRAPPER_END}`, SCRIPT_FILE_NAME);
    if (evalResult.error) {
      resolveOutcome({ error: context.dump(evalResult.error) });
      evalResult.error.dispose();
    } else {
      // The script is an async function: whatever it does, the call returns its promise, and
      // how it ends comes back through done / fail.
      context
        .unwrapResult(context.callFunction(evalResult.value, context.undefined, doneFunction, failFunction))
        .dispose();
      evalResult.value.dispose();
      executePendingJobs();
    }
    doneFunction.dispose();
    failFunction.dispose();
    const outcome = await Promise.race([outcomePromise, abortPromise]);

    if (outcome.aborted || isAborted()) {
      return { status: 'aborted' };
    }
    if (stopped) {
      return { status: 'stopped' };
    }
    if (outcome.error !== undefined) {
      return { status: 'error', error: describeError(outcome.error, maxSyncExecutionMs) };
    }
    return { status: 'success', value: outcome.value };
  } finally {
    finished = true;
    if (abortSignal && abortListener) {
      abortSignal.removeEventListener('abort', abortListener);
    }
    pendingPromises.forEach((deferred) => deferred.dispose());
    freeSandbox(context, runtime);
  }
}

module.exports = {
  compileScript,
  runScript,
  describeError,
  getErrorPosition,
  freeSandbox,
};
