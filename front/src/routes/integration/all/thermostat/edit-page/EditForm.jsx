import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import { RequestStatus } from '../../../../../utils/consts';

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

            {/* Type de calcul */}
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

            {/* Presets */}
            <div class="form-group">
              <label class="form-label">
                <Text id="integration.thermostat.edit.presetsLabel" />
              </label>
              <div class="row">
                {activePresets.map(key => (
                  <div class="col-md-4" key={key}>
                    <div class="form-group">
                      <label class="form-label">
                        <Text id={`integration.thermostat.edit.preset.${key}`} />
                      </label>
                      <input
                        type="number"
                        class="form-control"
                        value={props[presetFields[key]]}
                        onInput={e => props.updateThermostatField(presetFields[key], e.target.value)}
                        step="1"
                      />
                    </div>
                  </div>
                ))}
              </div>
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
