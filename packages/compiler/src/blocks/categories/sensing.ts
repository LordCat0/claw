import type { Bindings } from '../../types.ts';

export default {
  sprite: {
    touching: {
      kind: 'function',
      blockType: 'reporter',
      args: [10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'sensing_touchingobject',
        inputs: {
          TOUCHINGOBJECTMENU: compiler.menu(
            'sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', fields[0], inputs[0]
          )
        }
      })
    },
    touchingColor: {
      kind: 'function',
      blockType: 'reporter',
      args: [9],
      create: ({ inputs }) => ({
        opcode: 'sensing_touchingcolor',
        inputs: {
          COLOR: inputs[0]
        }
      })
    },
    colorTouchingColor: {
      kind: 'function',
      blockType: 'reporter',
      args: [9, 9],
      create: ({ inputs }) => ({
        opcode: 'sensing_coloristouchingcolor',
        inputs: {
          COLOR: inputs[0],
          COLOR2: inputs[1]
        }
      })
    },
    distanceTo: {
      kind: 'function',
      blockType: 'reporter',
      args: [10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'sensing_distanceto',
        inputs: {
          DISTANCETOMENU: compiler.menu(
            'sensing_distancetomenu', 'DISTANCETOMENU', fields[0], inputs[0]
          )
        }
      })
    },
    setDragMode: {
      kind: 'function',
      blockType: 'command',
      args: ['field'],
      create: ({ fields }) => ({
        opcode: 'sensing_setdragmode',
        fields: {
          DRAG_MODE: fields[0]
        }
      })
    }
  },
  project: {
    ask: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs }) => ({
        opcode: 'sensing_askandwait',
        inputs: {
          QUESTION: inputs[0]
        }
      })
    },
    answer: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'sensing_answer'
        })
      }
    },
    keyIsDown: {
      kind: 'function',
      blockType: 'reporter',
      args: [10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'sensing_keypressed',
        inputs: {
          KEY_OPTION: compiler.menu('sensing_keyoptions', 'KEY_OPTION', fields[0], inputs[0])
        }
      })
    },
    mouse: {
      kind: 'object',
      members: {
        isDown: {
          kind: 'function',
          blockType: 'reporter',
          args: [],
          create: () => ({
            opcode: 'sensing_mousedown'
          })
        },
        x: {
          kind: 'variable',
          get: {
            kind: 'function',
            blockType: 'reporter',
            args: [],
            create: () => ({
              opcode: 'sensing_mousex'
            })
          }
        },
        y: {
          kind: 'variable',
          get: {
            kind: 'function',
            blockType: 'reporter',
            args: [],
            create: () => ({
              opcode: 'sensing_mousey'
            })
          }
        }
      }
    },
    loudness: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'sensing_loudness'
        })
      }
    },
    isLoud: {
      kind: 'function',
      blockType: 'reporter',
      args: [],
      create: () => ({
        opcode: 'sensing_loud'
      })
    },
    timer: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'sensing_timer'
        })
      }
    },
    resetTimer: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'sensing_resettimer'
      })
    },
    attributeOf: {
      kind: 'function',
      blockType: 'reporter',
      args: ['field', 10],
      create: ({ fields, inputs }, compiler) => ({
        opcode: 'sensing_of',
        inputs: {
          OBJECT: compiler.menu('sensing_of_object_menu', 'OBJECT', fields[1], inputs[1])
        },
        fields: {
          PROPERTY: fields[0]
        }
      })
    },
    current: {
      kind: 'function',
      blockType: 'reporter',
      args: ['field'],
      create: ({ fields }) => ({
        opcode: 'sensing_current',
        fields: {
          CURRENTMENU: fields[0]
        }
      })
    },
    daysSince2000: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'sensing_dayssince2000'
        })
      }
    },
    username: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'sensing_username'
        })
      }
    }
  }
} satisfies Record<string, Bindings>;
