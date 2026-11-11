// Limits of the scripts of the code mode (docs/specs/scene-editor-modes.md B.2 and D.2).
const SCRIPT_LANGUAGES = ['javascript'];
const SCRIPT_MAX_CODE_LENGTH = 100000;
// Memory a single execution may allocate inside the sandbox.
const SCRIPT_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;
// QuickJS runs on the stack of Node: its own limit must be reached well before the one of V8,
// or a runaway recursion overflows V8 inside the WebAssembly module. 256 KB still allows a
// recursion about 1 000 calls deep.
const SCRIPT_MAX_STACK_SIZE_BYTES = 256 * 1024;
// A script running longer than this without awaiting the API is interrupted.
const SCRIPT_MAX_SYNC_EXECUTION_MS = 1000;
// Processor time a single execution may use in all, its waits (sleep, actions) left out: a script
// cannot keep Gladys busy by slices that each stay under the limit above.
const SCRIPT_MAX_TOTAL_EXECUTION_MS = 30 * 1000;
// Layout of the graph mode: display only, bounded so a scene row stays small.
const EDITOR_MODES = ['classic', 'graph', 'code'];
const EDITOR_GRAPH_DIRECTIONS = ['horizontal', 'vertical'];
const EDITOR_GRAPH_MAX_POSITIONS = 2000;
const EDITOR_GRAPH_MAX_SIGNATURE_LENGTH = 4096;

module.exports = {
  SCRIPT_LANGUAGES,
  SCRIPT_MAX_CODE_LENGTH,
  SCRIPT_MEMORY_LIMIT_BYTES,
  SCRIPT_MAX_STACK_SIZE_BYTES,
  SCRIPT_MAX_SYNC_EXECUTION_MS,
  SCRIPT_MAX_TOTAL_EXECUTION_MS,
  EDITOR_MODES,
  EDITOR_GRAPH_DIRECTIONS,
  EDITOR_GRAPH_MAX_POSITIONS,
  EDITOR_GRAPH_MAX_SIGNATURE_LENGTH,
};
