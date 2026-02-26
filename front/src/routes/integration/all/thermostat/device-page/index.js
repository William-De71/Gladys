import { Component } from 'preact';
import { connect } from 'unistore/preact';
import actions from './actions';
import ThermostatPage from '../ThermostatPage';
import DeviceTab from './DeviceTab';

class ThermostatDevicePage extends Component {
  componentWillMount() {
    this.props.getThermostatDevices();
    this.props.getHouses();
  }

  render(props) {
    return (
      <ThermostatPage user={props.user}>
        <DeviceTab {...props} />
      </ThermostatPage>
    );
  }
}

export default connect(
  'user,houses,thermostatDevices,getThermostatDevicesStatus,thermostatDeviceSearch,getThermostatDeviceOrderDir',
  actions
)(ThermostatDevicePage);
