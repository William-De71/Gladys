const sinon = require('sinon');
const { fake, assert } = require('sinon');
const { FREEBOX_APPTOKEN_KEY } = require('../../../../services/freebox/lib/utils/constants');

const FreeboxHandler = require('../../../../services/freebox/lib/index');

const serviceId = 'e4ff2e60-46e7-476c-85cc-1c13c2b28fbd';

describe('FreeboxHandler.disconnect', () => {
  
  afterEach(() => {
    sinon.reset();
  });
  
  it('should reset attributes', () => {
    const gladys = {
      variable: {
        destroy: fake.resolves('value'),
      },
    };

    const freeboxHandler = new FreeboxHandler(gladys, serviceId);

    freeboxHandler.disconnect();

    // ASSERT
    assert.callCount(gladys.variable.destroy, 1);
    assert.calledWith(gladys.variable.destroy, FREEBOX_APPTOKEN_KEY, serviceId);

  });
});
