import { Component } from 'preact';
import { Text } from 'preact-i18n';
import { RequestStatus } from '../../../utils/consts';
import style from './style.css';

const TAIL_OPTIONS = [50, 100, 200, 500, 1000];

class SettingsSystemLogs extends Component {
  constructor(props) {
    super(props);
    this.state = {
      logs: [],
      tail: 200,
      status: null,
      autoScroll: true,
    };
    this.logsEndRef = null;
  }

  getLogs = async () => {
    this.setState({ status: RequestStatus.Getting });
    try {
      const result = await this.props.httpClient.get(`/api/v1/system/logs?tail=${this.state.tail}`);
      this.setState({ logs: result.logs, status: RequestStatus.Success }, () => {
        if (this.state.autoScroll && this.logsEndRef) {
          this.logsEndRef.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } catch (e) {
      console.error(e);
      this.setState({ status: RequestStatus.Error });
    }
  };

  onTailChange = e => {
    this.setState({ tail: parseInt(e.target.value, 10) }, this.getLogs);
  };

  toggleAutoScroll = () => {
    this.setState(prev => ({ autoScroll: !prev.autoScroll }));
  };

  render(props, { logs, tail, status, autoScroll }) {
    const loading = status === RequestStatus.Getting;
    const error = status === RequestStatus.Error;

    return (
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h4 class="mb-0">
            <Text id="systemSettings.logs.title" />
          </h4>
          <div class="d-flex align-items-center">
            <select
              class={`form-control form-control-sm mr-2 ${style.logsSelectWidth}`}
              value={tail}
              onChange={this.onTailChange}
              disabled={loading}
            >
              {TAIL_OPTIONS.map(n => (
                <option key={n} value={n}>
                  {n} <Text id="systemSettings.logs.lines" />
                </option>
              ))}
            </select>
            <button
              class="btn btn-sm btn-secondary mr-2"
              onClick={this.getLogs}
              disabled={loading}
              title="Refresh"
            >
              <i class={`fe fe-refresh-cw${loading ? ' fa-spin' : ''}`} />
            </button>
            <button
              class={`btn btn-sm ${autoScroll ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={this.toggleAutoScroll}
              title="Auto-scroll"
            >
              <i class="fe fe-arrow-down" />
            </button>
          </div>
        </div>
        <div class="card-body p-0">
          {error && (
            <div class="alert alert-danger m-3">
              <Text id="systemSettings.logs.error" />
            </div>
          )}
          {status === null && (
            <div class="text-center p-4 text-muted">
              <Text id="systemSettings.logs.clickRefresh" />
            </div>
          )}
          {(status === RequestStatus.Success || loading) && (
            <div class={`p-3 ${style.logsContainer}`}>
              {logs.length === 0 && !loading && (
                <span class="text-muted">
                  <Text id="systemSettings.logs.empty" />
                </span>
              )}
              {logs.map((line, index) => (
                <div key={index} class={`mb-0 ${style.logsLine}`}>
                  {line}
                </div>
              ))}
              <div
                ref={el => {
                  this.logsEndRef = el;
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default SettingsSystemLogs;
