import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../server/utils/constants';
import withIntlAsProp from '../../../utils/withIntlAsProp';
import style from './style.css';

const DEFAULT_MIN = 5;
const DEFAULT_MAX = 35;
const ARC_DEGREES = 240;
const ARC_START_ANGLE = 150;
const DEFAULT_PRESET_TEMPS = { off: null, frost: 7, away: 16, comfort: 21, eco: 18, night: 17 };
const PRESET_ICONS = { off: 'fe-power', frost: 'fe-cloud-snow', away: 'fe-user-x', comfort: 'fe-sun', eco: 'fe-feather', night: 'fe-moon' };

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

const CircularGauge = ({ setpoint, currentTemp, humidity, onPointerDown, minTemp, maxTemp, mode, isActive }) => {
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
      <path d={bgPath} fill="none" stroke="#e9ecef" strokeWidth={sw} strokeLinecap="round" />
      {fgPath && <path d={fgPath} fill="none" stroke={arcColor} strokeWidth={sw} strokeLinecap="round" />}
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

      {/* Setpoint: integer + decimal superscript + unit, precisely positioned */}
      <text x={intX} y={cy + 22} textAnchor="start" dominantBaseline="auto" class={style.tempMain}>{intPart}</text>
      <text x={suffixX} y={cy + 4} textAnchor="start" dominantBaseline="auto" class={style.tempDecimal}>,{decPart}</text>
      <text x={suffixX} y={cy + 22} textAnchor="start" dominantBaseline="auto" class={style.tempUnit}>°C</text>

      {/* Active icon: at bottom of gauge */}
      {isActive && mode === 'heating' && (
        <text x={cx} y={cy + 54} textAnchor="middle" dominantBaseline="middle" class={style.activeIconHeating}>🔥</text>
      )}
      {isActive && mode === 'cooling' && (
        <text x={cx} y={cy + 54} textAnchor="middle" dominantBaseline="middle" class={style.activeIconCooling}>❄️</text>
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
    mode: 'off',
    error: false,
    noConfig: false
  };

  svgRef = null;

  getMinTemp = () => Number(this.props.box.temp_min) || DEFAULT_MIN;
  getMaxTemp = () => Number(this.props.box.temp_max) || DEFAULT_MAX;

  getPresets = () => {
    const { box } = this.props;
    return [
      { key: 'off', icon: PRESET_ICONS.off, temp: null },
      { key: 'frost', icon: PRESET_ICONS.frost, temp: Number(box.preset_frost) || DEFAULT_PRESET_TEMPS.frost },
      { key: 'away', icon: PRESET_ICONS.away, temp: Number(box.preset_away) || DEFAULT_PRESET_TEMPS.away },
      { key: 'comfort', icon: PRESET_ICONS.comfort, temp: Number(box.preset_comfort) || DEFAULT_PRESET_TEMPS.comfort },
      { key: 'eco', icon: PRESET_ICONS.eco, temp: Number(box.preset_eco) || DEFAULT_PRESET_TEMPS.eco },
      { key: 'night', icon: PRESET_ICONS.night, temp: Number(box.preset_night) || DEFAULT_PRESET_TEMPS.night }
    ];
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
    this.getDeviceData();
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.handleWebsocketMessage);
    this.props.session.dispatcher.addListener('websocket.connected', this.handleWebsocketConnected);
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.handleWebsocketMessage);
    this.props.session.dispatcher.removeListener('websocket.connected', this.handleWebsocketConnected);
    this.stopDrag();
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
    this.setState({ setpoint: this.angleToTemp(angle) });
    this._onMove = ev => {
      ev.preventDefault();
      const a = this.getAngleFromPointer(ev, this.svgRef);
      if (this.isAngleInArc(a)) {
        this.setState({ setpoint: this.angleToTemp(a) });
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
  };

  increment = () => {
    const newVal = Math.min(this.getMaxTemp(), Math.round((this.state.setpoint + 0.5) * 2) / 2);
    this.setState({ setpoint: newVal });
    this.sendSetpoint(newVal);
  };

  decrement = () => {
    const newVal = Math.max(this.getMinTemp(), Math.round((this.state.setpoint - 0.5) * 2) / 2);
    this.setState({ setpoint: newVal });
    this.sendSetpoint(newVal);
  };

  togglePresetMenu = e => {
    e.stopPropagation();
    this.setState(s => ({ presetOpen: !s.presetOpen }));
  };

  selectPreset = preset => {
    if (preset.key === 'off') {
      this.setState({ activePreset: 'off', presetOpen: false, mode: 'off' });
    } else {
      this.setState({ activePreset: preset.key, setpoint: preset.temp, presetOpen: false });
      this.sendSetpoint(preset.temp);
    }
  };

  cycleActiveMode = () => {
    this.setState(s => {
      const next = s.mode === 'heating' ? 'cooling' : 'heating';
      return { mode: next };
    });
  };

  render(props, { setpoint, currentTemp, humidity, presetOpen, activePreset, mode, error, noConfig }) {
    const minTemp = this.getMinTemp();
    const maxTemp = this.getMaxTemp();
    const presets = this.getPresets();
    const activePresetData = presets.find(p => p.key === activePreset) || presets[1];
    const isActive = mode === 'heating'
      ? (currentTemp !== null && currentTemp !== undefined && currentTemp < setpoint)
      : mode === 'cooling'
        ? (currentTemp !== null && currentTemp !== undefined && currentTemp > setpoint)
        : false;

    const modeBtnClass = mode === 'heating' ? 'btn-warning' : mode === 'cooling' ? 'btn-info' : 'btn-outline-warning';
    const modeIcon = mode === 'cooling' ? 'fe-wind' : 'fe-thermometer';
    const modeKey = mode === 'cooling' ? 'dashboard.boxes.thermostat.modeCooling' : 'dashboard.boxes.thermostat.modeHeating';

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
              <div class="d-flex justify-content-center">
                <div ref={el => (this.svgRef = el)} class={style.gaugeContainer}>
                  <CircularGauge
                    setpoint={setpoint}
                    currentTemp={currentTemp}
                    humidity={humidity}
                    onPointerDown={this.onPointerDown}
                    minTemp={minTemp}
                    maxTemp={maxTemp}
                    mode={mode}
                    isActive={isActive}
                  />
                </div>
              </div>

              <div class="d-flex justify-content-center mb-3">
                <button class="btn btn-outline-secondary btn-sm mr-3" onClick={this.decrement}>
                  <i class="fe fe-minus" />
                </button>
                <button class="btn btn-outline-secondary btn-sm" onClick={this.increment}>
                  <i class="fe fe-plus" />
                </button>
              </div>

              <div class="row">
                <div class="col-6">
                  <button class={`btn btn-block ${modeBtnClass}`} onClick={this.cycleActiveMode}>
                    <div class="pb-1">
                      <i class={`fe ${modeIcon} ${style.modeIcon}`} />
                    </div>
                    <div><Text id={modeKey} /></div>
                  </button>
                </div>

                <div class="col-6">
                  <div class={style.presetWrapper}>
                    <button
                      class={`btn btn-block ${activePreset === 'comfort' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={this.togglePresetMenu}
                    >
                      <div class="pb-1">
                        <i class={`fe ${activePresetData.icon} ${style.modeIcon}`} />
                      </div>
                      <div><Text id={`dashboard.boxes.thermostat.preset.${activePreset}`} /></div>
                    </button>

                    {presetOpen && (
                      <div class={style.presetMenu}>
                        {presets.map(preset => (
                          <button
                            key={preset.key}
                            class={`${style.presetItem} ${activePreset === preset.key ? style.presetItemActive : ''}`}
                            onClick={() => this.selectPreset(preset)}
                          >
                            <i class={`fe ${preset.icon} mr-2`} />
                            <span class={style.presetLabel}>
                              <Text id={`dashboard.boxes.thermostat.preset.${preset.key}`} />
                            </span>
                            {preset.temp !== null && (
                              <span class={style.presetTemp}>{preset.temp}°</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default connect('httpClient,session', {})(withIntlAsProp(ThermostatBox));
