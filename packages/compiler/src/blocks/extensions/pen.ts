import type { Bindings } from '../../types.ts';

export default {
  clear: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'pen_clear'
    })
  },
  stamp: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'pen_stamp'
    })
  },
  penDown: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'pen_penDown'
    })
  },
  penUp: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'pen_penUp'
    })
  },
  setPenColorToColor: {
    kind: 'function',
    blockType: 'command',
    args: [9],
    create: ({ inputs }) => ({
      opcode: 'pen_setPenColorToColor',
      inputs: {
        COLOR: inputs[0]
      }
    })
  },
  changePenColorParamBy: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'pen_menu_colorParam',
        fields: {
          colorParam: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'pen_changePenColorParamBy',
        inputs: {
          COLOR_PARAM: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          VALUE: inputs[1]
        }
      };
    }
  },
  setPenColorParamTo: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'pen_menu_colorParam',
        fields: {
          colorParam: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'pen_setPenColorParamTo',
        inputs: {
          COLOR_PARAM: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          VALUE: inputs[1]
        }
      };
    }
  },
  changePenSizeBy: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'pen_changePenSizeBy',
      inputs: {
        SIZE: inputs[0]
      }
    })
  },
  setPenSizeTo: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'pen_setPenSizeTo',
      inputs: {
        SIZE: inputs[0]
      }
    })
  },
  setPenShadeToNumber: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'pen_setPenShadeToNumber',
      inputs: {
        SHADE: inputs[0]
      }
    })
  },
  changePenShadeBy: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'pen_changePenShadeBy',
      inputs: {
        SHADE: inputs[0]
      }
    })
  },
  setPenHueToNumber: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'pen_setPenHueToNumber',
      inputs: {
        HUE: inputs[0]
      }
    })
  },
  changePenHueBy: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'pen_changePenHueBy',
      inputs: {
        HUE: inputs[0]
      }
    })
  },
  down: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'pen_penDown'
    })
  },
  up: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'pen_penUp'
    })
  }
} satisfies Bindings;
