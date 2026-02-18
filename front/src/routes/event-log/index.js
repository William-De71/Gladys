import { Component } from 'preact';
import { connect } from 'unistore/preact';
import debounce from 'debounce';
import EventLogPage from './EventLogPage';

const PAGE_SIZE = 20;

class EventLog extends Component {
  getEventLogs = async () => {
    this.setState({ loading: true, getError: false });
    try {
      const params = {
        take: PAGE_SIZE,
        skip: this.state.currentPage * PAGE_SIZE,
        order_dir: 'DESC'
      };

      if (this.state.typeFilter) {
        params.type = this.state.typeFilter;
      }

      if (this.state.searchValue) {
        params.search = this.state.searchValue;
      }

      if (this.state.dateFrom) {
        params.from = new Date(this.state.dateFrom).toISOString();
      }

      if (this.state.dateTo) {
        params.to = new Date(this.state.dateTo).toISOString();
      }

      const result = await this.props.httpClient.get('/api/v1/event_log', params);

      const totalPages = Math.ceil(result.count / PAGE_SIZE);
      this.setState({
        eventLogs: result.rows,
        totalCount: result.count,
        totalPages,
        loading: false
      });
    } catch (e) {
      this.setState({ loading: false, getError: true });
    }
  };

  search = async e => {
    await this.setState({ searchValue: e.target.value, currentPage: 0 });
    this.debouncedGetEventLogs();
  };

  changeTypeFilter = async e => {
    await this.setState({ typeFilter: e.target.value, currentPage: 0 });
    await this.getEventLogs();
  };

  changeDateFrom = async e => {
    await this.setState({ dateFrom: e.target.value, currentPage: 0 });
    await this.getEventLogs();
  };

  changeDateTo = async e => {
    await this.setState({ dateTo: e.target.value, currentPage: 0 });
    await this.getEventLogs();
  };

  clearDateFilters = async () => {
    await this.setState({ dateFrom: '', dateTo: '', currentPage: 0 });
    await this.getEventLogs();
  };

  askPurgeEventLogs = () => {
    this.setState({ askDeleteConfirm: true });
  };

  cancelPurgeEventLogs = () => {
    this.setState({ askDeleteConfirm: false });
  };

  confirmPurgeEventLogs = async () => {
    try {
      const result = await this.props.httpClient.post('/api/v1/event_log/purge');
      await this.setState({ askDeleteConfirm: false, currentPage: 0, purgeResult: result.deleted });
      await this.getEventLogs();
    } catch (e) {
      this.setState({ getError: true, askDeleteConfirm: false });
    }
  };

  previousPage = async () => {
    if (this.state.currentPage > 0) {
      await this.setState({ currentPage: this.state.currentPage - 1 });
      await this.getEventLogs();
    }
  };

  nextPage = async () => {
    if (this.state.currentPage < this.state.totalPages - 1) {
      await this.setState({ currentPage: this.state.currentPage + 1 });
      await this.getEventLogs();
    }
  };

  constructor(props) {
    super(props);
    this.state = {
      eventLogs: [],
      totalCount: 0,
      totalPages: 0,
      loading: true,
      typeFilter: '',
      searchValue: '',
      dateFrom: '',
      dateTo: '',
      currentPage: 0,
      askDeleteConfirm: false,
      purgeResult: null
    };
    this.debouncedGetEventLogs = debounce(() => this.getEventLogs(), 200);
  }

  componentWillMount() {
    this.getEventLogs();
  }

  render(props, state) {
    const isFirstPage = state.currentPage === 0;
    const isLastPage = state.currentPage >= state.totalPages - 1;
    return (
      <EventLogPage
        eventLogs={state.eventLogs}
        loading={state.loading}
        getError={state.getError}
        search={this.search}
        eventLogSearch={state.searchValue}
        changeTypeFilter={this.changeTypeFilter}
        changeDateFrom={this.changeDateFrom}
        changeDateTo={this.changeDateTo}
        clearDateFilters={this.clearDateFilters}
        askPurgeEventLogs={this.askPurgeEventLogs}
        cancelPurgeEventLogs={this.cancelPurgeEventLogs}
        confirmPurgeEventLogs={this.confirmPurgeEventLogs}
        askDeleteConfirm={state.askDeleteConfirm}
        purgeResult={state.purgeResult}
        dateFrom={state.dateFrom}
        dateTo={state.dateTo}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        previousPage={this.previousPage}
        nextPage={this.nextPage}
      />
    );
  }
}

export default connect('httpClient,currentUrl', {})(EventLog);
