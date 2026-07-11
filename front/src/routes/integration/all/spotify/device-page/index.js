import { connect } from 'unistore/preact';
import DeviceTab from './DeviceTab';
import SpotifyPage from '../SpotifyPage';

const SpotifyDevicePage = props => (
  <SpotifyPage user={props.user}>
    <DeviceTab {...props} />
  </SpotifyPage>
);

export default connect('user', {})(SpotifyDevicePage);
