import { RequestStatus } from '../../../../../utils/consts';
import update from 'immutability-helper';
import debounce from 'debounce';
import createActionsHouse from '../../../../../actions/house';

function createActions(store) {
  const houseActions = createActionsHouse(store);
  const actions = {
    async getThermostatDevices(state) {
      store.setState({ getThermostatDevicesStatus: RequestStatus.Getting });
      try {
        const options = {
          order_dir: state.getThermostatDeviceOrderDir || 'asc'
        };
        if (state.thermostatDeviceSearch && state.thermostatDeviceSearch.length) {
          options.search = state.thermostatDeviceSearch;
        }
        const allDevices = await state.httpClient.get('/api/v1/service/thermostat/device', options);
        const filtered = Array.isArray(allDevices) ? allDevices : [];
        store.setState({
          thermostatDevices: filtered,
          getThermostatDevicesStatus: RequestStatus.Success
        });
      } catch (e) {
        store.setState({
          thermostatDevices: [],
          getThermostatDevicesStatus: RequestStatus.Error
        });
      }
    },
    async saveDevice(state, device, index) {
      const savedDevice = await state.httpClient.post('/api/v1/device', device);
      const newState = update(state, {
        thermostatDevices: {
          $splice: [[index, 1, savedDevice]]
        }
      });
      store.setState(newState);
    },
    updateDeviceProperty(state, index, property, value) {
      const newState = update(state, {
        thermostatDevices: {
          [index]: {
            [property]: { $set: value }
          }
        }
      });
      store.setState(newState);
    },
    async deleteDevice(state, device, index) {
      await state.httpClient.delete(`/api/v1/device/${device.selector}`);
      const newState = update(state, {
        thermostatDevices: { $splice: [[index, 1]] }
      });
      store.setState(newState);
    },
    async search(state, e) {
      await store.setState({ thermostatDeviceSearch: e.target.value });
      actions.debouncedGetThermostatDevices(store.getState());
    },
    async changeOrderDir(state, e) {
      store.setState({ getThermostatDeviceOrderDir: e.target.value });
      await actions.getThermostatDevices(store.getState());
    }
  };
  actions.debouncedGetThermostatDevices = debounce(actions.getThermostatDevices, 200);
  return Object.assign({}, houseActions, actions);
}

export default createActions;
