import type { Bindings } from '../../types.ts';

export default {
  globals: {
    print: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs }, compiler) => ({
        opcode: 'data_addtolist',
        fields: {
          LIST: ['console', compiler.consoleList]
        },
        inputs: {
          ITEM: inputs[0]
        }
      })
    }
  },
  project: {
    variables: {
      kind: 'object',
      members: {
        get: {
          kind: 'function',
          blockType: 'reporter',
          args: ['variable'],
          create: ({ fields }) => ({
            opcode: 'data_variable',
            fields: {
              VARIABLE: fields[0]
            }
          })
        },
        set: {
          kind: 'function',
          blockType: 'command',
          args: ['writableVariable', 10],
          create: ({ fields, inputs }) => ({
            opcode: 'data_setvariableto',
            inputs: {
              VALUE: inputs[1]
            },
            fields: {
              VARIABLE: fields[0]
            }
          })
        },
        change: {
          kind: 'function',
          blockType: 'command',
          args: ['writableVariable', 4],
          create: ({ fields, inputs }) => ({
            opcode: 'data_changevariableby',
            inputs: {
              VALUE: inputs[1]
            },
            fields: {
              VARIABLE: fields[0]
            }
          })
        },
        show: {
          kind: 'function',
          blockType: 'command',
          args: ['variable'],
          create: ({ fields }) => ({
            opcode: 'data_showvariable',
            fields: {
              VARIABLE: fields[0]
            }
          })
        },
        hide: {
          kind: 'function',
          blockType: 'command',
          args: ['variable'],
          create: ({ fields }) => ({
            opcode: 'data_hidevariable',
            fields: {
              VARIABLE: fields[0]
            }
          })
        }
      }
    },
    lists: {
      kind: 'object',
      members: {
        contents: {
          kind: 'function',
          blockType: 'reporter',
          args: ['list'],
          create: ({ fields }) => ({
            opcode: 'data_listcontents',
            fields: {
              LIST: fields[0]
            }
          })
        },
        add: {
          kind: 'function',
          blockType: 'command',
          args: ['list', 10],
          create: ({ fields, inputs }) => ({
            opcode: 'data_addtolist',
            inputs: {
              ITEM: inputs[1]
            },
            fields: {
              LIST: fields[0]
            }
          })
        },
        delete: {
          kind: 'function',
          blockType: 'command',
          args: ['list', 7],
          create: ({ fields, inputs }) => ({
            opcode: 'data_deleteoflist',
            inputs: {
              INDEX: inputs[1]
            },
            fields: {
              LIST: fields[0]
            }
          })
        },
        clear: {
          kind: 'function',
          blockType: 'command',
          args: ['list'],
          create: ({ fields }) => ({
            opcode: 'data_deletealloflist',
            fields: {
              LIST: fields[0]
            }
          })
        },
        insert: {
          kind: 'function',
          blockType: 'command',
          args: ['list', 7, 10],
          create: ({ fields, inputs }) => ({
            opcode: 'data_insertatlist',
            inputs: {
              INDEX: inputs[1],
              ITEM: inputs[2]
            },
            fields: {
              LIST: fields[0]
            }
          })
        },
        replace: {
          kind: 'function',
          blockType: 'command',
          args: ['list', 7, 10],
          create: ({ fields, inputs }) => ({
            opcode: 'data_replaceitemoflist',
            inputs: {
              INDEX: inputs[1],
              ITEM: inputs[2]
            },
            fields: {
              LIST: fields[0]
            }
          })
        },
        item: {
          kind: 'function',
          blockType: 'reporter',
          args: ['list', 7],
          create: ({ fields, inputs }) => ({
            opcode: 'data_itemoflist',
            inputs: {
              INDEX: inputs[1]
            },
            fields: {
              LIST: fields[0]
            }
          })
        },
        indexOf: {
          kind: 'function',
          blockType: 'reporter',
          args: ['list', 10],
          create: ({ fields, inputs }) => ({
            opcode: 'data_itemnumoflist',
            inputs: {
              ITEM: inputs[1]
            },
            fields: {
              LIST: fields[0]
            }
          })
        },
        length: {
          kind: 'function',
          blockType: 'reporter',
          args: ['list'],
          create: ({ fields }) => ({
            opcode: 'data_lengthoflist',
            fields: {
              LIST: fields[0]
            }
          })
        },
        contains: {
          kind: 'function',
          blockType: 'reporter',
          args: ['list', 10],
          create: ({ fields, inputs }) => ({
            opcode: 'data_listcontainsitem',
            inputs: {
              ITEM: inputs[1]
            },
            fields: {
              LIST: fields[0]
            }
          })
        },
        show: {
          kind: 'function',
          blockType: 'command',
          args: ['list'],
          create: ({ fields }) => ({
            opcode: 'data_showlist',
            fields: {
              LIST: fields[0]
            }
          })
        },
        hide: {
          kind: 'function',
          blockType: 'command',
          args: ['list'],
          create: ({ fields }) => ({
            opcode: 'data_hidelist',
            fields: {
              LIST: fields[0]
            }
          })
        }
      }
    }
  }
} satisfies Record<string, Bindings>;
