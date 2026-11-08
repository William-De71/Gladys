// What the server says when it refuses a scene, made readable (docs/specs/scene-editor-modes.md
// C.5): its schema messages name a JSON path ("[1][0].then[0][1].devices") and list every value
// it accepts, in English. They are turned into places of the scene ("Step 2 › Action 1 › Then ›
// Step 1 › Action 2") and kinds of problem, which the editor translates.
//
// Pure functions, unit-tested with `npm run test-unit` (saveErrors.test.js).

export const PROBLEMS = {
  MISSING_TYPE: 'missingType',
  REQUIRED: 'required',
  NOT_ALLOWED: 'notAllowed',
  INVALID: 'invalid',
  SYNTAX: 'syntax'
};

// `"[1][0].type" must be one of [...]` — one Joi message, the quoted path first
const JOI_MESSAGE_REGEX = /^"([^"]*)"\s+(.*)$/;
const SYNTAX_REGEX = /^Script syntax error(?: in the function block ([\w.]+))?(?: at line (\d+), column (\d+))?: (.*)$/s;

const problemOf = (field, text) => {
  if (field === 'type' && /must be one of|must be a string|is required/.test(text)) {
    return PROBLEMS.MISSING_TYPE;
  }
  if (/is required/.test(text)) {
    return PROBLEMS.REQUIRED;
  }
  if (/is not allowed$/.test(text)) {
    return PROBLEMS.NOT_ALLOWED;
  }
  return PROBLEMS.INVALID;
};

/**
 * Split a Joi path into places of the scene. `[1][0].then[0][1].devices[0]` of the actions gives
 * the action path `1.0.then.0.1` and the field `devices`.
 */
export const parsePath = (attribute, joiPath) => {
  const tokens = joiPath.match(/\[\d+\]|[^.[\]]+/g) || [];
  const segments = [];
  let field = null;
  tokens.forEach(token => {
    const index = token.startsWith('[') ? Number(token.slice(1, -1)) : null;
    if (field !== null) {
      return; // inside a field (devices[0]): the field is enough
    }
    if (index !== null) {
      segments.push(String(index));
    } else if (token === 'then' || token === 'else' || token === 'if') {
      segments.push(token);
    } else {
      field = token;
    }
  });
  if (attribute === 'triggers') {
    return { triggerIndex: segments.length > 0 ? Number(segments[0]) : null, actionPath: null, field };
  }
  return { triggerIndex: null, actionPath: segments.length > 0 ? segments.join('.') : null, field };
};

/**
 * The places of an action path, for display: `1.0.then.0.1` gives step 2 › action 1 › then ›
 * step 1 › action 2. The conditions of a block (`if.0`) are numbered alone.
 */
export const describeActionPath = actionPath => {
  const segments = actionPath.split('.');
  const places = [];
  let i = 0;
  while (i < segments.length) {
    const segment = segments[i];
    if (segment === 'then' || segment === 'else') {
      places.push({ kind: segment });
      i += 1;
    } else if (segment === 'if') {
      places.push({ kind: 'condition', number: Number(segments[i + 1]) + 1 });
      i += 2;
    } else {
      places.push({ kind: 'step', number: Number(segment) + 1 });
      if (segments[i + 1] !== undefined && /^\d+$/.test(segments[i + 1])) {
        places.push({ kind: 'action', number: Number(segments[i + 1]) + 1 });
      }
      i += 2;
    }
  }
  return places;
};

/**
 * Turn the answer of a refused save into problems: `{ problem, actionPath, triggerIndex, field,
 * line, column, reason }`. Each place and problem is listed once. Returns an empty list when the
 * answer is not one the editor understands, so the raw message is shown instead.
 */
export const parseSaveError = data => {
  if (!data) {
    return [];
  }
  const problems = [];
  const seen = new Set();
  const add = problem => {
    const key = [problem.problem, problem.actionPath, problem.triggerIndex, problem.field].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      problems.push(problem);
    }
  };

  (Array.isArray(data.properties) ? data.properties : []).forEach(property => {
    String(property.message || '')
      .split('; ')
      .forEach(message => {
        const match = JOI_MESSAGE_REGEX.exec(message.trim());
        if (!match) {
          return;
        }
        const place = parsePath(property.attribute, match[1]);
        add({ problem: problemOf(place.field, match[2]), ...place });
      });
  });

  if (typeof data.message === 'string') {
    const syntax = SYNTAX_REGEX.exec(data.message);
    if (syntax) {
      add({
        problem: PROBLEMS.SYNTAX,
        // the script of a scene in the advanced mode has no block to name
        actionPath: syntax[1] || null,
        triggerIndex: null,
        field: null,
        line: syntax[2] ? Number(syntax[2]) : null,
        column: syntax[3] ? Number(syntax[3]) : null,
        reason: syntax[4]
      });
    }
  }
  return problems;
};

/** The raw text of the answer, for the detail shown on demand. */
export const rawSaveError = data => {
  if (!data) {
    return null;
  }
  if (Array.isArray(data.properties) && data.properties.length > 0) {
    return data.properties.map(property => property.message).join('\n');
  }
  return data.message || null;
};
