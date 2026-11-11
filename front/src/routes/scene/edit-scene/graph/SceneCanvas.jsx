import { Component } from 'preact';
import { Localizer, Text } from 'preact-i18n';
import { connect } from 'unistore/preact';
import get from 'get-value';
import cx from 'classnames';
import ReactFlow, { Background, Controls, MarkerType, MiniMap, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';

import { ACTIONS } from '../../../../../../server/utils/constants';
import withIntlAsProp from '../../../../utils/withIntlAsProp';
import { getActionSummary, getTriggerSummary } from '../summary';
import { SCENE_DECLARATION_KINDS, getSceneDeclarationTitle } from '../sceneIntegrations';
import { NODE_COMPONENTS } from './GraphNodes';
import NodePanel from './NodePanel';
import {
  NODE_TYPES,
  HANDLES,
  START_NODE_ID,
  GRID_SIZE,
  DIRECTIONS,
  canConnect,
  getNodeAction,
  copyNodes,
  isBlockType
} from './sceneGraph';
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

// A phone shows the whole scene, smaller; a larger screen keeps the blocks readable
const FIT_VIEW_OPTIONS = {
  padding: 0.2,
  minZoom: typeof window !== 'undefined' && window.innerWidth < 576 ? 0.3 : 0.6,
  maxZoom: 1
};

class SceneCanvas extends Component {
  // Several nodes may be selected (Ctrl + click, or Shift + drag): they are moved, copied and
  // removed together. The panel opens for a single one, picked with a plain click: it covers a
  // part of the canvas, so building a selection never opens it.
  state = { selectedNodeIds: [], selectedEdgeId: null, hasClipboard: false, panelClosed: false };

  selectedNodeId = () => (this.state.selectedNodeIds.length === 1 ? this.state.selectedNodeIds[0] : null);

  selectNode = id => this.setState({ selectedNodeIds: id ? [id] : [], selectedEdgeId: null, panelClosed: false });

  isSelectable = node => Boolean(node) && node.type !== NODE_TYPES.JOIN && node.type !== NODE_TYPES.START;

  getNode = id => this.props.graph.nodes.find(node => node.id === id);

  // --- what the canvas draws

  displayNodes() {
    const { graph, scene, intl, deviceFeatures, thermostatSchedules, executingPaths, sceneIntegrations } = this.props;
    const dictionary = get(intl, 'dictionary', { default: {} });
    const language = get(this.props, 'user.language') || 'en';
    const { direction } = this.props;
    return graph.nodes.map(node => {
      const display = {
        ...node,
        data: { ...node.data, direction },
        selected: this.state.selectedNodeIds.includes(node.id),
        draggable: node.type !== NODE_TYPES.JOIN,
        selectable: node.type !== NODE_TYPES.JOIN && node.type !== NODE_TYPES.START,
        deletable: false
      };
      if (node.type === NODE_TYPES.TRIGGER) {
        const trigger = scene.triggers[node.data.index] || { type: null };
        return { ...display, data: { ...display.data, trigger, summary: getTriggerSummary(trigger, dictionary) } };
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
          ...display.data,
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
    // The box drawn with Shift + drag selects the nodes it covers. The clicks are handled by
    // onNodeClick alone: the canvas would otherwise toggle a node a second time.
    const selections = this.boxSelecting
      ? changes.filter(change => change.type === 'select' && this.isSelectable(this.getNode(change.id)))
      : [];
    if (selections.length > 0) {
      this.setState(prevState => {
        const ids = new Set(prevState.selectedNodeIds);
        selections.forEach(change => (change.selected ? ids.add(change.id) : ids.delete(change.id)));
        return { selectedNodeIds: [...ids], selectedEdgeId: null, panelClosed: true };
      });
    }
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

  onSelectionStart = () => {
    this.boxSelecting = true;
  };

  onSelectionEnd = () => {
    this.boxSelecting = false;
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
    if (!this.isSelectable(node)) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      // add the node to the selection, or take it out
      this.setState(prevState => ({
        selectedNodeIds: prevState.selectedNodeIds.includes(node.id)
          ? prevState.selectedNodeIds.filter(id => id !== node.id)
          : [...prevState.selectedNodeIds, node.id],
        selectedEdgeId: null,
        panelClosed: true
      }));
      return;
    }
    this.selectNode(node.id);
  };

  onEdgeClick = (event, edge) => {
    // the edges into the start are drawn by the triggers: they cannot be removed
    if (edge.target === START_NODE_ID) {
      return;
    }
    this.setState({ selectedEdgeId: edge.id, selectedNodeIds: [] });
  };

  onPaneClick = () => this.setState({ selectedNodeIds: [], selectedEdgeId: null });

  isValidConnection = connection =>
    canConnect(this.props.scene, this.props.graph.nodes, this.props.graph.edges, connection, this.props.direction);

  onConnect = connection => {
    if (!this.isValidConnection(connection)) {
      return;
    }
    this.props.connectNodes(connection);
  };

  onKeyDown = event => {
    const target = event.target;
    // keys typed in a field, or anywhere in the panel (a select, a button), are not for the canvas
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        (target.closest && target.closest('[data-graph-panel]')))
    ) {
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
      } else {
        this.removeSelection();
      }
    } else if (ctrl && (event.key === 'c' || event.key === 'C')) {
      this.copySelection();
    } else if (ctrl && (event.key === 'v' || event.key === 'V')) {
      this.pasteClipboard();
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
      if (
        action &&
        isBlockType(action.type) &&
        this.hasBranchNodes(node) &&
        !(await this.props.askConfirmation('deleteBlock'))
      ) {
        return;
      }
      this.props.removeNode(nodeId);
    }
    this.selectNode(null);
  };

  hasBranchNodes = node =>
    Boolean(node.data.path) &&
    this.props.graph.nodes.some(
      other => other.data && other.data.path && other.data.path.startsWith(`${node.data.path}.`)
    );

  // Remove what is selected: one node as its panel does, several ones together
  removeSelection = async () => {
    const ids = this.state.selectedNodeIds;
    if (ids.length === 1) {
      await this.removeNode(ids[0]);
      return;
    }
    const nodes = ids.map(this.getNode).filter(Boolean);
    if (nodes.length === 0) {
      return;
    }
    const actionNodes = nodes.filter(node => node.type !== NODE_TYPES.TRIGGER);
    if (actionNodes.some(this.hasBranchNodes) && !(await this.props.askConfirmation('deleteBlock'))) {
      return;
    }
    if (actionNodes.length > 0) {
      this.props.removeNodes(actionNodes.map(node => node.id));
    }
    // the last triggers first: removing one renumbers those after it
    nodes
      .filter(node => node.type === NODE_TYPES.TRIGGER)
      .map(node => node.data.index)
      .sort((a, b) => b - a)
      .forEach(index => this.props.deleteTrigger(index));
    this.selectNode(null);
  };

  // --- copy and paste (spec C.5): the copy stays in the canvas, it is not the system clipboard

  copySelection = () => {
    const clipboard = copyNodes(this.props.graph, this.state.selectedNodeIds, this.props.scene.actions);
    if (clipboard.nodes.length > 0) {
      this.clipboard = clipboard;
      this.setState({ hasClipboard: true });
    }
  };

  pasteClipboard = () => {
    if (!this.clipboard) {
      return;
    }
    const ids = this.props.pasteNodes(this.clipboard);
    this.setState({ selectedNodeIds: ids, selectedEdgeId: null, panelClosed: false });
  };

  insertNode = (nodeId, where, handle) => {
    const newId = this.props.insertNode(nodeId, where, handle);
    if (newId) {
      this.selectNode(newId);
    }
  };

  appendNode = () => {
    const newId = this.props.appendNode();
    if (newId) {
      this.selectNode(newId);
    }
  };

  addTrigger = () => {
    const newId = this.props.addTrigger();
    if (newId) {
      this.selectNode(newId);
    }
  };

  closePanel = () => this.selectNode(null);

  toggleDirection = () =>
    this.props.setGraphDirection(
      this.props.direction === DIRECTIONS.VERTICAL ? DIRECTIONS.HORIZONTAL : DIRECTIONS.VERTICAL
    );

  componentDidUpdate() {
    this.dropMissingSelection();
  }

  // the selected node may have gone (undo, removed trigger)
  dropMissingSelection = () => {
    if (this.state.selectedNodeIds.some(id => !this.getNode(id))) {
      this.setState(prevState => ({ selectedNodeIds: prevState.selectedNodeIds.filter(id => this.getNode(id)) }));
    }
  };

  render(props, { selectedNodeIds, hasClipboard, panelClosed }) {
    const selectedNodeId = panelClosed ? null : this.selectedNodeId();
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
            <i class="fe fe-plus" />
            <span class={style.toolbarLabel}>
              <Text id="editScene.graph.addAction" />
            </span>
          </button>
          <button
            type="button"
            class={cx(editStyle.pill, editStyle.pillAccent)}
            onClick={this.addTrigger}
            data-cy="graph-add-trigger"
          >
            <i class="fe fe-zap" />
            <span class={style.toolbarLabel}>
              <Text id="editScene.addNewTriggerButton" />
            </span>
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
              onClick={this.toggleDirection}
              title={
                <Text
                  id={
                    props.direction === DIRECTIONS.VERTICAL
                      ? 'editScene.graph.directionToHorizontal'
                      : 'editScene.graph.directionToVertical'
                  }
                />
              }
              data-cy="graph-direction"
            >
              <i class={props.direction === DIRECTIONS.VERTICAL ? 'fe fe-arrow-right' : 'fe fe-arrow-down'} />
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
          <Localizer>
            <button
              type="button"
              class={cx(editStyle.pill, editStyle.pillIcon)}
              onClick={this.copySelection}
              disabled={selectedNodeIds.length === 0}
              title={<Text id="editScene.graph.copy" />}
              data-cy="graph-copy"
            >
              <i class="fe fe-copy" />
            </button>
          </Localizer>
          <Localizer>
            <button
              type="button"
              class={cx(editStyle.pill, editStyle.pillIcon)}
              onClick={this.pasteClipboard}
              disabled={!hasClipboard}
              title={<Text id="editScene.graph.paste" />}
              data-cy="graph-paste"
            >
              <i class="fe fe-clipboard" />
            </button>
          </Localizer>
          {selectedNodeIds.length > 1 && (
            <button
              type="button"
              class={cx(editStyle.pill, editStyle.pillDanger)}
              onClick={this.removeSelection}
              data-cy="graph-delete-selection"
            >
              <i class="fe fe-trash-2" />
              <span class={style.toolbarLabel}>
                <Text id="editScene.graph.deleteSelection" fields={{ count: selectedNodeIds.length }} />
              </span>
            </button>
          )}
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
            // the handles move to other sides: the canvas measures them again
            key={props.direction}
            nodes={this.displayNodes()}
            edges={this.displayEdges()}
            nodeTypes={NODE_COMPONENTS}
            onNodesChange={this.onNodesChange}
            onNodeDragStart={this.onNodeDragStart}
            onNodeDragStop={this.onNodeDragStop}
            onNodeClick={this.onNodeClick}
            onEdgeClick={this.onEdgeClick}
            onPaneClick={this.onPaneClick}
            onSelectionStart={this.onSelectionStart}
            onSelectionEnd={this.onSelectionEnd}
            multiSelectionKeyCode={null}
            onConnect={this.onConnect}
            isValidConnection={this.isValidConnection}
            deleteKeyCode={null}
            snapToGrid
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={GRID_SIZE} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className={style.minimap} />
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
