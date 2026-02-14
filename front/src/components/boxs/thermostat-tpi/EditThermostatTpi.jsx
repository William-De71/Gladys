import { Component } from 'preact';
import { Localizer, Text } from 'preact-i18n';
import { connect } from 'unistore/preact';
import Select from 'react-select';

import BaseEditBox from '../baseEditBox';
import { getDeviceFeatureName } from '../../../utils/device';
import { DEVICE_FEATURE_CATEGORIES } from '../../../../../server/utils/constants';
import withIntlAsProp from '../../../utils/withIntlAsProp';


class EditThermostatTpi extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      devices: [],
      deviceFeatures: []
    };
  }

  componentDidMount() {
    this.getDevices();
  }

  getDevices = async () => {
    try {
      this.setState({ loading: true });
      const devices = await this.props.httpClient.get(`/api/v1/device`);

      this.setState({
        devices,
        loading: false
      });
    } catch (e) {
      console.error('Error fetching devices:', e);
      this.setState({ loading: false });
    }
  };

  updateBoxName = e => {
    this.props.updateBoxConfig(this.props.x, this.props.y, {
      name: e.target.value
    });
  };

  updateDeviceFeatures = selectedOptions => {
    if (selectedOptions && selectedOptions.length > 0) {
      this.props.updateBoxConfig(this.props.x, this.props.y, {
        device_features: selectedOptions.map(option => option.value)
      });
    } else {
      this.props.updateBoxConfig(this.props.x, this.props.y, {
        device_features: []
      });
    }
  };

  updateTemperatureSensor = selectedOption => {
    if (selectedOption) {
      this.props.updateBoxConfig(this.props.x, this.props.y, {
        temperature_sensor: selectedOption.value
      });
    } else {
      this.props.updateBoxConfig(this.props.x, this.props.y, {
        temperature_sensor: null
      });
    }
  };

  getSelectedDeviceFeatures = () => {
    if (!this.props.box.device_features) {
      return [];
    }
    return this.props.box.device_features.map(deviceFeatureSelector => {
      const deviceFeature = this.state.deviceFeatures.find(d => d.selector === deviceFeatureSelector);
      if (!deviceFeature) {
        return {
          label: deviceFeatureSelector,
          value: deviceFeatureSelector
        };
      }
      return {
        label: getDeviceFeatureName(this.state.devices, this.state.deviceFeatures, deviceFeature),
        value: deviceFeature.selector
      };
    });
  };

  getSelectedTemperatureSensor = () => {
    if (!this.props.box.temperature_sensor) {
      return null;
    }
    const deviceFeature = this.state.deviceFeatures.find(d => d.selector === this.props.box.temperature_sensor);
    if (!deviceFeature) {
      return {
        label: this.props.box.temperature_sensor,
        value: this.props.box.temperature_sensor
      };
    }
    return {
      label: getDeviceFeatureName(this.state.devices, this.state.deviceFeatures, deviceFeature),
      value: deviceFeature.selector
    };
  };

  getTemperatureSensorOptions = () => {
    const temperatureSensorOptions = [];
    this.state.devices.forEach(device => {
      device.features.forEach(feature => {
        if (feature.category === DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR) {
          temperatureSensorOptions.push({
            label: getDeviceFeatureName(this.props.intl.dictionary, device, feature),
            value: feature.selector
          });
        }
      });
    });
    return temperatureSensorOptions;
  };

  getDeviceFeatureOptions = () => {
    const deviceFeaturesOptions = [];
    this.state.devices.forEach(device => {
      device.features.forEach(feature => {
        if (feature.category === DEVICE_FEATURE_CATEGORIES.THERMOSTAT) {
          deviceFeaturesOptions.push({
            label: getDeviceFeatureName(this.props.intl.dictionary, device, feature),
            value: feature.selector
          });
        }
      });
    });
    return deviceFeaturesOptions;
  };

  render(props, { loading }) {
    if (loading) {
      return (
        <BaseEditBox {...props} titleKey="dashboard.boxTitle.thermostat-tpi">
          <div class="text-center">
            <div class="spinner-border" role="status">
              <span class="sr-only">
                <Text id="global.loading" />
              </span>
            </div>
          </div>
        </BaseEditBox>
      );
    }

    const selectedDeviceFeatures = this.getSelectedDeviceFeatures();
    const deviceFeatureOptions = this.getDeviceFeatureOptions();
    const selectedTemperatureSensor = this.getSelectedTemperatureSensor();
    const temperatureSensorOptions = this.getTemperatureSensorOptions();

    return (
      <BaseEditBox {...props} titleKey="dashboard.boxTitle.thermostat-tpi">
        <div class="form-group">
          <label>
            <Text id="dashboard.boxes.thermostatTpi.editName" />
          </label>
          <Localizer>
            <input
              type="text"
              value={props.box.name}
              onInput={this.updateBoxName}
              class="form-control"
              placeholder={<Text id="dashboard.boxes.thermostatTpi.editNamePlaceholder" />}
            />
          </Localizer>
        </div>
        <div class="form-group">
          <label>
            <Text id="dashboard.boxes.thermostatTpi.editDeviceFeatures" />
          </label>
          <Select
            defaultValue={[]}
            value={selectedDeviceFeatures}
            onChange={this.updateDeviceFeatures}
            options={deviceFeatureOptions.length > 0 ? deviceFeatureOptions : null}
            maxMenuHeight={220}
            isMulti
          />
        </div>
        <div class="form-group">
          <label>
            <Text id="dashboard.boxes.thermostatTpi.editTemperatureSensor" />
          </label>
          <Select
            defaultValue={[]}
            value={selectedTemperatureSensor}
            onChange={this.updateTemperatureSensor}
            options={temperatureSensorOptions.length > 0 ? temperatureSensorOptions : null}
            maxMenuHeight={220}
          />
        </div>
      </BaseEditBox>
    );
  }
}

export default connect('user,session,httpClient', {})(withIntlAsProp(EditThermostatTpi));
