import { Component } from 'preact';
import { Text } from 'preact-i18n';
import { connect } from 'unistore/preact';
import Select from 'react-select';
import { getDeviceFeatureName } from '../../../utils/device';
import withIntlAsProp from '../../../utils/withIntlAsProp';
import BaseEditBox from '../baseEditBox';
import { DEVICE_FEATURE_CATEGORIES } from '../../../../../server/utils/constants';

const THERMOSTAT_CATEGORIES = [
  DEVICE_FEATURE_CATEGORIES.THERMOSTAT,
  DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING
];

const TEMPERATURE_CATEGORIES = [
  DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
  DEVICE_FEATURE_CATEGORIES.THERMOSTAT,
  DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING
];

const HUMIDITY_CATEGORIES = [DEVICE_FEATURE_CATEGORIES.HUMIDITY_SENSOR];

class EditThermostatBoxComponent extends Component {
  updateThermostatFeature = option => {
    this.props.updateBoxConfig(this.props.x, this.props.y, {
      thermostat_feature: option ? option.value : null
    });
    this.setState({ selectedThermostatOption: option });
  };

  updateTemperatureFeature = option => {
    this.props.updateBoxConfig(this.props.x, this.props.y, {
      temperature_feature: option ? option.value : null
    });
    this.setState({ selectedTemperatureOption: option });
  };

  updateHumidityFeature = option => {
    this.props.updateBoxConfig(this.props.x, this.props.y, {
      humidity_feature: option ? option.value : null
    });
    this.setState({ selectedHumidityOption: option });
  };

  updateName = e => {
    this.props.updateBoxConfig(this.props.x, this.props.y, { name: e.target.value || undefined });
  };

  updateNumberField = field => e => {
    const val = parseFloat(e.target.value);
    this.props.updateBoxConfig(this.props.x, this.props.y, { [field]: isNaN(val) ? undefined : val });
  };

  stepValue = (field, def, step, min, max, delta) => {
    const current = this.props.box[field] !== undefined ? Number(this.props.box[field]) : def;
    const next = Math.min(max, Math.max(min, Math.round((current + delta * step) * 10) / 10));
    this.props.updateBoxConfig(this.props.x, this.props.y, { [field]: next });
  };

  buildOptions = (devices, filterFn) => {
    const options = [];
    devices.forEach(device => {
      const featureOptions = [];
      device.features.forEach(feature => {
        if (!filterFn(feature)) return;
        featureOptions.push({
          value: feature.selector,
          label: getDeviceFeatureName(this.props.intl.dictionary, device, feature)
        });
      });
      if (featureOptions.length > 0) {
        featureOptions.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
        options.push({ label: device.name, options: featureOptions });
      }
    });
    return options;
  };

  getDevices = async () => {
    try {
      this.setState({ loading: true });
      const devices = await this.props.httpClient.get('/api/v1/device');

      const thermostatOptions = this.buildOptions(devices, f => THERMOSTAT_CATEGORIES.includes(f.category));
      const temperatureOptions = this.buildOptions(devices, f => TEMPERATURE_CATEGORIES.includes(f.category));
      const humidityOptions = this.buildOptions(devices, f => HUMIDITY_CATEGORIES.includes(f.category));
      let selectedThermostatOption = null;
      let selectedTemperatureOption = null;
      let selectedHumidityOption = null;

      thermostatOptions.forEach(group => group.options.forEach(opt => {
        if (opt.value === this.props.box.thermostat_feature) selectedThermostatOption = opt;
      }));
      temperatureOptions.forEach(group => group.options.forEach(opt => {
        if (opt.value === this.props.box.temperature_feature) selectedTemperatureOption = opt;
      }));
      humidityOptions.forEach(group => group.options.forEach(opt => {
        if (opt.value === this.props.box.humidity_feature) selectedHumidityOption = opt;
      }));
      this.setState({
        thermostatOptions,
        temperatureOptions,
        humidityOptions,
        selectedThermostatOption,
        selectedTemperatureOption,
        selectedHumidityOption,
        loading: false
      });
    } catch (e) {
      console.error(e);
      this.setState({ loading: false });
    }
  };

  componentDidMount() {
    this.getDevices();
  }

  render(props, {
    thermostatOptions, temperatureOptions, humidityOptions,
    selectedThermostatOption, selectedTemperatureOption, selectedHumidityOption
  }) {
    const placeholder = props.intl && props.intl.dictionary
      ? props.intl.dictionary.dashboard.boxes.thermostat.selectPlaceholder
      : '';

    return (
      <BaseEditBox {...props} titleKey="dashboard.boxTitle.thermostat">
        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.editNameLabel" />
          </label>
          <input
            type="text"
            class="form-control"
            placeholder={props.intl && props.intl.dictionary
              ? props.intl.dictionary.dashboard.boxes.thermostat.editNamePlaceholder
              : ''}
            value={props.box.name || ''}
            onInput={this.updateName}
          />
        </div>

        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.thermostatFeatureLabel" />
          </label>
          <Select
            value={selectedThermostatOption}
            onChange={this.updateThermostatFeature}
            options={thermostatOptions}
            isClearable
            className="react-select-container"
            classNamePrefix="react-select"
            placeholder={placeholder}
          />
          <small class="form-text text-muted">
            <Text id="dashboard.boxes.thermostat.thermostatFeatureHelp" />
          </small>
        </div>

        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.temperatureFeatureLabel" />
          </label>
          <Select
            value={selectedTemperatureOption}
            onChange={this.updateTemperatureFeature}
            options={temperatureOptions}
            isClearable
            className="react-select-container"
            classNamePrefix="react-select"
            placeholder={placeholder}
          />
          <small class="form-text text-muted">
            <Text id="dashboard.boxes.thermostat.temperatureFeatureHelp" />
          </small>
        </div>

        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.humidityFeatureLabel" />
          </label>
          <Select
            value={selectedHumidityOption}
            onChange={this.updateHumidityFeature}
            options={humidityOptions}
            isClearable
            className="react-select-container"
            classNamePrefix="react-select"
            placeholder={placeholder}
          />
          <small class="form-text text-muted">
            <Text id="dashboard.boxes.thermostat.humidityFeatureHelp" />
          </small>
        </div>

        <div class="row">
          <div class="col-6">
            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.tempMinLabel" />
              </label>
              <div class="input-group">
                <div class="input-group-prepend">
                  <button class="btn btn-outline-secondary" type="button" onClick={() => this.stepValue('temp_min', 5, 1, -20, 40, -1)}>
                    <i class="fe fe-minus" />
                  </button>
                </div>
                <input
                  type="number"
                  class="form-control text-center"
                  value={props.box.temp_min !== undefined ? props.box.temp_min : 5}
                  onInput={this.updateNumberField('temp_min')}
                  min="-20"
                  max="40"
                  step="1"
                />
                <div class="input-group-append">
                  <button class="btn btn-outline-secondary" type="button" onClick={() => this.stepValue('temp_min', 5, 1, -20, 40, 1)}>
                    <i class="fe fe-plus" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="col-6">
            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.tempMaxLabel" />
              </label>
              <div class="input-group">
                <div class="input-group-prepend">
                  <button class="btn btn-outline-secondary" type="button" onClick={() => this.stepValue('temp_max', 35, 1, -20, 40, -1)}>
                    <i class="fe fe-minus" />
                  </button>
                </div>
                <input
                  type="number"
                  class="form-control text-center"
                  value={props.box.temp_max !== undefined ? props.box.temp_max : 35}
                  onInput={this.updateNumberField('temp_max')}
                  min="-20"
                  max="40"
                  step="1"
                />
                <div class="input-group-append">
                  <button class="btn btn-outline-secondary" type="button" onClick={() => this.stepValue('temp_max', 35, 1, -20, 40, 1)}>
                    <i class="fe fe-plus" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <label class="form-label">
          <Text id="dashboard.boxes.thermostat.presetsLabel" />
        </label>
        <div class="row">
          {[['frost', 7], ['away', 16], ['comfort', 21], ['eco', 18], ['night', 17]].map(([key, def]) => (
            <div class="col-6" key={key}>
              <div class="form-group">
                <label class="form-label">
                  <Text id={`dashboard.boxes.thermostat.preset.${key}`} />
                </label>
                <div class="input-group">
                  <div class="input-group-prepend">
                    <button class="btn btn-outline-secondary" type="button" onClick={() => this.stepValue(`preset_${key}`, def, 0.5, -20, 40, -1)}>
                      <i class="fe fe-minus" />
                    </button>
                  </div>
                  <input
                    type="number"
                    class="form-control text-center"
                    value={props.box[`preset_${key}`] !== undefined ? props.box[`preset_${key}`] : def}
                    onInput={this.updateNumberField(`preset_${key}`)}
                    min="-20"
                    max="40"
                    step="0.5"
                  />
                  <div class="input-group-append">
                    <button class="btn btn-outline-secondary" type="button" onClick={() => this.stepValue(`preset_${key}`, def, 0.5, -20, 40, 1)}>
                      <i class="fe fe-plus" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </BaseEditBox>
    );
  }
}

export default connect('httpClient', {})(withIntlAsProp(EditThermostatBoxComponent));
