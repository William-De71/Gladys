import { Localizer, Text } from 'preact-i18n';
import cx from 'classnames';

import { ACTIONS } from '../../../../../../server/utils/constants';
import ACTION_COMPONENTS from '../actionComponents';
import TriggerCard from '../TriggerCard';
import ConditionIfElseThen from '../actions/ConditionIfElseThen';
import ConditionWhile from '../actions/ConditionWhile';
import { HANDLES, NODE_TYPES, isBlockType, getAtPath } from './sceneGraph';
import style from './graph.css';

// The panel of the selected node (docs/specs/scene-editor-modes.md C.5): the same forms as the
// cards of the classic editor, so each action keeps a single form.

const BLOCK_COMPONENTS = {
  [ACTIONS.CONDITION.IF_THEN_ELSE]: ConditionIfElseThen,
  [ACTIONS.CONDITION.WHILE]: ConditionWhile
};

const PanelButton = ({ onClick, icon, labelId, cy, danger }) => (
  <Localizer>
    <button
      type="button"
      class={cx('btn btn-sm', danger ? 'btn-outline-danger' : 'btn-outline-secondary', style.panelButton)}
      onClick={onClick}
      data-cy={cy}
      title={<Text id={labelId} />}
    >
      <i class={`fe fe-${icon}`} /> <Text id={labelId} />
    </button>
  </Localizer>
);

const ActionInsertButtons = ({ node, action, onInsert }) => {
  const type = action && action.type;
  return (
    <div class={style.panelActions}>
      {type === ACTIONS.CONDITION.IF_THEN_ELSE && (
        <>
          <PanelButton
            onClick={() => onInsert(node.id, 'after', HANDLES.THEN)}
            icon="corner-down-right"
            labelId="editScene.graph.addInThen"
            cy="graph-add-then"
          />
          <PanelButton
            onClick={() => onInsert(node.id, 'after', HANDLES.ELSE)}
            icon="corner-down-right"
            labelId="editScene.graph.addInElse"
            cy="graph-add-else"
          />
        </>
      )}
      {type === ACTIONS.CONDITION.WHILE && (
        <PanelButton
          onClick={() => onInsert(node.id, 'after', HANDLES.DO)}
          icon="corner-down-right"
          labelId="editScene.graph.addInDo"
          cy="graph-add-do"
        />
      )}
      <PanelButton
        onClick={() => onInsert(node.id, 'after', HANDLES.NEXT)}
        icon="arrow-right"
        labelId="editScene.graph.addAfter"
        cy="graph-add-after"
      />
      <PanelButton
        onClick={() => onInsert(node.id, 'parallel')}
        icon="git-merge"
        labelId="editScene.addParallelActionButton"
        cy="graph-add-parallel"
      />
    </div>
  );
};

const NodePanel = props => {
  const { node, scene } = props;
  if (!node) {
    return null;
  }

  if (node.type === NODE_TYPES.TRIGGER) {
    return (
      <div class={style.panel} data-cy="graph-panel">
        <TriggerCard
          trigger={scene.triggers[node.data.index]}
          index={node.data.index}
          deleteTrigger={props.deleteTrigger}
          updateTriggerProperty={props.updateTriggerProperty}
          variables={props.variables}
          setVariablesTrigger={props.setVariablesTrigger}
          sceneIntegrations={props.sceneIntegrations}
        />
      </div>
    );
  }

  if (node.type !== NODE_TYPES.ACTION && node.type !== NODE_TYPES.BLOCK) {
    return null;
  }

  const action = node.data.action || { type: null };
  const unwired = !node.data.path;
  const block = isBlockType(action.type);
  // A wired node is edited in the scene through its path; an unwired one in the node itself
  const path = unwired ? `unwired.${node.id}` : node.data.path;
  const updateActionProperty = unwired
    ? (ignoredPath, property, value) => props.updateUnwiredAction(node.id, property, value)
    : props.updateActionProperty;
  const topStepIndex = unwired ? scene.actions.length : Number(path.split('.')[0]);
  const Component = block ? BLOCK_COMPONENTS[action.type] : ACTION_COMPONENTS[action.type];
  // The forms of the blocks fill in missing branches when they mount: they get the action as it
  // is in the scene, branches included, or they would empty them
  const formAction = unwired ? action : getAtPath(scene.actions, path) || action;

  return (
    <div class={style.panel} data-cy="graph-panel">
      <div class={style.panelHeader}>
        <span class={style.panelTitle}>
          {action.type ? <Text id={`editScene.actions.${action.type}`} /> : <Text id="editScene.newAction" />}
        </span>
        <Localizer>
          <button
            type="button"
            class={cx('btn btn-sm btn-link', style.panelClose)}
            onClick={props.closePanel}
            aria-label={<Text id="editScene.graph.closePanel" />}
          >
            <i class="fe fe-x" />
          </button>
        </Localizer>
      </div>
      {unwired && (
        <div class="alert alert-warning py-2">
          <i class="fe fe-alert-triangle" /> <Text id="editScene.graph.unwiredNodeHint" />
        </div>
      )}
      {!unwired && <ActionInsertButtons node={node} action={action} onInsert={props.insertNode} />}
      <div class={style.panelBody}>
        {unwired && block ? (
          <div class="text-muted">
            <Text id="editScene.graph.unwiredBlockHint" />
          </div>
        ) : (
          Component && (
            <Component
              action={formAction}
              allActions={scene.actions}
              path={path}
              hideBranches
              updateActionProperty={updateActionProperty}
              variables={props.variables}
              setVariables={props.setVariables}
              actionsGroupsBefore={scene.actions.slice(0, topStepIndex)}
              triggersVariables={props.triggersVariables}
              deleteAction={props.deleteAction}
              deleteActionGroup={props.deleteActionGroup}
              addAction={props.addAction}
              moveCard={props.moveCard}
              moveCardGroup={props.moveCardGroup}
              scene={scene}
              sceneIntegrations={props.sceneIntegrations}
              deviceFeatures={props.deviceFeatures}
              thermostatSchedules={props.thermostatSchedules}
            />
          )
        )}
      </div>
      <div class={style.panelFooter}>
        <PanelButton
          onClick={() => props.removeNode(node.id)}
          icon="trash-2"
          labelId={block ? 'editScene.graph.deleteBlock' : 'editScene.deleteActionButton'}
          cy="graph-delete-node"
          danger
        />
      </div>
    </div>
  );
};

export default NodePanel;
