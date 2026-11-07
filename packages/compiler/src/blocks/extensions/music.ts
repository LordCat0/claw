import type { Bindings } from '../../types.ts';

export default {
  playDrumForBeats: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'music_menu_DRUM',
        fields: {
          DRUM: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'music_playDrumForBeats',
        inputs: {
          DRUM: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          BEATS: inputs[1]
        }
      };
    }
  },
  midiPlayDrumForBeats: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'music_menu_DRUM',
        fields: {
          DRUM: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'music_midiPlayDrumForBeats',
        inputs: {
          DRUM: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          BEATS: inputs[1]
        }
      };
    }
  },
  restForBeats: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'music_restForBeats',
      inputs: {
        BEATS: inputs[0]
      }
    })
  },
  playNoteForBeats: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'note',
        fields: {
          NOTE: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'music_playNoteForBeats',
        inputs: {
          NOTE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          BEATS: inputs[1]
        }
      };
    }
  },
  setInstrument: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'music_menu_INSTRUMENT',
        fields: {
          INSTRUMENT: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'music_setInstrument',
        inputs: {
          INSTRUMENT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  midiSetInstrument: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'music_midiSetInstrument',
      inputs: {
        INSTRUMENT: inputs[0]
      }
    })
  },
  setTempo: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'music_setTempo',
      inputs: {
        TEMPO: inputs[0]
      }
    })
  },
  changeTempo: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'music_changeTempo',
      inputs: {
        TEMPO: inputs[0]
      }
    })
  },
  getTempo: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'music_getTempo'
    })
  },
  tempo: {
    kind: 'variable',
    get: {
      kind: 'function',
      blockType: 'reporter',
      args: [],
      create: () => ({
        opcode: 'music_getTempo'
      })
    },
    set: {
      kind: 'function',
      blockType: 'command',
      args: [4],
      create: ({ inputs }) => ({
        opcode: 'music_setTempo',
        inputs: {
          TEMPO: inputs[0]
        }
      })
    }
  }
} satisfies Bindings;
