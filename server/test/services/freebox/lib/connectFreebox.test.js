const { expect } = require('chai');
// const proxyquire = require('proxyquire').noCallThru();

const sinon = require('sinon');
// const { client } = require('../freebox.mock.test');

// const { assert, fake } = sinon;

const { connectFreebox } = require('../../../../services/freebox/lib/connectFreebox');

// const FreeboxHandler = require('../../../../services/freebox/lib/index');
// , { 
/*
'./connectFreebox': connectFreebox,
});
*/
// const { FREEBOX_APPTOKEN_KEY } = require('../../../../services/freebox/lib/utils/constants');
// const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../../utils/constants');
// const { ServiceNotConfiguredError } = require('../../../../utils/coreErrors');

/* const gladys = {
  event: {
    emit: fake.returns(null),
  },
  variable: {
    setValue: fake.resolves('value'),
    getValue: fake.resolves(true),
  },
};
*/

// const serviceId = 'e4ff2e60-46e7-476c-85cc-1c13c2b28fbd';

describe('FreeboxHandler.connectFreebox', () => {

  // const freeboxHandler = new FreeboxHandler(gladys, serviceId);

  beforeEach(() => {
    sinon.reset();
  });

  afterEach(() => {
    sinon.reset();
  });

  
  // it('well connected', async () => {
    // await freeboxHandler.connectFreebox();

    // assert.calledOnce(client.init);

    // assert.callCount(gladys.variable.getValue, 1);
    // assert.calledWith(gladys.variable.getValue, FREEBOX_APPTOKEN_KEY, serviceId);

    /*
    assert.callCount(gladys.event.emit, 1);
    assert.calledWith(gladys.event.emit, EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.CONNECTED,
    });
    */

    it('should return the stored app_token if it exists', async () => {
      const gladys = {
        variable: {
          async getValue(key, serviceId) {
            return 'app_token';
          },
        },
      };
  
      const appToken = await connectFreebox.call(gladys);
  
      expect(appToken).to.equal('app_token');
    });

    /*
    it('should request a new app_token from the Freebox if it does not exist', async () => {
      const mockRequestAuthorization = jest.fn();
      mockRequestAuthorization.mockResolvedValue({
        data: {
          result: {
            app_token: 'app_token',
            track_id: 'track_id',
          },
        },
      });
  
      const mockGetAuthorizationStatus = jest.fn();
      mockGetAuthorizationStatus.mockResolvedValue();
  
      const gladys = {
        variable: {
          async getValue(key, serviceId) {
            return null;
          },
        },
        requestAuthorization: mockRequestAuthorization,
        getAuthorizationStatus: mockGetAuthorizationStatus,
      };
  
      const appToken = await connectFreebox.call(gladys);
  
      expect(mockRequestAuthorization).toHaveBeenCalledWith('TOKENREQUEST');
      expect(mockGetAuthorizationStatus).toHaveBeenCalledWith('track_id');
      expect(appToken).to.equal('app_token');
    });
    */



    
  // });

  

});
