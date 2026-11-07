import type { Bindings } from '../../types.ts';

export default {
  project: {
    add: {
      kind: 'function',
      blockType: 'reporter',
      args: [4, 4],
      create: ({ inputs }) => ({
        opcode: 'operator_add',
        inputs: {
          NUM1: inputs[0],
          NUM2: inputs[1]
        }
      })
    },
    subtract: {
      kind: 'function',
      blockType: 'reporter',
      args: [4, 4],
      create: ({ inputs }) => ({
        opcode: 'operator_subtract',
        inputs: {
          NUM1: inputs[0],
          NUM2: inputs[1]
        }
      })
    },
    multiply: {
      kind: 'function',
      blockType: 'reporter',
      args: [4, 4],
      create: ({ inputs }) => ({
        opcode: 'operator_multiply',
        inputs: {
          NUM1: inputs[0],
          NUM2: inputs[1]
        }
      })
    },
    divide: {
      kind: 'function',
      blockType: 'reporter',
      args: [4, 4],
      create: ({ inputs }) => ({
        opcode: 'operator_divide',
        inputs: {
          NUM1: inputs[0],
          NUM2: inputs[1]
        }
      })
    },
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
    greaterThan: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_gt',
        inputs: {
          OPERAND1: inputs[0],
          OPERAND2: inputs[1]
        }
      })
    },
    lessThan: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_lt',
        inputs: {
          OPERAND1: inputs[0],
          OPERAND2: inputs[1]
        }
      })
    },
    equals: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_equals',
        inputs: {
          OPERAND1: inputs[0],
          OPERAND2: inputs[1]
        }
      })
    },
    and: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_and',
        inputs: {
          OPERAND1: inputs[0],
          OPERAND2: inputs[1]
        }
      })
    },
    or: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_or',
        inputs: {
          OPERAND1: inputs[0],
          OPERAND2: inputs[1]
        }
      })
    },
    not: {
      kind: 'function',
      blockType: 'reporter',
      args: [10],
      create: ({ inputs }) => ({
        opcode: 'operator_not',
        inputs: {
          OPERAND: inputs[0]
        }
      })
    },
    join: {
      kind: 'function',
      blockType: 'reporter',
      args: [10, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_join',
        inputs: {
          STRING1: inputs[0],
          STRING2: inputs[1]
        }
      })
    },
    letterOf: {
      kind: 'function',
      blockType: 'reporter',
      args: [6, 10],
      create: ({ inputs }) => ({
        opcode: 'operator_letter_of',
        inputs: {
          LETTER: inputs[0],
          STRING: inputs[1]
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
    },
    mod: {
      kind: 'function',
      blockType: 'reporter',
      args: [4, 4],
      create: ({ inputs }) => ({
        opcode: 'operator_mod',
        inputs: {
          NUM1: inputs[0],
          NUM2: inputs[1]
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
    math: {
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
  }
} satisfies Record<string, Bindings>;
