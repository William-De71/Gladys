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
        const enriched = await Promise.all(filtered.map(async device => {
          if (device.features && device.features[0]) {
            const featureKey = device.features[0].selector.toUpperCase().replace(/-/g, '_');
            try {
              const varResp = await state.httpClient.get(`/api/v1/variable/THERMOSTAT_ACTIVE_SCHEDULE_${featureKey}`);
              return { ...device, active_schedule: (varResp && varResp.value) || '' };
            } catch (e) {
              return { ...device, active_schedule: '' };
            }
          }
          return { ...device, active_schedule: '' };
        }));
        store.setState({
          thermostatDevices: enriched,
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
      const { active_schedule, ...deviceToSave } = device;
      const savedDevice = await state.httpClient.post('/api/v1/device', deviceToSave);
      if (savedDevice && savedDevice.features && savedDevice.features[0]) {
        const featureKey = savedDevice.features[0].selector.toUpperCase().replace(/-/g, '_');
        await state.httpClient.post(`/api/v1/variable/THERMOSTAT_ACTIVE_SCHEDULE_${featureKey}`, {
          value: active_schedule || ''
        });
      }
      const newState = update(state, {
        thermostatDevices: {
          $splice: [[index, 1, { ...savedDevice, active_schedule: active_schedule || '' }]]
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
    async getSchedules(state) {
      try {
        const schedules = await state.httpClient.get('/api/v1/service/thermostat/schedule');
        store.setState({ thermostatSchedules: Array.isArray(schedules) ? schedules : [] });
      } catch (e) {
        store.setState({ thermostatSchedules: [] });
      }
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
