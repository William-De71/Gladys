// Unit tests of the readable save errors: `npm run test-unit` (node --test, no dependency).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PROBLEMS, parsePath, describeActionPath, parseSaveError, rawSaveError } from './saveErrors.js';

describe('parsePath', () => {
  it('should read the action path and the field of the actions', () => {
    assert.deepEqual(parsePath('actions', '[1][0].then[0][1].devices[0]'), {
      triggerIndex: null,
      actionPath: '1.0.then.0.1',
      field: 'devices'
    });
    assert.deepEqual(parsePath('actions', '[2][0].if[1].type'), {
      triggerIndex: null,
      actionPath: '2.0.if.1',
      field: 'type'
    });
    assert.deepEqual(parsePath('actions', 'value'), { triggerIndex: null, actionPath: null, field: 'value' });
  });

  it('should read the trigger of the triggers', () => {
    assert.deepEqual(parsePath('triggers', '[0].time_ranges[0].start'), {
      triggerIndex: 0,
      actionPath: null,
      field: 'time_ranges'
    });
    assert.deepEqual(parsePath('triggers', ''), { triggerIndex: null, actionPath: null, field: null });
  });
});

describe('describeActionPath', () => {
  it('should number the steps, actions, branches and conditions from 1', () => {
    assert.deepEqual(describeActionPath('1.0.then.0.1'), [
      { kind: 'step', number: 2 },
      { kind: 'action', number: 1 },
      { kind: 'then' },
      { kind: 'step', number: 1 },
      { kind: 'action', number: 2 }
    ]);
    assert.deepEqual(describeActionPath('0.0.else.2.0'), [
      { kind: 'step', number: 1 },
      { kind: 'action', number: 1 },
      { kind: 'else' },
      { kind: 'step', number: 3 },
      { kind: 'action', number: 1 }
    ]);
    assert.deepEqual(describeActionPath('3.1.if.0'), [
      { kind: 'step', number: 4 },
      { kind: 'action', number: 2 },
      { kind: 'condition', number: 1 }
    ]);
    assert.deepEqual(describeActionPath('4'), [{ kind: 'step', number: 5 }]);
  });
});

describe('parseSaveError', () => {
  const TYPES = '[ai.ask, alarm.check-alarm-mode, delay, script.run]';

  it('should list each missing type once, whatever the number of messages', () => {
    const data = {
      properties: [
        {
          attribute: 'actions',
          message: `"[1][0].type" must be one of ${TYPES}; "[1][0].type" must be a string; "[2][0].type" must be one of ${TYPES}; "[2][0].type" must be a string`
        }
      ]
    };
    assert.deepEqual(parseSaveError(data), [
      { problem: PROBLEMS.MISSING_TYPE, triggerIndex: null, actionPath: '1.0', field: 'type' },
      { problem: PROBLEMS.MISSING_TYPE, triggerIndex: null, actionPath: '2.0', field: 'type' }
    ]);
  });

  it('should tell a required, a forbidden and an invalid field apart', () => {
    const data = {
      properties: [
        {
          attribute: 'actions',
          message:
            '"[0][0].integration" is required; "[0][1].foo" is not allowed; "[0][2].value" must be a number; "[0][2].value" must be a string'
        },
        {
          attribute: 'triggers',
          message: '"[1].time_ranges[0].start" with value "99:99" fails to match the required pattern'
        },
        { attribute: 'triggers', message: '"[2].type" is required' }
      ]
    };
    assert.deepEqual(parseSaveError(data), [
      { problem: PROBLEMS.REQUIRED, triggerIndex: null, actionPath: '0.0', field: 'integration' },
      { problem: PROBLEMS.NOT_ALLOWED, triggerIndex: null, actionPath: '0.1', field: 'foo' },
      { problem: PROBLEMS.INVALID, triggerIndex: null, actionPath: '0.2', field: 'value' },
      { problem: PROBLEMS.INVALID, triggerIndex: 1, actionPath: null, field: 'time_ranges' },
      { problem: PROBLEMS.MISSING_TYPE, triggerIndex: 2, actionPath: null, field: 'type' }
    ]);
  });

  it('should read the syntax error of a function block and of the advanced mode', () => {
    assert.deepEqual(
      parseSaveError({
        message:
          "Script syntax error in the function block 1.0.then.0.0 at line 2, column 1: unexpected token in expression: '}'"
      }),
      [
        {
          problem: PROBLEMS.SYNTAX,
          actionPath: '1.0.then.0.0',
          triggerIndex: null,
          field: null,
          line: 2,
          column: 1,
          reason: "unexpected token in expression: '}'"
        }
      ]
    );
    assert.deepEqual(parseSaveError({ message: 'Script syntax error: broken' }), [
      {
        problem: PROBLEMS.SYNTAX,
        actionPath: null,
        triggerIndex: null,
        field: null,
        line: null,
        column: null,
        reason: 'broken'
      }
    ]);
  });

  it('should give nothing for an answer it does not understand', () => {
    assert.deepEqual(parseSaveError(null), []);
    assert.deepEqual(parseSaveError({ message: 'Scene not found' }), []);
    assert.deepEqual(
      parseSaveError({
        properties: [{ attribute: 'actions', message: 'A scene in code mode must have a single "script.run" action' }]
      }),
      []
    );
    assert.deepEqual(parseSaveError({ properties: [{ attribute: 'actions' }] }), []);
  });
});

describe('rawSaveError', () => {
  it('should give the raw text of the answer', () => {
    assert.equal(rawSaveError(null), null);
    assert.equal(rawSaveError({ properties: [{ message: 'a' }, { message: 'b' }] }), 'a\nb');
    assert.equal(rawSaveError({ properties: [], message: 'c' }), 'c');
    assert.equal(rawSaveError({}), null);
  });
});
