import type { Bindings } from '../../types.ts';

export default {
  whenButtonPressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'microbit_menu_buttons',
        fields: {
          buttons: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_whenButtonPressed',
        inputs: {
          BTN: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  isButtonPressed: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'microbit_menu_buttons',
        fields: {
          buttons: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_isButtonPressed',
        inputs: {
          BTN: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  whenGesture: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'microbit_menu_gestures',
        fields: {
          gestures: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_whenGesture',
        inputs: {
          GESTURE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  displaySymbol: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'matrix',
        fields: {
          MATRIX: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_displaySymbol',
        inputs: {
          MATRIX: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  displayText: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs }) => ({
      opcode: 'microbit_displayText',
      inputs: {
        TEXT: inputs[0]
      }
    })
  },
  displayClear: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'microbit_displayClear'
    })
  },
  whenTilted: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'microbit_menu_tiltDirectionAny',
        fields: {
          tiltDirectionAny: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_whenTilted',
        inputs: {
          DIRECTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  isTilted: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'microbit_menu_tiltDirectionAny',
        fields: {
          tiltDirectionAny: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_isTilted',
        inputs: {
          DIRECTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  getTiltAngle: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'microbit_menu_tiltDirection',
        fields: {
          tiltDirection: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_getTiltAngle',
        inputs: {
          DIRECTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  whenPinConnected: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'microbit_menu_touchPins',
        fields: {
          touchPins: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'microbit_whenPinConnected',
        inputs: {
          PIN: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  }
} satisfies Bindings;
