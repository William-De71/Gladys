import ThermostatPage from '../ThermostatPage';
import SetupTab from './SetupTab';

const ThermostatSetupPage = props => (
  <ThermostatPage {...props}>
    <SetupTab {...props} />
  </ThermostatPage>
);

export default ThermostatSetupPage;
