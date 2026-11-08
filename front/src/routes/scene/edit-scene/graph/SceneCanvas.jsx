import { Component } from 'preact';
import { Localizer, Text } from 'preact-i18n';
import { connect } from 'unistore/preact';
import get from 'get-value';
import cx from 'classnames';
import ReactFlow, { Background, Controls, MarkerType, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';

import { ACTIONS } from '../../../../../../server/utils/constants';
import withIntlAsProp from '../../../../utils/withIntlAsProp';
import { getActionSummary, getTriggerSummary } from '../summary';
import { SCENE_DECLARATION_KINDS, getSceneDeclarationTitle } from '../sceneIntegrations';
import { NODE_COMPONENTS } from './GraphNodes';
import NodePanel from './NodePanel';
import { NODE_TYPES, HANDLES, START_NODE_ID, GRID_SIZE, canConnect, getNodeAction, isBlockType } from './sceneGraph';
import editStyle from '../style.css';
import style from './graph.css';

// The canvas of the graph mode (docs/specs/scene-editor-modes.md C). The graph itself lives in
// the editor (index.js), which recomputes the scene from it after every structural change; this
// component draws it and turns the user's gestures into changes.

const EDGE_CLASS = {
  [HANDLES.THEN]: 'edgeThen',
  [HANDLES.ELSE]: 'edgeElse',
  [HANDLES.DO]: 'edgeThen'
};

class SceneCanvas extends Component {
  state = { selectedNodeId: null, selectedEdgeId: null };

  getNode = id => this.props.graph.nodes.find(node => node.id === id);

  // --- what the canvas draws

  displayNodes() {
    const { graph, scene, intl, deviceFeatures, thermostatSchedules, executingPaths, sceneIntegrations } = this.props;
    const dictionary = get(intl, 'dictionary', { default: {} });
    const language = get(this.props, 'user.language') || 'en';
    return graph.nodes.map(node => {
      const display = {
        ...node,
        selected: node.id === this.state.selectedNodeId,
        draggable: node.type !== NODE_TYPES.JOIN,
        selectable: node.type !== NODE_TYPES.JOIN && node.type !== NODE_TYPES.START,
        deletable: false
      };
      if (node.type === NODE_TYPES.TRIGGER) {
        const trigger = scene.triggers[node.data.index] || { type: null };
        return { ...display, data: { ...node.data, trigger, summary: getTriggerSummary(trigger, dictionary) } };
      }
      if (node.type !== NODE_TYPES.ACTION && node.type !== NODE_TYPES.BLOCK) {
        return display;
      }
      const action = getNodeAction(node, scene.actions) || { type: null };
      const title =
        action.type === ACTIONS.EXTERNAL_INTEGRATION.SCENE_ACTION
          ? getSceneDeclarationTitle(sceneIntegrations, SCENE_DECLARATION_KINDS.action, action, language)
          : null;
      return {
        ...display,
        type: isBlockType(action.type) ? NODE_TYPES.BLOCK : NODE_TYPES.ACTION,
        data: {
          ...node.data,
          action,
          title,
          unwired: !node.data.path,
          executing: Boolean(node.data.path && executingPaths && executingPaths[node.data.path]),
          summary: action.type ? getActionSummary(action, dictionary, deviceFeatures, thermostatSchedules) : null
        }
      };
    });
  }

  displayEdges() {
    const unwired = new Set(this.props.graph.nodes.filter(node => node.data && node.data.path === null).map(n => n.id));
    return this.props.graph.edges.map(edge => ({
      ...edge,
      type: 'smoothstep',
      selected: edge.id === this.state.selectedEdgeId,
      deletable: false,
      className: cx(style.edge, style[EDGE_CLASS[edge.sourceHandle]], {
        [style.edgeUnwired]: unwired.has(edge.source) || unwired.has(edge.target),
        [style.edgeTrigger]: edge.target === START_NODE_ID
      }),
      markerEnd: edge.target === START_NODE_ID ? undefined : { type: MarkerType.ArrowClosed, width: 16, height: 16 }
    }));
  }

  // --- gestures

  // Moving a node only redraws it; dropping it somewhere else is a structural change (the order of
  // parallel actions follows their vertical order). A click also reports a drag, without a move.
  onNodesChange = changes => {
    const { graph } = this.props;
    const moves = changes.filter(
      change => (change.type === 'position' && change.position) || change.type === 'dimensions'
    );
    if (moves.length === 0) {
      return;
    }
    this.props.changeGraph(
      { nodes: applyNodeChanges(moves, graph.nodes), edges: graph.edges },
      { structural: false, history: false }
    );
  };

  onNodeDragStart = (event, node) => {
    const current = this.getNode(node.id);
    this.dragOrigin = current && current.position ? { id: node.id, ...current.position } : null;
    this.dragSnapshot = this.props.graph;
  };

  onNodeDragStop = (event, node) => {
    const origin = this.dragOrigin;
    this.dragOrigin = null;
    const current = this.getNode(node.id);
    if (!origin || !current || (current.position.x === origin.x && current.position.y === origin.y)) {
      return;
    }
    this.props.changeGraph(this.props.graph, { structural: true, history: true, historyFrom: this.dragSnapshot });
  };

  onNodeClick = (event, node) => {
    if (node.type === NODE_TYPES.JOIN || node.type === NODE_TYPES.START) {
      return;
    }
    this.setState({ selectedNodeId: node.id, selectedEdgeId: null });
  };

  onEdgeClick = (event, edge) => {
    // the edges into the start are drawn by the triggers: they cannot be removed
    if (edge.target === START_NODE_ID) {
      return;
    }
    this.setState({ selectedEdgeId: edge.id, selectedNodeId: null });
  };

  onPaneClick = () => this.setState({ selectedNodeId: null, selectedEdgeId: null });

  isValidConnection = connection =>
    canConnect(this.props.scene, this.props.graph.nodes, this.props.graph.edges, connection);

  onConnect = connection => {
    if (!this.isValidConnection(connection)) {
      return;
    }
    this.props.connectNodes(connection);
  };

  onKeyDown = event => {
    const target = event.target;
    // keys typed in a form of the panel are not for the canvas
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && (event.key === 'z' || event.key === 'Z') && !event.shiftKey) {
      event.preventDefault();
      this.props.undoGraph();
    } else if (ctrl && (event.key === 'y' || ((event.key === 'z' || event.key === 'Z') && event.shiftKey))) {
      event.preventDefault();
      this.props.redoGraph();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.state.selectedEdgeId) {
        this.props.removeEdge(this.state.selectedEdgeId);
        this.setState({ selectedEdgeId: null });
      } else if (this.state.selectedNodeId) {
        this.removeNode(this.state.selectedNodeId);
      }
    }
  };

  removeNode = async nodeId => {
    const node = this.getNode(nodeId);
    if (!node) {
      return;
    }
    if (node.type === NODE_TYPES.TRIGGER) {
      this.props.deleteTrigger(node.data.index);
    } else {
      const action = getNodeAction(node, this.props.scene.actions);
      // a block goes away with its branches: ask first when they hold something
      const hasBranches =
        node.data.path &&
        this.props.graph.nodes.some(
          other => other.data && other.data.path && other.data.path.startsWith(`${node.data.path}.`)
        );
      if (action && isBlockType(action.type) && hasBranches && !(await this.props.askConfirmation('deleteBlock'))) {
        return;
      }
      this.props.removeNode(nodeId);
    }
    this.setState({ selectedNodeId: null });
  };

  insertNode = (nodeId, where, handle) => {
    const newId = this.props.insertNode(nodeId, where, handle);
    if (newId) {
      this.setState({ selectedNodeId: newId, selectedEdgeId: null });
    }
  };

  appendNode = () => {
    const newId = this.props.appendNode();
    if (newId) {
      this.setState({ selectedNodeId: newId, selectedEdgeId: null });
    }
  };

  addTrigger = () => {
    const newId = this.props.addTrigger();
    if (newId) {
      this.setState({ selectedNodeId: newId, selectedEdgeId: null });
    }
  };

  closePanel = () => this.setState({ selectedNodeId: null });

  componentDidUpdate() {
    this.dropMissingSelection();
  }

  // the selected node may have gone (undo, removed trigger)
  dropMissingSelection = () => {
    if (this.state.selectedNodeId && !this.getNode(this.state.selectedNodeId)) {
      this.setState({ selectedNodeId: null });
    }
  };

  render(props, { selectedNodeId }) {
    const selectedNode = selectedNodeId ? this.getNode(selectedNodeId) : null;
    const panelNode =
      selectedNode && (selectedNode.type === NODE_TYPES.ACTION || selectedNode.type === NODE_TYPES.BLOCK)
        ? { ...selectedNode, data: { ...selectedNode.data, action: getNodeAction(selectedNode, props.scene.actions) } }
        : selectedNode;
    const unwiredCount = props.graph.nodes.filter(node => node.data && node.data.path === null).length;

    return (
      <div class={style.canvasWrapper} onKeyDown={this.onKeyDown} tabIndex={0} data-cy="graph-canvas">
        <div class={style.toolbar}>
          <button
            type="button"
            class={cx(editStyle.pill, editStyle.pillAccent)}
            onClick={this.appendNode}
            data-cy="graph-add-action"
          >
            <i class="fe fe-plus" /> <Text id="editScene.graph.addAction" />
          </button>
          <button
            type="button"
            class={cx(editStyle.pill, editStyle.pillAccent)}
            onClick={this.addTrigger}
            data-cy="graph-add-trigger"
          >
            <i class="fe fe-zap" /> <Text id="editScene.addNewTriggerButton" />
          </button>
          <Localizer>
            <button
              type="button"
              class={cx(editStyle.pill, editStyle.pillIcon)}
              onClick={props.relayoutGraph}
              title={<Text id="editScene.graph.relayout" />}
              data-cy="graph-relayout"
            >
              <i class="fe fe-grid" />
            </button>
          </Localizer>
          <Localizer>
            <button
              type="button"
              class={cx(editStyle.pill, editStyle.pillIcon)}
              onClick={props.undoGraph}
              disabled={!props.canUndo}
              title={<Text id="editScene.graph.undo" />}
              data-cy="graph-undo"
            >
              <i class="fe fe-corner-up-left" />
            </button>
          </Localizer>
          <Localizer>
            <button
              type="button"
              class={cx(editStyle.pill, editStyle.pillIcon)}
              onClick={props.redoGraph}
              disabled={!props.canRedo}
              title={<Text id="editScene.graph.redo" />}
              data-cy="graph-redo"
            >
              <i class="fe fe-corner-up-right" />
            </button>
          </Localizer>
          {unwiredCount > 0 && (
            <span class={cx(style.statusBadge, style.statusWarning)} data-cy="graph-unwired-count">
              <i class="fe fe-alert-triangle" />{' '}
              <Text id="editScene.graph.unwiredCount" plural={unwiredCount} fields={{ count: unwiredCount }} />
            </span>
          )}
          {props.graphError && (
            <span class={cx(style.statusBadge, style.statusDanger)}>
              <Text id={`editScene.graph.errors.${props.graphError}`} />
            </span>
          )}
        </div>
        <div class={style.canvas}>
          <ReactFlow
            nodes={this.displayNodes()}
            edges={this.displayEdges()}
            nodeTypes={NODE_COMPONENTS}
            onNodesChange={this.onNodesChange}
            onNodeDragStart={this.onNodeDragStart}
            onNodeDragStop={this.onNodeDragStop}
            onNodeClick={this.onNodeClick}
            onEdgeClick={this.onEdgeClick}
            onPaneClick={this.onPaneClick}
            onConnect={this.onConnect}
            isValidConnection={this.isValidConnection}
            deleteKeyCode={null}
            snapToGrid
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={GRID_SIZE} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
          {panelNode && (
            <NodePanel
              {...props}
              node={panelNode}
              closePanel={this.closePanel}
              removeNode={this.removeNode}
              insertNode={this.insertNode}
            />
          )}
        </div>
      </div>
    );
  }
}

export default connect('user', {})(withIntlAsProp(SceneCanvas));
