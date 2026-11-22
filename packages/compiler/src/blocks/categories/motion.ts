import type { Bindings } from '../../types.ts';

export default {
  sprite: {
    move: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'motion_movesteps',
        inputs: {
          STEPS: inputs[0]
        }
      })
    },
    goTo: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'motion_goto',
        inputs: {
          TO: compiler.menu('motion_goto_menu', 'TO', fields[0], inputs[0])
        }
      })
    },
    goToXY: {
      kind: 'function',
      blockType: 'command',
      args: [4, 4],
      create: ({ inputs }) => ({
        opcode: 'motion_gotoxy',
        inputs: {
          X: inputs[0],
          Y: inputs[1]
        }
      })
    },
    glideTo: {
      kind: 'function',
      blockType: 'command',
      args: [4, 10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'motion_glideto',
        inputs: {
          SECS: inputs[0],
          TO: compiler.menu('motion_glideto_menu', 'TO', fields[1], inputs[1])
        }
      })
    },
    glideToXY: {
      kind: 'function',
      blockType: 'command',
      args: [4, 4, 4],
      create: ({ inputs }) => ({
        opcode: 'motion_glidesecstoxy',
        inputs: {
          SECS: inputs[0],
          X: inputs[1],
          Y: inputs[2]
        }
      })
    },
    pointTowards: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'motion_pointtowards',
        inputs: {
          TOWARDS: compiler.menu(
            'motion_pointtowards_menu',
            'TOWARDS',
            fields[0],
            inputs[0]
          )
        }
      })
    },
    bounceOnEdge: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'motion_ifonedgebounce'
      })
    },
    setRotationStyle: {
      kind: 'function',
      blockType: 'command',
      args: ['field'],
      create: ({ fields }) => ({
        opcode: 'motion_setrotationstyle',
        fields: {
          STYLE: fields[0]
        }
      })
    },
    x: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        resultType: 'number',
        args: [],
        create: () => ({
          opcode: 'motion_xposition'
        })
      },
      set: {
        kind: 'function',
        blockType: 'command',
        args: [4],
        create: ({ inputs }) => ({
          opcode: 'motion_setx',
          inputs: {
            X: inputs[0]
          }
        })
      }
    },
    y: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        resultType: 'number',
        args: [],
        create: () => ({
          opcode: 'motion_yposition'
        })
      },
      set: {
        kind: 'function',
        blockType: 'command',
        args: [4],
        create: ({ inputs }) => ({
          opcode: 'motion_sety',
          inputs: {
            Y: inputs[0]
          }
        })
      }
    },
    direction: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        resultType: 'number',
        args: [],
        create: () => ({
          opcode: 'motion_direction'
        })
      },
      set: {
        kind: 'function',
        blockType: 'command',
        args: [4],
        create: ({ inputs }) => ({
          opcode: 'motion_pointindirection',
          inputs: {
            DIRECTION: inputs[0]
          }
        })
      }
    }
  }
} satisfies Record<string, Bindings>;
