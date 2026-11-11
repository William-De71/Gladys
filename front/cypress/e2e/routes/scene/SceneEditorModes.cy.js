// The three ways of editing a scene: classic, graph and code (docs/specs/scene-editor-modes.md).
// The scene is created through the API, edited through the real editor, and read back from the
// server after each save.
const SCENE_SELECTOR = 'editor-modes-scene';

const delay = value => ({ type: 'delay', value, unit: 'seconds' });

const authenticatedRequest = options =>
  cy.window().then(win => {
    const { access_token: accessToken } = JSON.parse(win.localStorage.getItem('user'));
    return cy.request({
      ...options,
      url: `${Cypress.env('serverUrl')}${options.url}`,
      headers: { authorization: `Bearer ${accessToken}` }
    });
  });

const getSavedScene = () => authenticatedRequest({ method: 'GET', url: `/api/v1/scene/${SCENE_SELECTOR}` }).its('body');

const save = () => cy.contains('button', 'editScene.saveButton').click();

const typeInCodeEditor = text => {
  cy.get('[data-cy="scene-code-editor"] .cm-content').click();
  cy.get('[data-cy="scene-code-editor"] .cm-content').type('{selectall}{backspace}', { delay: 0 });
  cy.get('[data-cy="scene-code-editor"] .cm-content').type(text, { delay: 0, parseSpecialCharSequences: false });
};

describe('Scene editor modes', () => {
  beforeEach(() => {
    cy.login();
  });

  // the other scene specs count the scenes of the list: leave none behind
  after(() => {
    cy.login();
    cy.visit('/dashboard/scene');
    authenticatedRequest({ method: 'DELETE', url: `/api/v1/scene/${SCENE_SELECTOR}`, failOnStatusCode: false });
  });

  it('Should create the scene through the API', () => {
    cy.visit('/dashboard/scene');
    authenticatedRequest({ method: 'DELETE', url: `/api/v1/scene/${SCENE_SELECTOR}`, failOnStatusCode: false });
    authenticatedRequest({
      method: 'POST',
      url: '/api/v1/scene',
      body: {
        name: 'Editor modes scene',
        selector: SCENE_SELECTOR,
        icon: 'bell',
        triggers: [],
        actions: [[delay(1)], [delay(2), delay(3)]]
      }
    })
      .its('status')
      .should('eq', 201);
  });

  it('Should draw the scene as a graph, and insert a step from the panel', () => {
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="editor-mode-graph"]').click();

    cy.get('[data-cy="graph-canvas"]').should('exist');
    cy.get('[data-cy="graph-start-node"]').should('exist');
    cy.get('[data-cy="graph-action-node"]').should('have.length', 3);

    // insert a step after the first delay
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();
    cy.get('[data-cy="graph-panel"]').should('exist');
    cy.get('[data-cy="graph-add-after"]').click();
    cy.get('[data-cy="graph-action-node"]').should('have.length', 4);
    // the new block opens on the type picker
    cy.get('[data-cy="graph-panel"] [data-cy="type-picker-option"][data-value="delay"]').click();
    cy.get('[data-cy="graph-action-node"][data-path="1.0"]').should('exist');

    save();
    cy.contains('editScene.savedLabel').should('exist');
    getSavedScene().then(scene => {
      expect(scene.editor.mode).to.equal('graph');
      expect(scene.editor.graph.positions).to.have.property('0.0');
      expect(scene.actions.map(step => step.map(action => action.type))).to.deep.equal([
        ['delay'],
        ['delay'],
        ['delay', 'delay']
      ]);
      expect(scene.actions[0][0]).to.deep.equal(delay(1));
      expect(scene.actions[2]).to.deep.equal([delay(2), delay(3)]);
    });
  });

  it('Should reopen the scene in the graph mode, then show the same scene in the classic mode', () => {
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-canvas"]').should('exist');
    cy.get('[data-cy="editor-mode-graph"]').should('have.attr', 'aria-pressed', 'true');
    // selecting a node changes nothing
    cy.get('[data-cy="graph-action-node"][data-path="1.0"]').click();
    cy.get('[data-cy="graph-panel"]').should('exist');
    cy.contains('editScene.savedLabel').should('exist');

    cy.get('[data-cy="editor-mode-classic"]').click();
    cy.get('[data-cy="graph-canvas"]').should('not.exist');
    cy.contains('editScene.parallelBlockTitle').should('exist');
    // nothing changed but the mode
    cy.contains('editScene.unsavedChanges').should('exist');
    save();
    getSavedScene().then(scene => {
      expect(scene.editor).to.deep.equal({ mode: 'classic' });
      // the classic editor keeps an empty step at the end, to add the next one
      expect(scene.actions.filter(step => step.length > 0)).to.have.length(3);
    });
  });

  it('Should remove a block of the graph and wire the rest of the scene', () => {
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="editor-mode-graph"]').click();
    cy.get('[data-cy="graph-action-node"][data-path="1.0"]').click();
    cy.get('[data-cy="graph-delete-node"]').click();
    cy.get('[data-cy="graph-action-node"]').should('have.length', 3);
    cy.get('[data-cy="graph-unwired-count"]').should('not.exist');
    save();
    getSavedScene().then(scene => {
      expect(scene.actions).to.deep.equal([[delay(1)], [delay(2), delay(3)]]);
    });
  });

  it('Should convert the scene to code, refuse a script that does not compile, and run the console', () => {
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="editor-mode-code"]').click();
    // the conversion asks first, in the editor's own dialog
    cy.get('[data-cy="confirm-dialog"]').should('contain', Cypress.env('i18n').editScene.modes.toCodeTitle);
    cy.get('[data-cy="confirm-dialog-confirm"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('not.exist');

    cy.get('[data-cy="scene-code-editor"] .cm-content').should(
      'contain',
      "gladys.action('delay', { value: 1, unit: 'seconds' });"
    );
    cy.get('[data-cy="scene-code-editor"] .cm-content').should('contain', 'Promise.all');
    save();
    getSavedScene().then(scene => {
      expect(scene.editor).to.deep.equal({ mode: 'code' });
      expect(scene.actions).to.have.length(1);
      expect(scene.actions[0][0].type).to.equal('script.run');
      expect(scene.actions[0][0].code).to.contain("gladys.action('delay'");
    });

    // a syntax error is refused, with its position
    typeInCodeEditor('const a = ;');
    save();
    cy.get('[data-cy="save-error-problems"]')
      .should('contain', Cypress.env('i18n').editScene.saveErrors.places.scene)
      .should(
        'contain',
        Cypress.env('i18n')
          .editScene.saveErrors.problems.syntaxAt.replace('{{line}}', '1')
          .split('{{column}}')[0]
      );

    typeInCodeEditor("console.log('hello');");
    save();
    cy.contains('editScene.savedLabel').should('exist');
    getSavedScene().then(scene => {
      expect(scene.actions[0][0].code).to.equal("console.log('hello');");
    });

    // the logs of the script
    cy.get('[data-cy="code-console"]').should('contain', Cypress.env('i18n').editScene.code.emptyConsole);
    cy.sendWebSocket({
      type: 'scene.script-log',
      payload: { sceneSelector: SCENE_SELECTOR, level: 'info', message: 'hello from the script' }
    });
    cy.sendWebSocket({
      type: 'scene.script-log',
      payload: { sceneSelector: 'another-scene', level: 'info', message: 'not for this scene' }
    });
    cy.get('[data-cy="code-console"]').should('contain', 'hello from the script');
    cy.get('[data-cy="code-console"]').should('not.contain', 'not for this scene');

    // the reference of the API
    cy.get('[data-cy="code-toggle-reference"]').click();
    cy.get('[data-cy="code-reference"]').should('contain', 'gladys.device.setValue');
    cy.get('[data-cy="code-reference"]')
      .should('contain', 'gladys.light.turnOn')
      .should('contain', Cypress.env('i18n').editScene.code.api.variable);
  });

  it('Should go back to blocks, starting from an empty step', () => {
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="scene-code-editor"]').should('exist');
    cy.get('[data-cy="editor-mode-classic"]').click();
    cy.get('[data-cy="confirm-dialog-confirm"]').click();
    cy.get('[data-cy="scene-code-editor"]').should('not.exist');
    save();
    getSavedScene().then(scene => {
      expect(scene.editor).to.deep.equal({ mode: 'classic' });
      expect(scene.actions).to.deep.equal([[]]);
    });
  });

  it('Should keep the code when the conversion back to blocks is cancelled', () => {
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'code' }, actions: [[{ type: 'script.run', code: 'await sleep(1);' }]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="editor-mode-graph"]').click();
    cy.get('[data-cy="confirm-dialog-cancel"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('not.exist');
    cy.get('[data-cy="scene-code-editor"]').should('exist');
    cy.get('[data-cy="scene-code-editor"] .cm-content').should('contain', 'await sleep(1);');
  });

  it('Should edit the conditions of a block in its panel, keeping its branches', () => {
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: {
        editor: { mode: 'graph' },
        actions: [
          [
            {
              type: 'condition.if-then-else',
              if: [],
              then: [[delay(1)], [delay(2)]],
              else: [[delay(3)]]
            }
          ]
        ]
      }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-action-node"]').should('have.length', 4);
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();
    cy.get('[data-cy="graph-panel"]').should(
      'contain',
      Cypress.env('i18n').editScene.actionsCard.conditionIfThenElse.conditions
    );
    // the panel edits the conditions only: the branches are nodes of the canvas, left untouched
    cy.get('[data-cy="graph-action-node"][data-path="0.0.then.1.0"]').should('exist');
    cy.get('[data-cy="graph-action-node"][data-path="0.0.else.0.0"]').should('exist');
    save();
    getSavedScene().then(scene => {
      // as in the classic editor, the form of the block may keep an empty step at the end of a branch
      const nonEmpty = steps => steps.filter(step => step.length > 0);
      expect(nonEmpty(scene.actions[0][0].then)).to.deep.equal([[delay(1)], [delay(2)]]);
      expect(nonEmpty(scene.actions[0][0].else)).to.deep.equal([[delay(3)]]);
    });
  });

  it('Should lay the graph out top to bottom, and add a function block', () => {
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'graph' }, actions: [[delay(1)]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-direction"]').click();
    // the input of a block faces the top
    cy.get('[data-cy="graph-action-node"][data-path="0.0"] .react-flow__handle-top').should('exist');

    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();
    cy.get('[data-cy="graph-add-after"]').click();
    cy.get('[data-cy="graph-panel"] [data-cy="type-picker-option"][data-value="script.run"]').click();
    cy.get('[data-cy="function-block-editor"] .cm-content').click();
    cy.get('[data-cy="function-block-editor"] .cm-content').type('return 42;', { delay: 0 });

    save();
    cy.contains('editScene.savedLabel').should('exist');
    getSavedScene().then(scene => {
      expect(scene.editor.graph.direction).to.equal('vertical');
      expect(scene.actions[1]).to.deep.equal([{ type: 'script.run', code: 'return 42;' }]);
    });
  });

  it('Should name the blocks without type instead of saving them', () => {
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'graph' }, actions: [[delay(1)]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-add-action"]').click();
    cy.get('[data-cy="graph-add-action"]').click();
    save();
    cy.get('.alert-danger').should(
      'contain',
      Cypress.env('i18n').editScene.untypedActionsError.other.replace('{{count}}', '2')
    );
    cy.get('[data-cy="save-error-detail"]').should('not.exist');
  });

  it('Should explain a refused save in the language of the user, the raw answer on demand', () => {
    const i18n = Cypress.env('i18n').editScene;
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'classic' }, actions: [[delay(1)], [{ type: 'script.run', code: 'return 1;' }]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);

    // a function block that does not compile: refused by the server, named by the editor
    cy.get('[data-cy="editor-mode-graph"]').click();
    cy.get('[data-cy="graph-action-node"][data-path="1.0"]').click();
    cy.get('[data-cy="function-block-editor"] .cm-content').click();
    cy.get('[data-cy="function-block-editor"] .cm-content').type('{selectall}{backspace}', { delay: 0 });
    cy.get('[data-cy="function-block-editor"] .cm-content').type('return (', { delay: 0 });
    save();
    cy.get('[data-cy="save-error-problems"]')
      .should('contain', i18n.saveErrors.places.step.replace('{{number}}', '2'))
      .should('contain', i18n.actions.script.run)
      .should('contain', i18n.saveErrors.problems.syntaxAt.split('{{line}}')[0]);

    // a schema refusal: one readable line per block, the raw text folded
    cy.intercept('PATCH', `**/api/v1/scene/${SCENE_SELECTOR}`, {
      statusCode: 422,
      body: {
        status: 422,
        properties: [
          {
            attribute: 'actions',
            message: '"[0][0].type" must be one of [delay, script.run]; "[0][0].type" must be a string'
          }
        ]
      }
    });
    save();
    cy.get('[data-cy="save-error-problems"] li').should('have.length', 1);
    cy.get('[data-cy="save-error-problems"]').should('contain', i18n.saveErrors.problems.missingType);
    cy.get('[data-cy="save-error-detail"]').should('not.contain', 'must be one of');
    cy.contains('button', i18n.showErrorDetail).click();
    cy.get('[data-cy="save-error-detail"]').should('contain', 'must be one of');
  });

  it('Should select several blocks, copy, paste and remove them, with a mini-map', () => {
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'graph' }, actions: [[delay(1)], [delay(2)]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-canvas"] .react-flow__minimap').should('exist');
    cy.get('[data-cy="graph-paste"]').should('be.disabled');

    // a copy is pasted beside its original, wired to nothing
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();
    cy.get('[data-cy="graph-copy"]').click();
    cy.get('[data-cy="graph-paste"]').click();
    cy.get('[data-cy="graph-action-node"]').should('have.length', 3);
    cy.get('[data-cy="graph-unwired-count"]').should('exist');

    // a key typed in a select of the panel is not for the canvas
    cy.get('[data-cy="graph-panel"] select')
      .first()
      .trigger('keydown', { key: 'Delete' });
    cy.get('[data-cy="graph-panel"] [data-cy="graph-delete-node"]').trigger('keydown', { key: 'Backspace' });
    cy.get('[data-cy="graph-action-node"]').should('have.length', 3);

    // Ctrl + click selects several blocks: they are removed together, and come back with an undo
    // (building a selection never opens the panel, which would cover the other blocks)
    cy.get('[data-cy="graph-close-panel"]').click();
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click({ ctrlKey: true });
    cy.get('[data-cy="graph-panel"]').should('not.exist');
    cy.get('[data-cy="graph-action-node"][data-path="1.0"]').click({ ctrlKey: true });
    cy.get('[data-cy="graph-panel"]').should('not.exist');
    cy.get('[data-cy="graph-delete-selection"]').click();
    cy.get('[data-cy="graph-action-node"]').should('have.length', 1);
    cy.get('[data-cy="graph-undo"]').click();
    cy.get('[data-cy="graph-action-node"]').should('have.length', 3);
  });

  it('Should undo what a form of the panel changed', () => {
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'graph' }, actions: [[delay(1)]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-undo"]').should('be.disabled');
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();
    cy.get('[data-cy="graph-panel"] select')
      .first()
      .select('minutes');
    cy.get('[data-cy="graph-undo"]').should('not.be.disabled');
    cy.get('[data-cy="graph-undo"]').click();
    cy.get('[data-cy="graph-panel"] select')
      .first()
      .should('have.value', 'seconds');
    cy.get('[data-cy="graph-redo"]').click();
    cy.get('[data-cy="graph-panel"] select')
      .first()
      .should('have.value', 'minutes');
  });

  it('Should ask before dropping the unwired blocks on the way to the advanced mode', () => {
    const i18n = Cypress.env('i18n').editScene;
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'graph' }, actions: [[delay(1)]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();
    cy.get('[data-cy="graph-copy"]').click();
    cy.get('[data-cy="graph-paste"]').click();
    cy.get('[data-cy="graph-unwired-count"]').should('exist');

    cy.get('[data-cy="editor-mode-code"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('contain', i18n.modes.dropUnwiredTitle);
    cy.get('[data-cy="confirm-dialog-cancel"]').click();
    cy.get('[data-cy="graph-canvas"]').should('exist');

    cy.get('[data-cy="editor-mode-code"]').click();
    cy.get('[data-cy="confirm-dialog-confirm"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('contain', i18n.modes.toCodeTitle);
    cy.get('[data-cy="confirm-dialog-confirm"]').click();
    cy.get('[data-cy="scene-code-editor"]').should('exist');
  });

  it('Should suggest the API while typing, and try a script without saving the scene', () => {
    const i18n = Cypress.env('i18n').editScene;
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'code' }, actions: [[{ type: 'script.run', code: 'await sleep(1);' }]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);

    cy.get('[data-cy="scene-code-editor"] .cm-content').click();
    cy.get('[data-cy="scene-code-editor"] .cm-content').type('{selectall}{backspace}', { delay: 0 });
    cy.get('[data-cy="scene-code-editor"] .cm-content').type('gladys.');
    cy.get('.cm-tooltip-autocomplete').should('contain', 'device');
    cy.get('.cm-tooltip-autocomplete').should('contain', 'store');
    cy.get('.cm-tooltip-autocomplete').should('contain', 'light');
    cy.get('[data-cy="scene-code-editor"] .cm-content').type('{esc}');

    // a script that does not compile is not started
    typeInCodeEditor('const a = ;');
    cy.get('[data-cy="code-test"]').click();
    cy.get('[data-cy="code-console"]').should('contain', i18n.code.test.syntaxErrorAt.split('{{line}}')[0]);

    // the script runs on the server as it is written, the saved scene is left alone
    typeInCodeEditor('return 2;');
    cy.intercept('POST', `**/api/v1/scene/${SCENE_SELECTOR}/script/test`).as('testScript');
    cy.get('[data-cy="code-test"]').click();
    cy.wait('@testScript').then(({ request, response }) => {
      expect(request.body).to.deep.equal({ code: 'return 2;' });
      expect(response.statusCode).to.equal(200);
      cy.sendWebSocket({
        type: 'scene.script-test-finished',
        payload: {
          executionId: response.body.execution_id,
          sceneSelector: SCENE_SELECTOR,
          status: 'success',
          result: 2
        }
      });
    });
    cy.get('[data-cy="code-console"]').should('contain', i18n.code.test.successWithResult.replace('{{result}}', '2'));
    getSavedScene().then(scene => {
      expect(scene.actions[0][0].code).to.equal('await sleep(1);');
    });
  });

  it('Should name a function block, and widen its panel', () => {
    authenticatedRequest({
      method: 'PATCH',
      url: `/api/v1/scene/${SCENE_SELECTOR}`,
      body: { editor: { mode: 'graph' }, actions: [[{ type: 'script.run', code: 'return 1;' }]] }
    });
    cy.visit(`/dashboard/scene/${SCENE_SELECTOR}`);
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();

    // the name replaces the generic title, on the node and in the panel
    cy.get('[data-cy="function-block-name"]').type('Average temperature');
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').should('contain', 'Average temperature');
    cy.get('[data-cy="graph-panel"]').should('contain', 'Average temperature');

    // the panel is widened with its button, and keeps its width when it opens again
    cy.get('[data-cy="graph-panel"]')
      .invoke('outerWidth')
      .should('eq', 420);
    cy.get('[data-cy="graph-panel-widen"]').click();
    cy.get('[data-cy="graph-panel"]')
      .invoke('outerWidth')
      .should('be.greaterThan', 500);
    cy.get('[data-cy="graph-close-panel"]').click();
    cy.get('[data-cy="graph-action-node"][data-path="0.0"]').click();
    cy.get('[data-cy="graph-panel"]')
      .invoke('outerWidth')
      .should('be.greaterThan', 500);
    cy.get('[data-cy="graph-panel-widen"]').click();
    cy.get('[data-cy="graph-panel"]')
      .invoke('outerWidth')
      .should('eq', 420);

    save();
    cy.contains('editScene.savedLabel').should('exist');
    getSavedScene().then(scene => {
      expect(scene.actions[0][0]).to.deep.equal({ type: 'script.run', code: 'return 1;', name: 'Average temperature' });
    });

    // an emptied name is not saved
    cy.get('[data-cy="function-block-name"]').clear();
    save();
    cy.contains('editScene.savedLabel').should('exist');
    getSavedScene().then(scene => {
      expect(scene.actions[0][0]).to.deep.equal({ type: 'script.run', code: 'return 1;' });
    });
  });
});
