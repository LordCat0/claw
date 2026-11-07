import type { Bindings } from '../../types.ts';

export default {
  math: {
    random: {
      kind: 'function',
      blockType: 'reporter',
      args: [4, 4],
      create: ({ inputs }) => ({
        opcode: 'operator_random',
        inputs: {
          FROM: inputs[0],
          TO: inputs[1]
        }
      })
    },
    round: {
      kind: 'function',
      blockType: 'reporter',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'operator_round',
        inputs: {
          NUM: inputs[0]
        }
      })
    },
    calculate: {
      kind: 'function',
      blockType: 'reporter',
      args: ['field', 4],
      create: ({ fields, inputs }) => ({
        opcode: 'operator_mathop',
        inputs: {
          NUM: inputs[1]
        },
        fields: {
          OPERATOR: fields[0]
        }
      })
    }
  },
  text: {
    letterAt: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 6],
      create: ({ inputs }) => ({
        opcode: 'operator_letter_of',
        inputs: {
          LETTER: inputs[1],
          STRING: inputs[0]
        }
      })
    },
    length: {
      kind: 'function',
      blockType: 'reporter',
      args: [10],
      create: ({ inputs }) => ({
        opcode: 'operator_length',
        inputs: {
          STRING: inputs[0]
        }
      })
    },
    contains: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_contains',
        inputs: {
          STRING1: inputs[0],
          STRING2: inputs[1]
        }
      })
    }
  }
} satisfies Record<string, Bindings>;
