import { RequestStatus } from '../../../../utils/consts';
import createActionsIntegration from '../../../../actions/integration';

function createActions(store) {
  const integrationActions = createActionsIntegration(store);

  const actions = {
    async discoverFreebox(state) {
      store.setState({
        discoverFreeboxStatus: RequestStatus.Getting,
      });
      let freeboxDiscover = {};
      try {
        freeboxDiscover = await state.httpClient.get('/api/v1/service/freebox/discovery');
  
        store.setState({
          deviceName: freeboxDiscover.deviceName,
          boxModelName: freeboxDiscover.boxModelName,
          boxModel: freeboxDiscover.boxModel,
          apiVersionMajor: freeboxDiscover.apiVersionMajor,
          apiBaseUrl: freeboxDiscover.apiBaseUrl,
          apiDomain: freeboxDiscover.apiDomain,
          discoverFreeboxStatus: RequestStatus.Success
        });
  
      } catch (e) {
        console.error(e);
        store.setState({
          deviceName: null,
          boxModelName: null,
          boxModel: null,
          apiVersionMajor: null,
          apiBaseUrl: null,
          apiDomain: null,
          discoverFreeboxStatus: RequestStatus.NetworkError,
          freeboxConnectionError: e.message
        });
      }
    },

    async connectFreebox(state) {
      store.setState({
        authorizedFreeboxStatus: RequestStatus.Getting,
      });
      let freeboxGetToken = null;
      try {
        freeboxGetToken = await state.httpClient.post('/api/v1/service/freebox/connect');
        
        store.setState({
          //appToken: freeboxGetToken.appToken,
          authorizedFreeboxStatus: RequestStatus.Success
        });

      } catch (e) {
        console.error(e);
        store.setState({
          //appToken: null,
          authorizedFreeboxStatus: RequestStatus.Error,
          freeboxConnectionError: e.message
        });
      }
    },

    async openSessionFreebox(state) {
      store.setState({
        sessionFreeboxStatus: RequestStatus.Getting,
      });
      try {
        await state.httpClient.post('/api/v1/service/freebox/sessionToken');

        store.setState({
          sessionFreeboxStatus: RequestStatus.Success
        });

      } catch (e) {
        console.error(e);
        store.setState({
          sessionFreeboxStatus: RequestStatus.Error,
          freeboxConnectionError: e.message
        });
      }
    },

    async loadProps(state) {
      let appToken;
      try {
        appToken = await state.httpClient.get('/api/v1/service/freebox/variable/FREEBOX_APPTOKEN');
      } finally {
        store.setState({
          appToken: (appToken || { value: '' }).value,
        });
      }
    },

    displayDiscoveredMessage() {
      // display 3 seconds a message "Freebox connected"
      store.setState({
        freeboxConnectionError: undefined
      });
      /*
      setTimeout(
        () =>
          store.setState({
            connectFreeboxStatus: undefined
          }),
        3000
      );
      */
    },

    displayFreeboxError(state, error) {
      store.setState({
        // discoverFreeboxStatus: undefined,
        // authorizedFreeboxStatus: undefined,
        // connectFreeboxStatus: undefined,
        freeboxConnectionError: error
      });
    },

  }
	

  return Object.assign({}, integrationActions, actions);

}

export default createActions;