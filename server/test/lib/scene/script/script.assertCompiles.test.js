const { expect } = require('chai');

const { ACTIONS } = require('../../../../utils/constants');
const { findScripts } = require('../../../../lib/scene/script/script.assertCompiles');

describe('scene script assertCompiles', () => {
  it('should find the scripts at every depth, skipping what is not an action', () => {
    const steps = [
      [null, 'not an action', { type: ACTIONS.SCRIPT.RUN, code: 'a' }],
      [
        {
          type: ACTIONS.CONDITION.IF_THEN_ELSE,
          if: [{ type: ACTIONS.SCRIPT.RUN }],
          then: [[{ type: ACTIONS.SCRIPT.RUN, code: 'b' }]],
          else: 'not steps',
        },
      ],
      'not a step',
    ];
    expect(findScripts(steps, '', [])).to.deep.equal([
      { path: '0.2', code: 'a' },
      { path: '1.0.then.0.0', code: 'b' },
      { path: '1.0.if.0.0', code: '' },
    ]);
  });
});
