import type { Bindings } from '../../types.ts';

export default {
  sprite: {
    playSoundUntilDone: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'sound_sounds_menu',
          fields: {
            SOUND_MENU: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'sound_playuntildone',
          inputs: {
            SOUND_MENU: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
    },
    startSound: {
      kind: 'function',
      blockType: 'command',
      args: [10],
      create: ({ inputs, fields }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'sound_sounds_menu',
          fields: {
            SOUND_MENU: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'sound_play',
          inputs: {
            SOUND_MENU: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          }
        };
      }
    },
    changeSoundEffect: {
      kind: 'function',
      blockType: 'command',
      args: ['field', 4],
      create: ({ fields, inputs }) => ({
        opcode: 'sound_changeeffectby',
        inputs: {
          VALUE: inputs[1]
        },
        fields: {
          EFFECT: fields[0]
        }
      })
    },
    setSoundEffect: {
      kind: 'function',
      blockType: 'command',
      args: ['field', 4],
      create: ({ fields, inputs }) => ({
        opcode: 'sound_seteffectto',
        inputs: {
          VALUE: inputs[1]
        },
        fields: {
          EFFECT: fields[0]
        }
      })
    },
    clearSoundEffects: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'sound_cleareffects'
      })
    },
    changeVolume: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'sound_changevolumeby',
        inputs: {
          VOLUME: inputs[0]
        }
      })
    },
    setVolume: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'sound_setvolumeto',
        inputs: {
          VOLUME: inputs[0]
        }
      })
    },
    volume: {
      kind: 'variable',
      get: {
        kind: 'function',
        blockType: 'reporter',
        args: [],
        create: () => ({
          opcode: 'sound_volume'
        })
      },
      set: {
        kind: 'function',
        blockType: 'command',
        args: [4],
        create: ({ inputs }) => ({
          opcode: 'sound_setvolumeto',
          inputs: {
            VOLUME: inputs[0]
          }
        })
      }
    }
  },
  project: {
    stopSounds: {
      kind: 'function',
      blockType: 'command',
      args: [],
      create: () => ({
        opcode: 'sound_stopallsounds'
      })
    }
  }
} satisfies Record<string, Bindings>;
