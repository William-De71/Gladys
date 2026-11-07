import { Handle, Position } from 'reactflow';
import { Text } from 'preact-i18n';
import cx from 'classnames';

import { ACTIONS } from '../../../../../../server/utils/constants';
import { ACTION_ICON, ACTION_COLOR, TRIGGER_ICON, TRIGGER_COLOR, COLOR_CLASS } from '../typesCatalog';
import { HANDLES } from './sceneGraph';
import editStyle from '../style.css';
import style from './graph.css';

// The nodes of the canvas (docs/specs/scene-editor-modes.md C.1). Their content comes from
// `data`, filled by SceneCanvas from the scene: the action, its title and summary, and whether it
// is running, unwired or selected.

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
    <Handle type="source" position={Position.Right} id={HANDLES.NEXT} class={style.handle} isConnectable={false} />
  </div>
);

export const StartNode = () => (
  <div class={cx(style.startNode)} data-cy="graph-start-node">
    <i class="fe fe-play" />
    <span>
      <Text id="editScene.graph.start" />
    </span>
    <Handle type="target" position={Position.Left} class={style.handle} isConnectable={false} />
    <Handle type="source" position={Position.Right} id={HANDLES.NEXT} class={style.handle} />
  </div>
);

export const JoinNode = () => (
  <div class={style.joinNode} title="">
    <Handle type="target" position={Position.Left} class={style.joinHandle} isConnectable={false} />
    <Handle type="source" position={Position.Right} id={HANDLES.NEXT} class={style.joinHandle} isConnectable={false} />
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

// Vertical position of each output label, by number of outputs
const OUTPUT_POSITIONS = {
  1: ['outputMiddle'],
  2: ['outputTop', 'outputBottom']
};

export const ActionNode = ({ data, selected }) => {
  const { action } = data;
  const type = action ? action.type : null;
  const outputs = BLOCK_OUTPUTS[type] || [];
  return (
    <div
      class={cx(style.node, style.actionNode, {
        [style.blockNode]: outputs.length > 0,
        [style.unwiredNode]: data.unwired,
        [style.executingNode]: data.executing,
        [style.selectedNode]: selected
      })}
      data-cy="graph-action-node"
      data-path={data.path || ''}
    >
      <Handle type="target" position={Position.Left} class={style.handle} />
      <NodeIcon icon={type ? ACTION_ICON[type] : 'fe fe-plus-circle'} color={ACTION_COLOR[type]} />
      <NodeText
        title={data.title || (type ? <Text id={`editScene.actions.${type}`} /> : <Text id="editScene.newAction" />)}
        summary={data.summary}
      />
      {outputs.map((output, index) => (
        <div
          key={output.handle}
          class={cx(style.outputLabel, style[output.className], style[OUTPUT_POSITIONS[outputs.length][index]])}
        >
          <Text id={output.labelId} />
          <Handle
            type="source"
            position={Position.Right}
            id={output.handle}
            class={cx(style.handle, style[output.className])}
            data-cy={`graph-handle-${output.handle}`}
          />
        </div>
      ))}
      <Handle
        type="source"
        position={outputs.length > 0 ? Position.Bottom : Position.Right}
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
