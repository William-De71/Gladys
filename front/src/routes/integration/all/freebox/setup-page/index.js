import { Component } from 'preact';
import { connect } from 'unistore/preact';
import actions from '../actions';
import FreeboxPage from '../FreeboxPage';
import SetupTab from './SetupTab';
// import { RequestStatus } from '../../../../../utils/consts';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../../../server/utils/constants';

class FreeboxSetupPage extends Component {
  
  componentWillMount() {
    this.props.discoverFreebox();
    // this.props.openSessionFreebox();
    this.props.loadProps();
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.FREEBOX.DISCOVER, this.props.displayDiscoveredMessage);
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.FREEBOX.ERROR, this.props.displayFreeboxError);
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.FREEBOX.DISCOVER, this.props.displayDiscoveredMessage);
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.FREEBOX.ERROR, this.props.displayFreeboxError);
  }


  render(props, {}) {
    return (
      <FreeboxPage>
        <SetupTab {...props} />
      </FreeboxPage>
    );
  }
}

export default connect(
  'user,session,discoverFreeboxStatus,authorizedFreeboxStatus,deviceName,boxModelName,boxModel,appToken', 
  actions
)(FreeboxSetupPage);