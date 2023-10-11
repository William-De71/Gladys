import { Component } from 'preact';
import { connect } from 'unistore/preact';
import FreeboxPage from '../FreeboxPage';
import UpdateDevice from '../../../../../components/device';

class EditFreeboxDevice extends Component {
  render(props, {}) {
    return (
      <FreeboxPage user={props.user}>
        <UpdateDevice
          {...props}
          integrationName="freebox"
          allowModifyFeatures={false}
          previousPage="/dashboard/integration/device/freebox"
        />
      </FreeboxPage>
    );
  }
}

export default connect('user,session,httpClient,currentIntegration,houses', {})(EditFreeboxDevice);
