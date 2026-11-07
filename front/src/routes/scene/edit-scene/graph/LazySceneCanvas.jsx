import { Component } from 'preact';
import { Text } from 'preact-i18n';
import cx from 'classnames';

import style from './graph.css';

// The canvas and its library are only loaded when a scene is opened in the graph mode, so the
// other pages do not pay for them.
class LazySceneCanvas extends Component {
  state = { SceneCanvas: null, loadError: false };

  componentDidMount() {
    this.loadCanvas();
  }

  loadCanvas = async () => {
    try {
      const { default: SceneCanvas } = await import('./SceneCanvas');
      this.setState({ SceneCanvas });
    } catch (e) {
      console.error(e);
      this.setState({ loadError: true });
    }
  };

  render(props, { SceneCanvas, loadError }) {
    if (loadError) {
      return (
        <div class="alert alert-danger">
          <Text id="editScene.graph.loadError" />
        </div>
      );
    }
    if (!SceneCanvas) {
      return (
        <div class={cx('dimmer active', style.loading)}>
          <div class="loader" />
        </div>
      );
    }
    return <SceneCanvas {...props} />;
  }
}

export default LazySceneCanvas;
