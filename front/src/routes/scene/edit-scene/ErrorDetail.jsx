import { useState } from 'preact/hooks';
import { Text } from 'preact-i18n';
import cx from 'classnames';

import { describeActionPath, PROBLEMS } from './saveErrors';
import { getAtPath } from './graph/sceneGraph';
import style from './style.css';

// What the server said when it refused a save (docs/specs/scene-editor-modes.md C.5): the problems
// it names, in the user's language, at their place in the scene, with the name of the action or
// trigger. The raw text stays available, folded, for a developer.
const MAX_FOLDED_LENGTH = 240;

const Place = ({ problem, scene }) => {
  if (problem.actionPath) {
    const action = getAtPath(scene.actions, problem.actionPath);
    return (
      <span>
        {describeActionPath(problem.actionPath).map((place, index) => (
          <span key={index}>
            {index > 0 && ' › '}
            <Text id={`editScene.saveErrors.places.${place.kind}`} fields={{ number: place.number }} />
          </span>
        ))}
        {action && action.type && (
          <span>
            {' ('}
            <Text id={`editScene.actions.${action.type}`} />)
          </span>
        )}
      </span>
    );
  }
  if (problem.triggerIndex !== null && problem.triggerIndex !== undefined) {
    const trigger = (scene.triggers || [])[problem.triggerIndex];
    return (
      <span>
        <Text id="editScene.saveErrors.places.trigger" fields={{ number: problem.triggerIndex + 1 }} />
        {trigger && trigger.type && (
          <span>
            {' ('}
            <Text id={`editScene.triggers.${trigger.type}`} />)
          </span>
        )}
      </span>
    );
  }
  return <Text id="editScene.saveErrors.places.scene" />;
};

const Problem = ({ problem }) => {
  if (problem.problem === PROBLEMS.SYNTAX && problem.line !== null) {
    return (
      <Text
        id="editScene.saveErrors.problems.syntaxAt"
        fields={{ line: problem.line, column: problem.column, reason: problem.reason }}
      />
    );
  }
  return (
    <Text
      id={`editScene.saveErrors.problems.${problem.problem}`}
      fields={{ field: problem.field, reason: problem.reason }}
    />
  );
};

const ErrorDetail = ({ message, problems, scene }) => {
  const [open, setOpen] = useState(false);
  const understood = Array.isArray(problems) && problems.length > 0;
  const long = message.length > MAX_FOLDED_LENGTH;
  // understood problems are listed, the raw text is only shown on demand
  const showRaw = understood ? open : open || !long;
  return (
    <div class="mt-2" data-cy="save-error-detail">
      {understood && (
        <ul class={style.errorProblems} data-cy="save-error-problems">
          {problems.map((problem, index) => (
            <li key={index}>
              <strong>
                <Place problem={problem} scene={scene} />
              </strong>
              {' : '}
              <Problem problem={problem} />
            </li>
          ))}
        </ul>
      )}
      {!understood && !showRaw && <small class={style.errorDetail}>{`${message.slice(0, MAX_FOLDED_LENGTH)}…`}</small>}
      {showRaw && <small class={cx(style.errorDetail, style.errorDetailOpen)}>{message}</small>}
      {(understood || long) && (
        <div class="mt-1">
          <button type="button" class={cx(style.pill, style.pillSmall)} onClick={() => setOpen(!open)}>
            <Text id={open ? 'editScene.hideErrorDetail' : 'editScene.showErrorDetail'} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorDetail;
