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
    }
  },
  project: {
    stop: {
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
    },
    createClone: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'control_create_clone_of',
        inputs: {
          CLONE_OPTION: compiler.menu(
            'control_create_clone_of_menu',
            'CLONE_OPTION',
            fields[0], inputs[0]
          )
        }
      })
    }
  },
  thread: {
    stop: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'control_stop',
        fields: {
          STOP_OPTION: ['this script', null]
        },
        mutation: {
          tagName: 'mutation',
          children: [],
          hasnext: false
        }
      })
    }
  },
  sprite: {
    stopOtherThreads: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'control_stop',
        fields: {
          STOP_OPTION: ['other scripts in sprite', null]
        },
        mutation: {
          tagName: 'mutation',
          children: [],
          hasnext: true
        }
      })
    },
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
      args: [],
      create: (_, compiler) => ({
        opcode: 'control_create_clone_of',
        inputs: {
          CLONE_OPTION: compiler.menu(
            'control_create_clone_of_menu',
            'CLONE_OPTION',
            ['_myself_', null],
            null
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
