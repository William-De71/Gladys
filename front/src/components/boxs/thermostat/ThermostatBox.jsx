import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import { WEBSOCKET_MESSAGE_TYPES, AC_MODE } from '../../../../../server/utils/constants';
import withIntlAsProp from '../../../utils/withIntlAsProp';
import style from './style.css';

const DEFAULT_MIN = 5;
const DEFAULT_MAX = 35;
const ARC_DEGREES = 240;
const ARC_START_ANGLE = 150;
const DEFAULT_PRESET_TEMPS = { off: null, frost: 7, away: 16, comfort: 21, eco: 18, night: 17 };
const PRESET_ICONS = { off: 'fe-power', frost: 'fe-cloud-snow', away: 'fe-user-x', comfort: 'fe-sun', eco: 'fe-feather', night: 'fe-moon' };
const HEATING_PRESETS = ['off', 'frost', 'away', 'eco', 'night', 'comfort'];
const COOLING_PRESETS = ['off', 'comfort'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const CircularGauge = ({ setpoint, currentTemp, humidity, onPointerDown, onIncrement, onDecrement, minTemp, maxTemp, mode, isActive, isManualMode }) => {
  const cx = 110;
  const cy = 110;
  const r = 88;
  const sw = 11;
  const pct = Math.min(1, Math.max(0, (setpoint - minTemp) / (maxTemp - minTemp)));
  const arcEnd = ARC_START_ANGLE + pct * ARC_DEGREES;
  const bgPath = describeArc(cx, cy, r, ARC_START_ANGLE, ARC_START_ANGLE + ARC_DEGREES);
  const fgPath = pct > 0 ? describeArc(cx, cy, r, ARC_START_ANGLE, arcEnd) : null;
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
      {fgPath && (
        <path 
          d={fgPath} 
          fill="none" 
          stroke={arcColor} 
          strokeWidth={sw} 
          strokeLinecap="round"
          filter={isActive ? 'url(#arcGlow)' : 'none'}
        />
      )}
      <circle cx={knob.x} cy={knob.y} r="9" fill="white" stroke={arcColor} strokeWidth="2.5" />

      {/* Current temp + humidity: above setpoint */}
      {hasCurrentTemp && (
        <text x={cx} y={hasHumidity ? cy - 46 : cy - 38} textAnchor="middle" dominantBaseline="middle" class={style.currentTempText}>
          {Number(currentTemp).toFixed(1)} °C
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
      <text x={suffixX + 4} y={cy + 4} textAnchor="start" dominantBaseline="auto" class={style.tempUnit}>C</text>

      {/* Active icon: at bottom of gauge */}
      {isActive && mode === 'heating' && (
        <text x={cx} y={cy + 54} textAnchor="middle" dominantBaseline="middle" class={style.activeIconHeating}>🔥</text>
      )}
      {isActive && mode === 'cooling' && (
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
      
      {/* Manual mode indicator icon between +/- buttons */}
      {isManualMode && (
        <g class={style.manualModeIcon}>
          <circle cx="180" cy="110" r="2" fill="#ffc107" />
          <circle cx="180" cy="110" r="8" fill="none" stroke="#ffc107" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
};

class ThermostatBox extends Component {
  state = {
    setpoint: 21.0,
    currentTemp: null,
    humidity: null,
    presetOpen: false,
    activePreset: 'comfort',
    error: false,
    noConfig: false
  };

  svgRef = null;
  presetRef = null;

  getMinTemp = () => Number(this.props.box.temp_min) || DEFAULT_MIN;
  getMaxTemp = () => Number(this.props.box.temp_max) || DEFAULT_MAX;

  getStorageKey = suffix => `thermostat_${suffix}_${this.props.box.thermostat_feature || 'default'}`;

  loadMode = () => {
    try {
      const savedPreset = localStorage.getItem(this.getStorageKey('preset'));
      if (savedPreset) this.setState({ activePreset: savedPreset });
      const savedManualMode = localStorage.getItem(this.getStorageKey('manual_mode'));
      if (savedManualMode === 'true') this.setState({ isManualMode: true });
    } catch (e) { /* ignore */ }
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

  savePreset = preset => {
    try {
      localStorage.setItem(this.getStorageKey('preset'), preset);
    } catch (e) { /* ignore */ }
  };

  saveManualMode = isManual => {
    try {
      localStorage.setItem(this.getStorageKey('manual_mode'), isManual.toString());
    } catch (e) { /* ignore */ }
  };

  getPresets = () => {
    const { box } = this.props;
    const mode = box.default_mode || 'heating';
    const keys = mode === 'cooling' ? COOLING_PRESETS : HEATING_PRESETS;
    const comfortIcon = mode === 'cooling' ? 'fe-cloud-snow' : 'fe-thermometer';
    const allPresets = {
      off: { key: 'off', icon: PRESET_ICONS.off, temp: null },
      frost: { key: 'frost', icon: PRESET_ICONS.frost, temp: Number(box.preset_frost) || DEFAULT_PRESET_TEMPS.frost },
      away: { key: 'away', icon: PRESET_ICONS.away, temp: Number(box.preset_away) || DEFAULT_PRESET_TEMPS.away },
      comfort: { key: 'comfort', icon: comfortIcon, temp: Number(box.preset_comfort) || DEFAULT_PRESET_TEMPS.comfort },
      eco: { key: 'eco', icon: PRESET_ICONS.eco, temp: Number(box.preset_eco) || DEFAULT_PRESET_TEMPS.eco },
      night: { key: 'night', icon: PRESET_ICONS.night, temp: Number(box.preset_night) || DEFAULT_PRESET_TEMPS.night }
    };
    return keys.map(k => allPresets[k]);
  };

  getDeviceData = async () => {
    const { box } = this.props;
    if (!box.thermostat_feature && !box.temperature_feature) {
      this.setState({ noConfig: true });
      return;
    }
    this.setState({ noConfig: false, error: false });
    try {
      const selectors = [box.thermostat_feature, box.temperature_feature, box.humidity_feature]
        .filter(Boolean)
        .join(',');
      const devices = await this.props.httpClient.get('/api/v1/device', {
        device_feature_selectors: selectors
      });
      if (devices && devices.length) {
        devices.forEach(device => {
          device.features.forEach(feat => {
            if (feat.selector === box.thermostat_feature && feat.last_value !== null && feat.last_value !== undefined) {
              this.setState({ setpoint: feat.last_value });
            }
            if (feat.selector === box.temperature_feature && feat.last_value !== null && feat.last_value !== undefined) {
              this.setState({ currentTemp: feat.last_value });
            }
            if (feat.selector === box.humidity_feature && feat.last_value !== null && feat.last_value !== undefined) {
              this.setState({ humidity: feat.last_value });
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
    if (box.thermostat_feature && payload.device_feature_selector === box.thermostat_feature) {
      this.setState({ setpoint: payload.last_value });
    }
    if (box.temperature_feature && payload.device_feature_selector === box.temperature_feature) {
      this.setState({ currentTemp: payload.last_value });
    }
    if (box.humidity_feature && payload.device_feature_selector === box.humidity_feature) {
      this.setState({ humidity: payload.last_value });
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

  componentDidMount() {
    this.loadMode();
    this.getDeviceData();
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.handleWebsocketMessage);
    this.props.session.dispatcher.addListener('websocket.connected', this.handleWebsocketConnected);
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.handleWebsocketMessage);
    this.props.session.dispatcher.removeListener('websocket.connected', this.handleWebsocketConnected);
  }

  componentDidUpdate(prevProps) {
    const { box } = this.props;
    if (
      prevProps.box.thermostat_feature !== box.thermostat_feature ||
      prevProps.box.temperature_feature !== box.temperature_feature ||
      prevProps.box.humidity_feature !== box.humidity_feature
    ) {
      this.getDeviceData();
    }
  }

  sendSetpoint = async value => {
    const { box } = this.props;
    if (!box.thermostat_feature) return;
    try {
      await this.props.httpClient.post(`/api/v1/device_feature/${box.thermostat_feature}/value`, { value });
    } catch (e) {
      console.error(e);
    }
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
      this.setState({ setpoint: this.angleToTemp(angle), isDragging: true, isManualMode: true, activePreset: lastPreset });
      this.savePreset(lastPreset);
    } else {
      this.setState({ setpoint: this.angleToTemp(angle), isDragging: true, isManualMode: true });
    }
    this.saveManualMode(true);
    this._onMove = ev => {
      ev.preventDefault();
      const a = this.getAngleFromPointer(ev, this.svgRef);
      if (this.isAngleInArc(a)) {
        this.setState({ setpoint: this.angleToTemp(a), isManualMode: true });
        this.saveManualMode(true);
      }
    };
    this._onUp = () => {
      this.stopDrag();
      this.sendSetpoint(this.state.setpoint);
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
    const newSetpoint = Math.min(this.getMaxTemp(), this.state.setpoint + 0.5);
    if (this.state.activePreset === 'off') {
      const lastPreset = this.getLastActivePreset();
      this.setState({ setpoint: newSetpoint, isManualMode: true, activePreset: lastPreset });
      this.savePreset(lastPreset);
    } else {
      this.setState({ setpoint: newSetpoint, isManualMode: true });
    }
    this.saveManualMode(true);
    this.sendSetpoint(newSetpoint);
  };

  decrement = () => {
    const newSetpoint = Math.max(this.getMinTemp(), this.state.setpoint - 0.5);
    if (this.state.activePreset === 'off') {
      const lastPreset = this.getLastActivePreset();
      this.setState({ setpoint: newSetpoint, isManualMode: true, activePreset: lastPreset });
      this.savePreset(lastPreset);
    } else {
      this.setState({ setpoint: newSetpoint, isManualMode: true });
    }
    this.saveManualMode(true);
    this.sendSetpoint(newSetpoint);
  };

  selectPreset = preset => {
    this.saveLastActivePreset(this.state.activePreset);
    this.setState({ activePreset: preset.key, setpoint: preset.temp || this.state.setpoint, presetOpen: false, isManualMode: false });
    this.savePreset(preset.key);
    this.saveManualMode(false);
    if (preset.temp !== null) {
      this.sendSetpoint(preset.temp);
    }
  };

  togglePreset = () => {
    this.setState({ presetOpen: !this.state.presetOpen });
  };

  closePreset = e => {
    if (this.presetRef && !this.presetRef.contains(e.target)) {
      this.setState({ presetOpen: false });
    }
  };

  render(props, { setpoint, currentTemp, humidity, activePreset, presetOpen, error, noConfig, isManualMode }) {
    const minTemp = this.getMinTemp();
    const maxTemp = this.getMaxTemp();
    const configMode = props.box.default_mode || 'heating';
    const mode = activePreset === 'off' ? 'off' : configMode;
    const presets = this.getPresets();
    const hystStart = Number(props.box.hysteresis_start) || 0.5;
    const hystStop = Number(props.box.hysteresis_stop) || 0.5;
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
    const showActive = isActive && !isStopped;

    return (
      <div class="card">
        {props.box.name && (
          <div class="card-header">
            <h3 class="card-title">
              <i class="fe fe-thermometer mr-2" />
              {props.box.name}
            </h3>
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
          {!error && !noConfig && (
            <div>
              <div class="d-flex justify-content-center mb-3">
                <div ref={el => (this.svgRef = el)} class={style.gaugeContainer}>
                  <CircularGauge
                    setpoint={setpoint}
                    currentTemp={currentTemp}
                    humidity={humidity}
                    onPointerDown={this.onPointerDown}
                    onIncrement={this.increment}
                    onDecrement={this.decrement}
                    minTemp={minTemp}
                    maxTemp={maxTemp}
                    mode={mode}
                    isActive={showActive}
                    isManualMode={isManualMode}
                  />
                </div>
              </div>

              <div class={style.segmentedControl}>
                {presets.map(preset => {
                  const presetTitle = props.intl && props.intl.dictionary && props.intl.dictionary.dashboard 
                    && props.intl.dictionary.dashboard.boxes && props.intl.dictionary.dashboard.boxes.thermostat
                    && props.intl.dictionary.dashboard.boxes.thermostat.preset
                    && props.intl.dictionary.dashboard.boxes.thermostat.preset[preset.key]
                    ? props.intl.dictionary.dashboard.boxes.thermostat.preset[preset.key]
                    : preset.key;
                  return (
                    <button
                      key={preset.key}
                      class={`${style.segmentBtn} ${activePreset === preset.key ? style.segmentBtnActive : ''} ${style[`segmentBtn_${preset.key === 'comfort' ? `comfort_${configMode}` : preset.key}`] || ''}`}
                      onClick={() => this.selectPreset(preset)}
                      title={presetTitle}
                    >
                      <i class={`fe ${preset.icon}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

}

export default connect('httpClient,session', {})(withIntlAsProp(ThermostatBox));
