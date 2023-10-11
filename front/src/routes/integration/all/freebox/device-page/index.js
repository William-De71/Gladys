import { Component } from 'preact';
import { connect } from 'unistore/preact';
import DeviceTab from './DeviceTab';
import FreeboxPage from '../FreeboxPage';

class DevicePage extends Component {
  render(props, {}) {
    return (
      <FreeboxPage user={props.user}>
        <DeviceTab {...props} />
      </FreeboxPage>
    );
  }
}

export default connect('user', {})(DevicePage);
