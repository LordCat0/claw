import type { Bindings } from '../../types.ts';

export default {
  playDrumForBeats: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'music_playDrumForBeats',
      inputs: {
        DRUM: compiler.menu('music_menu_DRUM', 'DRUM', fields[0], inputs[0]),
        BEATS: inputs[1]
      }
    })
  },
  midiPlayDrumForBeats: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'music_midiPlayDrumForBeats',
      inputs: {
        DRUM: compiler.menu('music_menu_DRUM', 'DRUM', fields[0], inputs[0]),
        BEATS: inputs[1]
      }
    })
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
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'music_playNoteForBeats',
      inputs: {
        NOTE: compiler.menu('note', 'NOTE', fields[0], inputs[0]),
        BEATS: inputs[1]
      }
    })
  },
  setInstrument: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'music_setInstrument',
      inputs: {
        INSTRUMENT: compiler.menu('music_menu_INSTRUMENT', 'INSTRUMENT', fields[0], inputs[0])
      }
    })
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
