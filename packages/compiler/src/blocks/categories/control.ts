import type { Bindings } from '../../types.ts';

export default {
  globals: {
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
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'control_create_clone_of',
        inputs: {
          CLONE_OPTION: compiler.menu(
            'control_create_clone_of_menu', 'CLONE_OPTION', fields[0], inputs[0]
          )
        }
      })
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
