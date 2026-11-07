import type { Bindings } from '../../types.ts';

export default {
  whenMakeyKeyPressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'makeymakey_menu_KEY',
        fields: {
          KEY: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'makeymakey_whenMakeyKeyPressed',
        inputs: {
          KEY: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  whenCodePressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'makeymakey_menu_SEQUENCE',
        fields: {
          SEQUENCE: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'makeymakey_whenCodePressed',
        inputs: {
          SEQUENCE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  }
} satisfies Bindings;
