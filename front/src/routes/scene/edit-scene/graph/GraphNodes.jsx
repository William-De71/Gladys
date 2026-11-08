import { Handle, Position } from 'reactflow';
import { Text } from 'preact-i18n';
import cx from 'classnames';

import { ACTIONS } from '../../../../../../server/utils/constants';
import { ACTION_ICON, ACTION_COLOR, TRIGGER_ICON, TRIGGER_COLOR, COLOR_CLASS } from '../typesCatalog';
import { HANDLES, DIRECTIONS } from './sceneGraph';
import editStyle from '../style.css';
import style from './graph.css';

// The nodes of the canvas (docs/specs/scene-editor-modes.md C.1). Their content comes from
// `data`, filled by SceneCanvas from the scene: the action, its title and summary, whether it is
// running, unwired or selected, and the direction of the graph.

// Where the handles are, by direction of the graph (spec C.5): the input faces where the flow
// comes from, the output where it goes; the branches of a block leave on the flow side, the rest
// of the scene on the other one
const SIDES = {
  [DIRECTIONS.HORIZONTAL]: { input: Position.Left, output: Position.Right, blockNext: Position.Bottom },
  [DIRECTIONS.VERTICAL]: { input: Position.Top, output: Position.Bottom, blockNext: Position.Right }
};
const sidesOf = data => SIDES[(data && data.direction) || DIRECTIONS.HORIZONTAL] || SIDES[DIRECTIONS.HORIZONTAL];

const NodeIcon = ({ icon, color }) => (
  <span class={cx(editStyle.stepIconTile, editStyle[COLOR_CLASS[color] || 'typePickerIconGray'], style.nodeIcon)}>
    <i class={cx(icon, 'dark-mode-fe-none-filter')} />
  </span>
);

const NodeText = ({ title, summary }) => (
  <div class={style.nodeText}>
    <span class={style.nodeTitle}>{title}</span>
    {summary && <span class={style.nodeSummary}>{summary}</span>}
  </div>
);

export const TriggerNode = ({ data }) => (
  <div class={cx(style.node, style.triggerNode)} data-cy="graph-trigger-node">
    <NodeIcon
      icon={data.trigger.type ? TRIGGER_ICON[data.trigger.type] : 'fe fe-plus-circle'}
      color={TRIGGER_COLOR[data.trigger.type]}
    />
    <NodeText
      title={
        data.trigger.type ? <Text id={`editScene.triggers.${data.trigger.type}`} /> : <Text id="editScene.newTrigger" />
      }
      summary={data.summary}
    />
    <Handle
      type="source"
      position={sidesOf(data).output}
      id={HANDLES.NEXT}
      class={style.handle}
      isConnectable={false}
    />
  </div>
);

export const StartNode = ({ data }) => (
  <div class={cx(style.startNode)} data-cy="graph-start-node">
    <i class="fe fe-play" />
    <span>
      <Text id="editScene.graph.start" />
    </span>
    <Handle type="target" position={sidesOf(data).input} class={style.handle} isConnectable={false} />
    <Handle type="source" position={sidesOf(data).output} id={HANDLES.NEXT} class={style.handle} />
  </div>
);

export const JoinNode = ({ data }) => (
  <div class={style.joinNode} title="">
    <Handle type="target" position={sidesOf(data).input} class={style.joinHandle} isConnectable={false} />
    <Handle
      type="source"
      position={sidesOf(data).output}
      id={HANDLES.NEXT}
      class={style.joinHandle}
      isConnectable={false}
    />
  </div>
);

// Outputs of a block, with their label, top to bottom
const BLOCK_OUTPUTS = {
  [ACTIONS.CONDITION.IF_THEN_ELSE]: [
    { handle: HANDLES.THEN, labelId: 'editScene.graph.thenOutput', className: 'handleThen' },
    { handle: HANDLES.ELSE, labelId: 'editScene.graph.elseOutput', className: 'handleElse' }
  ],
  [ACTIONS.CONDITION.WHILE]: [{ handle: HANDLES.DO, labelId: 'editScene.graph.doOutput', className: 'handleThen' }]
};

// Where each output label sits on the flow side, by direction and number of outputs
const OUTPUT_POSITIONS = {
  [DIRECTIONS.HORIZONTAL]: {
    1: ['outputMiddle'],
    2: ['outputTop', 'outputBottom']
  },
  [DIRECTIONS.VERTICAL]: {
    1: ['outputVertical outputCenter'],
    2: ['outputVertical outputLeft', 'outputVertical outputRight']
  }
};

export const ActionNode = ({ data, selected }) => {
  const { action } = data;
  const type = action ? action.type : null;
  const outputs = BLOCK_OUTPUTS[type] || [];
  const sides = sidesOf(data);
  const outputPositions = OUTPUT_POSITIONS[data.direction] || OUTPUT_POSITIONS[DIRECTIONS.HORIZONTAL];
  return (
    <div
      class={cx(style.node, style.actionNode, {
        [style.blockNode]: outputs.length > 0,
        [style.blockNodeVertical]: outputs.length > 0 && data.direction === DIRECTIONS.VERTICAL,
        [style.unwiredNode]: data.unwired,
        [style.untypedNode]: !type,
        [style.executingNode]: data.executing,
        [style.selectedNode]: selected
      })}
      data-cy="graph-action-node"
      data-path={data.path || ''}
    >
      <Handle type="target" position={sides.input} class={style.handle} />
      <NodeIcon icon={type ? ACTION_ICON[type] : 'fe fe-plus-circle'} color={ACTION_COLOR[type]} />
      <NodeText
        title={data.title || (type ? <Text id={`editScene.actions.${type}`} /> : <Text id="editScene.newAction" />)}
        summary={data.summary}
      />
      {outputs.map((output, index) => (
        <div
          key={output.handle}
          class={cx(
            style.outputLabel,
            style[output.className],
            ...outputPositions[outputs.length][index].split(' ').map(name => style[name])
          )}
        >
          <Text id={output.labelId} />
          <Handle
            type="source"
            position={sides.output}
            id={output.handle}
            class={cx(style.handle, style[output.className])}
            data-cy={`graph-handle-${output.handle}`}
          />
        </div>
      ))}
      <Handle
        type="source"
        position={outputs.length > 0 ? sides.blockNext : sides.output}
        id={HANDLES.NEXT}
        class={style.handle}
        data-cy="graph-handle-next"
      />
    </div>
  );
};

export const NODE_COMPONENTS = {
  trigger: TriggerNode,
  start: StartNode,
  action: ActionNode,
  block: ActionNode,
  join: JoinNode
};
