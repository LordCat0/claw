import type { Bindings } from '../../types.ts';

export default {
  speakAndWait: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs }) => ({
      opcode: 'text2speech_speakAndWait',
      inputs: {
        WORDS: inputs[0]
      }
    })
  },
  setVoice: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'text2speech_setVoice',
      inputs: {
        VOICE: compiler.menu('text2speech_menu_voices', 'voices', fields[0], inputs[0])
      }
    })
  },
  setLanguage: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'text2speech_setLanguage',
      inputs: {
        LANGUAGE: compiler.menu(
          'text2speech_menu_languages',
          'languages',
          fields[0],
          inputs[0]
        )
      }
    })
  }
} satisfies Bindings;
