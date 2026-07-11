import { connect } from 'unistore/preact';
import DiscoverTab from './DiscoverTab';
import SpotifyPage from '../SpotifyPage';

const SpotifyDiscoverPage = props => (
  <SpotifyPage user={props.user}>
    <DiscoverTab {...props} />
  </SpotifyPage>
);

export default connect('user', {})(SpotifyDiscoverPage);
