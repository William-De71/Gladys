import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import get from 'get-value';
import withIntlAsProp from '../../utils/withIntlAsProp';
import './style.css';

/**
 * Get the bold label to display next to the event name (device name, service name, etc.).
 */
function getEventLabel(log) {
  const data = log.data;
  if (!data) {
    return null;
  }
  if (data.device_name) {
    return data.device_name;
  }
  if (data.device_feature) {
    return data.device_feature;
  }
  if (data.service) {
    return data.service;
  }
  if (data.scene_selector) {
    return data.scene_selector;
  }
  if (data.house) {
    return data.house;
  }
  if (data.user) {
    return data.user;
  }
  return null;
}

/**
 * Get the value line (value + unit), resolving i18n labels from dictionary when available.
 */
function getEventValue(log, dictionary) {
  const data = log.data;
  if (!data) {
    return null;
  }
  if (data.last_value !== undefined && data.last_value !== null) {
    const { feature_category: category, feature_type: type, last_value: value, unit } = data;
    // Try to resolve a human-readable label from the i18n dictionary
    if (dictionary && category && type) {
      // Try category+type specific key first (e.g. button.click.1)
      const categoryTypeKey = `deviceFeatureValue.category.${category}.${type}.${value}`;
      const categoryTypeLabel = get(dictionary, categoryTypeKey);
      if (categoryTypeLabel && typeof categoryTypeLabel === 'string') {
        return categoryTypeLabel;
      }
      // Try binary category key (e.g. motion.binary plural)
      const binaryKey = `deviceFeatureValue.category.${category}.binary`;
      const binaryObj = get(dictionary, binaryKey);
      if (binaryObj && typeof binaryObj === 'object') {
        const binaryLabel = value === 1 ? binaryObj.one : value === 0 ? binaryObj.zero : null;
        if (binaryLabel) {
          return binaryLabel;
        }
      }
    }
    return unit ? `${value} ${unit}` : String(value);
  }
  if (data.error) {
    return data.error;
  }
  return null;
}

const EventLogPage = ({ children, intl, ...props }) => {
  const dictionary = intl && intl.dictionary;
  const hasDateFilter = props.dateFrom || props.dateTo;

  return (
    <div class="page">
      <div class="page-main">
        <div class="my-3 my-md-5">
          <div class="container">
            <div class="page-header">
              <h1 class="page-title">
                <Text id="eventLog.pageTitle" />
              </h1>
              <div class="page-options d-flex">
                <select class="form-control custom-select w-auto" onChange={props.changeTypeFilter}>
                  <option value="">
                    <Text id="eventLog.allTypes" />
                  </option>
                  <option value="device.">
                    <Text id="eventLog.typeDevice" />
                  </option>
                  <option value="alarm.">
                    <Text id="eventLog.typeAlarm" />
                  </option>
                  <option value="scene.">
                    <Text id="eventLog.typeScene" />
                  </option>
                  <option value="user.">
                    <Text id="eventLog.typePresence" />
                  </option>
                  <option value="system.">
                    <Text id="eventLog.typeSystem" />
                  </option>
                  <option value="service.">
                    <Text id="eventLog.typeService" />
                  </option>
                </select>
                <div class="input-icon ml-2">
                  <span class="input-icon-addon">
                    <i class="fe fe-search" />
                  </span>
                  <Localizer>
                    <input
                      type="text"
                      class="form-control w-auto"
                      placeholder={<Text id="eventLog.searchPlaceholder" />}
                      onInput={props.search}
                      value={props.eventLogSearch}
                    />
                  </Localizer>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <h3 class="card-title">
                  <i class="fe fe-book-open mr-2" />
                  <Text id="eventLog.title" />
                </h3>
              </div>
              <div class="card-body">
                <Text id="eventLog.description" />
              </div>
            </div>

            {props.purgeResult !== null && props.purgeResult !== undefined && (
              <div class="alert alert-success">
                <Text id="eventLog.purgeSuccess" /> ({props.purgeResult})
              </div>
            )}

            <div class="card mb-3">
              <div class="card-body py-3">
                <div class="row align-items-center">
                  <div class="col-auto">
                    <label class="form-label small mb-0 mr-2">
                      <Text id="eventLog.dateFrom" />
                    </label>
                  </div>
                  <div class="col-auto">
                    <input
                      type="datetime-local"
                      class="form-control form-control-sm"
                      value={props.dateFrom}
                      onChange={props.changeDateFrom}
                    />
                  </div>
                  <div class="col-auto">
                    <label class="form-label small mb-0 mr-2">
                      <Text id="eventLog.dateTo" />
                    </label>
                  </div>
                  <div class="col-auto">
                    <input
                      type="datetime-local"
                      class="form-control form-control-sm"
                      value={props.dateTo}
                      onChange={props.changeDateTo}
                    />
                  </div>
                  {hasDateFilter && (
                    <div class="col-auto">
                      <button
                        class="btn btn-sm btn-outline-danger"
                        onClick={props.clearDateFilters}
                      >
                        <i class="fe fe-x mr-1" />
                        <Text id="eventLog.clearDates" />
                      </button>
                    </div>
                  )}
                  <div class="col-auto ml-auto">
                    {!props.askDeleteConfirm && (
                      <button
                        class="btn btn-sm btn-danger"
                        onClick={props.askPurgeEventLogs}
                      >
                        <i class="fe fe-trash-2 mr-1" />
                        <Text id="eventLog.purge" />
                      </button>
                    )}
                    {props.askDeleteConfirm && (
                      <span>
                        <Text id="eventLog.purgeConfirm" />
                        <button
                          class="btn btn-sm btn-danger ml-2"
                          onClick={props.confirmPurgeEventLogs}
                        >
                          <Text id="eventLog.purgeYes" /> <i class="fe fe-trash-2" />
                        </button>
                        <button
                          class="btn btn-sm btn-outline-secondary ml-2"
                          onClick={props.cancelPurgeEventLogs}
                        >
                          <Text id="eventLog.purgeNo" /> <i class="fe fe-slash" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              class={cx('dimmer', {
                active: props.loading
              })}
            >
              <div class="loader" />
              <div class="dimmer-content">
                <div class="card">
                  <div class="table-responsive">
                    <table class="table table-hover table-outline table-vcenter card-table">
                      <thead>
                        <tr>
                          <th class="w-1" />
                          <th>
                            <Text id="eventLog.columnMessage" />
                          </th>
                          <th class="text-right">
                            <Text id="eventLog.columnDate" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {props.eventLogs &&
                          props.eventLogs.map(log => {
                            const label = getEventLabel(log);
                            const value = getEventValue(log, dictionary);
                            const roomName = log.data && log.data.room_name;
                            return (
                              <tr key={log.id}>
                                <td class="text-center">
                                  <i class={`fe fe-${log.icon || 'info'}`} />
                                </td>
                                <td>
                                  <div>
                                    <strong><Text id={log.message}>{log.message}</Text></strong>
                                    {label && (
                                      <span class="ml-1">{label}</span>
                                    )}
                                  </div>
                                  {value && (
                                    <div class="text-muted event-log-sub">{value}</div>
                                  )}
                                  {roomName && (
                                    <div class="text-muted event-log-sub">
                                      {roomName}
                                    </div>
                                  )}
                                </td>
                                <td class="text-right text-nowrap">
                                  <div>
                                    {new Date(log.created_at).toLocaleDateString(undefined, {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    })}
                                  </div>
                                  <div class="small text-muted">
                                    {new Date(log.created_at).toLocaleTimeString(undefined, {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {props.eventLogs && props.eventLogs.length === 0 && (
                          <tr>
                            <td colSpan="3" class="text-center text-muted py-4">
                              <Text id="eventLog.noEvents" />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div class="card-body">
                    {!props.isFirstPage && (
                      <button class="btn btn-secondary" onClick={props.previousPage}>
                        <Text id="eventLog.previous" />
                      </button>
                    )}
                    {!props.isLastPage && (
                      <button class="btn btn-secondary ml-2" onClick={props.nextPage}>
                        <Text id="eventLog.next" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withIntlAsProp(EventLogPage);
