import type { Bindings } from '../../types.ts';

export default {
  sprite: {
    say: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs }) => ({
        opcode: 'looks_say',
        inputs: {
          MESSAGE: inputs[0]
        }
      })
    },
    sayFor: {
      kind: 'function',
      blockType: 'command',
      args: [10, 4],
      create: ({ inputs }) => ({
        opcode: 'looks_sayforsecs',
        inputs: {
          MESSAGE: inputs[0],
          SECS: inputs[1]
        }
      })
    },
    think: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs }) => ({
        opcode: 'looks_think',
        inputs: {
          MESSAGE: inputs[0]
        }
      })
    },
    thinkFor: {
      kind: 'function',
      blockType: 'command',
      args: [10, 4],
      create: ({ inputs }) => ({
        opcode: 'looks_thinkforsecs',
        inputs: {
          MESSAGE: inputs[0],
          SECS: inputs[1]
        }
      })
    },
    switchCostume: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'looks_costume',
          fields: {
            COSTUME: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'looks_switchcostumeto',
          inputs: {
            COSTUME: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
    },
    nextCostume: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'looks_nextcostume'
      })
    },
    changeSize: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'looks_changesizeby',
        inputs: {
          CHANGE: inputs[0]
        }
      })
    },
    setSize: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'looks_setsizeto',
        inputs: {
          SIZE: inputs[0]
        }
      })
    },
    changeEffect: {
      kind: 'function',
      blockType: 'command',
      args: ['field', 4],
      create: ({ fields, inputs }) => ({
        opcode: 'looks_changeeffectby',
        inputs: {
          CHANGE: inputs[1]
        },
        fields: {
          EFFECT: fields[0]
        }
      })
    },
    setEffect: {
      kind: 'function',
      blockType: 'command',
      args: ['field', 4],
      create: ({ fields, inputs }) => ({
        opcode: 'looks_seteffectto',
        inputs: {
          VALUE: inputs[1]
        },
        fields: {
          EFFECT: fields[0]
        }
      })
    },
    clearEffects: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'looks_cleargraphiceffects'
      })
    },
    show: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'looks_show'
      })
    },
    hide: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'looks_hide'
      })
    },
    goToLayer: {
      kind: 'function',
      blockType: 'command',
      args: ['field'],
      create: ({ fields }) => ({
        opcode: 'looks_gotofrontback',
        fields: {
          FRONT_BACK: fields[0]
        }
      })
    },
    moveLayers: {
      kind: 'function',
      blockType: 'command',
      args: ['field', 6],
      create: ({ fields, inputs }) => ({
        opcode: 'looks_goforwardbackwardlayers',
        inputs: {
          NUM: inputs[1]
        },
        fields: {
          FORWARD_BACKWARD: fields[0]
        }
      })
    },
    costume: {
      kind: 'function',
      blockType: 'reporter',
      args: ['field'],
      create: ({ fields }) => ({
        opcode: 'looks_costumenumbername',
        fields: {
          NUMBER_NAME: fields[0]
        }
      })
    },
    size: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'looks_size'
        })
      },
      set: {
        kind: 'function',
        blockType: 'command',
        args: [4],
        create: ({ inputs }) => ({
          opcode: 'looks_setsizeto',
          inputs: {
            SIZE: inputs[0]
          }
        })
      }
    }
  },
  project: {
    switchBackdrop: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'looks_backdrops',
          fields: {
            BACKDROP: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'looks_switchbackdropto',
          inputs: {
            BACKDROP: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
    },
    switchBackdropAndWait: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'looks_backdrops',
          fields: {
            BACKDROP: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'looks_switchbackdroptoandwait',
          inputs: {
            BACKDROP: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
    },
    nextBackdrop: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'looks_nextbackdrop'
      })
    },
    backdrop: {
      kind: 'function',
      blockType: 'reporter',
      args: ['field'],
      create: ({ fields }) => ({
        opcode: 'looks_backdropnumbername',
        fields: {
          NUMBER_NAME: fields[0]
        }
      })
    }
  }
} satisfies Record<string, Bindings>;
