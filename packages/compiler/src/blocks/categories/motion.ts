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
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'motion_goto_menu',
          fields: {
            TO: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'motion_goto',
          inputs: {
            TO: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
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
      create: ({ inputs, fields }, compiler) => {
        const shadow1 = compiler.insertBlock({
          opcode: 'motion_glideto_menu',
          fields: {
            TO: fields[1] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'motion_glideto',
          inputs: {
            SECS: inputs[0],
            TO: fields[1] ? [1, shadow1] : [3, inputs[1][1], shadow1]
          }
        };
      }
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
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'motion_pointtowards_menu',
          fields: {
            TOWARDS: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'motion_pointtowards',
          inputs: {
            TOWARDS: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
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
