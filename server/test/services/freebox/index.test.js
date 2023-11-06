const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const { assert, fake } = sinon;

const FreeboxHandlerMock = sinon.stub();
FreeboxHandlerMock.prototype.init = fake.returns(null);
FreeboxHandlerMock.prototype.disconnect = fake.returns(null);

const FreeboxService = proxyquire('../../../services/freebox/index', { './lib': FreeboxHandlerMock });

const gladys = {};
const serviceId = 'e4ff2e60-46e7-476c-85cc-1c13c2b28fbd';

describe('FreeboxService', () => {
  const freeboxService = FreeboxService(gladys, serviceId);

  beforeEach(() => {
    sinon.reset();
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should start service', async () => {
    await freeboxService.start();
    assert.calledOnce(freeboxService.device.init);
    assert.notCalled(freeboxService.device.disconnect);
  });

  it('should stop service', async () => {
    freeboxService.stop();
    assert.notCalled(freeboxService.device.init);
    assert.calledOnce(freeboxService.device.disconnect);
  });

});
