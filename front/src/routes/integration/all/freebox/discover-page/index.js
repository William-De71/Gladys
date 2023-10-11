import { Component } from 'preact';
import { connect } from 'unistore/preact';
import DiscoverTab from './DiscoverTab';
import FreeboxPage from '../FreeboxPage';

class FreeboxDiscoverPage extends Component {
  render(props) {
    return (
      <FreeboxPage user={props.user}>
        <DiscoverTab {...props} />
      </FreeboxPage>
    );
  }
}

export default connect('user', {})(FreeboxDiscoverPage);
