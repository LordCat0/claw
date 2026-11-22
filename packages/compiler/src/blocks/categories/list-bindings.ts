import type { Bindings } from '../../types.ts';

export const internals: Bindings = {
  compiler: {
    kind: 'object',
    members: {
      join: {
        kind: 'function',
        blockType: 'reporter',
        resultType: 'string',
        args: [10, 10],
        create: ({ inputs }) => ({
          opcode: 'operator_join',
          inputs: {
            STRING1: inputs[0],
            STRING2: inputs[1]
          }
        })
      },
      waitUntil: {
        kind: 'function',
        blockType: 'command',
        args: [10],
        create: ({ inputs }, compiler) => ({
          opcode: 'control_wait_until',
          inputs: { CONDITION: compiler.boolean(inputs[0]) }
        })
      }
    }
  }
};

export const listMethods: Record<string, [number, number]> = {
  at: [1, 1],
  push: [0, Infinity],
  pop: [0, 0],
  shift: [0, 0],
  unshift: [0, Infinity],
  insert: [2, Infinity],
  remove: [1, 2],
  clear: [0, 0],
  slice: [0, 2],
  concat: [0, Infinity],
  copy: [0, 0],
  splice: [1, Infinity],
  reverse: [0, 0],
  sort: [0, 0],
  fill: [1, 3],
  indexOf: [1, 2],
  lastIndexOf: [1, 2],
  includes: [1, 2],
  join: [0, 1],
  map: [1, 1],
  filter: [1, 1]
};
