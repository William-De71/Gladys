import { h, Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import cx from 'classnames';
import style from './style.css'; 

const ThermostatTpiBox = ({ loading, error, targetTemp, isHeating, currentMode, updateTemp, changeMode }) => {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (270 / 360) * circumference;
  const progress = Math.min(Math.max((targetTemp - 10) / 20, 0), 1) * strokeDash;
  
  // Calculate knob position based on temperature
  const angle = -135 + (progress / strokeDash) * 270; // Start from left, go 270 degrees
  const knobX = 100 + radius * Math.cos(angle * Math.PI / 180);
  const knobY = 100 + radius * Math.sin(angle * Math.PI / 180);

  return (
    <div class={style.thermostatCard}>
      <div class="card-body p-4">
        {error && (
          <div class="alert alert-danger mb-3">
            <Text id="dashboard.boxes.thermostatTpi.error" />
          </div>
        )}
        <div class={cx('dimmer', { active: loading })}>
          <div class="loader" />
          <div class="dimmer-content">
            {/* Circular Slider Container */}
            <div class={style.thermostatContainer}>
              <svg width="220" height="220" viewBox="0 0 220 220" class={style.svgRoot}>
                {/* Background arc */}
                <path
                  d={`M 30 100 A 90 90 0 1 1 30 100`}
                  fill="none"
                  stroke="#333333"
                  stroke-width="8"
                  stroke-linecap="round"
                />
                {/* Progress arc */}
                <path
                  d={`M 30 100 A 90 90 0 1 1 ${30 + progress * 2} 100`}
                  fill="none"
                  stroke="#FF6B35"
                  stroke-width="8"
                  stroke-linecap="round"
                />
                {/* Knob */}
                <circle
                  cx={knobX}
                  cy={knobY}
                  r="8"
                  fill="#FFFFFF"
                  class={style.knob}
                />
              </svg>

              {/* Central Display */}
              <div class={style.centralDisplay}>
                <div class={style.status}>
                  {isHeating ? 'Actif' : 'Inactif'}
                </div>
                <div class={style.temperatureMain}>
                  <span class={style.tempValue}>{Math.floor(targetTemp)}</span>
                  <span class={style.tempDecimal}>,0</span>
                  <span class={style.tempUnit}>°C</span>
                </div>
                
                {/* Quick Controls */}
                <div class={style.quickControls}>
                  <button 
                    class={style.quickButton}
                    onClick={() => updateTemp(-0.5)}
                  >
                    -
                  </button>
                  <button 
                    class={style.quickButton}
                    onClick={() => updateTemp(0.5)}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Circular Slider Input */}
              <input
                type="range"
                min="10"
                max="30"
                step="0.5"
                value={targetTemp}
                onInput={(e) => updateTemp(parseFloat(e.target.value) - targetTemp)}
                class={style.circularSliderInput}
              />
            </div>

            {/* Bottom Action Bar */}
            <div class={style.actionBar}>
              <button 
                class={cx(style.actionButton, currentMode === 1 && style.active)}
                onClick={() => changeMode(1)}
              >
                <i class="fe fe-flame mr-2" />
                Mode Chauffage
              </button>
              <button 
                class={cx(style.actionButton, currentMode === 0 && style.active)}
                onClick={() => changeMode(0)}
              >
                <i class="fe fe-thermometer mr-2" />
                Confort
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

class ThermostatTpi extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: false,
      targetTemp: 20,
      currentTemp: 0,
      currentMode: 0,
      isHeating: false
    };
  }

  componentDidMount() {
    this.refreshData();
    this.interval = setInterval(this.refreshData, 30000); // Refresh every 30 seconds
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  componentDidUpdate(prevProps) {
    // Refresh data when box configuration changes
    if (prevProps.box !== this.props.box) {
      this.refreshData();
    }
  }

  refreshData = async () => {
    try {
      const { box } = this.props;
      
      // Vérifier si on a des device features configurées
      if (!box.device_features || box.device_features.length === 0) {
        this.setState({ loading: false, error: false });
        return;
      }

      // Récupérer le device principal
      const deviceSelector = box.device_features[0].split(':')[0];
      const device = await this.props.httpClient.get(`/api/v1/device/${deviceSelector}`);
      
      if (!device) {
        this.setState({ error: true, loading: false });
        return;
      }

      // Récupérer la feature de température cible
      const targetFeature = device.features.find(f => f.category === 'thermostat');
      
      // Récupérer la feature de température actuelle
      let currentTempFeature = null;
      if (box.temperature_sensor) {
        try {
          currentTempFeature = await this.props.httpClient.get(`/api/v1/device_feature/${box.temperature_sensor}`);
        } catch (e) {
          // Si erreur, essayer de trouver dans le device principal
          currentTempFeature = device.features.find(f => f.category === 'temperature-sensor');
        }
      } else {
        currentTempFeature = device.features.find(f => f.category === 'temperature-sensor');
      }
      
      // Récupérer les autres features
      const modeFeature = device.features.find(f => f.type === 'mode');
      const stateFeature = device.features.find(f => f.type === 'binary');

      this.setState({
        targetTemp: (targetFeature && targetFeature.last_value !== undefined) ? targetFeature.last_value : 20,
        currentTemp: (currentTempFeature && currentTempFeature.last_value !== undefined) ? currentTempFeature.last_value : 0,
        currentMode: (modeFeature && modeFeature.last_value !== undefined) ? modeFeature.last_value : 0,
        isHeating: stateFeature && stateFeature.last_value === 1,
        loading: false,
        error: false
      });
    } catch (e) {
      this.setState({ error: true, loading: false });
    }
  };

  updateTemp = async (delta) => {
    const newTemp = this.state.targetTemp + delta;
    this.setState({ targetTemp: newTemp });
    
    if (this.props.box.device_features && this.props.box.device_features.length > 0) {
      const featureSelector = this.props.box.device_features[0];
      await this.props.httpClient.post(`/api/v1/device_feature/${featureSelector}/value`, { value: newTemp });
    }
  };

  changeMode = async (mode) => {
    this.setState({ currentMode: mode });
    
    // Trouver le device pour récupérer la feature de mode
    if (this.props.box.device_features && this.props.box.device_features.length > 0) {
      const deviceSelector = this.props.box.device_features[0].split(':')[0];
      try {
        const device = await this.props.httpClient.get(`/api/v1/device/${deviceSelector}`);
        const modeFeature = device.features.find(f => f.type === 'mode');
        if (modeFeature) {
          await this.props.httpClient.post(`/api/v1/device_feature/${modeFeature.selector}/value`, { value: mode });
        }
      } catch (e) {
        console.error('Error changing mode:', e);
      }
    }
  };

  render(props, state) {
    return (
      <ThermostatTpiBox
        {...state}
        box={props.box}
        updateTemp={this.updateTemp}
        changeMode={this.changeMode}
      />
    );
  }
}

export default connect('httpClient,user', {})(ThermostatTpi);




































/*

const ThermostatTpi = ({ children, ...props }) => {
  // Récupération des données depuis props.box (passées par Gladys)
  const device = props.box.device;
  const targetFeature = device?.features.find(f => f.category === 'thermostat-setpoint');
  const tempFeature = device?.features.find(f => f.category === 'temperature-sensor');
  
  const [targetTemp, setTargetTemp] = useState(targetFeature?.last_value || 20);

  // Calcul du cercle SVG
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (270 / 360) * circumference;

  const updateTemp = (val) => {
    const newTemp = Math.round((targetTemp + val) * 2) / 2;
    setTargetTemp(newTemp);
    // Appel API Gladys pour changer la valeur
    props.httpClient.post(`/api/v1/device_feature/${targetFeature.selector}/value`, { value: newTemp });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{props.box.name || <Text id="dashboard.boxes.thermostat.title" />}</h3>
      </div>
      <div className="card-body py-5">
        <div className="d-flex justify-content-center align-items-center position-relative">
          
          // Anneau Thermostat 
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#2d3436" strokeWidth="12" 
              strokeDasharray={`${strokeDash} ${circumference}`} 
              strokeLinecap="round"
              style={{ transform: 'rotate(135deg)', transformOrigin: '50% 50%' }} />
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#e74c3c" strokeWidth="12" 
              strokeDasharray={`${(targetTemp/30) * strokeDash} ${circumference}`} 
              strokeLinecap="round"
              style={{ transform: 'rotate(135deg)', transformOrigin: '50% 50%', transition: 'all 0.4s' }} />
          </svg>

          // Température au centre
          <div className="position-absolute text-center">
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{targetTemp.toFixed(1)}°</div>
            <div className="text-muted">{tempFeature?.last_value.toFixed(1)}°C actuel</div>
          </div>

          // Boutons +/- 
          <div className="d-flex flex-column ml-4">
            <button className="btn btn-outline-secondary btn-sm mb-2" onClick={() => updateTemp(0.5)}>+</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => updateTemp(-0.5)}>-</button>
          </div>
        </div>

        Barre des modes (Icônes) 
        <div className="d-flex justify-content-around mt-4">
          <i className="fe fe-hand text-warning" style={{ fontSize: '1.2rem' }} />
          <i className="fe fe-leaf text-muted" style={{ fontSize: '1.2rem' }} />
          <i className="fe fe-home text-muted" style={{ fontSize: '1.2rem' }} />
          <i className="fe fe-zap text-muted" style={{ fontSize: '1.2rem' }} />
        </div>
      </div>
    </div>
  );
};

export default ThermostatTpi;

*/