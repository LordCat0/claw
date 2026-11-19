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
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'looks_switchcostumeto',
        inputs: {
          COSTUME: compiler.menu('looks_costume', 'COSTUME', fields[0], inputs[0])
        }
      })
    },
    nextCostume: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'looks_nextcostume'
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
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'looks_switchbackdropto',
        inputs: {
          BACKDROP: compiler.menu('looks_backdrops', 'BACKDROP', fields[0], inputs[0])
        }
      })
    },
    switchBackdropAndWait: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => ({
        opcode: 'looks_switchbackdroptoandwait',
        inputs: {
          BACKDROP: compiler.menu('looks_backdrops', 'BACKDROP', fields[0], inputs[0])
        }
      })
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
