import type { Bindings } from '../../types.ts';

export default {
  globals: {
    stopAll: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'control_stop',
        fields: {
          STOP_OPTION: ['all', null]
        },
        mutation: {
          tagName: 'mutation',
          children: [],
          hasnext: false
        }
      })
    }
  },
  project: {
    wait: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'control_wait',
        inputs: {
          DURATION: inputs[0]
        }
      })
    },
    repeat: {
      kind: 'function',
      blockType: 'command',
      args: [6, 'body'],
      create: ({ inputs, bodies }) => ({
        opcode: 'control_repeat',
        inputs: {
          TIMES: inputs[0],
          SUBSTACK: [2, bodies[1]]
        }
      })
    },
    forever: {
      kind: 'function',
      blockType: 'command',
      args: ['body'],
      create: ({ bodies }) => ({
        opcode: 'control_forever',
        inputs: {
          SUBSTACK: [2, bodies[0]]
        }
      })
    },
    if: {
      kind: 'function',
      blockType: 'command',
      args: [10, 'body'],
      create: ({ inputs, bodies }) => ({
        opcode: 'control_if',
        inputs: {
          CONDITION: inputs[0],
          SUBSTACK: [2, bodies[1]]
        }
      })
    },
    ifElse: {
      kind: 'function',
      blockType: 'command',
      args: [10, 'body', 'body'],
      create: ({ inputs, bodies }) => ({
        opcode: 'control_if_else',
        inputs: {
          CONDITION: inputs[0],
          SUBSTACK: [2, bodies[1]],
          SUBSTACK2: [2, bodies[2]]
        }
      })
    },
    waitUntil: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs }) => ({
        opcode: 'control_wait_until',
        inputs: {
          CONDITION: inputs[0]
        }
      })
    },
    repeatUntil: {
      kind: 'function',
      blockType: 'command',
      args: [10, 'body'],
      create: ({ inputs, bodies }) => ({
        opcode: 'control_repeat_until',
        inputs: {
          CONDITION: inputs[0],
          SUBSTACK: [2, bodies[1]]
        }
      })
    },
    while: {
      kind: 'function',
      blockType: 'command',
      args: [10, 'body'],
      create: ({ inputs, bodies }) => ({
        opcode: 'control_while',
        inputs: {
          CONDITION: inputs[0],
          SUBSTACK: [2, bodies[1]]
        }
      })
    },
    forEach: {
      kind: 'function',
      blockType: 'command',
      args: ['writableVariable', 6, 'body'],
      create: ({ fields, inputs, bodies }) => ({
        opcode: 'control_for_each',
        inputs: {
          VALUE: inputs[1],
          SUBSTACK: [2, bodies[2]]
        },
        fields: {
          VARIABLE: fields[0]
        }
      })
    },
    allAtOnce: {
      kind: 'function',
      blockType: 'command',
      args: ['body'],
      create: ({ bodies }) => ({
        opcode: 'control_all_at_once',
        inputs: {
          SUBSTACK: [2, bodies[0]]
        }
      })
    },
    counter: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'control_get_counter'
        })
      }
    },
    incrementCounter: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'control_incr_counter'
      })
    },
    clearCounter: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'control_clear_counter'
      })
    },
    stop: {
      kind: 'function',
      blockType: 'command',
      args: ['field'],
      create: ({ fields }) => ({
        opcode: 'control_stop',
        fields: {
          STOP_OPTION: fields[0]
        },
        mutation: {
          tagName: 'mutation',
          children: [],
          hasnext: fields[0][0] === 'other scripts in sprite'
        }
      })
    }
  },
  sprite: {
    whenCloned: {
      kind: 'function',
      blockType: 'hat',
      args: ['body'],
      create: ({ bodies }) => ({
        opcode: 'control_start_as_clone',
        topLevel: true,
        next: bodies[0]
      })
    },
    createClone: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'control_create_clone_of_menu',
          fields: {
            CLONE_OPTION: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'control_create_clone_of',
          inputs: {
            CLONE_OPTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
    },
    deleteClone: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'control_delete_this_clone'
      })
    }
  }
} satisfies Record<string, Bindings>;
