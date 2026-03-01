import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import { RequestStatus } from '../../../../../utils/consts';
import style from './style.css';

const FeatureSelect = ({ value, features, onChange, emptyLabel }) => (
  <select class="form-control" value={value} onChange={onChange}>
    <option value="">{emptyLabel}</option>
    {features &&
      features.map(f => (
        <option key={f.selector} value={f.selector} selected={f.selector === value}>
          {f.label}
        </option>
      ))}
  </select>
);

const EditForm = ({ ...props }) => {
  const saving = props.thermostatCreateStatus === RequestStatus.Getting;
  const isEdit = !!(props.thermostatEditDevice && props.thermostatEditDevice.selector);
  const mode = props.thermostatEditMode || 'heating';

  const heatingPresets = ['frost', 'away', 'eco', 'night', 'comfort'];
  const coolingPresets = ['comfort'];
  const activePresets = mode === 'cooling' ? coolingPresets : heatingPresets;

  const presetFields = {
    frost: 'thermostatEditPresetFrost',
    away: 'thermostatEditPresetAway',
    eco: 'thermostatEditPresetEco',
    night: 'thermostatEditPresetNight',
    comfort: 'thermostatEditPresetComfort'
  };

  const presetColorFields = {
    off: 'thermostatEditColorOff',
    frost: 'thermostatEditColorFrost',
    away: 'thermostatEditColorAway',
    eco: 'thermostatEditColorEco',
    night: 'thermostatEditColorNight',
    comfort: 'thermostatEditColorComfort'
  };

  const presetColorDefaults = {
    off: '#4a4a4a',
    frost: '#74c0fc',
    away: '#e03131',
    eco: '#74b816',
    night: '#1971c2',
    comfort: '#f59f00'
  };

  const controlType = props.thermostatEditControlType || 'hysteresis';

  return (
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">
          {isEdit ? (
            <Text id="integration.thermostat.edit.titleEdit" />
          ) : (
            <Text id="integration.thermostat.edit.titleNew" />
          )}
        </h1>
      </div>
      <div class="card-body">
        <div class={cx('dimmer', { active: saving })}>
          <div class="loader" />
          <div class="dimmer-content">
            {props.thermostatCreateStatus === RequestStatus.Error && (
              <div class="alert alert-danger">
                <Text id="integration.thermostat.edit.saveError" />
              </div>
            )}

            {/* Nom */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.nameLabel" />
              </label>
              <Localizer>
                <input
                  type="text"
                  class="form-control"
                  placeholder={<Text id="integration.thermostat.edit.namePlaceholder" />}
                  value={props.thermostatEditName}
                  onInput={e => props.updateThermostatField('thermostatEditName', e.target.value)}
                />
              </Localizer>
            </div>

            {/* Pièce */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.roomLabel" />
              </label>
              <select
                class="form-control"
                value={props.thermostatEditRoomId || ''}
                onChange={e => props.updateThermostatField('thermostatEditRoomId', e.target.value)}
              >
                <option value="">
                  <Text id="global.emptySelectOption" />
                </option>
                {props.houses &&
                  props.houses.map(house => (
                    <optgroup label={house.name}>
                      {house.rooms.map(room => (
                        <option
                          selected={room.id === props.thermostatEditRoomId}
                          value={room.id}
                        >
                          {room.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </div>

            {/* Mode */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.modeLabel" />
              </label>
              <select
                class="form-control"
                value={mode}
                onChange={e => props.updateThermostatField('thermostatEditMode', e.target.value)}
              >
                <option value="heating">
                  <Text id="integration.thermostat.edit.mode.heating" />
                </option>
                <option value="cooling">
                  <Text id="integration.thermostat.edit.mode.cooling" />
                </option>
              </select>
            </div>

            {/* Type de calcul + paramètres associés */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.controlTypeLabel" />
              </label>
              <select
                class="form-control"
                value={props.thermostatEditControlType || 'hysteresis'}
                onChange={e => props.updateThermostatField('thermostatEditControlType', e.target.value)}
                disabled={mode === 'cooling'}
              >
                <option value="hysteresis">
                  <Text id="integration.thermostat.edit.controlType.hysteresis" />
                </option>
                <option value="tpi">
                  <Text id="integration.thermostat.edit.controlType.tpi" />
                </option>
              </select>
              <small class="form-text text-muted">
                <Text id="integration.thermostat.edit.controlTypeHelp" />
              </small>
            </div>

            {/* Paramètres hystérésis */}
            {controlType === 'hysteresis' && (
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.thermostat.edit.hysteresisStartLabel" />
                    </label>
                    <div class="input-group">
                      <input
                        type="number"
                        class="form-control"
                        step="0.1"
                        min="0"
                        max="5"
                        value={props.thermostatEditHysteresisStart || '0.5'}
                        onInput={e => props.updateThermostatField('thermostatEditHysteresisStart', e.target.value)}
                      />
                      <div class="input-group-append">
                        <span class="input-group-text">°C</span>
                      </div>
                    </div>
                    <small class="form-text text-muted">
                      <Text id="integration.thermostat.edit.hysteresisStartHelp" />
                    </small>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.thermostat.edit.hysteresisStopLabel" />
                    </label>
                    <div class="input-group">
                      <input
                        type="number"
                        class="form-control"
                        step="0.1"
                        min="0"
                        max="5"
                        value={props.thermostatEditHysteresisStop || '0.5'}
                        onInput={e => props.updateThermostatField('thermostatEditHysteresisStop', e.target.value)}
                      />
                      <div class="input-group-append">
                        <span class="input-group-text">°C</span>
                      </div>
                    </div>
                    <small class="form-text text-muted">
                      <Text id="integration.thermostat.edit.hysteresisStopHelp" />
                    </small>
                  </div>
                </div>
              </div>
            )}

            {/* Paramètres TPI */}
            {controlType === 'tpi' && (
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.thermostat.edit.tpiCycleTimeLabel" />
                    </label>
                    <div class="input-group">
                      <input
                        type="number"
                        class="form-control"
                        step="1"
                        min="5"
                        max="120"
                        value={props.thermostatEditTpiCycleTime || '30'}
                        onInput={e => props.updateThermostatField('thermostatEditTpiCycleTime', e.target.value)}
                      />
                      <div class="input-group-append">
                        <span class="input-group-text">min</span>
                      </div>
                    </div>
                    <small class="form-text text-muted">
                      <Text id="integration.thermostat.edit.tpiCycleTimeHelp" />
                    </small>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.thermostat.edit.tpiProportionalBandLabel" />
                    </label>
                    <div class="input-group">
                      <input
                        type="number"
                        class="form-control"
                        step="0.5"
                        min="0.5"
                        max="10"
                        value={props.thermostatEditTpiProportionalBand || '2'}
                        onInput={e => props.updateThermostatField('thermostatEditTpiProportionalBand', e.target.value)}
                      />
                      <div class="input-group-append">
                        <span class="input-group-text">°C</span>
                      </div>
                    </div>
                    <small class="form-text text-muted">
                      <Text id="integration.thermostat.edit.tpiProportionalBandHelp" />
                    </small>
                  </div>
                </div>
              </div>
            )}

            {/* Unité + Plage de température */}
            <div class="row">
              <div class="col-md-4">
                <div class="form-group">
                  <label class="form-label">
                    <Text id="integration.thermostat.edit.tempUnitLabel" />
                  </label>
                  <select
                    class="form-control"
                    value={props.thermostatEditTempUnit}
                    onChange={e => props.updateThermostatField('thermostatEditTempUnit', e.target.value)}
                  >
                    <option value="C">
                      <Text id="integration.thermostat.edit.celsius" />
                    </option>
                    <option value="F">
                      <Text id="integration.thermostat.edit.fahrenheit" />
                    </option>
                  </select>
                </div>
              </div>
              <div class="col-md-4">
                <div class="form-group">
                  <label class="form-label">
                    <Text id="integration.thermostat.edit.minTempLabel" />
                  </label>
                  <Localizer>
                    <input
                      type="number"
                      class="form-control"
                      placeholder={<Text id="integration.thermostat.edit.minTempPlaceholder" />}
                      value={props.thermostatEditMinTemp}
                      onInput={e => props.updateThermostatField('thermostatEditMinTemp', e.target.value)}
                    />
                  </Localizer>
                </div>
              </div>
              <div class="col-md-4">
                <div class="form-group">
                  <label class="form-label">
                    <Text id="integration.thermostat.edit.maxTempLabel" />
                  </label>
                  <Localizer>
                    <input
                      type="number"
                      class="form-control"
                      placeholder={<Text id="integration.thermostat.edit.maxTempPlaceholder" />}
                      value={props.thermostatEditMaxTemp}
                      onInput={e => props.updateThermostatField('thermostatEditMaxTemp', e.target.value)}
                    />
                  </Localizer>
                </div>
              </div>
            </div>

            {/* Capteur de température */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.temperatureFeatureLabel" />
              </label>
              <Localizer>
                <FeatureSelect
                  value={props.thermostatEditTemperatureFeature || ''}
                  features={props.temperatureFeatures}
                  onChange={e => props.updateThermostatField('thermostatEditTemperatureFeature', e.target.value)}
                  emptyLabel={<Text id="global.emptySelectOption" />}
                />
              </Localizer>
              <small class="form-text text-muted">
                <Text id="integration.thermostat.edit.temperatureFeatureHelp" />
              </small>
            </div>

            {/* Capteur d'humidité */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.humidityFeatureLabel" />
              </label>
              <Localizer>
                <FeatureSelect
                  value={props.thermostatEditHumidityFeature || ''}
                  features={props.humidityFeatures}
                  onChange={e => props.updateThermostatField('thermostatEditHumidityFeature', e.target.value)}
                  emptyLabel={<Text id="global.emptySelectOption" />}
                />
              </Localizer>
              <small class="form-text text-muted">
                <Text id="integration.thermostat.edit.humidityFeatureHelp" />
              </small>
            </div>

            {/* Commutateur */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.switchFeatureLabel" />
              </label>
              <Localizer>
                <FeatureSelect
                  value={props.thermostatEditSwitchFeature || ''}
                  features={props.switchFeatures}
                  onChange={e => props.updateThermostatField('thermostatEditSwitchFeature', e.target.value)}
                  emptyLabel={<Text id="global.emptySelectOption" />}
                />
              </Localizer>
              <small class="form-text text-muted">
                <Text id="integration.thermostat.edit.switchFeatureHelp" />
              </small>
            </div>

            {/* Presets : couleur + température alignées par préréglage */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.presetsLabel" />
              </label>
              <table class="table table-sm table-borderless mb-0">
                <thead>
                  <tr>
                    <th class={style.presetColName}><Text id="integration.thermostat.edit.presetColNameLabel" /></th>
                    <th class={style.presetColColor}><Text id="integration.thermostat.edit.presetColColorLabel" /></th>
                    <th><Text id="integration.thermostat.edit.presetColTempLabel" /></th>
                  </tr>
                </thead>
                <tbody>
                  {['off', ...activePresets].map(key => (
                    <tr key={key}>
                      <td class="align-middle">
                        <Text id={`integration.thermostat.edit.preset.${key}`} />
                      </td>
                      <td class="align-middle">
                        <input
                          type="color"
                          class={`form-control p-1 ${style.presetColorInput}`}
                          value={props[presetColorFields[key]] || presetColorDefaults[key]}
                          onInput={e => props.updateThermostatField(presetColorFields[key], e.target.value)}
                        />
                      </td>
                      <td class="align-middle">
                        {presetFields[key] ? (
                          <div class="input-group input-group-sm">
                            <input
                              type="number"
                              class={`form-control ${style.presetTempInput}`}
                              value={props[presetFields[key]]}
                              onInput={e => props.updateThermostatField(presetFields[key], e.target.value)}
                              step="0.5"
                            />
                            <div class="input-group-append">
                              <span class="input-group-text">
                                {(props.thermostatEditTempUnit || 'C') === 'F' ? '°F' : '°C'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span class="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Durée mode manuel */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.manualDurationLabel" />
              </label>
              <div class="input-group">
                <input
                  type="number"
                  class="form-control"
                  min="1"
                  max="480"
                  value={props.thermostatEditManualDuration || '30'}
                  onInput={e => props.updateThermostatField('thermostatEditManualDuration', e.target.value)}
                  step="1"
                />
                <div class="input-group-append">
                  <span class="input-group-text">
                    <Text id="integration.thermostat.edit.manualDurationUnit" />
                  </span>
                </div>
              </div>
              <small class="form-text text-muted">
                <Text id="integration.thermostat.edit.manualDurationHelp" />
              </small>
            </div>


            <div class="row mt-2">
              <div class="col">
                <button
                  onClick={props.saveThermostatDevice}
                  class={cx('btn', 'btn-success', { 'btn-loading': saving })}
                >
                  <Text id="integration.thermostat.edit.saveButton" />
                </button>
                <a href="/dashboard/integration/device/thermostat" class="btn btn-secondary ml-2">
                  <Text id="integration.thermostat.edit.cancelButton" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditForm;
