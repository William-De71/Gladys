const { ACTIONS, CONDITION_ACTIONS } = require('../../../utils/constants');
const { BadParameters } = require('../../../utils/coreErrors');

// Converts the steps of a scene to a script with the same behavior
// (docs/specs/scene-editor-modes.md D.4). Every action goes through `gladys.action`, which runs
// it exactly as its block did; the only rewriting is the control flow (parallel steps,
// conditions, if / else, while).

const INDENT = '  ';
// Same limits as the "while" block of the engine (scene.actions.js).
const WHILE_DEFAULT_MAX_ITERATIONS = 1000;
const WHILE_ABSOLUTE_MAX_ITERATIONS = 10000;
const WHILE_MIN_ITERATION_TIME_MS = 100;
const IDENTIFIER_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * @description Write a value as a JavaScript literal.
 * @param {any} value - A JSON value.
 * @param {string} indent - The indentation of the line the literal starts on.
 * @returns {string} The literal.
 * @example
 * toJsLiteral({ device_feature: 'lamp', value: 1 }, ''); // "{ device_feature: 'lamp', value: 1 }"
 */
function toJsLiteral(value, indent) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `'${value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')}'`;
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  const inner = `${indent}${INDENT}`;
  const entries = Array.isArray(value)
    ? value.map((item) => toJsLiteral(item, inner))
    : Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .map(
          (key) => `${IDENTIFIER_REGEX.test(key) ? key : toJsLiteral(key, inner)}: ${toJsLiteral(value[key], inner)}`,
        );
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  if (entries.length === 0) {
    return `${open}${close}`;
  }
  const oneLine = Array.isArray(value) ? `[${entries.join(', ')}]` : `{ ${entries.join(', ')} }`;
  if (oneLine.length <= 80 && !oneLine.includes('\n')) {
    return oneLine;
  }
  return `${open}\n${entries.map((entry) => `${inner}${entry},`).join('\n')}\n${indent}${close}`;
}

/**
 * @description Gather every string of a value, at any depth.
 * @param {any} value - A JSON value.
 * @param {Array<string>} strings - The strings found so far.
 * @returns {Array<string>} The strings.
 * @example
 * collectStrings({ text: 'a', list: ['b'] }, []); // ['a', 'b']
 */
function collectStrings(value, strings) {
  if (typeof value === 'string') {
    strings.push(value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }
  return strings;
}

/**
 * @description Tell whether the result of the action at a path is read by a template
 * ({{path.…}}) or a condition selector ("path.…") somewhere in the scene.
 * @param {Array<string>} strings - Every string of the scene.
 * @param {string} path - The path of an action.
 * @returns {boolean} True when the result is read.
 * @example
 * isPathReferenced(['{{0.0.last_value}}'], '0.0'); // true
 */
function isPathReferenced(strings, path) {
  const templateRegex = new RegExp(`{{\\s*${path.replace(/\./g, '\\.')}\\.`);
  return strings.some((text) => text.startsWith(`${path}.`) || templateRegex.test(text));
}

/**
 * @description Build the parameters of an action: the action without its type.
 * @param {object} action - The action.
 * @returns {object} The parameters.
 * @example
 * actionParams({ type: 'delay', value: 1, unit: 'seconds' }); // { value: 1, unit: 'seconds' }
 */
function actionParams(action) {
  const { type, ...params } = action;
  return params;
}

/**
 * @description Write the arguments of a `gladys.action` / `gladys.check` call.
 * @param {object} action - The action.
 * @param {string} path - Its path.
 * @param {object} context - The generation context.
 * @param {string} indent - The indentation of the call.
 * @returns {string} The arguments.
 * @example
 * callArguments({ type: 'delay', value: 1 }, '0.0', context, '');
 */
function callArguments(action, path, context, indent) {
  const args = [toJsLiteral(action.type, indent), toJsLiteral(actionParams(action), indent)];
  if (isPathReferenced(context.strings, path)) {
    args.push(`{ saveAs: ${toJsLiteral(path, indent)} }`);
  }
  return args.join(', ');
}

/**
 * @description Tell whether a step contains at least one action to generate.
 * @param {Array} step - A step.
 * @returns {boolean} True when it is not empty.
 * @example
 * hasActions([{ type: null }]); // false
 */
function hasActions(step) {
  return Array.isArray(step) && step.some((action) => action && action.type);
}

/**
 * @description Write a sequence of steps.
 * @param {Array} steps - The steps.
 * @param {string} basePath - The path of the steps ('' for the scene, 'x.y.then' for a branch).
 * @param {object} context - The generation context.
 * @param {string} indent - The indentation.
 * @returns {Array<string>} The lines.
 * @example
 * generateSteps([[{ type: 'delay', value: 1, unit: 'seconds' }]], '', context, '');
 */
function generateSteps(steps, basePath, context, indent) {
  const lines = [];
  (steps || []).forEach((step, stepIndex) => {
    if (!hasActions(step)) {
      return;
    }
    const stepPath = basePath ? `${basePath}.${stepIndex}` : `${stepIndex}`;
    const actions = step
      .map((action, actionIndex) => ({ action, path: `${stepPath}.${actionIndex}` }))
      .filter(({ action }) => action && action.type);
    if (actions.length === 1) {
      // eslint-disable-next-line no-use-before-define
      lines.push(...generateAction(actions[0].action, actions[0].path, context, indent));
      return;
    }
    lines.push(`${indent}// At the same time`);
    lines.push(`${indent}await Promise.all([`);
    actions.forEach(({ action, path }) => {
      const inner = `${indent}${INDENT}`;
      if (
        action.type === ACTIONS.CONDITION.IF_THEN_ELSE ||
        action.type === ACTIONS.CONDITION.WHILE ||
        action.type === ACTIONS.SCRIPT.RUN
      ) {
        lines.push(`${inner}(async () => {`);
        // eslint-disable-next-line no-use-before-define
        lines.push(...generateAction(action, path, context, `${inner}${INDENT}`));
        lines.push(`${inner}})(),`);
      } else if (CONDITION_ACTIONS.includes(action.type)) {
        lines.push(`${inner}gladys.check(${callArguments(action, path, context, inner)}).then((ok) => ok || stop()),`);
      } else {
        lines.push(`${inner}gladys.action(${callArguments(action, path, context, inner)}),`);
      }
    });
    lines.push(`${indent}]);`);
  });
  return lines;
}

/**
 * @description Write one action.
 * @param {object} action - The action.
 * @param {string} path - Its path.
 * @param {object} context - The generation context.
 * @param {string} indent - The indentation.
 * @returns {Array<string>} The lines.
 * @example
 * generateAction({ type: 'delay', value: 1, unit: 'seconds' }, '0.0', context, '');
 */
function generateAction(action, path, context, indent) {
  const inner = `${indent}${INDENT}`;
  const conditions = (action.if || [])
    .map((condition, index) => ({ condition, path: `${path}.if.${index}` }))
    .filter(({ condition }) => condition && condition.type);

  if (action.type === ACTIONS.CONDITION.IF_THEN_ELSE) {
    const lines = [];
    let test;
    if (conditions.length === 0) {
      test = 'true';
    } else if (conditions.length === 1) {
      test = `await gladys.check(${callArguments(conditions[0].condition, conditions[0].path, context, indent)})`;
    } else {
      // The conditions of an if block are checked at the same time, and must all be met
      const name = `conditions${path.replace(/\D+/g, '_')}`;
      lines.push(`${indent}const ${name} = await Promise.all([`);
      conditions.forEach((item) => {
        lines.push(`${inner}gladys.check(${callArguments(item.condition, item.path, context, inner)}),`);
      });
      lines.push(`${indent}]);`);
      test = `${name}.every(Boolean)`;
    }
    lines.push(`${indent}if (${test}) {`);
    lines.push(...generateSteps(action.then, `${path}.then`, context, inner));
    const elseLines = generateSteps(action.else, `${path}.else`, context, inner);
    if (elseLines.length > 0) {
      lines.push(`${indent}} else {`);
      lines.push(...elseLines);
    }
    lines.push(`${indent}}`);
    return lines;
  }

  if (action.type === ACTIONS.CONDITION.WHILE) {
    const body = generateSteps(action.then, `${path}.then`, context, inner);
    // The engine refuses an empty loop by stopping the scene
    if (conditions.length === 0 || body.length === 0) {
      return [`${indent}// An empty "while" block stops the scene`, `${indent}stop();`];
    }
    const maxIterations = Math.min(
      action.max_iterations !== undefined ? action.max_iterations : WHILE_DEFAULT_MAX_ITERATIONS,
      WHILE_ABSOLUTE_MAX_ITERATIONS,
    );
    const counter = `iteration${path.replace(/\D+/g, '_')}`;
    const startedAt = `startedAt${path.replace(/\D+/g, '_')}`;
    const lines = [`${indent}for (let ${counter} = 0; ${counter} < ${maxIterations}; ${counter} += 1) {`];
    // The conditions of a while block are checked one after the other, before each iteration
    conditions.forEach((item) => {
      lines.push(`${inner}if (!(await gladys.check(${callArguments(item.condition, item.path, context, inner)}))) {`);
      lines.push(`${inner}${INDENT}break;`);
      lines.push(`${inner}}`);
    });
    lines.push(`${inner}const ${startedAt} = Date.now();`);
    lines.push(...body);
    lines.push(`${inner}await sleep(Math.max(0, ${WHILE_MIN_ITERATION_TIME_MS} - (Date.now() - ${startedAt})));`);
    lines.push(`${indent}}`);
    return lines;
  }

  if (action.type === ACTIONS.SCRIPT.RUN) {
    // A function block: its code runs as it is, in a function of its own, so its `return` ends the
    // block only. What it returns is kept when a later action reads it ({{path.result}}).
    // the name the user gave the block, on one line
    const name = typeof action.name === 'string' ? action.name.replace(/\s+/g, ' ').trim() : '';
    const comment = `${indent}// Function block${name ? `: ${name}` : ''}`;
    const body = (action.code || '').split('\n').map((line) => (line ? `${inner}${line}` : line));
    if (isPathReferenced(context.strings, path)) {
      return [
        comment,
        `${indent}await gladys.store(${toJsLiteral(path, indent)}, {`,
        `${inner}result: await (async () => {`,
        ...body.map((line) => (line ? `${INDENT}${line}` : line)),
        `${inner}})(),`,
        `${indent}});`,
      ];
    }
    return [comment, `${indent}await (async () => {`, ...body, `${indent}})();`];
  }

  if (CONDITION_ACTIONS.includes(action.type)) {
    return [
      `${indent}if (!(await gladys.check(${callArguments(action, path, context, indent)}))) {`,
      `${inner}stop();`,
      `${indent}}`,
    ];
  }

  return [`${indent}await gladys.action(${callArguments(action, path, context, indent)});`];
}

/**
 * @description Refuse steps that do not have the shape of scene actions: a list of steps, each a
 * list of actions, whose `if` is a list of actions and whose `then` / `else` are steps.
 * @param {any} steps - The steps.
 * @example
 * assertStepsShape([[{ type: 'delay', value: 1, unit: 'seconds' }]]);
 */
function assertStepsShape(steps) {
  if (!Array.isArray(steps) || !steps.every((step) => Array.isArray(step))) {
    throw new BadParameters('"actions" must be an array of steps, each an array of actions');
  }
  steps.forEach((step) => {
    step.forEach((action) => {
      if (action === null || typeof action !== 'object' || Array.isArray(action)) {
        throw new BadParameters('An action must be an object');
      }
      if (action.if !== undefined) {
        assertStepsShape([action.if]);
      }
      ['then', 'else'].forEach((branch) => {
        if (action[branch] !== undefined) {
          assertStepsShape(action[branch]);
        }
      });
    });
  });
}

/**
 * @description Convert the steps of a scene to a script with the same behavior.
 * @param {Array} actions - The steps of the scene.
 * @returns {string} The JavaScript of the script.
 * @example
 * generateScript([[{ type: 'light.turn-on', devices: ['lamp'] }]]);
 */
function generateScript(actions) {
  assertStepsShape(actions);
  const context = { strings: collectStrings(actions, []) };
  const lines = generateSteps(actions, '', context, '');
  const header = [
    '// Converted from the blocks of this scene.',
    '// `gladys.action(type, params)` runs an action exactly as its block did.',
  ];
  return `${[...header, '', ...lines].join('\n')}\n`;
}

module.exports = {
  generateScript,
  toJsLiteral,
  isPathReferenced,
};
