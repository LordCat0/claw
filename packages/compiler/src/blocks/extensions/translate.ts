import type { Bindings } from '../../types.ts';

export default {
  getTranslate: {
    kind: 'function',
    blockType: 'reporter',
    args: [10, 10],
    create: ({ inputs, fields }, compiler) => {
      const shadow1 = compiler.insertBlock({
        opcode: 'translate_menu_languages',
        fields: {
          languages: fields[1] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'translate_getTranslate',
        inputs: {
          WORDS: inputs[0],
          LANGUAGE: fields[1] ? [1, shadow1] : [3, inputs[1][1], shadow1]
        }
      };
    }
  },
  getViewerLanguage: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'translate_getViewerLanguage'
    })
  },
  language: {
    kind: 'variable',
    get: {
      kind: 'function',
      blockType: 'reporter',
      args: [],
      create: () => ({
        opcode: 'translate_getViewerLanguage'
      })
    }
  }
} satisfies Bindings;
