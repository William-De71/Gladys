const { ACTIONS } = require('../../../utils/constants');
const { BadParameters } = require('../../../utils/coreErrors');
const { isScriptActions } = require('../../../models/scene');
const { compileScript } = require('./script.sandbox');

/**
 * @description List the "script.run" actions of some steps, at any depth, with their path.
 * @param {Array} steps - The steps.
 * @param {string} basePath - The path of the steps ('' for the scene).
 * @param {Array} found - The scripts found so far.
 * @returns {Array<{path: string, code: string}>} The scripts.
 * @example
 * findScripts([[{ type: 'script.run', code: '' }]], '', []); // [{ path: '0.0', code: '' }]
 */
function findScripts(steps, basePath, found) {
  (Array.isArray(steps) ? steps : []).forEach((step, stepIndex) => {
    (Array.isArray(step) ? step : []).forEach((action, actionIndex) => {
      if (!action || typeof action !== 'object') {
        return;
      }
      const path = basePath ? `${basePath}.${stepIndex}.${actionIndex}` : `${stepIndex}.${actionIndex}`;
      if (action.type === ACTIONS.SCRIPT.RUN) {
        found.push({ path, code: action.code || '' });
      }
      ['then', 'else'].forEach((property) => findScripts(action[property], `${path}.${property}`, found));
      if (Array.isArray(action.if)) {
        findScripts([action.if], `${path}.if`, found);
      }
    });
  });
  return found;
}

/**
 * @description Refuse a scene holding a script that does not compile: the script of a scene in
 * code mode, or a function block of a block scene (docs/specs/scene-editor-modes.md B.3). A scene
 * is never saved in a state where it cannot run.
 * @param {Array} actions - The actions about to be saved.
 * @returns {Promise} Resolve when the actions can be saved.
 * @example
 * await assertScriptCompiles([[{ type: 'script.run', code: 'await sleep(1000);' }]]);
 */
async function assertScriptCompiles(actions) {
  const codeMode = isScriptActions(actions);
  const scripts = findScripts(actions, '', []);
  // eslint-disable-next-line no-restricted-syntax
  for (const script of scripts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await compileScript(script.code);
    if (!result.valid) {
      const where = codeMode ? '' : ` in the function block ${script.path}`;
      const position = result.line === null ? '' : ` at line ${result.line}, column ${result.column}`;
      throw new BadParameters(`Script syntax error${where}${position}: ${result.message}`);
    }
  }
}

module.exports = {
  assertScriptCompiles,
  findScripts,
};
