// The graph mode of the scene editor (docs/specs/scene-editor-modes.md C): pure conversions
// between the steps of a scene and the nodes / edges of the canvas. No UI here, so the rules are
// unit-tested (sceneGraph.test.js, `npm run test-unit`).
//
// Imports carry their extension so the module also runs under `node --test`.
import { ACTIONS } from '../../../../../../server/utils/constants.js';

export const NODE_TYPES = {
  TRIGGER: 'trigger',
  START: 'start',
  ACTION: 'action',
  BLOCK: 'block',
  JOIN: 'join'
};

// Outputs of a node. Every action has `next`; an if block adds `then` / `else`, a while block `do`.
export const HANDLES = {
  NEXT: 'next',
  THEN: 'then',
  ELSE: 'else',
  DO: 'do'
};

export const START_NODE_ID = 'start';

export const GRAPH_ERRORS = {
  CYCLE: 'cycle',
  MULTIPLE_FLOWS: 'multiple-flows'
};

// The grid the canvas snaps to, in pixels. Every node size is a multiple of twice the grid, so
// the center of a node, where its handles are, always lies on a grid line: two nodes dropped on
// the same row are aligned (graph.css holds the sizes).
export const GRID_SIZE = 15;
export const NODE_SIZE = {
  WIDTH: 240,
  HEIGHT: 60,
  BLOCK_HEIGHT: 90,
  JOIN: 30
};

// Layout grid of the automatic layout, in pixels (multiples of the grid)
export const LAYOUT = {
  COLUMN_WIDTH: 300,
  ROW_HEIGHT: 120
};

const snapToGrid = value => Math.round(value / GRID_SIZE) * GRID_SIZE;

// A join node sits in the gap before its column, centered on the row of the nodes it joins
const joinLayoutPosition = (column, row) => ({
  x: column * LAYOUT.COLUMN_WIDTH - (LAYOUT.COLUMN_WIDTH - NODE_SIZE.WIDTH + NODE_SIZE.JOIN) / 2,
  y: row * LAYOUT.ROW_HEIGHT + (NODE_SIZE.HEIGHT - NODE_SIZE.JOIN) / 2
});

const isBlockType = type => type === ACTIONS.CONDITION.IF_THEN_ELSE || type === ACTIONS.CONDITION.WHILE;

// The branches of a block: the action property holding them, and the output starting them
const branchesOf = type => {
  if (type === ACTIONS.CONDITION.IF_THEN_ELSE) {
    return [
      { property: 'then', handle: HANDLES.THEN },
      { property: 'else', handle: HANDLES.ELSE }
    ];
  }
  if (type === ACTIONS.CONDITION.WHILE) {
    return [{ property: 'then', handle: HANDLES.DO }];
  }
  return [];
};

export const triggerNodeId = index => `trigger-${index}`;
const joinNodeId = (flowKey, stepIndex) => `join-${flowKey}-${stepIndex}`;
const edgeId = (source, sourceHandle, target) => `${source}:${sourceHandle}->${target}`;

// Key of a node in the saved layout (spec C.1)
export const layoutKey = node => {
  if (node.type === NODE_TYPES.TRIGGER) {
    return `trigger.${node.data.index}`;
  }
  if (node.type === NODE_TYPES.START) {
    return 'start';
  }
  if (node.type === NODE_TYPES.JOIN) {
    return `join.${node.data.flowKey}.${node.data.stepIndex}`;
  }
  return node.data.path;
};

// The action of a node, without the branches its block carries (they are nodes of their own)
export const withoutBranches = action => {
  if (!action || !isBlockType(action.type)) {
    return action;
  }
  const copy = { ...action };
  branchesOf(action.type).forEach(({ property }) => {
    delete copy[property];
  });
  return copy;
};

export const getAtPath = (actions, path) =>
  path
    .split('.')
    .reduce((value, segment) => (value === undefined || value === null ? undefined : value[segment]), actions);

/**
 * The action a node stands for: read from the scene for a wired node, from the node itself for an
 * unwired one.
 */
export const getNodeAction = (node, actions) =>
  node.data.path ? withoutBranches(getAtPath(actions, node.data.path)) : node.data.action;

// ---------------------------------------------------------------------------------------------
// Signature (spec C.4): the shape of a scene, not its parameters
// ---------------------------------------------------------------------------------------------

const stepsSignature = steps =>
  (steps || [])
    .filter(step => Array.isArray(step) && step.length > 0)
    .map(step =>
      step
        .map(action => {
          const type = (action && action.type) || 'null';
          const branches = branchesOf(type)
            .map(({ property }) => stepsSignature(action[property]))
            .join(';');
          return isBlockType(type) ? `${type}(${branches})` : type;
        })
        .join(',')
    )
    .join('/');

const hashString = text => {
  // djb2, enough to tell two shapes apart
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0; // eslint-disable-line no-bitwise
  }
  return (hash >>> 0).toString(16); // eslint-disable-line no-bitwise
};

export const MAX_SIGNATURE_LENGTH = 4096;

export const sceneSignature = scene => {
  const signature = `t${(scene.triggers || []).length}|${stepsSignature(scene.actions)}`;
  return signature.length <= MAX_SIGNATURE_LENGTH ? signature : `h${signature.length}:${hashString(signature)}`;
};

// ---------------------------------------------------------------------------------------------
// Steps -> graph
// ---------------------------------------------------------------------------------------------

/**
 * Edges of a flow drawn the canonical way (spec C.2): each node of a step to each node of the next
 * one, through a join node when both steps hold several nodes.
 * `steps` is a list of lists of node ids.
 */
const flowEdges = (root, flowKey, steps) => {
  const edges = [];
  const joins = [];
  let previous = [root];
  steps.forEach((step, stepIndex) => {
    const current = step.map(id => ({ id, handle: HANDLES.NEXT }));
    if (previous.length > 1 && current.length > 1) {
      const join = { id: joinNodeId(flowKey, stepIndex), flowKey, stepIndex };
      joins.push(join);
      previous.forEach(source => edges.push(makeEdge(source.id, source.handle, join.id)));
      current.forEach(target => edges.push(makeEdge(join.id, HANDLES.NEXT, target.id)));
    } else {
      previous.forEach(source => current.forEach(target => edges.push(makeEdge(source.id, source.handle, target.id))));
    }
    previous = current;
  });
  return { edges, joins };
};

const makeEdge = (source, sourceHandle, target) => ({
  id: edgeId(source, sourceHandle, target),
  source,
  sourceHandle,
  target
});

/**
 * Walk the steps of a scene, calling `visit(action, path)` on every action at every depth, and
 * return the steps as lists of the ids `visit` returned. Empty steps are left out.
 */
const mapSteps = (steps, basePath, visit) =>
  (steps || [])
    .map((step, stepIndex) =>
      (Array.isArray(step) ? step : [])
        .map((action, actionIndex) => {
          const path = basePath ? `${basePath}.${stepIndex}.${actionIndex}` : `${stepIndex}.${actionIndex}`;
          return visit(action, path);
        })
        .filter(id => id !== null)
    )
    .filter(step => step.length > 0);

/**
 * The canonical edges and join nodes of wired nodes, given their scene and the id of the node at
 * each path. Shared by the first drawing and by every redrawing after a change.
 */
export const canonicalEdges = (scene, idByPath) => {
  const edges = [];
  const joins = [];
  (scene.triggers || []).forEach((trigger, index) =>
    edges.push(makeEdge(triggerNodeId(index), HANDLES.NEXT, START_NODE_ID))
  );
  const addFlow = (root, flowKey, steps, basePath) => {
    const idSteps = mapSteps(steps, basePath, (action, path) => {
      const id = idByPath[path];
      if (id === undefined) {
        return null;
      }
      if (action && isBlockType(action.type)) {
        branchesOf(action.type).forEach(({ property, handle }) =>
          addFlow({ id, handle }, `${path}.${property}`, action[property], `${path}.${property}`)
        );
      }
      return id;
    });
    const flow = flowEdges(root, flowKey, idSteps);
    edges.push(...flow.edges);
    joins.push(...flow.joins);
  };
  addFlow({ id: START_NODE_ID, handle: HANDLES.NEXT }, 'main', scene.actions, '');
  return { edges, joins };
};

/**
 * Build the canvas of a scene: trigger nodes, the start node, a node per action and the canonical
 * edges. Node ids come from `newId`, so they stay stable while the scene is edited.
 */
export const sceneToGraph = (scene, { newId, positions } = {}) => {
  const nodes = [];
  const idByPath = {};
  (scene.triggers || []).forEach((trigger, index) =>
    nodes.push({ id: triggerNodeId(index), type: NODE_TYPES.TRIGGER, data: { index } })
  );
  nodes.push({ id: START_NODE_ID, type: NODE_TYPES.START, data: {} });
  const addNodes = (steps, basePath) =>
    mapSteps(steps, basePath, (action, path) => {
      const id = newId();
      idByPath[path] = id;
      const type = action && isBlockType(action.type) ? NODE_TYPES.BLOCK : NODE_TYPES.ACTION;
      nodes.push({ id, type, data: { path } });
      if (type === NODE_TYPES.BLOCK) {
        branchesOf(action.type).forEach(({ property }) => addNodes(action[property], `${path}.${property}`));
      }
      return id;
    });
  addNodes(scene.actions, '');
  const { edges, joins } = canonicalEdges(scene, idByPath);
  joins.forEach(join =>
    nodes.push({
      id: join.id,
      type: NODE_TYPES.JOIN,
      data: { flowKey: join.flowKey, stepIndex: join.stepIndex }
    })
  );
  const laidOut = autoLayout(nodes, edges, scene);
  return {
    nodes: laidOut.map(node => {
      const saved = positions && positions[layoutKey(node)];
      return saved ? { ...node, position: { x: saved.x, y: saved.y } } : node;
    }),
    edges
  };
};

// ---------------------------------------------------------------------------------------------
// Automatic layout (spec C.4): steps as columns, parallel actions stacked, branches below-right
// of their block
// ---------------------------------------------------------------------------------------------

export const autoLayout = (nodes, edges, scene) => {
  const positions = {};
  const nodeByPath = {};
  nodes.forEach(node => {
    if (node.data && node.data.path) {
      nodeByPath[node.data.path] = node;
    }
  });
  const place = (id, column, row) => {
    positions[id] = { x: column * LAYOUT.COLUMN_WIDTH, y: row * LAYOUT.ROW_HEIGHT };
  };
  // Returns the number of columns and rows the steps take
  const layoutSteps = (steps, basePath, flowKey, startColumn, startRow) => {
    let column = startColumn;
    let height = 0;
    let previousSize = 1;
    (steps || []).forEach((step, stepIndex) => {
      const placed = (Array.isArray(step) ? step : [])
        .map((action, actionIndex) => ({
          action,
          path: basePath ? `${basePath}.${stepIndex}.${actionIndex}` : `${stepIndex}.${actionIndex}`
        }))
        .filter(({ path }) => nodeByPath[path]);
      if (placed.length === 0) {
        return;
      }
      const joinId = joinNodeId(flowKey, stepIndex);
      if (previousSize > 1 && placed.length > 1 && nodes.some(node => node.id === joinId)) {
        positions[joinId] = joinLayoutPosition(column, startRow);
      }
      let row = startRow;
      let width = 1;
      placed.forEach(({ action, path }) => {
        place(nodeByPath[path].id, column, row);
        // a block is taller: centered on its row, its handles line up with the other nodes
        if (action && isBlockType(action.type)) {
          positions[nodeByPath[path].id].y -= (NODE_SIZE.BLOCK_HEIGHT - NODE_SIZE.HEIGHT) / 2;
        }
        let rows = 1;
        if (action && isBlockType(action.type)) {
          branchesOf(action.type).forEach(({ property }) => {
            const branch = layoutSteps(
              action[property],
              `${path}.${property}`,
              `${path}.${property}`,
              column + 1,
              row + rows
            );
            rows += Math.max(branch.height, 1);
            width = Math.max(width, 1 + branch.width);
          });
        }
        row += rows;
      });
      height = Math.max(height, row - startRow);
      column += width;
      previousSize = placed.length;
    });
    return { width: column - startColumn, height };
  };
  const triggerCount = (scene.triggers || []).length;
  for (let index = 0; index < triggerCount; index += 1) {
    place(triggerNodeId(index), -1, index);
  }
  place(START_NODE_ID, 0, Math.max((triggerCount - 1) / 2, 0));
  layoutSteps(scene.actions, '', 'main', 1, 0);
  return nodes.map(node => ({ ...node, position: positions[node.id] || node.position || { x: 0, y: 0 } }));
};

// ---------------------------------------------------------------------------------------------
// Graph -> steps (spec C.3)
// ---------------------------------------------------------------------------------------------

const byVerticalOrder = nodeById => (a, b) => {
  const positionA = nodeById[a].position || { x: 0, y: 0 };
  const positionB = nodeById[b].position || { x: 0, y: 0 };
  return positionA.y - positionB.y || positionA.x - positionB.x;
};

/**
 * Compute the steps a graph stands for.
 * Returns `{ actions, paths, orphans }`, or `{ error }` when the graph cannot be expressed as
 * steps (a cycle, or a node reached from two flows).
 * `getAction(node)` gives the action of a node, without its branches.
 */
export const graphToActions = (nodes, edges, getAction) => {
  const nodeById = {};
  nodes.forEach(node => {
    nodeById[node.id] = node;
  });
  const outgoing = {};
  const incoming = {};
  nodes.forEach(node => {
    outgoing[node.id] = [];
    incoming[node.id] = [];
  });
  edges.forEach(edge => {
    if (nodeById[edge.source] && nodeById[edge.target]) {
      outgoing[edge.source].push(edge);
      incoming[edge.target].push(edge);
    }
  });

  const paths = {};
  const owner = {};
  const isStructural = id => nodeById[id].type === NODE_TYPES.ACTION || nodeById[id].type === NODE_TYPES.BLOCK;

  // A flow: the nodes reached from (rootId, rootHandle) through `next` outputs and join nodes
  const buildFlow = (rootId, rootHandle, flowKey, basePath) => {
    const members = new Set();
    const queue = outgoing[rootId]
      .filter(edge => (edge.sourceHandle || HANDLES.NEXT) === rootHandle)
      .map(e => e.target);
    while (queue.length > 0) {
      const id = queue.shift();
      if (!members.has(id) && nodeById[id].type !== NODE_TYPES.START && nodeById[id].type !== NODE_TYPES.TRIGGER) {
        members.add(id);
        outgoing[id]
          .filter(edge => (edge.sourceHandle || HANDLES.NEXT) === HANDLES.NEXT)
          .forEach(edge => queue.push(edge.target));
      }
    }
    for (const id of members) {
      if (owner[id] !== undefined && owner[id] !== flowKey) {
        return { error: GRAPH_ERRORS.MULTIPLE_FLOWS };
      }
      owner[id] = flowKey;
    }

    // Longest distance from the root, a join adding nothing: a node waits for all its inputs
    const level = {};
    const pendingInputs = {};
    members.forEach(id => {
      pendingInputs[id] = incoming[id].filter(
        edge =>
          members.has(edge.source) &&
          (edge.sourceHandle || HANDLES.NEXT) === HANDLES.NEXT &&
          nodeById[edge.source].type !== NODE_TYPES.START
      ).length;
    });
    const ready = [...members].filter(id => pendingInputs[id] === 0);
    ready.forEach(id => {
      level[id] = 0;
    });
    let processed = 0;
    while (ready.length > 0) {
      const id = ready.shift();
      processed += 1;
      const weight = isStructural(id) ? 1 : 0;
      outgoing[id]
        .filter(edge => (edge.sourceHandle || HANDLES.NEXT) === HANDLES.NEXT && members.has(edge.target))
        .forEach(edge => {
          level[edge.target] = Math.max(level[edge.target] || 0, level[id] + weight);
          pendingInputs[edge.target] -= 1;
          if (pendingInputs[edge.target] === 0) {
            ready.push(edge.target);
          }
        });
    }
    if (processed < members.size) {
      return { error: GRAPH_ERRORS.CYCLE };
    }

    const stepsByLevel = {};
    [...members].filter(isStructural).forEach(id => {
      stepsByLevel[level[id]] = stepsByLevel[level[id]] || [];
      stepsByLevel[level[id]].push(id);
    });
    const idSteps = Object.keys(stepsByLevel)
      .map(Number)
      .sort((a, b) => a - b)
      .map(key => stepsByLevel[key].sort(byVerticalOrder(nodeById)));

    const steps = [];
    for (let stepIndex = 0; stepIndex < idSteps.length; stepIndex += 1) {
      const step = [];
      for (let actionIndex = 0; actionIndex < idSteps[stepIndex].length; actionIndex += 1) {
        const id = idSteps[stepIndex][actionIndex];
        const path = basePath ? `${basePath}.${stepIndex}.${actionIndex}` : `${stepIndex}.${actionIndex}`;
        paths[id] = path;
        const action = { ...getAction(nodeById[id]) };
        // A block is told by its action: a new node becomes one when its type is picked
        for (const { property, handle } of branchesOf(action.type)) {
          const branch = buildFlow(id, handle, `${path}.${property}`, `${path}.${property}`);
          if (branch.error) {
            return branch;
          }
          action[property] = branch.steps.length > 0 ? branch.steps : [[]];
        }
        step.push(action);
      }
      steps.push(step);
    }
    return { steps };
  };

  const main = buildFlow(START_NODE_ID, HANDLES.NEXT, 'main', '');
  if (main.error) {
    return { error: main.error };
  }
  const orphans = nodes.filter(node => isStructural(node.id) && paths[node.id] === undefined).map(node => node.id);
  return {
    actions: main.steps.length > 0 ? main.steps : [[]],
    paths,
    orphans
  };
};

// ---------------------------------------------------------------------------------------------
// Variables follow their action (spec C.3.5)
// ---------------------------------------------------------------------------------------------

/**
 * The new path of a variable path, given the paths of the actions that moved: the longest moved
 * action path it starts with is replaced. Unchanged when nothing matches.
 */
export const remapPath = (path, mapping) => {
  const segments = path.split('.');
  for (let length = segments.length; length > 0; length -= 1) {
    const prefix = segments.slice(0, length).join('.');
    if (Object.prototype.hasOwnProperty.call(mapping, prefix)) {
      return [mapping[prefix], ...segments.slice(length)].join('.');
    }
  }
  return path;
};

const TEMPLATE_REGEX = /\{\{(\s*)([0-9][^\s}]*)/g;

const remapTemplates = (text, mapping) =>
  text.replace(TEMPLATE_REGEX, (match, spaces, reference) => `{{${spaces}${remapPath(reference, mapping)}`);

/**
 * Rewrite, in one action (not its branches), every `{{path.…}}` template and every condition
 * `variable` selector whose action moved. All replacements happen in one pass, so a path is never
 * rewritten twice.
 */
export const remapActionVariables = (action, mapping) => {
  if (Object.keys(mapping).length === 0) {
    return action;
  }
  const rewrite = (value, key) => {
    if (typeof value === 'string') {
      const templated = remapTemplates(value, mapping);
      return key === 'variable' ? remapPath(templated, mapping) : templated;
    }
    if (Array.isArray(value)) {
      return value.map(item => rewrite(item, null));
    }
    if (value && typeof value === 'object') {
      const copy = {};
      Object.keys(value).forEach(property => {
        copy[property] = rewrite(value[property], property);
      });
      return copy;
    }
    return value;
  };
  return rewrite(action, null);
};

// ---------------------------------------------------------------------------------------------
// Applying a change of the canvas
// ---------------------------------------------------------------------------------------------

/**
 * Recompute the scene from the canvas after a structural change, then redraw the canvas from the
 * scene, so the canvas never holds a graph the steps cannot express (spec C.3).
 *
 * Returns `{ error }` when the change cannot be applied, otherwise
 * `{ actions, nodes, edges, mapping, orphans }`, where `mapping` gives the new path of every
 * action whose path changed (for the variables of the editor).
 */
export const applyGraph = (scene, nodes, edges) => {
  const result = graphToActions(nodes, edges, node => getNodeAction(node, scene.actions));
  if (result.error) {
    return { error: result.error };
  }
  const mapping = {};
  const wiredPaths = new Set(nodes.filter(node => node.data && node.data.path).map(node => node.data.path));
  nodes.forEach(node => {
    const newPath = result.paths[node.id];
    if (newPath === undefined || !node.data) {
      return;
    }
    // A node wired again takes its references back from its last path, unless another node holds
    // that path now
    const oldPath = node.data.path || (wiredPaths.has(node.data.lastPath) ? null : node.data.lastPath);
    if (oldPath && oldPath !== newPath) {
      mapping[oldPath] = newPath;
    }
  });
  const orphanIds = new Set(result.orphans);

  // Variables follow their action, at every depth, unwired blocks included
  const remapSteps = steps =>
    steps.map(step =>
      step.map(action => {
        const remapped = remapActionVariables(withoutBranches(action), mapping);
        branchesOf(action.type).forEach(({ property }) => {
          remapped[property] = remapSteps(action[property]);
        });
        return remapped;
      })
    );
  const actions = remapSteps(result.actions);

  const idByPath = {};
  Object.keys(result.paths).forEach(id => {
    idByPath[result.paths[id]] = id;
  });
  const { edges: wiredEdges, joins } = canonicalEdges({ triggers: scene.triggers, actions }, idByPath);

  const keptNodes = nodes
    .filter(node => node.type !== NODE_TYPES.JOIN)
    .map(node => {
      if (node.type !== NODE_TYPES.ACTION && node.type !== NODE_TYPES.BLOCK) {
        return node;
      }
      if (orphanIds.has(node.id)) {
        // An unwired node keeps its action, and its last path for when it is wired again
        return {
          ...node,
          data: {
            path: null,
            lastPath: node.data.path || node.data.lastPath || null,
            action: remapActionVariables(getNodeAction(node, scene.actions), mapping)
          }
        };
      }
      return { ...node, data: { path: result.paths[node.id] } };
    });
  const previousJoins = {};
  nodes
    .filter(node => node.type === NODE_TYPES.JOIN)
    .forEach(node => {
      previousJoins[node.id] = node;
    });
  const joinNodes = joins.map(join => {
    const previous = previousJoins[join.id];
    return {
      id: join.id,
      type: NODE_TYPES.JOIN,
      position: previous ? previous.position : joinPosition(join, wiredEdges, keptNodes),
      data: { flowKey: join.flowKey, stepIndex: join.stepIndex }
    };
  });

  // Edges between unwired nodes are kept as drawn: they become steps once wired
  const orphanEdges = edges.filter(edge => orphanIds.has(edge.source) && nodes.some(node => node.id === edge.target));

  return {
    actions,
    nodes: [...keptNodes, ...joinNodes],
    edges: [...wiredEdges, ...orphanEdges],
    mapping,
    orphans: result.orphans
  };
};

// A new join node sits between the nodes it joins
const joinPosition = (join, edges, nodes) => {
  const positionOf = id => {
    const node = nodes.find(candidate => candidate.id === id);
    return node && node.position ? node.position : { x: 0, y: 0 };
  };
  const sources = edges.filter(edge => edge.target === join.id).map(edge => positionOf(edge.source));
  const targets = edges.filter(edge => edge.source === join.id).map(edge => positionOf(edge.target));
  const all = [...sources, ...targets];
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    x: snapToGrid((Math.max(...sources.map(p => p.x)) + Math.min(...targets.map(p => p.x))) / 2),
    y: snapToGrid(average(all.map(p => p.y)) + (NODE_SIZE.HEIGHT - NODE_SIZE.JOIN) / 2)
  };
};

/**
 * Tell whether an edge may be drawn: not into a trigger or the start, not from a node to itself,
 * an output of the source node, and the result still expressible as steps.
 */
export const canConnect = (scene, nodes, edges, connection) => {
  const source = nodes.find(node => node.id === connection.source);
  const target = nodes.find(node => node.id === connection.target);
  if (!source || !target || source.id === target.id) {
    return false;
  }
  if (target.type === NODE_TYPES.TRIGGER || target.type === NODE_TYPES.START || source.type === NODE_TYPES.TRIGGER) {
    return false;
  }
  if (target.type === NODE_TYPES.JOIN) {
    return false;
  }
  const handle = connection.sourceHandle || HANDLES.NEXT;
  if (handle !== HANDLES.NEXT) {
    const action = getNodeAction(source, scene.actions);
    if (!action || !branchesOf(action.type).some(branch => branch.handle === handle)) {
      return false;
    }
  }
  if (edges.some(edge => edge.source === source.id && edge.target === target.id)) {
    return false;
  }
  const candidate = [...edges, makeEdge(source.id, handle, target.id)];
  return !graphToActions(nodes, candidate, node => getNodeAction(node, scene.actions)).error;
};

// ---------------------------------------------------------------------------------------------
// Edits of the canvas (spec C.5). Each one returns the nodes and edges to give to applyGraph.
// ---------------------------------------------------------------------------------------------

/** A new unwired action node, without type yet: its panel opens on the type picker. */
export const newActionNode = (id, position) => ({
  id,
  type: NODE_TYPES.ACTION,
  position,
  data: { path: null, action: { type: null } }
});

// Two nodes overlap when their boxes would cover each other
const overlaps = (position, other) =>
  Math.abs(position.x - other.x) < NODE_SIZE.WIDTH && Math.abs(position.y - other.y) < NODE_SIZE.HEIGHT;

/** The first free position at or below the given one, so a new node never covers another one. */
export const freePosition = (nodes, position) => {
  let candidate = position;
  while (nodes.some(node => node.position && node.type !== NODE_TYPES.JOIN && overlaps(candidate, node.position))) {
    candidate = { x: candidate.x, y: candidate.y + LAYOUT.ROW_HEIGHT };
  }
  return candidate;
};

// The nodes reached from some nodes, through any output
const downstream = (edges, startIds) => {
  const reached = new Set();
  const queue = [...startIds];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!reached.has(id)) {
      reached.add(id);
      edges.filter(edge => edge.source === id).forEach(edge => queue.push(edge.target));
    }
  }
  return reached;
};

const nextPosition = (nodes, nodeId, rowOffset = 0) => {
  const node = nodes.find(candidate => candidate.id === nodeId);
  const position = (node && node.position) || { x: 0, y: 0 };
  // next to a block, a node lines up with the block's center, not its top
  const centering = node && node.type === NODE_TYPES.BLOCK ? (NODE_SIZE.BLOCK_HEIGHT - NODE_SIZE.HEIGHT) / 2 : 0;
  return {
    x: position.x + LAYOUT.COLUMN_WIDTH,
    y: position.y + centering + rowOffset * LAYOUT.ROW_HEIGHT
  };
};

/**
 * Insert a node right after another one, on one of its outputs: what followed that output now
 * follows the new node.
 */
export const insertAfter = ({ nodes, edges }, nodeId, newNode, handle = HANDLES.NEXT) => {
  const following = edges.filter(edge => edge.source === nodeId && (edge.sourceHandle || HANDLES.NEXT) === handle);
  const rowOffset = handle === HANDLES.ELSE ? 1 : 0;
  const placed = { ...newNode, position: newNode.position || nextPosition(nodes, nodeId, rowOffset) };
  // what follows moves one column right, to make room, as in a list
  const shifted = downstream(
    edges,
    following.map(edge => edge.target)
  );
  return {
    nodes: [
      ...nodes.map(node =>
        shifted.has(node.id) && node.position
          ? { ...node, position: { x: node.position.x + LAYOUT.COLUMN_WIDTH, y: node.position.y } }
          : node
      ),
      placed
    ],
    edges: [
      ...edges.filter(edge => !following.includes(edge)),
      makeEdge(nodeId, handle, placed.id),
      ...following.map(edge => makeEdge(placed.id, HANDLES.NEXT, edge.target))
    ]
  };
};

/** Add a node running at the same time as another one: same inputs, same following nodes. */
export const addParallel = ({ nodes, edges }, nodeId, newNode) => {
  const node = nodes.find(candidate => candidate.id === nodeId);
  const position = (node && node.position) || { x: 0, y: 0 };
  const placed = {
    ...newNode,
    position: newNode.position || freePosition(nodes, { x: position.x, y: position.y + LAYOUT.ROW_HEIGHT })
  };
  return {
    nodes: [...nodes, placed],
    edges: [
      ...edges,
      ...edges
        .filter(edge => edge.target === nodeId)
        .map(edge => makeEdge(edge.source, edge.sourceHandle || HANDLES.NEXT, placed.id)),
      ...edges
        .filter(edge => edge.source === nodeId && (edge.sourceHandle || HANDLES.NEXT) === HANDLES.NEXT)
        .map(edge => makeEdge(placed.id, HANDLES.NEXT, edge.target))
    ]
  };
};

/** Add a node at the end of the scene: after every action of its last step. */
export const appendToMainFlow = ({ nodes, edges }, newNode) => {
  const lastStep = {};
  let lastIndex = -1;
  nodes.forEach(node => {
    if (node.data && node.data.path) {
      const segments = node.data.path.split('.');
      if (segments.length === 2) {
        const stepIndex = Number(segments[0]);
        if (stepIndex > lastIndex) {
          lastIndex = stepIndex;
        }
        lastStep[stepIndex] = [...(lastStep[stepIndex] || []), node];
      }
    }
  });
  const sources = lastIndex >= 0 ? lastStep[lastIndex] : [nodes.find(node => node.id === START_NODE_ID)];
  const rightmost = sources.reduce(
    (best, node) => (node.position && node.position.x > best ? node.position.x : best),
    0
  );
  const placed = {
    ...newNode,
    position:
      newNode.position ||
      freePosition(nodes, { x: rightmost + LAYOUT.COLUMN_WIDTH, y: (sources[0].position || { y: 0 }).y })
  };
  return {
    nodes: [...nodes, placed],
    edges: [...edges, ...sources.map(source => makeEdge(source.id, HANDLES.NEXT, placed.id))]
  };
};

/**
 * Remove a node. What came before it is wired to what came after it, so removing a step does not
 * cut the rest of the scene off. Removing a block removes its branches with it.
 */
export const removeNode = ({ nodes, edges }, nodeId) => {
  const node = nodes.find(candidate => candidate.id === nodeId);
  if (!node || node.type === NODE_TYPES.START || node.type === NODE_TYPES.TRIGGER || node.type === NODE_TYPES.JOIN) {
    return { nodes, edges };
  }
  const removed = new Set([nodeId]);
  if (node.data.path) {
    nodes.forEach(candidate => {
      if (candidate.data && candidate.data.path && candidate.data.path.startsWith(`${node.data.path}.`)) {
        removed.add(candidate.id);
      }
    });
  }
  const inputs = edges.filter(edge => edge.target === nodeId);
  const outputs = edges.filter(edge => edge.source === nodeId && (edge.sourceHandle || HANDLES.NEXT) === HANDLES.NEXT);
  const bridges = [];
  inputs.forEach(input =>
    outputs.forEach(output => {
      const handle = input.sourceHandle || HANDLES.NEXT;
      if (
        !removed.has(input.source) &&
        !removed.has(output.target) &&
        !edges.some(edge => edge.source === input.source && edge.target === output.target)
      ) {
        bridges.push(makeEdge(input.source, handle, output.target));
      }
    })
  );
  return {
    nodes: nodes.filter(candidate => !removed.has(candidate.id)),
    edges: [...edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)), ...bridges]
  };
};

/**
 * Keep one trigger node per trigger of the scene, each wired into the start: after a trigger was
 * added or removed in its panel.
 */
export const syncTriggerNodes = ({ nodes, edges }, triggerCount) => {
  const existing = nodes.filter(node => node.type === NODE_TYPES.TRIGGER);
  const others = nodes.filter(node => node.type !== NODE_TYPES.TRIGGER);
  const triggers = [];
  for (let index = 0; index < triggerCount; index += 1) {
    const previous = existing.find(node => node.data.index === index);
    triggers.push(
      previous || {
        id: triggerNodeId(index),
        type: NODE_TYPES.TRIGGER,
        position: { x: -LAYOUT.COLUMN_WIDTH, y: index * LAYOUT.ROW_HEIGHT },
        data: { index }
      }
    );
  }
  return {
    nodes: [...triggers, ...others],
    edges: [
      ...edges.filter(edge => !edge.source.startsWith('trigger-')),
      ...triggers.map(trigger => makeEdge(trigger.id, HANDLES.NEXT, START_NODE_ID))
    ]
  };
};

/** Lay the whole canvas out again, from the steps of the scene. */
export const relayout = (scene, { nodes, edges }) => {
  const wired = nodes.filter(node => node.type !== NODE_TYPES.JOIN && !(node.data && node.data.path === null));
  const unwired = nodes.filter(node => node.data && node.data.path === null);
  const joins = nodes.filter(node => node.type === NODE_TYPES.JOIN);
  const laidOut = autoLayout([...wired, ...joins], edges, scene);
  const bottom = laidOut.reduce((max, node) => Math.max(max, node.position.y), 0);
  return {
    nodes: [
      ...laidOut,
      ...unwired.map((node, index) => ({
        ...node,
        position: { x: index * LAYOUT.COLUMN_WIDTH, y: bottom + 2 * LAYOUT.ROW_HEIGHT }
      }))
    ],
    edges
  };
};

/** The positions to save with the scene (spec C.4): wired nodes only, by node key. */
export const layoutPositions = nodes => {
  const positions = {};
  nodes
    .filter(node => !(node.data && node.data.path === null) && node.position)
    .forEach(node => {
      positions[layoutKey(node)] = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
    });
  return positions;
};

export { makeEdge, isBlockType, branchesOf };
