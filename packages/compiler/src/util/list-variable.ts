import type { ScratchInput, VariableBinding } from '../types.ts';

const listVariable = (list: [string, string], index: ScratchInput): VariableBinding => ({
  kind: 'variable',
  scalar: true,
  get: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'data_itemoflist',
      fields: { LIST: list },
      inputs: { INDEX: index }
    })
  },
  set: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs }) => ({
      opcode: 'data_replaceitemoflist',
      fields: { LIST: list },
      inputs: {
        INDEX: index,
        ITEM: inputs[0]
      }
    })
  }
});

export default listVariable;
