import { Component } from 'preact';
import { Text } from 'preact-i18n';
import { connect } from 'unistore/preact';
import Select from 'react-select';
import { getDeviceFeatureName } from '../../../utils/device';
import withIntlAsProp from '../../../utils/withIntlAsProp';
import BaseEditBox from '../baseEditBox';
import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_UNITS } from '../../../../../server/utils/constants';
import { celsiusToFahrenheit, fahrenheitToCelsius } from '../../../../../server/utils/units';

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
const SWITCH_CATEGORIES = [DEVICE_FEATURE_CATEGORIES.SWITCH];

class EditThermostatBoxComponent extends Component {
  CONFIG_FIELDS = [
    'temperature_feature', 'humidity_feature', 'switch_feature', 'default_mode', 'control_type',
    'temp_min', 'temp_max', 'hysteresis_start', 'hysteresis_stop',
    'tpi_cycle_time', 'tpi_proportional_band',
    'preset_frost', 'preset_away', 'preset_comfort', 'preset_eco', 'preset_night'
  ];

  getVarKey = feature => feature.toUpperCase().replace(/-/g, '_');

  saveToGladys = async (feature, updates, baseConfig) => {
    if (!feature) return;
    const key = this.getVarKey(feature);
    // Use provided baseConfig, or fall back to state.localConfig
    const current = baseConfig !== undefined ? baseConfig : (this.state.localConfig || {});
    const merged = { ...current, ...updates };
    // Update localConfig state
    this.setState({ localConfig: merged });
    // Build the config object with only relevant fields
    const config = {};
    this.CONFIG_FIELDS.forEach(f => {
      if (merged[f] !== undefined) config[f] = merged[f];
    });
    try {
      await this.props.httpClient.post(`/api/v1/variable/THERMOSTAT_CONFIG_${key}`, {
        value: JSON.stringify(config)
      });
    } catch (e) {
      console.error('Failed to save thermostat config to Gladys:', e);
    }
  };

  updateThermostatFeature = async option => {
    const feature = option ? option.value : null;
    this.props.updateBoxConfig(this.props.x, this.props.y, { thermostat_feature: feature });
    this.setState({ selectedThermostatOption: option });
    if (!feature) return;
    // Load remote config for the newly selected thermostat
    try {
      const response = await this.props.httpClient.get(
        `/api/v1/variable/THERMOSTAT_CONFIG_${this.getVarKey(feature)}`
      );
      if (response && response.value) {
        let remoteConfig = null;
        try {
          remoteConfig = JSON.parse(response.value);
        } catch (e) {
          // ignore
        }
        if (remoteConfig) {
          // Update localConfig with remote values
          const localConfig = {};
          this.CONFIG_FIELDS.forEach(f => {
            if (remoteConfig[f] !== undefined) localConfig[f] = remoteConfig[f];
          });
          // Find matching select options for temperature, humidity and switch
          let selectedTemperatureOption = null;
          let selectedHumidityOption = null;
          let selectedSwitchOption = null;
          this.state.temperatureOptions.forEach(group => group.options.forEach(opt => {
            if (opt.value === remoteConfig.temperature_feature) selectedTemperatureOption = opt;
          }));
          this.state.humidityOptions.forEach(group => group.options.forEach(opt => {
            if (opt.value === remoteConfig.humidity_feature) selectedHumidityOption = opt;
          }));
          (this.state.switchOptions || []).forEach(group => group.options.forEach(opt => {
            if (opt.value === remoteConfig.switch_feature) selectedSwitchOption = opt;
          }));
          const controlType = remoteConfig.control_type || 'hysteresis';
          const selectedControlType = controlType === 'tpi'
            ? { value: 'tpi', label: this.props.intl.dictionary.dashboard.boxes.thermostat.controlTypeTPI }
            : { value: 'hysteresis', label: this.props.intl.dictionary.dashboard.boxes.thermostat.controlTypeHysteresis };
          // Sync box config with remote values
          this.props.updateBoxConfig(this.props.x, this.props.y, { thermostat_feature: feature, ...remoteConfig });
          this.setState({ localConfig, selectedTemperatureOption, selectedHumidityOption, selectedSwitchOption, selectedControlType });
        }
      }
    } catch (e) {
      // No remote config yet for this thermostat, keep current state
    }
  };

  updateTemperatureFeature = async option => {
    const updates = { temperature_feature: option ? option.value : null };
    this.props.updateBoxConfig(this.props.x, this.props.y, updates);
    this.setState({ selectedTemperatureOption: option });
    await this.saveToGladys(this.props.box.thermostat_feature, updates);
  };

  updateHumidityFeature = async option => {
    const updates = { humidity_feature: option ? option.value : null };
    this.props.updateBoxConfig(this.props.x, this.props.y, updates);
    this.setState({ selectedHumidityOption: option });
    await this.saveToGladys(this.props.box.thermostat_feature, updates);
  };

  updateSwitchFeature = async option => {
    const updates = { switch_feature: option ? option.value : null };
    this.props.updateBoxConfig(this.props.x, this.props.y, updates);
    this.setState({ selectedSwitchOption: option });
    await this.saveToGladys(this.props.box.thermostat_feature, updates);
  };

  updateName = e => {
    this.props.updateBoxConfig(this.props.x, this.props.y, { name: e.target.value || undefined });
  };

  updateDefaultMode = async mode => {
    const updates = { default_mode: mode };
    if (mode === 'cooling') {
      updates.control_type = 'hysteresis';
    }
    this.props.updateBoxConfig(this.props.x, this.props.y, updates);
    if (mode === 'cooling') {
      this.setState({
        selectedControlType: { 
          value: 'hysteresis', 
          label: this.props.intl.dictionary.dashboard.boxes.thermostat.controlTypeHysteresis 
        }
      });
    }
    await this.saveToGladys(this.props.box.thermostat_feature, updates);
  };

  updateControlType = async option => {
    const updates = { control_type: option ? option.value : 'hysteresis' };
    this.props.updateBoxConfig(this.props.x, this.props.y, updates);
    this.setState({ selectedControlType: option });
    await this.saveToGladys(this.props.box.thermostat_feature, updates);
  };

  toggleAdvancedOptions = () => {
    this.setState(prevState => ({
      showAdvancedOptions: !prevState.showAdvancedOptions
    }));
  };

  updateNumberField = async (field, e) => {
    let val = parseFloat(e.target.value);
    // Convert temperature fields from user unit to Celsius for storage
    const isTempField = field === 'temp_min' || field === 'temp_max' || field.startsWith('preset_') || field === 'hysteresis_start' || field === 'hysteresis_stop';
    if (isTempField && !isNaN(val)) {
      const userUnit = this.props.user && this.props.user.temperature_unit_preference;
      if (userUnit === DEVICE_FEATURE_UNITS.FAHRENHEIT) {
        val = fahrenheitToCelsius(val);
      }
    }
    const updates = { [field]: isNaN(val) ? undefined : val };
    this.props.updateBoxConfig(this.props.x, this.props.y, updates);
    if (!isNaN(val)) {
      await this.saveToGladys(this.props.box.thermostat_feature, updates);
    }
  };

  // Convert temperature from Celsius (stored) to user preference for display
  toDisplayTemp = (tempCelsius) => {
    if (tempCelsius === null || tempCelsius === undefined) return tempCelsius;
    const userUnit = this.props.user && this.props.user.temperature_unit_preference;
    if (userUnit === DEVICE_FEATURE_UNITS.FAHRENHEIT) {
      return Math.round(celsiusToFahrenheit(tempCelsius));
    }
    return tempCelsius;
  };

  // Get the temperature unit symbol
  getTempUnit = () => {
    const userUnit = this.props.user && this.props.user.temperature_unit_preference;
    return userUnit === DEVICE_FEATURE_UNITS.FAHRENHEIT ? '°F' : '°C';
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
      const [devices, remoteResponse] = await Promise.all([
        this.props.httpClient.get('/api/v1/device'),
        this.props.box.thermostat_feature
          ? this.props.httpClient.get(`/api/v1/variable/THERMOSTAT_CONFIG_${this.getVarKey(this.props.box.thermostat_feature)}`).catch(() => null)
          : Promise.resolve(null)
      ]);

      // Remote config takes priority over local box props
      const box = this.props.box || {};
      let remoteConfig = null;
      if (remoteResponse && remoteResponse.value) {
        try {
          remoteConfig = JSON.parse(remoteResponse.value);
        } catch (e) {
          // ignore parse error
        }
      }
      const effectiveBox = { ...box, ...(remoteConfig || {}) };

      const thermostatOptions = this.buildOptions(devices, f => THERMOSTAT_CATEGORIES.includes(f.category));
      const temperatureOptions = this.buildOptions(devices, f => TEMPERATURE_CATEGORIES.includes(f.category));
      const humidityOptions = this.buildOptions(devices, f => HUMIDITY_CATEGORIES.includes(f.category));
      const switchOptions = this.buildOptions(devices, f => SWITCH_CATEGORIES.includes(f.category));
      let selectedThermostatOption = null;
      let selectedTemperatureOption = null;
      let selectedHumidityOption = null;
      let selectedSwitchOption = null;

      thermostatOptions.forEach(group => group.options.forEach(opt => {
        if (opt.value === effectiveBox.thermostat_feature) selectedThermostatOption = opt;
      }));
      temperatureOptions.forEach(group => group.options.forEach(opt => {
        if (opt.value === effectiveBox.temperature_feature) selectedTemperatureOption = opt;
      }));
      humidityOptions.forEach(group => group.options.forEach(opt => {
        if (opt.value === effectiveBox.humidity_feature) selectedHumidityOption = opt;
      }));
      switchOptions.forEach(group => group.options.forEach(opt => {
        if (opt.value === effectiveBox.switch_feature) selectedSwitchOption = opt;
      }));
      const controlType = effectiveBox.control_type || 'hysteresis';
      const selectedControlType = controlType === 'tpi'
        ? { value: 'tpi', label: this.props.intl.dictionary.dashboard.boxes.thermostat.controlTypeTPI }
        : { value: 'hysteresis', label: this.props.intl.dictionary.dashboard.boxes.thermostat.controlTypeHysteresis };

      // Build localConfig from effectiveBox
      const localConfig = {};
      this.CONFIG_FIELDS.forEach(f => {
        if (effectiveBox[f] !== undefined) localConfig[f] = effectiveBox[f];
      });
      // If no remote config yet, push current config to Gladys
      if (!remoteConfig && box.thermostat_feature) {
        this.saveToGladys(box.thermostat_feature, localConfig, localConfig);
      }
      this.setState({
        thermostatOptions,
        temperatureOptions,
        humidityOptions,
        switchOptions,
        selectedThermostatOption,
        selectedTemperatureOption,
        selectedHumidityOption,
        selectedSwitchOption,
        selectedControlType,
        localConfig,
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
    thermostatOptions, temperatureOptions, humidityOptions, switchOptions,
    selectedThermostatOption, selectedTemperatureOption, selectedHumidityOption, selectedSwitchOption,
    selectedControlType, showAdvancedOptions
  }) {
    const placeholder = props.intl && props.intl.dictionary
      ? props.intl.dictionary.dashboard.boxes.thermostat.selectPlaceholder
      : '';
    const currentMode = props.box.default_mode || 'heating';
    const controlType = props.box.control_type || 'hysteresis';
    const tempUnit = this.getTempUnit();

    // Convert all temperature values for display
    const displayTempMin = this.toDisplayTemp(props.box.temp_min !== undefined ? props.box.temp_min : 5);
    const displayTempMax = this.toDisplayTemp(props.box.temp_max !== undefined ? props.box.temp_max : 35);
    const displayHysteresisStart = this.toDisplayTemp(props.box.hysteresis_start !== undefined ? props.box.hysteresis_start : 0.5);
    const displayHysteresisStop = this.toDisplayTemp(props.box.hysteresis_stop !== undefined ? props.box.hysteresis_stop : 0.5);
    // Map preset keys to their display values
    const presetDisplayValues = {
      frost: this.toDisplayTemp(props.box.preset_frost !== undefined ? props.box.preset_frost : 7),
      away: this.toDisplayTemp(props.box.preset_away !== undefined ? props.box.preset_away : 16),
      comfort: this.toDisplayTemp(props.box.preset_comfort !== undefined ? props.box.preset_comfort : 21),
      eco: this.toDisplayTemp(props.box.preset_eco !== undefined ? props.box.preset_eco : 18),
      night: this.toDisplayTemp(props.box.preset_night !== undefined ? props.box.preset_night : 17)
    };
    const heatingPresets = ['frost', 'away', 'eco', 'night', 'comfort'];
    const coolingPresets = ['comfort'];
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
            <span class="text-danger"> *</span>
          </label>
          <Select
            value={selectedThermostatOption}
            onChange={this.updateThermostatFeature}
            options={thermostatOptions}
            placeholder={placeholder}
            maxMenuHeight={220}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={{
              valueContainer: (provided) => ({ ...provided, paddingLeft: '8px' }),
              input: (provided) => ({ ...provided, paddingLeft: '4px' }),
              placeholder: (provided) => ({ ...provided, paddingLeft: '4px' }),
              singleValue: (provided) => ({ ...provided, marginLeft: '0px', paddingLeft: '4px' })
            }}
          />
          <small class="form-text text-muted">
            <Text id="dashboard.boxes.thermostat.thermostatFeatureHelp" />
          </small>
        </div>

        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.temperatureFeatureLabel" />
            <span class="text-danger"> *</span>
          </label>
          <Select
            value={selectedTemperatureOption}
            onChange={this.updateTemperatureFeature}
            options={temperatureOptions}
            placeholder={placeholder}
            maxMenuHeight={220}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={{
              valueContainer: (provided) => ({ ...provided, paddingLeft: '8px' }),
              input: (provided) => ({ ...provided, paddingLeft: '4px' }),
              placeholder: (provided) => ({ ...provided, paddingLeft: '4px' }),
              singleValue: (provided) => ({ ...provided, marginLeft: '0px', paddingLeft: '4px' })
            }}
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
            placeholder={placeholder}
            maxMenuHeight={220}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={{
              valueContainer: (provided) => ({ ...provided, paddingLeft: '8px' }),
              input: (provided) => ({ ...provided, paddingLeft: '4px' }),
              placeholder: (provided) => ({ ...provided, paddingLeft: '4px' }),
              singleValue: (provided) => ({ ...provided, marginLeft: '0px', paddingLeft: '4px' })
            }}
          />
          <small class="form-text text-muted">
            <Text id="dashboard.boxes.thermostat.humidityFeatureHelp" />
          </small>
        </div>

        <div class="form-group">
          <label class="form-label">
            <Text id="dashboard.boxes.thermostat.switchFeatureLabel" />
          </label>
          <Select
            value={selectedSwitchOption}
            onChange={this.updateSwitchFeature}
            options={switchOptions}
            isClearable
            placeholder={placeholder}
            maxMenuHeight={220}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={{
              valueContainer: (provided) => ({ ...provided, paddingLeft: '8px' }),
              input: (provided) => ({ ...provided, paddingLeft: '4px' }),
              placeholder: (provided) => ({ ...provided, paddingLeft: '4px' }),
              singleValue: (provided) => ({ ...provided, marginLeft: '0px', paddingLeft: '4px' })
            }}
          />
          <small class="form-text text-muted">
            <Text id="dashboard.boxes.thermostat.switchFeatureHelp" />
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
                maxMenuHeight={220}
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  valueContainer: (provided) => ({ ...provided, paddingLeft: '8px' }),
                  singleValue: (provided) => ({ ...provided, marginLeft: '0px' })
                }}
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
                isDisabled={currentMode === 'cooling'}
                maxMenuHeight={220}
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  valueContainer: (provided) => ({ ...provided, paddingLeft: '8px' }),
                  singleValue: (provided) => ({ ...provided, marginLeft: '0px' })
                }}
              />
              <small class="form-text text-muted">
                {currentMode === 'cooling' ? (
                  <Text id="dashboard.boxes.thermostat.controlTypeLockedCooling" />
                ) : (
                  <Text id="dashboard.boxes.thermostat.controlTypeHelp" />
                )}
              </small>
            </div>

            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.tempMinLabel" /> ({tempUnit})
              </label>
              <input
                type="number"
                class="form-control"
                value={displayTempMin}
                onInput={e => this.updateNumberField('temp_min', e)}
                step="1"
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                <Text id="dashboard.boxes.thermostat.tempMaxLabel" /> ({tempUnit})
              </label>
              <input
                type="number"
                class="form-control"
                value={displayTempMax}
                onInput={e => this.updateNumberField('temp_max', e)}
                step="1"
              />
            </div>

            {controlType === 'hysteresis' && (
              <>
                <div class="form-group">
                  <label class="form-label">
                    <Text id="dashboard.boxes.thermostat.hysteresisStartLabel" /> ({tempUnit})
                  </label>
                  <input
                    type="number"
                    class="form-control"
                    value={displayHysteresisStart}
                    onInput={e => this.updateNumberField('hysteresis_start', e)}
                    step="0.1"
                  />
                  <small class="form-text text-muted">
                    <Text id="dashboard.boxes.thermostat.hysteresisStartHelp" />
                  </small>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <Text id="dashboard.boxes.thermostat.hysteresisStopLabel" /> ({tempUnit})
                  </label>
                  <input
                    type="number"
                    class="form-control"
                    value={displayHysteresisStop}
                    onInput={e => this.updateNumberField('hysteresis_stop', e)}
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
              <Text id="dashboard.boxes.thermostat.presetsLabel" /> ({tempUnit})
            </label>
            {activePresets.map((key) => (
              <div class="form-group" key={key}>
                <label class="form-label">
                  <Text id={`dashboard.boxes.thermostat.preset.${key}`} />
                </label>
                <input
                  type="number"
                  class="form-control"
                  value={presetDisplayValues[key]}
                  onInput={e => this.updateNumberField(`preset_${key}`, e)}
                  step="1"
                />
              </div>
            ))}
          </div>
        )}
      </BaseEditBox>
    );
  }
}

export default connect('httpClient,user', {})(withIntlAsProp(EditThermostatBoxComponent));
