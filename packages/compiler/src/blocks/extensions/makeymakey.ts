import type { Bindings } from '../../types.ts';

export default {
  whenMakeyKeyPressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'makeymakey_whenMakeyKeyPressed',
      inputs: {
        KEY: compiler.menu('makeymakey_menu_KEY', 'KEY', fields[0], inputs[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  whenCodePressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'makeymakey_whenCodePressed',
      inputs: {
        SEQUENCE: compiler.menu('makeymakey_menu_SEQUENCE', 'SEQUENCE', fields[0], inputs[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  }
} satisfies Bindings;
