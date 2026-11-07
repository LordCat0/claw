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
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'text2speech_menu_voices',
        fields: {
          voices: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'text2speech_setVoice',
        inputs: {
          VOICE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  setLanguage: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'text2speech_menu_languages',
        fields: {
          languages: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'text2speech_setLanguage',
        inputs: {
          LANGUAGE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  }
} satisfies Bindings;
