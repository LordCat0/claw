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
    turnRight: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'motion_turnright',
        inputs: {
          DEGREES: inputs[0]
        }
      })
    },
    turnLeft: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'motion_turnleft',
        inputs: {
          DEGREES: inputs[0]
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
    pointInDirection: {
      kind: 'function',
      blockType: 'command',
      args: [8],
      create: ({ inputs }) => ({
        opcode: 'motion_pointindirection',
        inputs: {
          DIRECTION: inputs[0]
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
    changeX: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'motion_changexby',
        inputs: {
          DX: inputs[0]
        }
      })
    },
    setX: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'motion_setx',
        inputs: {
          X: inputs[0]
        }
      })
    },
    changeY: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'motion_changeyby',
        inputs: {
          DY: inputs[0]
        }
      })
    },
    setY: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'motion_sety',
        inputs: {
          Y: inputs[0]
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
    },
    xPosition: {
      kind: 'function',
      blockType: 'reporter',
      args: [],
      create: () => ({
        opcode: 'motion_xposition'
      })
    },
    yPosition: {
      kind: 'function',
      blockType: 'reporter',
      args: [],
      create: () => ({
        opcode: 'motion_yposition'
      })
    }
  }
} satisfies Record<string, Bindings>;
