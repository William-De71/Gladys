// Unit tests of the graph mode conversions: `npm run test-unit` (node --test, no dependency).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NODE_TYPES,
  HANDLES,
  START_NODE_ID,
  GRAPH_ERRORS,
  sceneToGraph,
  graphToActions,
  applyGraph,
  canConnect,
  getNodeAction,
  remapPath,
  remapActionVariables,
  sceneSignature,
  layoutKey,
  makeEdge,
  MAX_SIGNATURE_LENGTH,
  newActionNode,
  insertAfter,
  addParallel,
  appendToMainFlow,
  removeNode,
  syncTriggerNodes,
  relayout,
  layoutPositions,
  freePosition,
  DIRECTIONS
} from './sceneGraph.js';

const idGenerator = () => {
  let counter = 0;
  return () => {
    counter += 1;
    return `n${counter}`;
  };
};

const build = (scene, positions) => sceneToGraph(scene, { newId: idGenerator(), positions });

const nodeAt = (graph, path) => graph.nodes.find(node => node.data && node.data.path === path);

const edgePairs = graph =>
  graph.edges.map(edge => `${edge.source}:${edge.sourceHandle}->${edge.target}`).sort((a, b) => a.localeCompare(b));

const roundTrip = scene => {
  const graph = build(scene);
  return graphToActions(graph.nodes, graph.edges, node => getNodeAction(node, scene.actions));
};

const light = name => ({ type: 'light.turn-on', devices: [name] });
const message = text => ({ type: 'message.send', user: 'john', text });

const ifBlock = (conditions, thenSteps, elseSteps) => ({
  type: 'condition.if-then-else',
  if: conditions,
  then: thenSteps,
  else: elseSteps
});

describe('sceneToGraph', () => {
  it('should draw triggers into the start, and a sequence of steps', () => {
    const scene = {
      triggers: [{ type: 'time.sunset' }, { type: 'time.sunrise' }],
      actions: [[light('a')], [light('b')]]
    };
    const graph = build(scene);
    assert.deepEqual(
      graph.nodes.map(node => [node.id, node.type]),
      [
        ['trigger-0', NODE_TYPES.TRIGGER],
        ['trigger-1', NODE_TYPES.TRIGGER],
        [START_NODE_ID, NODE_TYPES.START],
        ['n1', NODE_TYPES.ACTION],
        ['n2', NODE_TYPES.ACTION]
      ]
    );
    assert.deepEqual(edgePairs(graph), [
      'n1:next->n2',
      'start:next->n1',
      'trigger-0:next->start',
      'trigger-1:next->start'
    ]);
  });

  it('should join two parallel steps through a join node, and fan out otherwise', () => {
    const scene = { triggers: [], actions: [[light('a'), light('b')], [light('c'), light('d')], [light('e')]] };
    const graph = build(scene);
    const join = graph.nodes.find(node => node.type === NODE_TYPES.JOIN);
    assert.deepEqual(join.data, { flowKey: 'main', stepIndex: 1 });
    // in the gap before its column, centered on the row, on the 15 px grid
    assert.deepEqual(join.position, { x: 555, y: 15 });
    graph.nodes.forEach(node => {
      assert.equal(node.position.x % 15, 0);
      assert.equal(node.position.y % 15, 0);
    });
    assert.deepEqual(edgePairs(graph), [
      `${join.id}:next->n3`,
      `${join.id}:next->n4`,
      `n1:next->${join.id}`,
      `n2:next->${join.id}`,
      'n3:next->n5',
      'n4:next->n5',
      'start:next->n1',
      'start:next->n2'
    ]);
  });

  it('should draw the branches of an if block and the body of a while block', () => {
    const scene = {
      triggers: [],
      actions: [
        [ifBlock([{ type: 'house.is-empty', house: 'main' }], [[light('a')], [light('b')]], [[light('c')]])],
        [{ type: 'condition.while', if: [], then: [[light('d')]] }],
        [light('e')]
      ]
    };
    const graph = build(scene);
    assert.equal(nodeAt(graph, '0.0').type, NODE_TYPES.BLOCK);
    assert.deepEqual(
      graph.nodes.filter(node => node.data && node.data.path).map(node => node.data.path),
      ['0.0', '0.0.then.0.0', '0.0.then.1.0', '0.0.else.0.0', '1.0', '1.0.then.0.0', '2.0']
    );
    const id = path => nodeAt(graph, path).id;
    assert.deepEqual(
      edgePairs(graph),
      [
        `${id('0.0')}:then->${id('0.0.then.0.0')}`,
        `${id('0.0.then.0.0')}:next->${id('0.0.then.1.0')}`,
        `${id('0.0')}:else->${id('0.0.else.0.0')}`,
        `${id('0.0')}:next->${id('1.0')}`,
        `${id('1.0')}:do->${id('1.0.then.0.0')}`,
        `${id('1.0')}:next->${id('2.0')}`,
        `start:next->${id('0.0')}`
      ].sort((a, b) => a.localeCompare(b))
    );
  });

  it('should skip empty steps and draw an action without type', () => {
    const graph = build({ triggers: [], actions: [[], [{ type: null }], [], [light('a')]] });
    assert.deepEqual(
      graph.nodes.filter(node => node.data.path).map(node => node.data.path),
      ['1.0', '3.0']
    );
    assert.deepEqual(edgePairs(graph), ['n1:next->n2', 'start:next->n1']);
  });

  it('should lay steps out as columns, parallel actions stacked and branches below their block', () => {
    const scene = {
      triggers: [{ type: 'time.sunset' }],
      actions: [[light('a'), ifBlock([], [[light('b')]], [[light('c')]])], [light('d')]]
    };
    const graph = build(scene);
    const position = path => nodeAt(graph, path).position;
    assert.deepEqual(graph.nodes[0].position, { x: -300, y: 0 });
    assert.deepEqual(position('0.0'), { x: 300, y: 0 });
    // a block is centered on its row, like the other nodes
    assert.deepEqual(position('0.1'), { x: 300, y: 105 });
    assert.deepEqual(position('0.1.then.0.0'), { x: 600, y: 240 });
    assert.deepEqual(position('0.1.else.0.0'), { x: 600, y: 360 });
    // the next step comes after the branches
    assert.deepEqual(position('1.0'), { x: 900, y: 0 });
  });

  it('should apply the saved positions by node key', () => {
    const scene = { triggers: [{ type: 'time.sunset' }], actions: [[light('a')]] };
    const graph = build(scene, { '0.0': { x: 5, y: 6 }, 'trigger.0': { x: -1, y: -2 } });
    assert.deepEqual(nodeAt(graph, '0.0').position, { x: 5, y: 6 });
    assert.deepEqual(graph.nodes[0].position, { x: -1, y: -2 });
    assert.deepEqual(graph.nodes[1].position, { x: 0, y: 0 });
  });
});

describe('graphToActions', () => {
  it('should give back the steps of any scene drawn by sceneToGraph', () => {
    const scene = {
      triggers: [{ type: 'time.sunset' }],
      actions: [
        [{ type: 'device.get-value', device_feature: 'temp' }],
        [light('a'), light('b')],
        [message('x'), message('y')],
        [
          ifBlock(
            [{ type: 'house.is-empty', house: 'main' }],
            [[light('c')], [ifBlock([], [[message('nested')]], [[]])]],
            [[]]
          )
        ],
        [{ type: 'condition.while', if: [{ type: 'house.is-empty' }], then: [[light('d'), light('e')]] }]
      ]
    };
    const result = roundTrip(scene);
    assert.deepEqual(result.actions, scene.actions);
    assert.deepEqual(result.orphans, []);
  });

  it('should give one empty step for a scene without action', () => {
    assert.deepEqual(roundTrip({ triggers: [], actions: [] }).actions, [[]]);
  });

  it('should make a node wait for every node wired before it', () => {
    const scene = { triggers: [], actions: [[light('a')], [light('b')]] };
    const graph = build(scene);
    // start -> c, and b -> c: c waits for b
    graph.nodes.push({
      id: 'c',
      type: NODE_TYPES.ACTION,
      position: { x: 0, y: 0 },
      data: { path: null, action: light('c') }
    });
    graph.edges.push(makeEdge(START_NODE_ID, HANDLES.NEXT, 'c'), makeEdge('n2', HANDLES.NEXT, 'c'));
    const result = graphToActions(graph.nodes, graph.edges, node => getNodeAction(node, scene.actions));
    assert.deepEqual(result.actions, [[light('a')], [light('b')], [light('c')]]);
  });

  it('should order parallel actions from top to bottom', () => {
    const scene = { triggers: [], actions: [[light('a'), light('b')]] };
    const graph = build(scene);
    nodeAt(graph, '0.0').position = { x: 0, y: 500 };
    const result = graphToActions(graph.nodes, graph.edges, node => getNodeAction(node, scene.actions));
    assert.deepEqual(result.actions, [[light('b'), light('a')]]);
    assert.deepEqual(result.paths, { n1: '0.1', n2: '0.0' });
  });

  it('should list the actions wired to nothing', () => {
    const scene = { triggers: [], actions: [[light('a')]] };
    const graph = build(scene);
    graph.nodes.push({ id: 'x', type: NODE_TYPES.ACTION, data: { path: null, action: light('x') } });
    const result = graphToActions(graph.nodes, graph.edges, node => getNodeAction(node, scene.actions));
    assert.deepEqual(result.orphans, ['x']);
    assert.deepEqual(result.actions, [[light('a')]]);
  });

  it('should refuse a cycle and a node reached from two flows', () => {
    const scene = { triggers: [], actions: [[light('a')], [light('b')]] };
    const graph = build(scene);
    const getAction = node => getNodeAction(node, scene.actions);
    assert.deepEqual(graphToActions(graph.nodes, [...graph.edges, makeEdge('n2', HANDLES.NEXT, 'n1')], getAction), {
      error: GRAPH_ERRORS.CYCLE
    });

    const withBlock = { triggers: [], actions: [[ifBlock([], [[light('a')]], [[]])], [light('b')]] };
    const blockGraph = build(withBlock);
    const thenNode = nodeAt(blockGraph, '0.0.then.0.0').id;
    const afterNode = nodeAt(blockGraph, '1.0').id;
    assert.deepEqual(
      graphToActions(blockGraph.nodes, [...blockGraph.edges, makeEdge(thenNode, HANDLES.NEXT, afterNode)], node =>
        getNodeAction(node, withBlock.actions)
      ),
      { error: GRAPH_ERRORS.MULTIPLE_FLOWS }
    );
  });

  it('should report the error of a nested branch', () => {
    const scene = { triggers: [], actions: [[ifBlock([], [[light('a')], [light('b')]], [[]])]] };
    const graph = build(scene);
    const a = nodeAt(graph, '0.0.then.0.0').id;
    const b = nodeAt(graph, '0.0.then.1.0').id;
    assert.deepEqual(
      graphToActions(graph.nodes, [...graph.edges, makeEdge(b, HANDLES.NEXT, a)], node =>
        getNodeAction(node, scene.actions)
      ),
      { error: GRAPH_ERRORS.CYCLE }
    );
  });
});

describe('applyGraph', () => {
  it('should insert a new step, rewrite the variables of the moved actions and redraw the edges', () => {
    const scene = {
      triggers: [],
      actions: [
        [{ type: 'device.get-value', device_feature: 'temp' }],
        [message('Temp {{0.0.last_value}}')],
        [message('Again {{ 1.0.text }}')]
      ]
    };
    const graph = build(scene);
    // a new action inserted between the first and the second step
    const nodes = [...graph.nodes, { id: 'new', type: NODE_TYPES.ACTION, data: { path: null, action: light('new') } }];
    const edges = graph.edges
      .filter(edge => !(edge.source === 'n1' && edge.target === 'n2'))
      .concat([makeEdge('n1', HANDLES.NEXT, 'new'), makeEdge('new', HANDLES.NEXT, 'n2')]);
    const result = applyGraph(scene, nodes, edges);
    assert.deepEqual(result.actions, [
      [{ type: 'device.get-value', device_feature: 'temp' }],
      [light('new')],
      [message('Temp {{0.0.last_value}}')],
      [message('Again {{ 2.0.text }}')]
    ]);
    assert.deepEqual(result.mapping, { '1.0': '2.0', '2.0': '3.0' });
    assert.deepEqual(result.orphans, []);
    assert.deepEqual(result.nodes.find(node => node.id === 'new').data, { path: '1.0' });
    assert.deepEqual(edgePairs(result), ['n1:next->new', 'n2:next->n3', 'new:next->n2', 'start:next->n1']);
  });

  it('should keep an action cut off from the flow, and wire it back with its variables', () => {
    const scene = {
      triggers: [],
      actions: [[{ type: 'device.get-value', device_feature: 'temp' }], [light('b')], [message('{{1.0.x}}')]]
    };
    const graph = build(scene);
    // cut b off
    const cut = applyGraph(
      scene,
      graph.nodes,
      graph.edges.filter(edge => edge.target !== 'n2')
    );
    // the message after it is cut off too: its only input was b
    assert.deepEqual(cut.orphans, ['n2', 'n3']);
    assert.deepEqual(cut.actions, [[{ type: 'device.get-value', device_feature: 'temp' }]]);
    assert.deepEqual(cut.nodes.find(node => node.id === 'n2').data, {
      path: null,
      lastPath: '1.0',
      action: light('b')
    });
    // its outgoing edge is kept as drawn
    assert.ok(cut.edges.some(edge => edge.source === 'n2' && edge.target === 'n3'));

    // wire it back after the first step: both come back, the message still reading it
    const sceneAfterCut = { ...scene, actions: cut.actions };
    const wired = applyGraph(sceneAfterCut, cut.nodes, [...cut.edges, makeEdge('n1', HANDLES.NEXT, 'n2')]);
    assert.deepEqual(wired.actions, [
      [{ type: 'device.get-value', device_feature: 'temp' }],
      [light('b')],
      [message('{{1.0.x}}')]
    ]);
  });

  it('should not take back a last path another action holds now', () => {
    const scene = { triggers: [], actions: [[light('a')], [message('{{1.0.x}}')]] };
    const graph = build(scene);
    const nodes = graph.nodes.map(node =>
      node.id === 'n1' ? { ...node, data: { path: null, lastPath: '1.0', action: light('a') } } : node
    );
    nodes.find(node => node.id === 'n2').data = { path: '1.0' };
    const result = applyGraph(scene, nodes, [
      makeEdge(START_NODE_ID, HANDLES.NEXT, 'n1'),
      makeEdge('n1', HANDLES.NEXT, 'n2')
    ]);
    assert.deepEqual(result.mapping, {});
  });

  it('should keep a join node where it was, and place a new one between its nodes', () => {
    const scene = {
      triggers: [],
      actions: [
        [light('a'), light('b')],
        [light('c'), light('d')]
      ]
    };
    const graph = build(scene);
    const join = graph.nodes.find(node => node.type === NODE_TYPES.JOIN);
    join.position = { x: 42, y: 43 };
    const kept = applyGraph(scene, graph.nodes, graph.edges);
    assert.deepEqual(kept.nodes.find(node => node.id === join.id).position, { x: 42, y: 43 });

    const sequential = { triggers: [], actions: [[light('a'), light('b')]] };
    const sequentialGraph = build(sequential);
    const nodes = [
      ...sequentialGraph.nodes,
      { id: 'c', type: NODE_TYPES.ACTION, position: { x: 600, y: 0 }, data: { path: null, action: light('c') } },
      { id: 'd', type: NODE_TYPES.ACTION, position: { x: 600, y: 120 }, data: { path: null, action: light('d') } }
    ];
    const edges = [
      ...sequentialGraph.edges,
      makeEdge('n1', HANDLES.NEXT, 'c'),
      makeEdge('n2', HANDLES.NEXT, 'd'),
      makeEdge('n1', HANDLES.NEXT, 'd'),
      makeEdge('n2', HANDLES.NEXT, 'c')
    ];
    const result = applyGraph(sequential, nodes, edges);
    const newJoin = result.nodes.find(node => node.type === NODE_TYPES.JOIN);
    // between the two columns, centered on the rows it joins, on the grid
    assert.deepEqual(newJoin.position, { x: 450, y: 75 });
    assert.deepEqual(result.actions, [
      [light('a'), light('b')],
      [light('c'), light('d')]
    ]);
  });

  it('should return the error of a change the steps cannot express', () => {
    const scene = { triggers: [], actions: [[light('a')], [light('b')]] };
    const graph = build(scene);
    assert.deepEqual(applyGraph(scene, graph.nodes, [...graph.edges, makeEdge('n2', HANDLES.NEXT, 'n1')]), {
      error: GRAPH_ERRORS.CYCLE
    });
  });

  it('should rewrite the variables inside the branches of a moved block', () => {
    const scene = {
      triggers: [],
      actions: [
        [{ type: 'device.get-value', device_feature: 'temp' }],
        [ifBlock([{ type: 'calendar.is-event-running' }], [[message('{{1.0.if.0.name}} {{0.0.last_value}}')]], [[]])]
      ]
    };
    const graph = build(scene);
    const nodes = [...graph.nodes, { id: 'new', type: NODE_TYPES.ACTION, data: { path: null, action: light('x') } }];
    const edges = graph.edges
      .filter(edge => !(edge.source === 'n1' && edge.target === 'n2'))
      .concat([makeEdge('n1', HANDLES.NEXT, 'new'), makeEdge('new', HANDLES.NEXT, 'n2')]);
    const result = applyGraph(scene, nodes, edges);
    assert.deepEqual(result.actions[2][0].then, [[message('{{2.0.if.0.name}} {{0.0.last_value}}')]]);
    assert.deepEqual(result.actions[2][0].else, [[]]);
  });
});

describe('canConnect', () => {
  const scene = { triggers: [{ type: 'time.sunset' }], actions: [[ifBlock([], [[]], [[]])], [light('b')]] };
  const graph = build(scene);
  graph.nodes.push({ id: 'free', type: NODE_TYPES.ACTION, data: { path: null, action: light('free') } });
  const connect = (source, target, sourceHandle) =>
    canConnect(scene, graph.nodes, graph.edges, { source, target, sourceHandle });

  it('should accept an output of the source into an action', () => {
    assert.equal(connect('n2', 'free', HANDLES.NEXT), true);
    assert.equal(connect('n1', 'free', HANDLES.THEN), true);
    assert.equal(connect('n1', 'free', HANDLES.ELSE), true);
    assert.equal(connect(START_NODE_ID, 'free'), true);
  });

  it('should refuse what the steps cannot express', () => {
    assert.equal(connect('n2', 'n2'), false);
    assert.equal(connect('n2', 'unknown'), false);
    assert.equal(connect('n2', 'trigger-0'), false);
    assert.equal(connect('n2', START_NODE_ID), false);
    assert.equal(connect('trigger-0', 'free'), false);
    assert.equal(connect('n2', 'free', HANDLES.THEN), false);
    assert.equal(connect('n1', 'free', HANDLES.DO), false);
    // already wired
    assert.equal(connect('n1', 'n2'), false);
    // cycle
    assert.equal(connect('n2', 'n1'), false);
  });

  it('should refuse an edge into a join node', () => {
    const parallel = {
      triggers: [],
      actions: [
        [light('a'), light('b')],
        [light('c'), light('d')]
      ]
    };
    const parallelGraph = build(parallel);
    const join = parallelGraph.nodes.find(node => node.type === NODE_TYPES.JOIN);
    assert.equal(
      canConnect(parallel, parallelGraph.nodes, parallelGraph.edges, { source: 'n1', target: join.id }),
      false
    );
  });
});

describe('variables', () => {
  it('should remap a path from the longest moved prefix', () => {
    const mapping = { '1.0': '2.0', '1.0.then.0.0': '3.0' };
    assert.equal(remapPath('1.0.then.0.0.last_value', mapping), '3.0.last_value');
    assert.equal(remapPath('1.0.last_value', mapping), '2.0.last_value');
    assert.equal(remapPath('10.0.last_value', mapping), '10.0.last_value');
    assert.equal(remapPath('triggerEvent.value', mapping), 'triggerEvent.value');
  });

  it('should rewrite templates everywhere and condition selectors', () => {
    const action = {
      type: 'condition.only-continue-if',
      conditions: [{ variable: '1.0.last_value', operator: '>', value: 1, evaluate_value: '{{1.0.last_value}} + 1' }],
      fields: { caption: 'Seen {{1.0.label}} at {{triggerEvent.time}}' },
      text: '1.0 is not a template'
    };
    assert.deepEqual(remapActionVariables(action, { '1.0': '4.0' }), {
      type: 'condition.only-continue-if',
      conditions: [{ variable: '4.0.last_value', operator: '>', value: 1, evaluate_value: '{{4.0.last_value}} + 1' }],
      fields: { caption: 'Seen {{4.0.label}} at {{triggerEvent.time}}' },
      text: '1.0 is not a template'
    });
    assert.equal(remapActionVariables(action, {}), action);
  });
});

describe('signature and layout keys', () => {
  it('should describe the shape of a scene, not its parameters', () => {
    const scene = {
      triggers: [{ type: 'time.sunset' }],
      actions: [
        [light('a'), { type: null }],
        [],
        [ifBlock([], [[light('b')]], [[]])],
        [{ type: 'condition.while', then: [[light('c')]] }]
      ]
    };
    assert.equal(
      sceneSignature(scene),
      't1|light.turn-on,null/condition.if-then-else(light.turn-on;)/condition.while(light.turn-on)'
    );
    assert.equal(
      sceneSignature({ ...scene, actions: [[light('other')], [{ type: null }]], triggers: undefined }),
      't0|light.turn-on/null'
    );
  });

  it('should hash the signature of a very big scene', () => {
    const scene = { triggers: [], actions: Array.from({ length: 400 }, () => [light('a')]) };
    const signature = sceneSignature(scene);
    assert.match(signature, /^h\d+:[0-9a-f]+$/);
    assert.ok(signature.length < MAX_SIGNATURE_LENGTH);
  });

  it('should key each node of the layout', () => {
    assert.equal(layoutKey({ type: NODE_TYPES.TRIGGER, data: { index: 2 } }), 'trigger.2');
    assert.equal(layoutKey({ type: NODE_TYPES.START, data: {} }), 'start');
    assert.equal(layoutKey({ type: NODE_TYPES.JOIN, data: { flowKey: 'main', stepIndex: 3 } }), 'join.main.3');
    assert.equal(layoutKey({ type: NODE_TYPES.ACTION, data: { path: '1.0' } }), '1.0');
  });
});

describe('canvas edits', () => {
  const scene = {
    triggers: [{ type: 'time.sunset' }],
    actions: [[light('a')], [ifBlock([], [[light('b')]], [[]])], [light('c')]]
  };
  const apply = (graph, sceneToApply = scene) => {
    const result = applyGraph(sceneToApply, graph.nodes, graph.edges);
    const action = node => getNodeAction(node, result.actions);
    return { ...result, typeOf: id => action(result.nodes.find(node => node.id === id)).type };
  };
  const placeholder = newActionNode('new');

  it('should create a node without type, unwired', () => {
    assert.deepEqual(newActionNode('x', { x: 1, y: 2 }), {
      id: 'x',
      type: NODE_TYPES.ACTION,
      position: { x: 1, y: 2 },
      data: { path: null, action: { type: null } }
    });
  });

  it('should insert a step after a node', () => {
    const result = apply(insertAfter(build(scene), 'n1', placeholder));
    assert.deepEqual(
      result.actions.map(step => step.map(action => action.type)),
      [['light.turn-on'], [null], ['condition.if-then-else'], ['light.turn-on']]
    );
    assert.deepEqual(result.nodes.find(node => node.id === 'new').position, { x: 600, y: 0 });
  });

  it('should move what follows an inserted node one column right', () => {
    const graph = build(scene);
    const before = id => graph.nodes.find(node => node.id === id).position;
    const inserted = insertAfter(graph, 'n1', placeholder);
    const after = id => inserted.nodes.find(node => node.id === id).position;
    // the block, its branch and the last action make room; the first action stays
    assert.deepEqual(after('n1'), before('n1'));
    ['n2', 'n3', 'n4'].forEach(id => assert.deepEqual(after(id), { x: before(id).x + 300, y: before(id).y }));
    assert.deepEqual(after('new'), { x: 600, y: 0 });
  });

  it('should place a new node where no other node is', () => {
    const nodes = [
      { id: 'a', type: NODE_TYPES.ACTION, position: { x: 0, y: 0 } },
      { id: 'b', type: NODE_TYPES.ACTION, position: { x: 0, y: 120 } },
      { id: 'join', type: NODE_TYPES.JOIN, position: { x: 0, y: 240 } },
      { id: 'no-position', type: NODE_TYPES.ACTION }
    ];
    assert.deepEqual(freePosition(nodes, { x: 0, y: 0 }), { x: 0, y: 240 });
    assert.deepEqual(freePosition(nodes, { x: 300, y: 0 }), { x: 300, y: 0 });
  });

  it('should insert into a branch of a block, the else one a row lower', () => {
    const graph = build(scene);
    const thenResult = apply(insertAfter(graph, 'n2', placeholder, HANDLES.THEN));
    assert.deepEqual(thenResult.actions[1][0].then, [[{ type: null }], [light('b')]]);
    const elseGraph = insertAfter(graph, 'n2', placeholder, HANDLES.ELSE);
    assert.deepEqual(apply(elseGraph).actions[1][0].else, [[{ type: null }]]);
    assert.deepEqual(elseGraph.nodes.find(node => node.id === 'new').position, { x: 900, y: 120 });
  });

  it('should add a node at the same time as another', () => {
    const result = apply(addParallel(build(scene), 'n4', placeholder));
    assert.deepEqual(result.actions[2], [light('c'), { type: null }]);
    const first = apply(addParallel(build(scene), 'n1', placeholder));
    assert.deepEqual(first.actions[0], [light('a'), { type: null }]);
    assert.deepEqual(first.actions[1][0].type, 'condition.if-then-else');
  });

  it('should append a node at the end of the scene, or after the start of an empty one', () => {
    const result = apply(appendToMainFlow(build(scene), placeholder));
    assert.deepEqual(result.actions[3], [{ type: null }]);
    const empty = { triggers: [], actions: [[]] };
    const emptyResult = apply(appendToMainFlow(build(empty), placeholder), empty);
    assert.deepEqual(emptyResult.actions, [[{ type: null }]]);
    const parallel = { triggers: [], actions: [[light('a'), light('b')]] };
    assert.deepEqual(apply(appendToMainFlow(build(parallel), placeholder), parallel).actions, [
      [light('a'), light('b')],
      [{ type: null }]
    ]);
  });

  it('should keep the position given to a new node', () => {
    const graph = appendToMainFlow(build(scene), newActionNode('new', { x: 7, y: 8 }));
    assert.deepEqual(graph.nodes.find(node => node.id === 'new').position, { x: 7, y: 8 });
  });

  it('should remove a node and wire what came before it to what came after it', () => {
    const result = apply(removeNode(build(scene), 'n1'));
    assert.deepEqual(
      result.actions.map(step => step[0].type),
      ['condition.if-then-else', 'light.turn-on']
    );
  });

  it('should remove a block with its branches', () => {
    const result = apply(removeNode(build(scene), 'n2'));
    assert.deepEqual(result.actions, [[light('a')], [light('c')]]);
    assert.equal(
      result.nodes.some(node => node.id === 'n3'),
      false
    );
  });

  it('should remove a parallel node, dropping the join node it needed', () => {
    const parallel = {
      triggers: [],
      actions: [
        [light('a'), light('b')],
        [light('c'), light('d')]
      ]
    };
    const result = apply(removeNode(build(parallel), 'n1'), parallel);
    assert.deepEqual(result.actions, [[light('b')], [light('c'), light('d')]]);
    assert.equal(
      result.nodes.some(node => node.type === NODE_TYPES.JOIN),
      false
    );
  });

  it('should never remove the start, a trigger, a join or an unknown node', () => {
    const graph = build(scene);
    [START_NODE_ID, 'trigger-0', 'unknown'].forEach(id => assert.deepEqual(removeNode(graph, id), graph));
    const parallel = build({
      triggers: [],
      actions: [
        [light('a'), light('b')],
        [light('c'), light('d')]
      ]
    });
    const join = parallel.nodes.find(node => node.type === NODE_TYPES.JOIN);
    assert.deepEqual(removeNode(parallel, join.id), parallel);
  });

  it('should remove an unwired node', () => {
    const graph = build(scene);
    const withFree = { nodes: [...graph.nodes, placeholder], edges: graph.edges };
    assert.equal(removeNode(withFree, 'new').nodes.length, graph.nodes.length);
  });

  it('should not bridge to a node removed with the block', () => {
    const nested = { triggers: [], actions: [[ifBlock([], [[light('a')], [light('b')]], [[]])]] };
    const graph = build(nested);
    const result = apply(removeNode(graph, 'n2'), nested);
    assert.deepEqual(result.actions[0][0].then, [[light('b')]]);
  });

  it('should keep one trigger node per trigger', () => {
    const graph = build(scene);
    const more = syncTriggerNodes(graph, 3);
    assert.deepEqual(
      more.nodes.filter(node => node.type === NODE_TYPES.TRIGGER).map(node => [node.id, node.position]),
      [
        ['trigger-0', graph.nodes[0].position],
        ['trigger-1', { x: -300, y: 120 }],
        ['trigger-2', { x: -300, y: 240 }]
      ]
    );
    assert.equal(more.edges.filter(edge => edge.target === START_NODE_ID).length, 3);
    const none = syncTriggerNodes(more, 0);
    assert.equal(
      none.nodes.some(node => node.type === NODE_TYPES.TRIGGER),
      false
    );
    assert.equal(
      none.edges.some(edge => edge.target === START_NODE_ID),
      false
    );
  });

  it('should lay everything out again, unwired nodes below', () => {
    const graph = build(scene);
    graph.nodes.find(node => node.id === 'n1').position = { x: 999, y: 999 };
    const withFree = { nodes: [...graph.nodes, newActionNode('free')], edges: graph.edges };
    const result = relayout(scene, withFree);
    assert.deepEqual(result.nodes.find(node => node.id === 'n1').position, { x: 300, y: 0 });
    // two rows below the lowest node (b, in the then branch)
    assert.deepEqual(result.nodes.find(node => node.id === 'free').position, { x: 0, y: 360 });
  });

  it('should save the positions of the wired nodes, rounded', () => {
    assert.deepEqual(
      layoutPositions([
        { id: 'start', type: NODE_TYPES.START, position: { x: 1.4, y: 2.6 }, data: {} },
        { id: 'a', type: NODE_TYPES.ACTION, position: { x: 3, y: 4 }, data: { path: '0.0' } },
        { id: 'free', type: NODE_TYPES.ACTION, position: { x: 5, y: 6 }, data: { path: null } },
        { id: 'no-position', type: NODE_TYPES.ACTION, data: { path: '1.0' } }
      ]),
      { start: { x: 1, y: 3 }, '0.0': { x: 3, y: 4 } }
    );
  });
});

describe('vertical graphs', () => {
  const VERTICAL = DIRECTIONS.VERTICAL;
  const buildVertical = scene => sceneToGraph(scene, { newId: idGenerator(), direction: VERTICAL });
  const scene = {
    triggers: [{ type: 'time.sunset' }, { type: 'time.sunrise' }],
    actions: [[light('a'), ifBlock([], [[light('b')]], [[light('c')]])], [light('d'), light('e')], [light('f')]]
  };

  it('should lay steps out as rows, parallel actions side by side, on the grid', () => {
    const graph = buildVertical(scene);
    const position = path => nodeAt(graph, path).position;
    assert.deepEqual(graph.nodes[0].position, { x: 0, y: -150 });
    assert.deepEqual(graph.nodes[1].position, { x: 300, y: -150 });
    // the start is narrower: centered on the column of the nodes
    assert.deepEqual(graph.nodes[2].position, { x: 210, y: 0 });
    assert.deepEqual(position('0.0'), { x: 0, y: 150 });
    // a block is not shifted across the flow
    assert.deepEqual(position('0.1'), { x: 300, y: 150 });
    assert.deepEqual(position('0.1.then.0.0'), { x: 600, y: 300 });
    assert.deepEqual(position('0.1.else.0.0'), { x: 900, y: 300 });
    assert.deepEqual(position('1.0'), { x: 0, y: 450 });
    assert.deepEqual(position('1.1'), { x: 300, y: 450 });
    const join = graph.nodes.find(node => node.type === NODE_TYPES.JOIN);
    // in the gap above its row, centered on the column
    assert.deepEqual(join.position, { x: 105, y: 390 });
    graph.nodes.forEach(node => {
      assert.ok(node.position.x % 15 === 0 && node.position.y % 15 === 0);
    });
  });

  it('should order parallel actions from left to right', () => {
    const parallel = { triggers: [], actions: [[light('a'), light('b')]] };
    const graph = buildVertical(parallel);
    nodeAt(graph, '0.0').position = { x: 900, y: 0 };
    const result = graphToActions(graph.nodes, graph.edges, node => getNodeAction(node, parallel.actions), VERTICAL);
    assert.deepEqual(result.actions, [[light('b'), light('a')]]);
    // the same positions read horizontally keep the order of the rows
    const horizontal = graphToActions(graph.nodes, graph.edges, node => getNodeAction(node, parallel.actions));
    assert.deepEqual(horizontal.actions, [[light('a'), light('b')]]);
  });

  it('should place and make room along the flow, and look for room across it', () => {
    const simple = { triggers: [], actions: [[light('a')], [light('b')]] };
    const graph = buildVertical(simple);
    const inserted = insertAfter(graph, 'n1', newActionNode('new'), HANDLES.NEXT, VERTICAL);
    assert.deepEqual(inserted.nodes.find(node => node.id === 'new').position, { x: 0, y: 300 });
    assert.deepEqual(inserted.nodes.find(node => node.id === 'n2').position, { x: 0, y: 450 });
    const parallel = addParallel(graph, 'n1', newActionNode('side'), VERTICAL);
    assert.deepEqual(parallel.nodes.find(node => node.id === 'side').position, { x: 300, y: 150 });
    const appended = appendToMainFlow(graph, newActionNode('last'), VERTICAL);
    assert.deepEqual(appended.nodes.find(node => node.id === 'last').position, { x: 0, y: 450 });
    assert.deepEqual(freePosition(graph.nodes, { x: 0, y: 150 }, VERTICAL), { x: 300, y: 150 });
  });

  it('should insert into the else branch one column aside, next to a block', () => {
    const withBlock = { triggers: [], actions: [[ifBlock([], [[]], [[]])]] };
    const graph = buildVertical(withBlock);
    const inserted = insertAfter(graph, 'n1', newActionNode('new'), HANDLES.ELSE, VERTICAL);
    assert.deepEqual(inserted.nodes.find(node => node.id === 'new').position, { x: 300, y: 300 });
  });

  it('should add trigger nodes side by side, and lay unwired nodes aside', () => {
    const graph = buildVertical({ triggers: [], actions: [[light('a')]] });
    const triggers = syncTriggerNodes(graph, 2, VERTICAL);
    assert.deepEqual(
      triggers.nodes.filter(node => node.type === NODE_TYPES.TRIGGER).map(node => node.position),
      [
        { x: 0, y: -150 },
        { x: 300, y: -150 }
      ]
    );
    const withFree = { nodes: [...graph.nodes, newActionNode('free')], edges: graph.edges };
    const result = relayout({ triggers: [], actions: [[light('a')]] }, withFree, VERTICAL);
    // two columns past the furthest node (the start, centered at x 60)
    assert.deepEqual(result.nodes.find(node => node.id === 'free').position, { x: 660, y: 0 });
  });

  it('should place a new join node between the rows it joins', () => {
    const sequential = { triggers: [], actions: [[light('a'), light('b')]] };
    const graph = buildVertical(sequential);
    const nodes = [
      ...graph.nodes,
      { id: 'c', type: NODE_TYPES.ACTION, position: { x: 0, y: 300 }, data: { path: null, action: light('c') } },
      { id: 'd', type: NODE_TYPES.ACTION, position: { x: 300, y: 300 }, data: { path: null, action: light('d') } }
    ];
    const edges = [
      ...graph.edges,
      makeEdge('n1', HANDLES.NEXT, 'c'),
      makeEdge('n2', HANDLES.NEXT, 'd'),
      makeEdge('n1', HANDLES.NEXT, 'd'),
      makeEdge('n2', HANDLES.NEXT, 'c')
    ];
    const result = applyGraph(sequential, nodes, edges, VERTICAL);
    assert.deepEqual(result.nodes.find(node => node.type === NODE_TYPES.JOIN).position, { x: 255, y: 225 });
  });
});
