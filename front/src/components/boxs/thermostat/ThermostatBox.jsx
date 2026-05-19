import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import { WEBSOCKET_MESSAGE_TYPES, AC_MODE, DEVICE_FEATURE_UNITS } from '../../../../../server/utils/constants';
import { celsiusToFahrenheit, fahrenheitToCelsius } from '../../../../../server/utils/units';
import withIntlAsProp from '../../../utils/withIntlAsProp';
import style from './style.css';
import PRESET_COLORS from '../../../utils/thermostatPresetColors';

const DEFAULT_MIN = 5;
const DEFAULT_MAX = 35;
const ARC_DEGREES = 240;
const ARC_START_ANGLE = 150;
const DEFAULT_PRESET_TEMPS = { off: null, frost: 7, away: 16, comfort: 21, eco: 18, night: 17 };
const PRESET_ICONS = { off: 'fe-power', frost: 'fe-cloud-snow', away: 'fe-user-x', comfort: 'fe-sun', eco: 'fe-feather', night: 'fe-moon' };
const HEATING_PRESETS = ['off', 'frost', 'away', 'eco', 'night', 'comfort'];
const COOLING_PRESETS = ['off', 'comfort'];
const MANUAL_DURATION_MS = 30 * 60 * 1000;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? '1' : '0';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const CircularGauge = ({ setpoint, currentTemp, humidity, onPointerDown, onIncrement, onDecrement, minTemp, maxTemp, mode, isActive, isWindowOpen, tempUnit }) => {
  const cx = 110;
  const cy = 110;
  const r = 88;
  const sw = 11;
  const range = maxTemp - minTemp;
  const pct = range === 0 ? 0.5 : Math.min(1, Math.max(0, (setpoint - minTemp) / range));
  const arcEnd = ARC_START_ANGLE + Math.max(pct, 0.001) * ARC_DEGREES;
  const bgPath = describeArc(cx, cy, r, ARC_START_ANGLE, ARC_START_ANGLE + ARC_DEGREES);
  const fgPath = describeArc(cx, cy, r, ARC_START_ANGLE, arcEnd);
    const knob = polarToCartesian(cx, cy, r, arcEnd);
  const arcColor = mode === 'cooling' ? '#3b82f6' : mode === 'off' ? '#adb5bd' : '#f97316';
  const intPart = Math.floor(setpoint);
  const decPart = Math.round((setpoint - intPart) * 10);
  const intW = String(intPart).length * 30;
  const intX = cx - intW / 2 - 18;
  const suffixX = intX + intW;

  const hasCurrentTemp = currentTemp !== null && currentTemp !== undefined;
  const hasHumidity = humidity !== null && humidity !== undefined;

  return (
    <svg viewBox="0 0 220 220" class={style.gaugeSvg} onPointerDown={onPointerDown}>
      <defs>
        <filter id="arcGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur">
            {isActive && (
              <animate attributeName="stdDeviation" values="2;4;2" dur="2s" repeatCount="indefinite" />
            )}
          </feGaussianBlur>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path d={bgPath} fill="none" stroke="#e9ecef" strokeWidth={sw} strokeLinecap="round" />
      {mode === 'cooling' ? (
        <g>
          <path 
            d={fgPath} 
            fill="none" 
            stroke={arcColor} 
            strokeWidth={sw} 
            strokeLinecap="round"
            filter="none"
          />
        </g>
      ) : (
        <path 
          key={`${mode}-${arcColor}`}
          d={fgPath} 
          fill="none" 
          stroke={arcColor} 
          strokeWidth={sw} 
          strokeLinecap="round"
          filter={isActive && pct >= 0.2 ? 'url(#arcGlow)' : 'none'}
        />
      )}
      <circle cx={knob.x} cy={knob.y} r="9" fill="white" stroke={arcColor} strokeWidth="2.5" />

      {/* Current temp + humidity: above setpoint */}
      {hasCurrentTemp && (
        <text x={cx} y={hasHumidity ? cy - 46 : cy - 38} textAnchor="middle" dominantBaseline="middle" class={style.currentTempText}>
          {Number(currentTemp).toFixed(1)} °{tempUnit || 'C'}
        </text>
      )}
      {hasHumidity && (
        <text x={cx} y={hasCurrentTemp ? cy - 28 : cy - 38} textAnchor="middle" dominantBaseline="middle" class={style.humidityText}>
          {`\u{1F4A7} ${Math.round(humidity)} %`}
        </text>
      )}

      {/* Setpoint: integer + decimal + unit split (° above dot, C above decimal) */}
      <text x={intX} y={cy + 25} textAnchor="start" dominantBaseline="auto" class={style.tempMain}>{intPart}</text>
      <text x={suffixX - 2} y={cy + 25} textAnchor="start" dominantBaseline="auto" class={style.tempDecimal}>.{decPart}</text>
      <text x={suffixX - 3} y={cy + 4} textAnchor="start" dominantBaseline="auto" class={style.tempUnit}>°</text>
      <text x={suffixX + 4} y={cy + 4} textAnchor="start" dominantBaseline="auto" class={style.tempUnit}>{tempUnit || 'C'}</text>

      {/* Active icon: at bottom of gauge */}
      {isWindowOpen && (
        <text x={cx} y={cy + 54} textAnchor="middle" dominantBaseline="middle" class={style.activeIconHeating}>🪟</text>
      )}
      {!isWindowOpen && isActive && mode === 'heating' && (
        <text x={cx} y={cy + 54} textAnchor="middle" dominantBaseline="middle" class={style.activeIconHeating}>🔥</text>
      )}
      {!isWindowOpen && isActive && mode === 'cooling' && (
        <text x={cx} y={cy + 54} textAnchor="middle" dominantBaseline="middle" class={style.activeIconCooling}>❄️</text>
      )}

      {onIncrement && (
        <g onClick={onIncrement} onPointerDown={e => e.stopPropagation()} class={style.arcBtnGroup}>
          <circle cx="180" cy="40" r="15" class={style.arcBtnCircle} />
          <text x="180" y="40" textAnchor="middle" dominantBaseline="middle" class={style.arcBtnText}>+</text>
        </g>
      )}
      {onDecrement && (
        <g onClick={onDecrement} onPointerDown={e => e.stopPropagation()} class={style.arcBtnGroup}>
          <circle cx="180" cy="180" r="15" class={style.arcBtnCircle} />
          <text x="180" y="180" textAnchor="middle" dominantBaseline="middle" class={style.arcBtnText}>−</text>
        </g>
      )}
      
    </svg>
  );
};

class ThermostatBox extends Component {
  state = {
    setpoint: null,
    currentTemp: null,
    humidity: null,
    presetOpen: false,
    activePreset: null,
    isManualMode: false,
    error: false,
    noConfig: false,
    remoteConfig: null,
    featureMin: null,
    featureMax: null,
    featureUnit: null,
    activeSchedule: null,
    currentSlot: null,
    manualUntil: null,
    isWindowOpen: false,
  };

  svgRef = null;
  presetRef = null;
  modeInitialized = false;
  savingPreset = false;
  lastSwitchActive = null;
  _initialized = false;

  getConfig = () => ({ ...this.props.box, ...(this.state.remoteConfig || {}) });
  getMinTemp = () => {
    // Device feature native min has top priority
    if (this.state.featureMin !== null) return this.state.featureMin;
    const cfg = this.getConfig();
    if (cfg.temp_min !== undefined && cfg.temp_min !== null) return Number(cfg.temp_min);
    return DEFAULT_MIN;
  };
  getMaxTemp = () => {
    // Device feature native max has top priority
    if (this.state.featureMax !== null) return this.state.featureMax;
    const cfg = this.getConfig();
    if (cfg.temp_max !== undefined && cfg.temp_max !== null) return Number(cfg.temp_max);
    return DEFAULT_MAX;
  };

  getStorageKey = suffix => `thermostat_${suffix}_${this.props.box.thermostat_feature || 'default'}`;

  // Effective temperature unit: device feature unit takes priority over user preference
  getEffectiveUnit = () => {
    if (this.state.featureUnit) return this.state.featureUnit;
    return (this.props.user && this.props.user.temperature_unit_preference) || DEVICE_FEATURE_UNITS.CELSIUS;
  };

  // Convert temperature from Celsius (stored) to display unit
  toDisplayTemp = (tempCelsius) => {
    if (tempCelsius === null || tempCelsius === undefined) return tempCelsius;
    if (this.getEffectiveUnit() === DEVICE_FEATURE_UNITS.FAHRENHEIT) {
      return celsiusToFahrenheit(tempCelsius);
    }
    return tempCelsius;
  };

  // Convert temperature from display unit to Celsius for storage/API
  toStorageTemp = (tempDisplay) => {
    if (tempDisplay === null || tempDisplay === undefined) return tempDisplay;
    if (this.getEffectiveUnit() === DEVICE_FEATURE_UNITS.FAHRENHEIT) {
      return fahrenheitToCelsius(tempDisplay);
    }
    return tempDisplay;
  };

  // Get the temperature unit symbol
  getTempUnit = () => {
    return this.getEffectiveUnit() === DEVICE_FEATURE_UNITS.FAHRENHEIT ? 'F' : 'C';
  };

  loadConfig = async () => {
    const { box } = this.props;
    if (!box.thermostat_feature) return null;
    const key = box.thermostat_feature.toUpperCase().replace(/-/g, '_');

    // Fetch both sources in parallel: device params (DB) and THERMOSTAT_CONFIG variable
    let paramsConfig = null;
    let varConfig = null;
    await Promise.all([
      this.props.httpClient.get('/api/v1/device', { device_feature_selectors: box.thermostat_feature })
        .then(devices => {
          const device = devices && devices[0];
          if (device && device.params && device.params.length > 0) {
            const getParam = name => {
              const p = device.params.find(x => x.name === name);
              return p ? p.value : null;
            };
            paramsConfig = {
              temperature_feature: getParam('THERMOSTAT_TEMPERATURE_FEATURE') || null,
              humidity_feature: getParam('THERMOSTAT_HUMIDITY_FEATURE') || null,
              switch_feature: getParam('THERMOSTAT_SWITCH_FEATURE') || null,
              window_feature: getParam('THERMOSTAT_WINDOW_FEATURE') || null,
              default_mode: getParam('THERMOSTAT_MODE') || null,
              control_type: getParam('THERMOSTAT_CONTROL_TYPE') || null,
              temp_min: getParam('THERMOSTAT_MIN_TEMP') ? parseFloat(getParam('THERMOSTAT_MIN_TEMP')) : null,
              temp_max: getParam('THERMOSTAT_MAX_TEMP') ? parseFloat(getParam('THERMOSTAT_MAX_TEMP')) : null,
              preset_frost: getParam('THERMOSTAT_PRESET_FROST') ? parseFloat(getParam('THERMOSTAT_PRESET_FROST')) : null,
              preset_away: getParam('THERMOSTAT_PRESET_AWAY') ? parseFloat(getParam('THERMOSTAT_PRESET_AWAY')) : null,
              preset_eco: getParam('THERMOSTAT_PRESET_ECO') ? parseFloat(getParam('THERMOSTAT_PRESET_ECO')) : null,
              preset_night: getParam('THERMOSTAT_PRESET_NIGHT') ? parseFloat(getParam('THERMOSTAT_PRESET_NIGHT')) : null,
              preset_comfort: getParam('THERMOSTAT_PRESET_COMFORT') ? parseFloat(getParam('THERMOSTAT_PRESET_COMFORT')) : null,
              hysteresis_start: getParam('THERMOSTAT_HYSTERESIS_START') ? parseFloat(getParam('THERMOSTAT_HYSTERESIS_START')) : null,
              hysteresis_stop: getParam('THERMOSTAT_HYSTERESIS_STOP') ? parseFloat(getParam('THERMOSTAT_HYSTERESIS_STOP')) : null,
              tpi_cycle_time: getParam('THERMOSTAT_TPI_CYCLE_TIME') ? parseInt(getParam('THERMOSTAT_TPI_CYCLE_TIME'), 10) : null,
              tpi_proportional_band: getParam('THERMOSTAT_TPI_PROPORTIONAL_BAND') ? parseFloat(getParam('THERMOSTAT_TPI_PROPORTIONAL_BAND')) : null,
              manual_duration: getParam('THERMOSTAT_MANUAL_DURATION') ? parseInt(getParam('THERMOSTAT_MANUAL_DURATION'), 10) : null,
            };
          }
        })
        .catch(() => {}),
      this.props.httpClient.get(`/api/v1/variable/THERMOSTAT_CONFIG_${key}`)
        .then(resp => {
          if (resp && resp.value) {
            varConfig = JSON.parse(resp.value);
          }
        })
        .catch(() => {}),
    ]);

    // Merge: device params take priority (more up-to-date), variable fills any missing fields
    let integrationConfig = null;
    if (paramsConfig) {
      integrationConfig = { ...varConfig, ...paramsConfig };
      // Remove null values from paramsConfig so varConfig can fill them
      Object.keys(paramsConfig).forEach(k => {
        if (paramsConfig[k] === null && varConfig && varConfig[k] != null) {
          integrationConfig[k] = varConfig[k];
        }
      });
    } else if (varConfig) {
      integrationConfig = varConfig;
    }

    const remoteConfig = {
      temperature_feature: (integrationConfig && integrationConfig.temperature_feature) || null,
      humidity_feature: (integrationConfig && integrationConfig.humidity_feature) || null,
      switch_feature: (integrationConfig && integrationConfig.switch_feature) || null,
      window_feature: (integrationConfig && integrationConfig.window_feature) || null,
      default_mode: (integrationConfig && integrationConfig.default_mode) || 'heating',
      control_type: (integrationConfig && integrationConfig.control_type) || 'hysteresis',
      temp_min: integrationConfig && integrationConfig.temp_min,
      temp_max: integrationConfig && integrationConfig.temp_max,
      preset_frost: integrationConfig && integrationConfig.preset_frost,
      preset_away: integrationConfig && integrationConfig.preset_away,
      preset_eco: integrationConfig && integrationConfig.preset_eco,
      preset_night: integrationConfig && integrationConfig.preset_night,
      preset_comfort: integrationConfig && integrationConfig.preset_comfort,
      hysteresis_start: integrationConfig && integrationConfig.hysteresis_start,
      hysteresis_stop: integrationConfig && integrationConfig.hysteresis_stop,
      tpi_cycle_time: integrationConfig && integrationConfig.tpi_cycle_time,
      tpi_proportional_band: integrationConfig && integrationConfig.tpi_proportional_band,
      manual_duration: integrationConfig && integrationConfig.manual_duration,
    };
    await new Promise(resolve => this.setState({ remoteConfig }, resolve));
    return remoteConfig;
  };

  loadMode = async () => {
    const { box } = this.props;
    if (!box.thermostat_feature) return {};
    if (this.savingPreset) return {};
    const key = box.thermostat_feature.toUpperCase().replace(/-/g, '_');
    let activePreset = null;
    let isManualMode = null;

    // Read manual mode first — it determines which source to use for the preset
    try {
      const response = await this.props.httpClient.get(`/api/v1/variable/THERMOSTAT_${key}_MANUAL_MODE`);
      if (response && response.value !== null && response.value !== undefined) {
        isManualMode = response.value === 'true';
      }
    } catch (e) { /* ignore */ }

    const knownPresets = [...HEATING_PRESETS, ...COOLING_PRESETS];

    if (isManualMode !== true && box.schedule_selector) {
      // Schedule is active and not in manual mode: derive preset from current slot directly
      // This avoids stale DB variable values
      activePreset = await this.resolvePresetFromSchedule();
      if (!activePreset) {
        // No matching slot right now — fall back to DB variable
        try {
          const response = await this.props.httpClient.get(`/api/v1/variable/THERMOSTAT_${key}_PRESET`);
          if (response && response.value && knownPresets.includes(response.value)) {
            activePreset = response.value;
          }
        } catch (e) { /* ignore */ }
      }
      this.modeInitialized = true;
    } else {
      // No schedule or manual mode: use DB variable
      try {
        const response = await this.props.httpClient.get(`/api/v1/variable/THERMOSTAT_${key}_PRESET`);
        if (response && response.value) {
          activePreset = knownPresets.includes(response.value) ? response.value : 'comfort';
          this.modeInitialized = true;
        } else if (!this.modeInitialized) {
          this.modeInitialized = true;
          activePreset = 'comfort';
          await this.savePreset(activePreset);
        }
      } catch (e) { /* ignore */ }
    }

    return { activePreset, isManualMode };
  };

  saveLastActivePreset = preset => {
    try {
      if (preset !== 'off') {
        localStorage.setItem(this.getStorageKey('last_active_preset'), preset);
      }
    } catch (e) { /* ignore */ }
  };

  getLastActivePreset = () => {
    try {
      return localStorage.getItem(this.getStorageKey('last_active_preset')) || 'comfort';
    } catch (e) {
      return 'comfort';
    }
  };

  savePreset = async preset => {
    const { box } = this.props;
    if (!box.thermostat_feature) return;
    
    this.savingPreset = true;
    try {
      await this.props.httpClient.post(`/api/v1/variable/THERMOSTAT_${box.thermostat_feature.toUpperCase().replace(/-/g, '_')}_PRESET`, {
        value: preset
      });
    } catch (e) {
      console.error('Failed to save preset:', e);
    } finally {
      this.savingPreset = false;
    }
  };

  saveManualMode = async isManual => {
    const { box } = this.props;
    if (!box.thermostat_feature) return;
    
    try {
      // Save to Gladys variables keyed by thermostat_feature
      await this.props.httpClient.post(`/api/v1/variable/THERMOSTAT_${box.thermostat_feature.toUpperCase().replace(/-/g, '_')}_MANUAL_MODE`, {
        value: isManual.toString()
      });
    } catch (e) {
      console.error('Failed to save manual mode:', e);
    }
  };

  getPresetColor = (presetKey) => {
    return PRESET_COLORS[presetKey] || PRESET_COLORS.comfort;
  };

  getPresets = () => {
    const cfg = this.getConfig();
    const mode = cfg.default_mode || 'heating';
    const keys = mode === 'cooling' ? COOLING_PRESETS : HEATING_PRESETS;
    const allPresets = {
      off: { key: 'off', icon: PRESET_ICONS.off, temp: null },
      frost: { key: 'frost', icon: PRESET_ICONS.frost, temp: Number(cfg.preset_frost) || DEFAULT_PRESET_TEMPS.frost },
      away: { key: 'away', icon: PRESET_ICONS.away, temp: Number(cfg.preset_away) || DEFAULT_PRESET_TEMPS.away },
      comfort: { key: 'comfort', icon: PRESET_ICONS.comfort, temp: Number(cfg.preset_comfort) || DEFAULT_PRESET_TEMPS.comfort },
      eco: { key: 'eco', icon: PRESET_ICONS.eco, temp: Number(cfg.preset_eco) || DEFAULT_PRESET_TEMPS.eco },
      night: { key: 'night', icon: PRESET_ICONS.night, temp: Number(cfg.preset_night) || DEFAULT_PRESET_TEMPS.night }
    };
    return keys.map(k => allPresets[k]);
  };

  getDeviceData = async () => {
    const { box } = this.props;
    const thermostatFeature = box.thermostat_feature;
    // temperature/humidity/window features come from integration config (remoteConfig), not box props
    const temperatureFeature = (this.state.remoteConfig && this.state.remoteConfig.temperature_feature) || null;
    const humidityFeature = (this.state.remoteConfig && this.state.remoteConfig.humidity_feature) || null;
    const windowFeature = (this.state.remoteConfig && this.state.remoteConfig.window_feature) || null;
    if (!thermostatFeature && !temperatureFeature) {
      this.setState({ noConfig: true });
      return;
    }
    // Reset features that have been removed
    const stateUpdate = { noConfig: false, error: false };
    if (!temperatureFeature) stateUpdate.currentTemp = null;
    if (!humidityFeature) stateUpdate.humidity = null;
    if (!windowFeature) stateUpdate.isWindowOpen = false;
    this.setState(stateUpdate);
    const selectors = [thermostatFeature, temperatureFeature, humidityFeature, windowFeature]
      .filter(Boolean)
      .join(',');
    if (!selectors) return;
    try {
      const devices = await this.props.httpClient.get('/api/v1/device', {
        device_feature_selectors: selectors
      });
      if (devices && devices.length) {
        devices.forEach(device => {
          device.features.forEach(feat => {
            if (feat.selector === thermostatFeature) {
              if (feat.last_value !== null && feat.last_value !== undefined) {
                // During manual mode, keep the manual setpoint
                // Also skip if setpoint was already set from schedule preset (avoid stale DB value)
                if (!this.state.isManualMode && !this._scheduleSetpointSet) {
                  this.setState({ setpoint: feat.last_value });
                }
              }
              this._scheduleSetpointSet = false;
              // Store native feature min/max/unit
              if (feat.min !== undefined && feat.min !== null) this.setState({ featureMin: feat.min });
              if (feat.max !== undefined && feat.max !== null) this.setState({ featureMax: feat.max });
              if (feat.unit) this.setState({ featureUnit: feat.unit });
            }
            if (temperatureFeature && feat.selector === temperatureFeature && feat.last_value !== null && feat.last_value !== undefined) {
              this.setState({ currentTemp: feat.last_value });
            }
            if (humidityFeature && feat.selector === humidityFeature && feat.last_value !== null && feat.last_value !== undefined) {
              this.setState({ humidity: feat.last_value });
            }
            if (windowFeature && feat.selector === windowFeature && feat.last_value !== null && feat.last_value !== undefined) {
              this.setState({ isWindowOpen: feat.last_value === 0 });
            }
          });
        });
      }
    } catch (e) {
      console.error(e);
      this.setState({ error: true });
    }
  };

  handleWebsocketMessage = payload => {
    const { box } = this.props;
    const thermostatFeature = box.thermostat_feature;
    const temperatureFeature = (this.state.remoteConfig && this.state.remoteConfig.temperature_feature) || null;
    const humidityFeature = (this.state.remoteConfig && this.state.remoteConfig.humidity_feature) || null;
    if (thermostatFeature && payload.device_feature_selector === thermostatFeature) {
      // Don't overwrite setpoint during manual mode
      if (!this.state.isManualMode) {
        this.setState({ setpoint: payload.last_value });
      }
    }
    if (temperatureFeature && payload.device_feature_selector === temperatureFeature) {
      this.setState({ currentTemp: payload.last_value });
    }
    if (humidityFeature && payload.device_feature_selector === humidityFeature) {
      this.setState({ humidity: payload.last_value });
    }
    const windowFeature = (this.state.remoteConfig && this.state.remoteConfig.window_feature) || null;
    if (windowFeature && payload.device_feature_selector === windowFeature) {
      const isWindowOpen = payload.last_value === 0;
      this.setState({ isWindowOpen });
      if (isWindowOpen) {
        this.sendSwitch(false);
      }
    }
  };

  handleWebsocketConnected = ({ connected }) => {
    if (!connected) {
      this.wasDisconnected = true;
    } else if (this.wasDisconnected) {
      this.getDeviceData();
      this.wasDisconnected = false;
    }
  };

  getFeatureVarKey = () => {
    const { box } = this.props;
    if (!box.thermostat_feature) return null;
    return box.thermostat_feature.toUpperCase().replace(/-/g, '_');
  };

  handleThermostatConfigUpdated = payload => {
    const key = this.getFeatureVarKey();
    if (!key || payload.key !== `THERMOSTAT_CONFIG_${key}`) return;
    try {
      const config = JSON.parse(payload.value);
      this.setState({ remoteConfig: config }, () => this.getDeviceData());
    } catch (e) {
      // Ignore parse errors
    }
  };

  handleThermostatPresetUpdated = payload => {
    const key = this.getFeatureVarKey();
    if (!key || payload.key !== `THERMOSTAT_${key}_PRESET`) return;
    if (this.savingPreset) return;
    // The schedule server always wins: apply the preset even in manual mode
    // (applySchedules already checks manualVal server-side and skips if still manual)
    if (payload.value) {
      const knownPresets = [...HEATING_PRESETS, ...COOLING_PRESETS];
      const resolvedPreset = knownPresets.includes(payload.value) ? payload.value : 'comfort';
      const newState = { activePreset: resolvedPreset, isManualMode: false, manualSetpointOverride: false };
      if (resolvedPreset !== 'off') {
        const presets = this.getPresets();
        const preset = presets.find(p => p.key === resolvedPreset);
        if (preset && preset.temp !== null && preset.temp !== undefined) {
          newState.setpoint = preset.temp;
        }
      }
      this.loadSchedule();
      this.setState(newState);
    }
  };

  handleThermostatManualModeUpdated = payload => {
    const key = this.getFeatureVarKey();
    if (!key || payload.key !== `THERMOSTAT_${key}_MANUAL_MODE`) return;
    const isManual = payload.value === 'true';
    if (!isManual && this.state.isManualMode) {
      // Server expired the manual timer — revert UI to schedule
      this.setState({ isManualMode: false, manualUntil: null, manualSetpointOverride: false });
      this.clearManualSetpoint();
      this.applyPlanningPreset();
      this.loadSchedule();
    } else if (isManual !== this.state.isManualMode && !this.savingPreset) {
      this.setState({ isManualMode: isManual });
    }
  };

  resolvePresetFromSchedule = async () => {
    const { box } = this.props;
    const scheduleSelector = box.schedule_selector;
    if (!scheduleSelector) return null;
    try {
      const schedules = await this.props.httpClient.get('/api/v1/service/thermostat/schedule');
      const schedule = Array.isArray(schedules) ? schedules.find(s => s.selector === scheduleSelector) : null;
      if (!schedule) return null;
      const slot = this.getCurrentSlot(schedule);
      if (slot && slot.preset) {
        const knownPresets = [...HEATING_PRESETS, ...COOLING_PRESETS];
        return knownPresets.includes(slot.preset) ? slot.preset : null;
      }
    } catch (e) { /* ignore */ }
    return null;
  };

  getCurrentSlot = (schedule) => {
    if (!schedule || !schedule.slots) return null;
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const yesterdayOfWeek = (dayOfWeek + 6) % 7;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseEnd = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      const v = h * 60 + m;
      return v === 0 ? 1440 : v; // 00:00 means end of day (midnight)
    };

    // Check today's normal slots (start < end)
    const slotsToday = schedule.slots.filter(s => s.day_of_week === dayOfWeek);
    for (const slot of slotsToday) {
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = parseEnd(slot.end_time);
      if (end > start && currentMinutes >= start && currentMinutes < end) return slot;
    }

    // Check today's overnight slots (end < start): covers start→23:59 on same day
    for (const slot of slotsToday) {
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const [eh, em] = slot.end_time.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      if (end < start && currentMinutes >= start) return slot;
    }

    // Check yesterday's overnight slots: covers 00:00→end on next day
    const slotsYesterday = schedule.slots.filter(s => s.day_of_week === yesterdayOfWeek);
    for (const slot of slotsYesterday) {
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const [eh, em] = slot.end_time.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      if (end < start && currentMinutes < end) return slot;
    }

    return null;
  };

  loadSchedule = async () => {
    const { box } = this.props;
    const scheduleSelector = box.schedule_selector;
    if (!scheduleSelector) {
      this.setState({ activeSchedule: null, currentSlot: null });
      return;
    }
    try {
      const schedules = await this.props.httpClient.get('/api/v1/service/thermostat/schedule');
      const schedule = Array.isArray(schedules) ? schedules.find(s => s.selector === scheduleSelector) : null;
      if (schedule) {
        const currentSlot = this.getCurrentSlot(schedule);
        this.setState({ activeSchedule: schedule, currentSlot });
      } else {
        this.setState({ activeSchedule: null, currentSlot: null });
      }
    } catch (e) {
      this.setState({ activeSchedule: null, currentSlot: null });
    }
  };

  saveManualSetpoint = (setpoint) => {
    try {
      localStorage.setItem(this.getStorageKey('manual_setpoint'), String(setpoint));
      localStorage.setItem(this.getStorageKey('manual_override'), '1');
    } catch (e) { /* ignore */ }
    // Also persist to DB so other browsers/devices get the value
    this.saveManualSetpointToDb(setpoint, true);
  };

  saveManualSetpointToDb = async (setpoint, override) => {
    const { box } = this.props;
    if (!box.thermostat_feature) return;
    const key = box.thermostat_feature.toUpperCase().replace(/-/g, '_');
    try {
      await this.props.httpClient.post(`/api/v1/variable/THERMOSTAT_${key}_MANUAL_SETPOINT`, {
        value: JSON.stringify({ setpoint, override: !!override })
      });
    } catch (e) { /* ignore */ }
  };

  clearManualSetpoint = () => {
    try {
      localStorage.removeItem(this.getStorageKey('manual_setpoint'));
      localStorage.removeItem(this.getStorageKey('manual_override'));
    } catch (e) { /* ignore */ }
    // Clear from DB too
    this.saveManualSetpointToDb(null, false);
  };

  cancelManualMode = () => {
    this.clearManualSetpoint();
    this.saveManualUntilToDb(0);
    this.setState({ isManualMode: false, manualUntil: null, manualSetpointOverride: false });
    this.saveManualMode(false);
    this.applyPlanningPreset();
    this.loadSchedule();
  };

  applyPlanningPreset = () => {
    // Called when manual timer expires: revert setpoint to the active preset temp
    const presets = this.getPresets();
    const preset = presets.find(p => p.key === this.state.activePreset);
    if (preset && preset.temp !== null && preset.temp !== undefined) {
      this.setState({ setpoint: preset.temp });
      this.sendSetpoint(preset.temp);
      this.applyManualSwitch(preset.temp);
    }
  };

  saveManualUntilToDb = async (until) => {
    const { box } = this.props;
    if (!box.thermostat_feature) return;
    const key = box.thermostat_feature.toUpperCase().replace(/-/g, '_');
    try {
      await this.props.httpClient.post(`/api/v1/variable/THERMOSTAT_${key}_MANUAL_UNTIL`, { value: String(until) });
    } catch (e) { /* ignore */ }
  };

  startManualTimer = (setpoint) => {
    const cfg = this.getConfig();
    const durationMs = cfg.manual_duration ? cfg.manual_duration * 60 * 1000 : MANUAL_DURATION_MS;
    const until = Date.now() + durationMs;
    this.setState({ manualUntil: until });
    this.saveManualSetpoint(setpoint !== undefined ? setpoint : this.state.setpoint);
    // Persist expiry server-side so the server can expire it even when browser is closed
    this.saveManualUntilToDb(until);
  };

  initData = async () => {
    await this.loadConfig();
    const { activePreset, isManualMode } = await this.loadMode();

    // Build initial state update: apply preset and manual mode atomically,
    // then restore manual setpoint from localStorage if still active.
    // This must be committed BEFORE getDeviceData() so the setpoint guard works.
    const stateInit = {};
    if (activePreset !== null) stateInit.activePreset = activePreset;
    if (isManualMode !== null) stateInit.isManualMode = isManualMode;

    // If not in manual mode and a preset was resolved, apply its setpoint immediately
    // so the gauge shows the correct temperature without waiting for getDeviceData
    if (!isManualMode && activePreset && activePreset !== 'off') {
      const presets = this.getPresets();
      const presetObj = presets.find(p => p.key === activePreset);
      if (presetObj && presetObj.temp !== null && presetObj.temp !== undefined) {
        stateInit.setpoint = presetObj.temp;
        this._scheduleSetpointSet = true;
      }
    }

    // Restore manual mode state from DB (server is the source of truth)
    if (isManualMode === true) {
      const { box } = this.props;
      if (box.thermostat_feature) {
        const key = box.thermostat_feature.toUpperCase().replace(/-/g, '_');
        try {
          // Restore manual until for UI countdown display
          const untilResp = await this.props.httpClient.get(`/api/v1/variable/THERMOSTAT_${key}_MANUAL_UNTIL`);
          if (untilResp && untilResp.value) {
            const until = parseInt(untilResp.value, 10);
            if (until > Date.now()) stateInit.manualUntil = until;
          }
          // Restore manual setpoint
          const spResp = await this.props.httpClient.get(`/api/v1/variable/THERMOSTAT_${key}_MANUAL_SETPOINT`);
          if (spResp && spResp.value) {
            const parsed = JSON.parse(spResp.value);
            if (parsed && parsed.setpoint !== null && !isNaN(parsed.setpoint)) {
              stateInit.setpoint = parsed.setpoint;
              if (parsed.override) stateInit.manualSetpointOverride = true;
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Commit everything atomically and wait for the state to be applied
    if (Object.keys(stateInit).length > 0) {
      await new Promise(resolve => this.setState(stateInit, resolve));
    }
    // Read current switch state so we don't trigger a spurious on/off at startup
    const cfg = this.getConfig();
    if (cfg.switch_feature) {
      try {
        const devices = await this.props.httpClient.get('/api/v1/device', {
          device_feature_selectors: cfg.switch_feature
        });
        if (devices && devices.length) {
          for (const d of devices) {
            const feat = d.features.find(f => f.selector === cfg.switch_feature);
            if (feat && feat.last_value !== null && feat.last_value !== undefined) {
              this.lastSwitchActive = feat.last_value === 1 || feat.last_value === true;
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    await this.getDeviceData();
    await this.loadSchedule();
    // Sync lastSwitchActive with computed state after full load, without sending any command.
    // This prevents componentDidUpdate from seeing a mismatch on the first render after init.
    this.lastSwitchActive = this.computeIsActive();
    this._initialized = true;
  };


  componentDidMount() {
    this.initData();
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.handleWebsocketMessage);
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.CONFIG_UPDATED, this.handleThermostatConfigUpdated);
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.PRESET_UPDATED, this.handleThermostatPresetUpdated);
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.MANUAL_MODE_UPDATED, this.handleThermostatManualModeUpdated);
    this.props.session.dispatcher.addListener('websocket.connected', this.handleWebsocketConnected);
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.handleWebsocketMessage);
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.CONFIG_UPDATED, this.handleThermostatConfigUpdated);
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.PRESET_UPDATED, this.handleThermostatPresetUpdated);
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.MANUAL_MODE_UPDATED, this.handleThermostatManualModeUpdated);
    this.props.session.dispatcher.removeListener('websocket.connected', this.handleWebsocketConnected);
  }

  componentDidUpdate(prevProps, prevState) {
    const { box } = this.props;
    if (
      prevProps.box.thermostat_feature !== box.thermostat_feature ||
      prevProps.box.temperature_feature !== box.temperature_feature ||
      prevProps.box.humidity_feature !== box.humidity_feature
    ) {
      this.getDeviceData();
      if (prevProps.box.thermostat_feature !== box.thermostat_feature) {
        this.loadMode();
      }
    }
    if (prevProps.box.schedule_selector !== box.schedule_selector) {
      this.loadConfig();
      this.loadSchedule();
    }
    // Re-persist config whenever any box param changes (switch, presets, hysteresis...)
    if (
      prevProps.box.switch_feature !== box.switch_feature ||
      prevProps.box.default_mode !== box.default_mode ||
      prevProps.box.preset_frost !== box.preset_frost ||
      prevProps.box.preset_away !== box.preset_away ||
      prevProps.box.preset_eco !== box.preset_eco ||
      prevProps.box.preset_night !== box.preset_night ||
      prevProps.box.preset_comfort !== box.preset_comfort ||
      prevProps.box.hysteresis_start !== box.hysteresis_start ||
      prevProps.box.hysteresis_stop !== box.hysteresis_stop
    ) {
      this.loadConfig();
    }
    // Detect isActive changes and actuate the switch — only after full init
    if (!this._initialized) return;
    const { setpoint, currentTemp, activePreset, remoteConfig } = this.state;
    const relevantChanged =
      prevState.setpoint !== setpoint ||
      prevState.currentTemp !== currentTemp ||
      prevState.activePreset !== activePreset ||
      prevState.remoteConfig !== remoteConfig ||
      prevProps.box !== box;
    if (relevantChanged) {
      // When a schedule is active, the server (applySchedules every minute) handles
      // switch actuation. Only drive the switch from the front when there is no schedule.
      const hasSchedule = !!this.props.box.schedule_selector;
      if (!hasSchedule) {
        const newActive = this.computeIsActive();
        if (newActive !== this.lastSwitchActive) {
          this.lastSwitchActive = newActive;
          this.sendSwitch(newActive);
        }
      }
    }
  }

  sendSetpoint = async value => {
    const { box } = this.props;
    if (!box.thermostat_feature) return;
    try {
      await this.props.httpClient.post(`/api/v1/service/thermostat/setpoint/${box.thermostat_feature}`, { value });
    } catch (e) {
      console.error(e);
    }
  };

  applyManualSwitch = (newSetpoint) => {
    const { currentTemp, activePreset } = this.state;
    const cfg = this.getConfig();
    if (!cfg.switch_feature) {
      return;
    }
    const mode = (activePreset === 'off') ? 'off' : (cfg.default_mode || 'heating');
    if (mode === 'off') {
      this.sendSwitch(false);
      return;
    }
    if (currentTemp === null || currentTemp === undefined) {
      return;
    }
    const hystStart = Number(cfg.hysteresis_start) || 0.5;
    const hystStop = Number(cfg.hysteresis_stop) || 0.5;
    let shouldBeActive = this.lastSwitchActive;
    if (mode === 'heating') {
      if (currentTemp < newSetpoint - hystStart) {
        shouldBeActive = true;
      } else if (currentTemp > newSetpoint + hystStop) {
        shouldBeActive = false;
      }
    } else if (currentTemp > newSetpoint + hystStart) {
      shouldBeActive = true;
    } else if (currentTemp < newSetpoint - hystStop) {
      shouldBeActive = false;
    }
    if (shouldBeActive !== this.lastSwitchActive) {
      this.lastSwitchActive = shouldBeActive;
      this.sendSwitch(shouldBeActive);
    }
  };

  sendSwitch = async active => {
    const cfg = this.getConfig();
    if (!cfg.switch_feature) return;
    try {
      await this.props.httpClient.post(`/api/v1/device_feature/${cfg.switch_feature}/value`, { value: active ? 1 : 0 });
    } catch (e) {
      console.error(e);
    }
  };

  computeIsActive = () => {
    const { setpoint, currentTemp, activePreset, remoteConfig } = this.state;
    const cfg = { ...this.props.box, ...(remoteConfig || {}) };
    const configMode = cfg.default_mode || 'heating';
    const mode = activePreset === 'off' ? 'off' : configMode;
    const hystStart = Number(cfg.hysteresis_start) || 0.5;
    const hystStop = Number(cfg.hysteresis_stop) || 0.5;
    const hasCurrent = currentTemp !== null && currentTemp !== undefined;
    const isActive = mode === 'heating'
      ? (hasCurrent && currentTemp < setpoint - hystStart)
      : mode === 'cooling'
        ? (hasCurrent && currentTemp > setpoint + hystStart)
        : false;
    const isStopped = mode === 'heating'
      ? (hasCurrent && currentTemp > setpoint + hystStop)
      : mode === 'cooling'
        ? (hasCurrent && currentTemp < setpoint - hystStop)
        : true;
    return isActive && !isStopped;
  };

  sendMode = async mode => {
    const { box } = this.props;
    if (!box.mode_feature) return;
    const modeValue = mode === 'heating' ? AC_MODE.HEATING : mode === 'cooling' ? AC_MODE.COOLING : AC_MODE.AUTO;
    try {
      await this.props.httpClient.post(`/api/v1/device_feature/${box.mode_feature}/value`, { value: modeValue });
    } catch (e) {
      console.error(e);
    }
  };

  angleToTemp = angleDeg => {
    const minTemp = this.getMinTemp();
    const maxTemp = this.getMaxTemp();
    let norm = ((angleDeg - ARC_START_ANGLE) % 360 + 360) % 360;
    // Dead zone: angles in the gap (ARC_DEGREES..360) map to nearest extreme
    if (norm > ARC_DEGREES) {
      norm = norm > ARC_DEGREES + (360 - ARC_DEGREES) / 2 ? 0 : ARC_DEGREES;
    }
    const temp = minTemp + (norm / ARC_DEGREES) * (maxTemp - minTemp);
    return Math.round(temp * 2) / 2;
  };

  getAngleFromPointer = (e, svgEl) => {
    const rect = svgEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * 220 - 110;
    const y = ((clientY - rect.top) / rect.height) * 220 - 110;
    let angle = (Math.atan2(x, -y) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    return angle;
  };

  isAngleInArc = angleDeg => {
    const norm = ((angleDeg - ARC_START_ANGLE) % 360 + 360) % 360;
    return norm <= ARC_DEGREES;
  };

  onPointerDown = e => {
    if (!this.svgRef) return;
    e.preventDefault();
    const angle = this.getAngleFromPointer(e, this.svgRef);
    if (!this.isAngleInArc(angle)) return;
    if (this.state.activePreset === 'off') {
      const lastPreset = this.getLastActivePreset();
      this.setState({ setpoint: this.angleToTemp(angle), isDragging: true, isManualMode: true, activePreset: lastPreset, manualSetpointOverride: true });
      this.savePreset(lastPreset);
    } else {
      this.setState({ setpoint: this.angleToTemp(angle), isDragging: true, isManualMode: true, manualSetpointOverride: true });
    }
    this.saveManualMode(true);
    let lastDragSetpoint = this.angleToTemp(angle);
    this._onMove = ev => {
      ev.preventDefault();
      const a = this.getAngleFromPointer(ev, this.svgRef);
      if (this.isAngleInArc(a)) {
        lastDragSetpoint = this.angleToTemp(a);
        this.setState({ setpoint: lastDragSetpoint, isManualMode: true, manualSetpointOverride: true });
        this.saveManualMode(true);
      }
    };
    this._onUp = () => {
      this.stopDrag();
      this.sendSetpoint(lastDragSetpoint);
      this.applyManualSwitch(lastDragSetpoint);
      this.saveManualSetpoint(lastDragSetpoint);
      if (this.props.box.schedule_selector) this.startManualTimer(lastDragSetpoint);
    };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('touchmove', this._onMove, { passive: false });
    window.addEventListener('touchend', this._onUp);
  };

  stopDrag = () => {
    if (this._onMove) window.removeEventListener('pointermove', this._onMove);
    if (this._onUp) window.removeEventListener('pointerup', this._onUp);
    if (this._onMove) window.removeEventListener('touchmove', this._onMove);
    if (this._onUp) window.removeEventListener('touchend', this._onUp);
    this.setState({ isDragging: false });
  };

  onPointerMove = e => {
    if (!this.state.isDragging) return;
    e.preventDefault();
    const rect = this.svgRef.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0) - centerX;
    const y = (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0) - centerY;
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = (angle + 360 - ARC_START_ANGLE) % 360;
    if (angle > ARC_DEGREES) {
      const distToStart = angle;
      const distToEnd = 360 - angle + ARC_DEGREES;
      if (distToStart < distToEnd && distToStart < 30) angle = 0;
      else if (distToEnd < 30) angle = ARC_DEGREES;
      else return;
    }
    const newSetpoint = this.getMinTemp() + (angle / ARC_DEGREES) * (this.getMaxTemp() - this.getMinTemp());
    const rounded = Math.round(newSetpoint * 2) / 2;
    this.setState({ setpoint: rounded });
  };

  increment = () => {
    const step = 0.5;
    const newSetpoint = Math.min(this.getMaxTemp(), this.state.setpoint + step);
    if (this.state.activePreset === 'off') {
      const lastPreset = this.getLastActivePreset();
      this.setState({ setpoint: newSetpoint, isManualMode: true, activePreset: lastPreset, manualSetpointOverride: true });
      this.savePreset(lastPreset);
    } else {
      this.setState({ setpoint: newSetpoint, isManualMode: true, manualSetpointOverride: true });
    }
    this.saveManualMode(true);
    this.saveManualSetpoint(newSetpoint);
    this.sendSetpoint(newSetpoint);
    this.applyManualSwitch(newSetpoint);
    if (this.props.box.schedule_selector) this.startManualTimer(newSetpoint);
  };

  decrement = () => {
    const step = 0.5;
    const newSetpoint = Math.max(this.getMinTemp(), this.state.setpoint - step);
    if (this.state.activePreset === 'off') {
      const lastPreset = this.getLastActivePreset();
      this.setState({ setpoint: newSetpoint, isManualMode: true, activePreset: lastPreset, manualSetpointOverride: true });
      this.savePreset(lastPreset);
    } else {
      this.setState({ setpoint: newSetpoint, isManualMode: true, manualSetpointOverride: true });
    }
    this.saveManualMode(true);
    this.saveManualSetpoint(newSetpoint);
    this.sendSetpoint(newSetpoint);
    this.applyManualSwitch(newSetpoint);
    if (this.props.box.schedule_selector) this.startManualTimer(newSetpoint);
  };

  selectPreset = async preset => {
    this.saveLastActivePreset(this.state.activePreset);
    const hasSchedule = !!this.props.box.schedule_selector;
    const newManual = hasSchedule;
    // Selecting a preset clears any manual temp override
    this.setState({ activePreset: preset.key, setpoint: preset.temp || this.state.setpoint, presetOpen: false, isManualMode: newManual, manualSetpointOverride: false });
    if (!newManual) this.clearManualSetpoint();
    await this.savePreset(preset.key);
    await this.saveManualMode(newManual);
    if (preset.temp !== null) {
      this.sendSetpoint(preset.temp);
    }
    if (hasSchedule) this.startManualTimer(preset.temp !== null ? preset.temp : this.state.setpoint);
  };

  togglePreset = () => {
    this.setState({ presetOpen: !this.state.presetOpen });
  };

  closePreset = e => {
    if (this.presetRef && !this.presetRef.contains(e.target)) {
      this.setState({ presetOpen: false });
    }
  };

  render(props, { setpoint, currentTemp, humidity, activePreset, error, noConfig, isManualMode, currentSlot, manualUntil, manualSetpointOverride, isWindowOpen }) {
    const cfg = this.getConfig();
    const minTemp = this.getMinTemp();
    const maxTemp = this.getMaxTemp();
    const configMode = cfg.default_mode || 'heating';
    const mode = activePreset === 'off' ? 'off' : configMode;
    const presets = this.getPresets();
    const hystStart = Number(cfg.hysteresis_start) || 0.5;
    const hystStop = Number(cfg.hysteresis_stop) || 0.5;
    const hasCurrent = currentTemp !== null && currentTemp !== undefined;
    const isActive = mode === 'heating'
      ? (hasCurrent && currentTemp < setpoint - hystStart)
      : mode === 'cooling'
        ? (hasCurrent && currentTemp > setpoint + hystStart)
        : false;
    const isStopped = mode === 'heating'
      ? (hasCurrent && currentTemp > setpoint + hystStop)
      : mode === 'cooling'
        ? (hasCurrent && currentTemp < setpoint - hystStop)
        : true;
    const showActive = !isWindowOpen && isActive && !isStopped;

    // Convert temperatures for display
    const displaySetpoint = this.toDisplayTemp(setpoint);
    const displayCurrentTemp = this.toDisplayTemp(currentTemp);
    const displayMinTemp = this.toDisplayTemp(minTemp);
    const displayMaxTemp = this.toDisplayTemp(maxTemp);
    const tempUnit = this.getTempUnit();

    return (
      <div class="card">
        {props.box.name && (
          <div class="card-header">
            <h3 class="card-title">{props.box.name}</h3>
          </div>
        )}
        <div class="card-body">
          {error && (
            <div class="alert alert-danger">
              <i class="fe fe-alert-triangle mr-2" />
              <Text id="dashboard.boxes.thermostat.error" />
            </div>
          )}
          {noConfig && (
            <div class="alert alert-warning">
              <i class="fe fe-alert-triangle mr-2" />
              <Text id="dashboard.boxes.thermostat.noConfig" />
            </div>
          )}
          {!error && !noConfig && setpoint !== null && (
            <div>
              <div class="d-flex justify-content-center mb-3">
                <div ref={el => (this.svgRef = el)} class={style.gaugeContainer}>
                  <CircularGauge
                    key={`gauge-${mode}`}
                    setpoint={displaySetpoint}
                    currentTemp={displayCurrentTemp}
                    humidity={humidity}
                    onPointerDown={this.onPointerDown}
                    onIncrement={this.increment}
                    onDecrement={this.decrement}
                    minTemp={displayMinTemp}
                    maxTemp={displayMaxTemp}
                    mode={mode}
                    isActive={showActive}
                    isWindowOpen={isWindowOpen}
                    tempUnit={tempUnit}
                  />
                </div>
              </div>

              {activePreset === null ? null : (() => {
                const hasSchedule = !!props.box.schedule_selector;
                if (hasSchedule) {
                  if (isManualMode && manualUntil) {
                    // Manual mode banner: fe-user + Manuel + until time + delete button
                    const untilDate = new Date(manualUntil);
                    const untilTime = `${String(untilDate.getHours()).padStart(2, '0')}:${String(untilDate.getMinutes()).padStart(2, '0')}`;
                    const t = props.intl && props.intl.dictionary && props.intl.dictionary.dashboard.boxes.thermostat;
                    const manualLabel = (t && t.manualMode) || '';
                    const manualUntilLabel = (t && t.manualUntil) || '';
                    const cancelLabel = (t && t.cancelManual) || '';
                    return (
                      <div class={style.manualBanner}>
                        <i class={`fe fe-user ${style.manualBannerIcon}`} />
                        <span class={style.manualBannerText}>
                          {manualLabel}
                          <span class={style.manualBannerUntil}>{' '}{manualUntilLabel}{' '}{untilTime}</span>
                        </span>
                        <button
                          class={style.manualBannerCancel}
                          onClick={this.cancelManualMode}
                          title={cancelLabel}
                        >
                          <i class="fe fe-x" />
                        </button>
                      </div>
                    );
                  }

                  // Planning mode banner: preset icon + name + slot end time
                  const knownPresetKeys = [...HEATING_PRESETS, ...COOLING_PRESETS];
                  const resolvedPresetKey = knownPresetKeys.includes(activePreset) ? activePreset : 'comfort';
                  const activePresetObj = presets.find(p => p.key === resolvedPresetKey) || presets.find(p => p.key === 'comfort') || presets[0];
                  const presetIcon = activePresetObj ? activePresetObj.icon : 'fe-power';
                  const i18nPresets = props.intl && props.intl.dictionary
                    && props.intl.dictionary.dashboard.boxes.thermostat.preset;
                  const presetName = i18nPresets && i18nPresets[resolvedPresetKey]
                    ? i18nPresets[resolvedPresetKey]
                    : resolvedPresetKey;
                  const bannerColor = this.getPresetColor(resolvedPresetKey);
                  const t2 = props.intl && props.intl.dictionary && props.intl.dictionary.dashboard.boxes.thermostat;
                  const untilLabel = (t2 && t2.scheduleUntil) || '';

                  return (
                    <div
                      class={style.scheduleBanner}
                      style={`--banner-color:${bannerColor}`}
                    >
                      <i class={`fe ${presetIcon} ${style.scheduleBannerIcon}`} />
                      <span class={style.scheduleBannerText}>
                        {presetName}
                        {currentSlot && currentSlot.end_time && (
                          <span class={style.scheduleBannerUntil}>
                            {' '}{untilLabel} {currentSlot.end_time.substring(0, 5)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                }

                // No schedule: always show full icon bar
                const resolvedActivePreset = [...HEATING_PRESETS, ...COOLING_PRESETS].includes(activePreset) ? activePreset : 'comfort';
                return (
                  <div class={style.segmentedControl}>
                    {presets.map(preset => {
                      const presetTitle = props.intl && props.intl.dictionary && props.intl.dictionary.dashboard
                        && props.intl.dictionary.dashboard.boxes && props.intl.dictionary.dashboard.boxes.thermostat
                        && props.intl.dictionary.dashboard.boxes.thermostat.preset
                        && props.intl.dictionary.dashboard.boxes.thermostat.preset[preset.key]
                        ? props.intl.dictionary.dashboard.boxes.thermostat.preset[preset.key]
                        : preset.key;
                      const isActive = resolvedActivePreset === preset.key && !manualSetpointOverride;
                      const presetColor = this.getPresetColor(preset.key);
                      return (
                        <button
                          key={preset.key}
                          class={`${style.segmentBtn} ${isActive ? style.segmentBtnActive : ''}`}
                          style={isActive ? `--preset-color:${presetColor}` : undefined}
                          onClick={() => this.selectPreset(preset)}
                          title={presetTitle}
                        >
                          <i class={`fe ${preset.icon}`} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          )}
        </div>
      </div>
    );
  }

}

export default connect('httpClient,session,user', {})(withIntlAsProp(ThermostatBox));
