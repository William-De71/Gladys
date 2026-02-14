import { h, Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import cx from 'classnames';
import style from './style.css'; 

const ModeIcon = ({ active, icon, onClick, colorClass }) => (
  <i
    className={cx(`fe fe-${icon}`, style.modeIcon, {
      [style.modeActive]: active,
      [colorClass]: active
    })}
    onClick={onClick}
  />
);

const ThermostatTpiBox = ({ loading, error, box, targetTemp, currentTemp, isHeating, currentMode, updateTemp, changeMode }) => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (270 / 360) * circumference;
  const progress = Math.min(Math.max((targetTemp - 10) / 20, 0), 1) * strokeDash;

  return (
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">
          <i class="fe fe-thermometer mr-2" />
          {box.name}
        </h3>
      </div>
      <div class="card-body">
        <div class={cx('dimmer', { active: loading })}>
          <div class="loader" />
          {error && (
            <p class="alert alert-danger">
              <Text id="dashboard.boxes.thermostatTpi.error" />
            </p>
          )}
          {!error && (
            <div class="dimmer-content">
              {/* Cercle et Températures */}
              <div class={style.thermostatContainer}>
                <svg width="200" height="200" viewBox="0 0 200 200" class={style.svgRoot}>
                  <circle cx="100" cy="100" r={radius} class={style.circleTrack} 
                    stroke-dasharray={`${strokeDash} ${circumference}`} />
                  <circle cx="100" cy="100" r={radius} class={style.circleProgress} 
                    stroke-dasharray={`${progress} ${circumference}`}
                    stroke={isHeating ? '#e74c3c' : '#555'} />
                </svg>

                <div class={style.infoCenter}>
                  <div class={style.targetTempDisplay}>{targetTemp.toFixed(1)}°</div>
                  <div class={style.currentTempDisplay}>
                    {currentTemp.toFixed(1)}°C <i class="fe fe-wind" />
                  </div>
                  <div class="mt-2">
                    <i class={cx('fe fe-flame mr-2', { 'text-danger': isHeating, 'text-muted': !isHeating })} />
                  </div>
                </div>

                <div class={style.sideButtons}>
                  <button class="btn btn-outline-secondary btn-sm" onClick={() => updateTemp(0.5)}>+</button>
                  <button class="btn btn-outline-secondary btn-sm" onClick={() => updateTemp(-0.5)}>-</button>
                </div>
              </div>

              {/* Sélecteur de mode */}
              <div class="d-flex justify-content-around mt-4 pt-3 border-top">
                <ModeIcon icon="hand" active={currentMode === 0} onClick={() => changeMode(0)} colorClass="text-warning" />
                <ModeIcon icon="leaf" active={currentMode === 1} onClick={() => changeMode(1)} colorClass="text-success" />
                <ModeIcon icon="home" active={currentMode === 2} onClick={() => changeMode(2)} colorClass="text-primary" />
                <ModeIcon icon="zap" active={currentMode === 3} onClick={() => changeMode(3)} colorClass="text-danger" />
              </div>
            </div>
          )}
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

  refreshData = async () => {
    try {
      const { box } = this.props;
      if (box.device_features && box.device_features.length > 0) {
        // Récupérer le device complet depuis l'API
        const deviceSelectors = box.device_features.map(feature => feature.split(':')[0]);
        const uniqueDeviceSelectors = [...new Set(deviceSelectors)];
        
        if (uniqueDeviceSelectors.length > 0) {
          const device = await this.props.httpClient.get(`/api/v1/device/${uniqueDeviceSelectors[0]}`);
          
          const targetFeature = device.features.find(f => f.category === 'thermostat');
          const tempFeature = box.temperature_sensor ? 
            await this.props.httpClient.get(`/api/v1/device_feature/${box.temperature_sensor}`) : 
            device.features.find(f => f.category === 'temperature-sensor');
          const modeFeature = device.features.find(f => f.type === 'mode');
          const stateFeature = device.features.find(f => f.type === 'binary');

          this.setState({
            targetTemp: (targetFeature && targetFeature.last_value !== undefined) ? targetFeature.last_value : 20,
            currentTemp: (tempFeature && tempFeature.last_value !== undefined) ? tempFeature.last_value : 0,
            currentMode: (modeFeature && modeFeature.last_value !== undefined) ? modeFeature.last_value : 0,
            isHeating: stateFeature && stateFeature.last_value === 1,
            loading: false,
            error: false
          });
        }
      }
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

  componentDidMount() {
    this.refreshData();
    // Rafraîchissement automatique toutes les 30 secondes
    this.interval = setInterval(this.refreshData, 30000); 
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

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