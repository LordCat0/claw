import type { Bindings } from '../../types.ts';

export default {
  translate: {
    kind: 'function',
    blockType: 'reporter',
    args: [10, 10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'translate_getTranslate',
      inputs: {
        WORDS: inputs[0],
        LANGUAGE: compiler.menu('translate_menu_languages', 'languages', fields[1], inputs[1])
      }
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
