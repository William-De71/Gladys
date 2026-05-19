import { Component } from 'preact';
import { connect } from 'unistore/preact';
import actions from './actions';
import ThermostatPage from '../ThermostatPage';
import EditForm from './EditForm';

class ThermostatEditPage extends Component {
  componentWillMount() {
    this.props.getDevicesForThermostatEdit();
    this.props.getHouses();
    this.props.getSchedules();
    if (this.props.deviceSelector) {
      this.props.getThermostatDevice(this.props.deviceSelector);
    } else {
      this.props.updateThermostatField('thermostatEditDevice', null);
      this.props.updateThermostatField('thermostatEditName', '');
      this.props.updateThermostatField('thermostatEditMode', 'heating');
      this.props.updateThermostatField('thermostatEditMinTemp', '5');
      this.props.updateThermostatField('thermostatEditMaxTemp', '35');
      this.props.updateThermostatField('thermostatEditTempUnit', 'C');
      this.props.updateThermostatField('thermostatEditControlType', 'hysteresis');
      this.props.updateThermostatField('thermostatEditTemperatureFeature', '');
      this.props.updateThermostatField('thermostatEditHumidityFeature', '');
      this.props.updateThermostatField('thermostatEditSwitchFeature', '');
      this.props.updateThermostatField('thermostatEditWindowFeature', '');
      this.props.updateThermostatField('thermostatEditPresetFrost', '7');
      this.props.updateThermostatField('thermostatEditPresetAway', '16');
      this.props.updateThermostatField('thermostatEditPresetEco', '18');
      this.props.updateThermostatField('thermostatEditPresetNight', '17');
      this.props.updateThermostatField('thermostatEditPresetComfort', '21');
      this.props.updateThermostatField('thermostatEditHysteresisStart', '0.5');
      this.props.updateThermostatField('thermostatEditHysteresisStop', '0.5');
      this.props.updateThermostatField('thermostatEditTpiCycleTime', '30');
      this.props.updateThermostatField('thermostatEditTpiProportionalBand', '2');
      this.props.updateThermostatField('thermostatEditRoomId', '');
      this.props.updateThermostatField('thermostatEditManualDuration', '30');
      this.props.updateThermostatField('thermostatCreateStatus', null);
    }
  }

  render(props) {
    return (
      <ThermostatPage user={props.user}>
        <EditForm {...props} />
      </ThermostatPage>
    );
  }
}

export default connect(
  'user,houses,thermostatEditDevice,thermostatEditName,thermostatEditMode,thermostatEditMinTemp,thermostatEditMaxTemp,thermostatEditTempUnit,thermostatEditControlType,thermostatEditTemperatureFeature,thermostatEditHumidityFeature,thermostatEditSwitchFeature,thermostatEditWindowFeature,thermostatEditPresetFrost,thermostatEditPresetAway,thermostatEditPresetEco,thermostatEditPresetNight,thermostatEditPresetComfort,thermostatEditHysteresisStart,thermostatEditHysteresisStop,thermostatEditTpiCycleTime,thermostatEditTpiProportionalBand,thermostatEditRoomId,thermostatEditManualDuration,thermostatCreateStatus,temperatureFeatures,humidityFeatures,switchFeatures,openingFeatures',
  actions
)(ThermostatEditPage);
