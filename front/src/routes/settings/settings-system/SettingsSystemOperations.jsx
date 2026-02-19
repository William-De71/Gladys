import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import { useState } from 'preact/hooks';
import { RequestStatus } from '../../../utils/consts';
import style from './style.css';

const SettingsSystemOperations = ({
  systemInfos,
  upgradeGladys,
  SystemUpgradeStatus,
  watchtowerLogs,
  websocketConnected,
  SystemGetInfosStatus,
  checkForUpdates,
  restartGladys,
  SystemRestartStatus
}) => {
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const handleRestartClick = () => setShowRestartConfirm(true);
  const handleRestartCancel = () => setShowRestartConfirm(false);
  const handleRestartConfirm = () => {
    setShowRestartConfirm(false);
    restartGladys();
  };

  return (
  <div class="card">
    <div class={SystemGetInfosStatus === RequestStatus.Getting ? 'dimmer active' : 'dimmer'}>
      <div class="loader" />
      <div class="dimmer-content">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h4 class="mb-0">
            <Text id="systemSettings.operations" />
          </h4>
          {systemInfos && systemInfos.new_release_available === false && (
            <button class={`btn btn-link ${style.textDecorationNone}`} onClick={checkForUpdates}>
              <i class="fe fe-refresh-cw" />
            </button>
          )}
        </div>

        {systemInfos && systemInfos.new_release_available === true && (
          <div class="card-body">
            <div>
              <h4>
                <Text id="systemSettings.newUpgradeAvailable" />
              </h4>
              <p>
                <Text id="systemSettings.newUpgradeAvailableText" />
              </p>
              {(SystemUpgradeStatus === RequestStatus.Getting || SystemUpgradeStatus === RequestStatus.Success) && (
                <div class="mt-3">
                  <div class="alert alert-info">
                    <Text id="systemSettings.upgradeInProgress" />
                  </div>
                  {websocketConnected === false && (
                    <div class="alert alert-secondary">
                      <Text id="systemSettings.websocketNotConnected" />
                    </div>
                  )}
                  {watchtowerLogs && watchtowerLogs.length > 0 && (
                    <div class="mt-3">
                      <h5>
                        <Text id="systemSettings.upgradeLogs" />
                      </h5>
                      <div class="card">
                        <div class="card-body p-0">
                          <div
                            class="bg-dark text-light p-3"
                            style={{
                              maxHeight: '300px',
                              overflowY: 'auto',
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}
                          >
                            {watchtowerLogs.map((log, index) => (
                              <div key={index} class="mb-1">
                                {log}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {systemInfos.is_docker === false && (
                <div class="alert alert-warning">
                  <Text id="systemSettings.notConnectedToDocker" />
                </div>
              )}
              <button
                class="btn btn-primary"
                onClick={upgradeGladys}
                disabled={
                  SystemUpgradeStatus === RequestStatus.Getting ||
                  SystemUpgradeStatus === RequestStatus.Success ||
                  systemInfos.is_docker === false
                }
              >
                <Text id="systemSettings.updateNow" />
              </button>
            </div>
          </div>
        )}

        {systemInfos && systemInfos.new_release_available === false && (
          <div class="table-responsive">
            <table className="table table-hover table-outline table-vcenter text-nowrap card-table">
              <tbody>
                <tr>
                  <td>
                    <Text id="systemSettings.upToDate" />
                  </td>
                  <td className="text-right">
                    <span class="badge badge-success">
                      <Text id="systemSettings.gladysVersionValue" fields={{ version: systemInfos.gladys_version }} />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div class="card-footer">
          {SystemRestartStatus === RequestStatus.Error && (
            <div class="alert alert-danger mb-2">
              <Text id="systemSettings.restartError" />
            </div>
          )}
          <p>
            {SystemRestartStatus === RequestStatus.Getting ? (
              <span>
                <Text id="systemSettings.restartingGladys" />
              </span>
            ) : !showRestartConfirm ? (
              <button class="btn btn-danger" onClick={handleRestartClick}>
                <Text id="systemSettings.restartGladys" />
              </button>
            ) : (
              <span>
                <button onClick={handleRestartConfirm} class="btn btn-primary mr-2">
                  <Text id="systemSettings.confirm" />
                </button>
                <button onClick={handleRestartCancel} class="btn btn-danger">
                  <Text id="systemSettings.cancel" />
                </button>
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  </div>
  );
};

export default connect('', {})(SettingsSystemOperations);
