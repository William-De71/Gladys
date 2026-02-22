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

  updateDefaultMode = mode => {
    this.props.updateBoxConfig(this.props.x, this.props.y, { default_mode: mode });
  };

  updateControlType = option => {
    this.props.updateBoxConfig(this.props.x, this.props.y, { control_type: option ? option.value : 'hysteresis' });
    this.setState({ selectedControlType: option });
  };

  toggleAdvancedOptions = () => {
    this.setState(prevState => ({
      showAdvancedOptions: !prevState.showAdvancedOptions
    }));
  };

  updateNumberField = (field, e) => {
    const val = parseFloat(e.target.value);
    this.props.updateBoxConfig(this.props.x, this.props.y, { [field]: isNaN(val) ? undefined : val });
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
      const controlType = this.props.box.control_type || 'hysteresis';
      const selectedControlType = controlType === 'tpi'
        ? { value: 'tpi', label: this.props.intl.dictionary.dashboard.boxes.thermostat.controlTypeTPI }
        : { value: 'hysteresis', label: this.props.intl.dictionary.dashboard.boxes.thermostat.controlTypeHysteresis };
      
      this.setState({
        thermostatOptions,
        temperatureOptions,
        humidityOptions,
        selectedThermostatOption,
        selectedTemperatureOption,
        selectedHumidityOption,
        selectedControlType,
        loading: false,
        showAdvancedOptions: false
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
    selectedThermostatOption, selectedTemperatureOption, selectedHumidityOption,
    selectedControlType, showAdvancedOptions
  }) {
    const placeholder = props.intl && props.intl.dictionary
      ? props.intl.dictionary.dashboard.boxes.thermostat.selectPlaceholder
      : '';
    const currentMode = props.box.default_mode || 'heating';
    const controlType = props.box.control_type || 'hysteresis';
    const heatingPresets = [['frost', 7], ['away', 16], ['eco', 18], ['night', 17], ['comfort', 21]];
    const coolingPresets = [['comfort', 21]];
    const activePresets = currentMode === 'cooling' ? coolingPresets : heatingPresets;

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

        <div class="form-group">
          <button onClick={this.toggleAdvancedOptions} class="btn btn-sm btn-outline-secondary w-100 mb-3">
            <i class={`fa fa-${showAdvancedOptions ? 'chevron-up' : 'chevron-down'} mr-2`} />
            <Text
              id={`dashboard.boxes.chart.${showAdvancedOptions ? 'hideAdvancedOptions' : 'showAdvancedOptions'}`}
            />
          </button>
        </div>

        {showAdvancedOptions && (
          <div class="advanced-options">
            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.defaultModeLabel" />
              </label>
              <Select
                value={currentMode === 'heating' 
                  ? { value: 'heating', label: props.intl.dictionary.dashboard.boxes.thermostat.modeHeating }
                  : { value: 'cooling', label: props.intl.dictionary.dashboard.boxes.thermostat.modeCooling }
                }
                onChange={opt => this.updateDefaultMode(opt.value)}
                options={[
                  { value: 'heating', label: props.intl.dictionary.dashboard.boxes.thermostat.modeHeating },
                  { value: 'cooling', label: props.intl.dictionary.dashboard.boxes.thermostat.modeCooling }
                ]}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.controlTypeLabel" />
              </label>
              <Select
                value={selectedControlType}
                onChange={this.updateControlType}
                options={[
                  { value: 'hysteresis', label: props.intl.dictionary.dashboard.boxes.thermostat.controlTypeHysteresis },
                  { value: 'tpi', label: props.intl.dictionary.dashboard.boxes.thermostat.controlTypeTPI }
                ]}
                className="react-select-container"
                classNamePrefix="react-select"
              />
              <small class="form-text text-muted">
                <Text id="dashboard.boxes.thermostat.controlTypeHelp" />
              </small>
            </div>

            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.tempMinLabel" />
              </label>
              <input
                type="number"
                class="form-control"
                value={props.box.temp_min !== undefined ? props.box.temp_min : 5}
                onInput={e => this.updateNumberField('temp_min', e)}
                min="-20"
                max="40"
                step="1"
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.tempMaxLabel" />
              </label>
              <input
                type="number"
                class="form-control"
                value={props.box.temp_max !== undefined ? props.box.temp_max : 35}
                onInput={e => this.updateNumberField('temp_max', e)}
                min="-20"
                max="40"
                step="1"
              />
            </div>

            {controlType === 'hysteresis' && (
              <>
                <div class="form-group">
                  <label class="form-label">
                    <Text id="dashboard.boxes.thermostat.hysteresisStartLabel" />
                  </label>
                  <input
                    type="number"
                    class="form-control"
                    value={props.box.hysteresis_start !== undefined ? props.box.hysteresis_start : 0.5}
                    onInput={e => this.updateNumberField('hysteresis_start', e)}
                    min="0"
                    max="5"
                    step="0.1"
                  />
                  <small class="form-text text-muted">
                    <Text id="dashboard.boxes.thermostat.hysteresisStartHelp" />
                  </small>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <Text id="dashboard.boxes.thermostat.hysteresisStopLabel" />
                  </label>
                  <input
                    type="number"
                    class="form-control"
                    value={props.box.hysteresis_stop !== undefined ? props.box.hysteresis_stop : 0.5}
                    onInput={e => this.updateNumberField('hysteresis_stop', e)}
                    min="0"
                    max="5"
                    step="0.1"
                  />
                  <small class="form-text text-muted">
                    <Text id="dashboard.boxes.thermostat.hysteresisStopHelp" />
                  </small>
                </div>
              </>
            )}

            {controlType === 'tpi' && (
              <>
                <div class="form-group">
                  <label class="form-label">
                    <Text id="dashboard.boxes.thermostat.tpiCycleTimeLabel" />
                  </label>
                  <input
                    type="number"
                    class="form-control"
                    value={props.box.tpi_cycle_time !== undefined ? props.box.tpi_cycle_time : 30}
                    onInput={e => this.updateNumberField('tpi_cycle_time', e)}
                    min="5"
                    max="120"
                    step="5"
                  />
                  <small class="form-text text-muted">
                    <Text id="dashboard.boxes.thermostat.tpiCycleTimeHelp" />
                  </small>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <Text id="dashboard.boxes.thermostat.tpiProportionalBandLabel" />
                  </label>
                  <input
                    type="number"
                    class="form-control"
                    value={props.box.tpi_proportional_band !== undefined ? props.box.tpi_proportional_band : 2}
                    onInput={e => this.updateNumberField('tpi_proportional_band', e)}
                    min="0.5"
                    max="10"
                    step="0.5"
                  />
                  <small class="form-text text-muted">
                    <Text id="dashboard.boxes.thermostat.tpiProportionalBandHelp" />
                  </small>
                </div>
              </>
            )}

            <label class="form-label">
              <Text id="dashboard.boxes.thermostat.presetsLabel" />
            </label>
            {activePresets.map(([key, def]) => (
              <div class="form-group" key={key}>
                <label class="form-label">
                  <Text id={`dashboard.boxes.thermostat.preset.${key}`} />
                </label>
                <input
                  type="number"
                  class="form-control"
                  value={props.box[`preset_${key}`] !== undefined ? props.box[`preset_${key}`] : def}
                  onInput={e => this.updateNumberField(`preset_${key}`, e)}
                  min="-20"
                  max="40"
                  step="0.5"
                />
              </div>
            ))}
          </div>
        )}
      </BaseEditBox>
    );
  }
}

export default connect('httpClient', {})(withIntlAsProp(EditThermostatBoxComponent));
