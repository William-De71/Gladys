import { connect } from 'unistore/preact';
import ThermostatTpi from './ThermostatTpi';

const ThermostatTpiBox = props => {
  return <ThermostatTpi {...props} />;
};

export default connect('httpClient,user', {})(ThermostatTpiBox);
