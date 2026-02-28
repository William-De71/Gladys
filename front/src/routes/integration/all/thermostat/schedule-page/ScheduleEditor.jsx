import { Component } from 'preact';
import { Text } from 'preact-i18n';
import cx from 'classnames';
import style from './style.css';

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const PRESETS = ['off', 'frost', 'away', 'eco', 'night', 'comfort'];
const TOTAL_MINUTES = 24 * 60;

const PRESET_COLORS = {
  off: '#adb5bd',
  frost: '#74c0fc',
  away: '#f59f00',
  eco: '#2fb344',
  night: '#7048e8',
  comfort: '#f97316'
};

function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatLabel(time) {
  const mins = timeToMinutes(time);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

class ScheduleEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      name: props.schedule ? props.schedule.name : '',
      slots: props.schedule ? props.schedule.slots.slice() : [],
      saving: false,
      error: null,
      selectedDay: null,
      lastScheduleSelector: props.schedule ? props.schedule.selector : null
    };
  }

  static getDerivedStateFromProps(props, state) {
    const incomingSelector = props.schedule ? props.schedule.selector : null;
    if (incomingSelector !== state.lastScheduleSelector) {
      return {
        name: props.schedule ? props.schedule.name : '',
        slots: props.schedule ? props.schedule.slots.slice() : [],
        error: null,
        selectedDay: null,
        lastScheduleSelector: incomingSelector
      };
    }
    return null;
  }

  updateName = e => {
    this.setState({ name: e.target.value });
  };

  selectDay = day => {
    this.setState(prev => ({ selectedDay: prev.selectedDay === day ? null : day }));
  };

  addSlot = dayOfWeek => {
    const daySlots = this.state.slots
      .filter(s => s.day_of_week === dayOfWeek)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    let startMinutes = 8 * 60;
    if (daySlots.length > 0) {
      startMinutes = timeToMinutes(daySlots[daySlots.length - 1].end_time);
    }
    const endMinutes = Math.min(startMinutes + 120, TOTAL_MINUTES);
    if (startMinutes >= TOTAL_MINUTES) return;

    const newSlot = {
      day_of_week: dayOfWeek,
      start_time: minutesToTime(startMinutes),
      end_time: minutesToTime(endMinutes),
      preset: 'comfort',
      _key: Date.now()
    };
    this.setState(prevState => ({ slots: [...prevState.slots, newSlot] }));
  };

  removeSlot = (dayOfWeek, slotRef) => {
    this.setState(prevState => ({
      slots: prevState.slots.filter(s => s !== slotRef)
    }));
  };

  updateSlot = (slotRef, field, value) => {
    this.setState(prevState => ({
      slots: prevState.slots.map(s => (s === slotRef ? { ...s, [field]: value } : s))
    }));
  };

  openCopyPicker = dayOfWeek => {
    this.setState({ copySourceDay: dayOfWeek, copyTargetDays: [] });
  };

  closeCopyPicker = () => {
    this.setState({ copySourceDay: null, copyTargetDays: [] });
  };

  toggleCopyTarget = day => {
    this.setState(prev => {
      const set = new Set(prev.copyTargetDays || []);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { copyTargetDays: Array.from(set) };
    });
  };

  applyCopy = () => {
    const { copySourceDay, copyTargetDays, slots } = this.state;
    if (!copyTargetDays || copyTargetDays.length === 0) {
      this.closeCopyPicker();
      return;
    }
    const daySlots = slots.filter(s => s.day_of_week === copySourceDay);
    const otherSlots = slots.filter(s => !copyTargetDays.includes(s.day_of_week));
    const copies = [];
    copyTargetDays.forEach(d => {
      daySlots.forEach(s => {
        copies.push({ ...s, day_of_week: d, _key: Date.now() + d * 100 + Math.random() });
      });
    });
    this.setState({ slots: [...otherSlots, ...copies], copySourceDay: null, copyTargetDays: [] });
  };

  save = async () => {
    const { name, slots } = this.state;
    if (!name.trim()) return;
    this.setState({ saving: true, error: null });
    const scheduleData = {
      name: name.trim(),
      slots: slots.map(({ _key, ...rest }) => rest)
    };
    try {
      const { schedule, httpClient, onSaved } = this.props;
      if (schedule) {
        await httpClient.put(`/api/v1/service/thermostat/schedule/${schedule.selector}`, scheduleData);
      } else {
        await httpClient.post('/api/v1/service/thermostat/schedule', scheduleData);
      }
      if (onSaved) onSaved();
    } catch (e) {
      const msg = (e && e.response && e.response.data && e.response.data.message) || true;
      this.setState({ saving: false, error: msg });
    }
  };

  renderTimeBar(daySlots) {
    const sorted = daySlots.slice().sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    const segments = [];
    const markers = new Set();
    markers.add(0);

    sorted.forEach(slot => {
      const start = timeToMinutes(slot.start_time);
      const end = Math.min(timeToMinutes(slot.end_time), TOTAL_MINUTES);
      if (end <= start) return;
      segments.push({ start, end, preset: slot.preset });
      markers.add(start);
      markers.add(end);
    });

    markers.add(TOTAL_MINUTES);
    const markerList = Array.from(markers).sort((a, b) => a - b);

    return (
      <div class={style.timeBarWrapper}>
        <div class={style.timeBar}>
          {(() => {
            const parts = [];
            const allPoints = Array.from(new Set([0, ...segments.flatMap(s => [s.start, s.end]), TOTAL_MINUTES])).sort((a, b) => a - b);
            for (let i = 0; i < allPoints.length - 1; i++) {
              const from = allPoints[i];
              const to = allPoints[i + 1];
              const widthPct = ((to - from) / TOTAL_MINUTES) * 100;
              const seg = segments.find(s => s.start <= from && s.end >= to);
              const color = seg ? (PRESET_COLORS[seg.preset] || '#ddd') : '#e9ecef';
              parts.push(
                <div
                  key={`${from}-${to}`}
                  class={style.timeBarSegment}
                  style={`--seg-width:${widthPct}%;--seg-color:${color}`}
                />
              );
            }
            return parts;
          })()}
        </div>
        <div class={style.timeBarMarkers}>
          {markerList.filter(m => m < TOTAL_MINUTES || m === 0).map(m => (
            <div
              key={m}
              class={style.timeMarker}
              style={`--marker-left:${(m / TOTAL_MINUTES) * 100}%`}
            >
              {minutesToTime(m) !== '00:00' || m === 0 ? formatLabel(minutesToTime(m)) : ''}
            </div>
          ))}
        </div>
      </div>
    );
  }

  render({ onCancel, intl }, { name, slots, saving, error, selectedDay, copySourceDay, copyTargetDays }) {
    const dictionary = intl && intl.dictionary && intl.dictionary.integration && intl.dictionary.integration.thermostat
      ? intl.dictionary.integration.thermostat.schedule
      : {};

    return (
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            {this.props.schedule
              ? <Text id="integration.thermostat.schedule.editButton" />
              : <Text id="integration.thermostat.schedule.newButton" />}
          </h3>
        </div>
        <div class="card-body">
          {error && (
            <div class="alert alert-danger">
              {typeof error === 'string'
                ? error
                : <Text id="integration.thermostat.schedule.saveError" />}
            </div>
          )}

          <div class="form-group">
            <label class="form-label">
              <Text id="integration.thermostat.schedule.nameLabel" />
            </label>
            <input
              type="text"
              class="form-control"
              placeholder={dictionary.namePlaceholder || ''}
              value={name}
              onInput={this.updateName}
            />
          </div>

          <div class={style.dayList}>
            {DAYS.map(day => {
              const daySlots = slots
                .filter(s => s.day_of_week === day)
                .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
              const isOpen = selectedDay === day;

              return (
                <div key={day} class={cx(style.dayRow, { [style.dayRowOpen]: isOpen })}>
                  <div class={style.dayRowHeader} onClick={() => this.selectDay(day)}>
                    <span class={style.dayLabel}>
                      <Text id={`integration.thermostat.schedule.days.${day}`} />
                    </span>
                    <i class={`fe fe-chevron-${isOpen ? 'up' : 'down'} ${style.dayChevron}`} />
                  </div>

                  {this.renderTimeBar(daySlots)}

                  {isOpen && (
                    <div class={style.dayPanel}>
                      {daySlots.length === 0 && (
                        <p class={`text-muted mb-2 ${style.noSlotsText}`}>
                          <Text id="integration.thermostat.schedule.noSlots" />
                        </p>
                      )}

                      {daySlots.map((slot, idx) => (
                        <div key={slot._key || `${day}-${idx}`} class={style.slotEditorRow}>
                          <div
                            class={`${style.slotColorDot} ${style[`dotPreset_${slot.preset}`] || ''}`}
                          />
                          <input
                            type="time"
                            class={cx('form-control', 'form-control-sm', style.slotTimeInput)}
                            value={slot.start_time}
                            onChange={e => this.updateSlot(slot, 'start_time', e.target.value)}
                          />
                          <span class={style.slotArrow}>→</span>
                          <input
                            type="time"
                            class={cx('form-control', 'form-control-sm', style.slotTimeInput)}
                            value={slot.end_time}
                            onChange={e => this.updateSlot(slot, 'end_time', e.target.value)}
                          />
                          <select
                            class={cx('form-control', 'form-control-sm', style.slotPresetSelect)}
                            value={slot.preset}
                            onChange={e => this.updateSlot(slot, 'preset', e.target.value)}
                          >
                            {PRESETS.map(p => (
                              <option key={p} value={p}>
                                {(dictionary.presets && dictionary.presets[p]) || p}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            onClick={() => this.removeSlot(day, slot)}
                          >
                            <i class="fe fe-trash-2" />
                          </button>
                        </div>
                      ))}

                      <div class={style.dayPanelActions}>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-primary"
                          onClick={() => this.addSlot(day)}
                        >
                          <i class="fe fe-plus mr-1" />
                          <Text id="integration.thermostat.schedule.addSlot" />
                        </button>
                        {copySourceDay !== day && (
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            onClick={() => this.openCopyPicker(day)}
                          >
                            <i class="fe fe-copy mr-1" />
                            <Text id="integration.thermostat.schedule.copyTo" />
                          </button>
                        )}

                        {copySourceDay === day && (
                          <div class={style.copyPicker}>
                            <span class={style.copyPickerLabel}>
                              <Text id="integration.thermostat.schedule.copyToLabel" />
                            </span>
                            {DAYS.filter(d => d !== day).map(d => (
                              <label key={d} class={style.copyPickerDay}>
                                <input
                                  type="checkbox"
                                  checked={(copyTargetDays || []).includes(d)}
                                  onChange={() => this.toggleCopyTarget(d)}
                                />
                                {' '}
                                <Text id={`integration.thermostat.schedule.daysShort.${d}`} />
                              </label>
                            ))}
                            <button
                              type="button"
                              class="btn btn-xs btn-primary ml-2"
                              onClick={this.applyCopy}
                              disabled={!(copyTargetDays && copyTargetDays.length > 0)}
                            >
                              <Text id="integration.thermostat.schedule.applyButton" />
                            </button>
                            <button
                              type="button"
                              class="btn btn-xs btn-secondary ml-1"
                              onClick={this.closeCopyPicker}
                            >
                              <Text id="integration.thermostat.schedule.cancelButton" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div class={style.saveRow}>
            <button
              type="button"
              class={cx('btn', 'btn-success', { 'btn-loading': saving })}
              onClick={this.save}
              disabled={!name.trim()}
            >
              <Text id="integration.thermostat.schedule.saveButton" />
            </button>
            <button type="button" class="btn btn-secondary" onClick={onCancel}>
              <Text id="integration.thermostat.schedule.cancelButton" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ScheduleEditor;
