# Scene editor modes: classic, graph and code

> **Living specification — source of truth.** This document specifies the three ways of editing a
> scene — the classic step list, the graph canvas and the code editor — the `t_scene.editor`
> column, the `script.run` action, its sandbox and the scripting API. **Rule: any PR that changes
> one of these behaviors or contracts modifies this file in the same diff.**
>
> Status: **implemented on `feat/scene-editor-modes`, not proposed upstream yet**.
>
> Sources: the graph view takes its idea, and some of its UI choices, from the canvas prototype of
> Hizo (Hizoka76) — forum topic <https://community.gladysassistant.com/t/scenes-en-mode-nodered/>,
> branch `Hizoka76/Gladys:feat/canvas_style`. The conversion between steps and graph and the
> canvas are a rewrite (C.3 explains what changed and why).

## A. Context

The scene editor is a vertical list of steps. It reads well for short scenes, but a scene with a
few branches becomes a long column of nested cards, and several users asked for a Node-RED-like
view. Other users, comfortable with code, find a block editor slow for logic it expresses in two
lines.

Three editing modes, one scene:

| Mode        | What the user edits                               | Stored as                            |
| ----------- | ------------------------------------------------- | ------------------------------------ |
| **classic** | the existing step list                            | `triggers` + `actions` (unchanged)   |
| **graph**   | the same scene, as blocks wired on a canvas       | `triggers` + `actions` (unchanged)   |
| **code**    | the triggers as blocks, the actions as JavaScript | `triggers` + one `script.run` action |

Classic and graph are **two views of the same data**: switching between them is free, at any
time, and never changes the scene. Code is a different representation: a scene can be converted
to code, never back (D.4).

The engine is unchanged: whatever the mode, the server runs `scene.actions`.

## B. Data model

### B.1 `t_scene.editor`

A new nullable JSON column (migration `20261107000000-scene-editor.js`). `null` is the classic
mode, so every existing scene is unchanged.

```json
{
  "mode": "graph",
  "graph": {
    "signature": "t2|a[l,c(i2;t[a];e[])],a[d]",
    "positions": {
      "trigger.0": { "x": -320, "y": 0 },
      "0.0": { "x": 0, "y": 0 }
    },
    "direction": "horizontal"
  }
}
```

| Field             | Type                                   | Rule                                                          |
| ----------------- | -------------------------------------- | ------------------------------------------------------------- |
| `mode`            | `'classic'` \| `'graph'` \| `'code'`   | required; the mode the scene opens in                         |
| `graph`           | object                                 | optional; the canvas layout, display only                     |
| `graph.signature` | string, ≤ 4096 chars                   | the shape of the scene the positions were saved for (C.4)     |
| `graph.positions` | `{ [nodeKey]: { x, y } }`, ≤ 2000 keys | finite numbers; node keys of C.1                              |
| `graph.direction` | `'horizontal'` \| `'vertical'`         | optional, `horizontal` when absent; how the graph flows (C.5) |

`mode` is a preference, except for `code`, which is an invariant of the actions (B.3).

### B.2 `script.run` action

| Field      | Type           | Rule                                              |
| ---------- | -------------- | ------------------------------------------------- |
| `type`     | `'script.run'` | `ACTIONS.SCRIPT.RUN`                              |
| `language` | `'javascript'` | optional, the only value (room for later)         |
| `code`     | string         | ≤ 100 000 chars; may be empty while being written |
| `name`     | string         | optional: the name the user gives a function block |

### B.3 Invariant of the code mode, function blocks

`editor.mode === 'code'` implies that `actions` is exactly `[[{ type: 'script.run', … }]]`.

- Checked by the model (Sequelize model-level validator), so neither the API nor MCP can store a
  code scene with blocks.
- A block scene (classic or graph) may hold `script.run` actions anywhere, branches and conditions
  included: **function blocks** (D.6), offered in the "Advanced" category of the picker.
- On create and update, **every** script of the scene is **compiled** (not run) in the sandbox: a
  syntax error refuses the save with `400` and the message
  `Script syntax error at line <l>, column <c>: <reason>` — with `in the function block <path>`
  before the position for a function block — so a scene is never saved in a state where it
  cannot run.

### B.4 Duplication and device migration

- `scene.duplicate` copies `editor` with the rest.
- `device.migrate` (device-migration.md B.3) rewrites the selectors of a migrated device inside a
  script: every **string literal** equal to an old selector (`'x'`, `"x"` or `` `x` ``) becomes the
  new one. A selector built at runtime (`'lamp-' + room`) cannot be found and is not rewritten.

## C. Graph mode

### C.1 Nodes

| Node       | Key                  | Represents                                     |
| ---------- | -------------------- | ---------------------------------------------- |
| trigger    | `trigger.<i>`        | `triggers[i]`                                  |
| start      | `start`              | the start of the scene (fixed, always present) |
| action     | the action path      | an action: `0.1`, `2.0.then.1.0`, …            |
| if / while | the action path      | a `condition.if-then-else` / `condition.while` |
| join       | `join.<flow>.<step>` | display only: "wait for all of them" (C.2)     |

Conditions of an if / while block are **not** nodes: they are edited in the block's panel, as in
the classic editor. Node keys are paths, as in the engine and the variables (`{{1.0.last_value}}`).

### C.2 Edges: the canonical graph

A scene is drawn as one canonical graph, left to right:

- every trigger → `start`;
- `start` → every action of step 0;
- every action of step _i_ → every action of step _i + 1_. When both steps hold several actions,
  the edges go through a **join** node (_n_ + _m_ edges instead of _n_ × _m_);
- an if block has three outputs: `then` → step 0 of its `then`, `else` → step 0 of its `else`,
  and its normal output → the next step of the flow it belongs to; a while block has `do` → step
  0 of its body, and its normal output;
- a branch ends where its last step ends: the flow continues from the block's normal output.

### C.3 Graph → steps

The canvas holds nodes and edges; the steps are computed from them, and the canvas is redrawn
**from the computed steps** after every structural change (connect, disconnect, delete, add).
The graph on screen is therefore always the canonical graph of a valid scene: an edge the steps
cannot express is never kept.

1. **Flows.** The main flow starts at `start`; each `then` / `else` / `do` output starts a flow.
   An action reachable from two flows is refused (the connection is not created).
2. **Steps.** In a flow, the step of a node is its longest distance from the flow's start (a join
   adds nothing), so a node waits for everything wired before it. Nodes of the same step run in
   parallel, ordered top to bottom.
3. **Cycles** are refused when the edge is drawn.
4. **Unwired blocks.** A block added from the palette, or cut off by removing an edge, is not part
   of the scene. It is drawn dashed and kept on the canvas, and the scene **cannot be saved**
   while one exists (the message names how many). Switching to the classic mode drops them, after
   a confirmation.
5. **Variables follow their action.** When a block changes step, its path changes: every
   `{{old.path.…}}` reference and every condition `variable` selector is rewritten to the new path
   in one pass (no path is rewritten twice).

Differences with the prototype it comes from: the prototype converted the steps to a free graph
and back with a layout heuristic (`sceneToGraph` / `graphToScene`), so a graph could be drawn that
the steps did not express, and was silently reshaped on save; the variables were not rewritten
when a block moved; display labels were added to the action schema; positions were not saved.
Here the canvas never holds a graph the steps cannot express, nothing is added to the actions, and
the layout is stored apart (C.4).

### C.4 Layout

- Positions are saved in `editor.graph.positions`, by node key, with the **signature** of the
  scene: its triggers count and the shape of its steps (types and nesting, not the parameters).
- On opening, saved positions are applied only when the signature matches; otherwise — the scene
  was changed in the classic mode — the graph is laid out automatically (steps as columns,
  parallel actions stacked, branches below their block).
- Moving a block on the canvas only changes its position, never the steps: the order of parallel
  actions follows their vertical order when the steps are recomputed.

### C.5 Editing

- **Grid.** The canvas snaps to a 15 px grid. Every node size is a multiple of twice the grid —
  actions and triggers 240 × 60, if / while blocks 240 × 90, the start 120 × 60, joins 30 × 30 — so
  the center of a node, where its handles are, always lies on a grid line: two nodes dropped on a
  row are aligned. The automatic layout centers the taller blocks on their row.
- **Look.** The canvas, its toolbar, the panel and the code editor follow the Horizon glass
  grammar of the editor: glass surfaces, pill buttons (accent, neutral, danger).

- **Direction.** A toolbar button switches the graph between left to right (Node-RED style, the
  default) and top to bottom, saved in `editor.graph.direction`. The layout code is written once, in
  two axes — the flow axis the steps follow, the cross axis parallel actions are stacked on — and a
  direction only maps them to x / y: in a vertical graph, steps are 150 px apart, parallel actions
  side by side and ordered left to right, branches leave from the bottom of their block and the
  rest of the scene from its right side. Switching lays the canvas out again in the new direction.
- **Adding.** The toolbar's "Action" button adds a block at the end of the scene; the panel of a
  block adds one right after it, at the same time as it, or at the start of one of its branches
  (`then`, `else`, the loop of a while). An insertion moves what follows one column right, as in a
  list; any other new node takes the first free place, never on top of another node. A new block has no type yet: its panel opens on the type
  picker of the classic editor (same catalog, same search, integration actions included). The
  toolbar also adds a trigger.
- **Wiring.** Dragging from an output to a block draws an edge; C.3 decides what it means, and
  refuses what the steps cannot express (a cycle, a block in two branches, an output the block
  does not have, an edge into a trigger, the start or a join).
- **Panel.** Clicking a node opens its panel: the same form components as the classic cards (a
  single source of truth for each action's form). The panel of an if / while block edits its
  conditions only (`conditionsOnly`): its branches are nodes. A block is given its action as it is
  in the scene, branches included, so its form never resets them.
- **Removing.** Removing a block wires what came before it to what came after it; removing an if /
  while removes its branches with it, after a confirmation. Removing an edge may leave blocks
  unwired (C.3.4). `Delete` / `Backspace` remove the selected node or edge, except when the key is
  typed in the panel or in a field.
- **History.** `Ctrl+Z` / `Ctrl+Y` (and the toolbar) undo / redo the changes of the canvas and
  what the forms of the panel changed (a parameter, a condition, a trigger), up to 50; a snapshot
  holds the graph, the actions, the triggers and their variables. Edits of a form less than a
  second apart are undone together, so a typed text goes back in one step.
- **Saving.** Before sending, the editor counts the blocks whose type was never picked (a new
  block, a new condition), in every mode and at any depth, and names them in a translated message
  instead of letting the server refuse the scene with its schema error. Untyped nodes are drawn
  with a red dashed border. A refusal the server still sends back is made readable
  (`saveErrors.js`, unit-tested): its schema messages, which name a JSON path and list every value
  they accept, become one line per place of the scene and kind of problem, in the user's language
  ("Step 2 › Action 1 (Function): no type has been picked"); a script syntax error names its block,
  line and column. The raw answer stays available behind a "technical detail" button.
- **Selecting several blocks.** `Ctrl` + click adds a node to the selection or takes it out,
  `Shift` + drag draws a box; the selected nodes are moved and removed together. Building a
  selection never opens the panel, which covers a part of the canvas.
- **Copy and paste.** `Ctrl+C` / `Ctrl+V` (and the toolbar) copy the selected action nodes and
  paste them as unwired nodes beside their originals, wired to each other as they were
  (`copyNodes` / `pasteNodes`). A block is copied without its branches, unless their nodes are
  selected too. The copy lives in the canvas, not in the system clipboard.
- **Panel width.** The panel is resized by dragging its left edge, or widened / narrowed with the
  button of its header (a function block needs room for its code). The width is kept in the
  browser (`localStorage`), not in the scene; on a phone the panel is a bottom sheet, not resized.
- **Mini-map.** A mini-map of the canvas, to move around a large scene; hidden on phones.
- **Selecting.** A click selects a node and opens its panel; it never counts as a change of the
  scene (a drag without a move is ignored).
- **Running.** The block being run is highlighted, from the `scene.executing-action` events.
- **Loading.** The canvas and its library (`reactflow` 11) are loaded only when a scene is opened in
  the graph mode.

### C.6 Tests

The conversions are pure functions (`front/src/routes/scene/edit-scene/graph/sceneGraph.js`),
unit-tested with the test runner of Node, no dependency: `npm run test-unit` in `front/`. The
editor is covered end to end by `front/cypress/e2e/routes/scene/SceneEditorModes.cy.js`.

## D. Code mode

### D.1 Editor

- The triggers keep their classic cards; the actions are one JavaScript editor (CodeMirror,
  loaded only in this mode).
- A reference panel lists the API (D.3), with examples.
- A console shows what the script logs while the scene runs (D.5) or is tried (D.7).
- The editor suggests the API and the selectors of the instance while typing (D.8).

### D.2 Sandbox

The script runs in **QuickJS compiled to WebAssembly** (`quickjs-emscripten-core` with the
`release-sync` variant only), not in Node:

- no `require`, `process`, file system, network or timers other than the API below; the API is
  frozen and the script runs in strict mode;
- **memory**: 32 MB per execution; **CPU**: a script running more than 1 s without yielding to
  Gladys (an `await` on the API) is interrupted — a `while (true) {}` cannot freeze Gladys. An
  execution also has **30 s of processor time in all**, its waits (`sleep`, actions) left out, so
  a script cannot keep Gladys busy by slices that each stay under the second; a script that waits
  most of the time can run for days;
- **stack**: 256 KB. QuickJS runs on the stack of Node, so its limit must be reached well before
  the one of V8: with 1 MB, a runaway recursion overflowed V8 inside the WebAssembly module
  instead of raising a JavaScript error. 256 KB still allows a recursion about 1 000 calls deep;
- **one WebAssembly instance per execution** (a few milliseconds to create), freed when it ends:
  nothing is shared between executions, and even a crash of QuickJS itself (a failed assertion
  while freeing a runtime aborts the whole instance) stays inside that execution — it is logged,
  never thrown to Gladys or to another running script;
- the script runs as the body of an `async` function: top-level `await` and `return` work. The
  host never holds a handle on the script's promise (the script reports how it ended through two
  callbacks), so a script left waiting forever is freed with its runtime.

A stop of the scene (stop button, `scene.stop`) interrupts the script at once: a pending API call
or `sleep` rejects, and the interrupt handler stops any running code.

### D.3 API

| Name                                      | Returns            | Behavior                                                                                                                  |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `event`                                   | object / undefined | copy of the trigger event (`triggerEvent`), `undefined` when started by hand                                              |
| `gladys.action(type, params, { saveAs })` | object / null      | runs any scene action, as its block would; the result is returned and, with `saveAs`, stored for `{{saveAs.…}}` templates |
| `gladys.check(type, params, { saveAs })`  | boolean            | runs a condition; `false` instead of stopping the scene                                                                   |
| `gladys.device.getValue(feature)`         | number / null      | `last_value` of a device feature                                                                                          |
| `gladys.device.getFeature(feature)`       | object             | copy of the device feature                                                                                                |
| `gladys.device.setValue(feature, value)`  | null               | same as the "set value" block                                                                                             |
| `gladys.scene.start(selector)`            | null               | same as the "start scene" block                                                                                           |
| `gladys.message.send(user, text)`         | null               | same as the "send message" block                                                                                          |
| `gladys.store(name, value)`               | null               | keeps a value for the `{{name.…}}` templates of the next actions                                                          |
| `sleep(ms)`                               | null               | waits, interrupted by a stop                                                                                              |
| `stop()`                                  | never              | ends the scene quietly, like an unmet condition                                                                           |
| `console.log/info/warn/error(…args)`      | —                  | Gladys logs and the editor console                                                                                        |

- `gladys.action` validates `params` with the action schema of the model; `script.run`,
  `condition.if-then-else` and `condition.while` are refused (use JavaScript instead).
- An action that stops a block scene (a condition not met, an empty value…) stops the script the
  same way, even if the script catches the error: nothing it does afterwards reaches Gladys. Any
  other error is thrown into the script, which may `try / catch` it.
- Without `saveAs`, the result of an action is kept under `<path of the script>.script.<n>`.
- `gladys.store(name, value)` keeps a value under a name for the templates of the next actions
  (`{{name.…}}`), like `saveAs`. Neither may write over what the engine keeps in the scope
  (`abortSignal`, `sceneSelector`, `alreadyExecutedScenes`, `triggerEvent`): the name is refused.
- `sleep(ms)` takes at most 2 147 483 647 ms (about 24.8 days), the longest timer of Node.
- What the script returns (`return value`) is kept under `<path of the script>.result`.
- Values cross the sandbox boundary as JSON.

### D.4 Converting blocks to code

`POST /api/v1/scene/script/generate` with `{ actions }` returns `{ code }`: a script with the
behavior of the steps. Anything that does not have the shape of scene actions (steps of actions,
`if` a list, `then` / `else` steps) is refused with a 400.

- each action → `await gladys.action(type, params)`, with `saveAs: '<path>'` when a template or a
  condition selector reads its result, so `{{0.0.last_value}}` keeps working unchanged;
- a step with several actions → `await Promise.all([…])`;
- a condition → `if (!(await gladys.check(…))) stop();`;
- if / else → `if ((await Promise.all([checks])).every(Boolean)) { … } else { … }`;
- while → a bounded `for` loop re-checking its conditions in series, with its minimal iteration
  time;
- a function block → its code as it is, in an `async` function of its own (its `return` ends the
  block only), wrapped in `gladys.store('<path>', { result: … })` when a later action reads its
  result.

Server tests run every conversion scenario both ways — as blocks through the engine, as the
generated script — on the same fakes, and compare the effects.

The editor asks for a confirmation: the conversion is one-way. Leaving the code mode for blocks
discards the code, after a confirmation, and starts from an empty step.

### D.5 Logs

`console.*` writes to the Gladys logs (prefixed with the scene selector) and emits
`scene.script-log` (`{ sceneSelector, level, message }`) on the websocket, **to the administrators
only** (`EVENTS.WEBSOCKET.SEND_ADMINS`, relayed user by user through Gladys Plus): a log may hold
what a script reads. The console of the script editors shows the last 200 lines of the scene it
displays. An execution logs 1 000 lines at most
(the last one says the limit was reached), each cut at 2 000 characters. An error that ends the
script is logged there too, with its line and column.

### D.6 Function blocks

A `script.run` action inside a block scene, like a Node-RED function node: JavaScript run in the
sandbox of D.2, with the API of D.3, when the scene reaches the block.

- The form of the block is the editor of the advanced mode (insert a device, example, API
  reference), smaller; it declares the variable `result` for the next blocks.
- What the code returns is the block's `result` (`{{1.0.result}}`); `stop()` ends the scene, an
  error fails the block like any action, the scene goes on with the next step.
- Its logs go to the Gladys logs and the `scene.script-log` event (D.5).
- The user may name the block (`name`): the name replaces "Function (JavaScript)" as the title of
  its card, of its node and of its panel, and is written in the comment of the block when the
  scene is converted to code. An empty name is not saved.

### D.7 Trying a script

`POST /api/v1/scene/:scene_selector/script/test` with `{ code }` (administrators) runs a script
as it is being written, without saving the scene: the "Try" button of the script editors, in the
advanced mode and in a function block.

- The script **runs for real**, with the API of D.3 and the limits of D.2, as an execution of the
  scene: it is listed with the running scenes (`scene.started` / `scene.stopped`) and stopped like
  them — the button becomes "Stop". It does not go through the queue of the scenes.
- A script that does not compile is refused (400, the message of B.3), an unknown scene is a 404.
  The answer is `{ execution_id }`.
- When it ends, `scene.script-test-finished`
  (`{ executionId, sceneSelector, status: 'success' | 'stopped' | 'error', result }`) is sent to
  the administrators; the console says how the trial ended, with what the script returned. Its
  logs and its error come through D.5.
- A function block is tried alone: the results of the blocks before it are not there.

### D.8 Suggestions

The script editors suggest, while typing (`code/completions.js`, pure and unit-tested): the
globals of D.3, the members of `gladys.` and of its namespaces, the selectors of the device
features of the instance where the API takes one (`gladys.device.getValue('…`, found by selector
or by name), and the action types in `gladys.action('…` / the condition types in
`gladys.check('…`.

## E. Mode switch

A segmented control in the editor header: **Classic · Graph · Advanced** (the code mode is
labelled "Advanced" for the user), always visible, styled as the other header controls (a frosted
pill). On a phone it takes its own full-width row below the scene name. The confirmations open in the editor's own dialog
(Horizon glass, Escape cancels, Enter confirms), never the browser's.

| From → to            | Effect                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| classic ↔ graph      | none on the scene; unwired graph blocks are dropped after a confirmation. The classic editor keeps an empty step at the end of the scene, as it always does |
| classic/graph → code | unwired graph blocks are dropped after a confirmation of their own; confirmation, then D.4                                                                  |
| code → classic/graph | confirmation, the code is discarded                                                                                                                         |

The mode is saved with the scene (`editor.mode`): the scene reopens where it was left.

## F. Out of scope

- Other languages (Lua, Python): `language` leaves room, nothing more.
- Code → blocks.
- Free-form graphs the steps cannot express (merging branches, loops drawn as edges).
