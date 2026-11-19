import type { Bindings } from '../../types.ts';

export default {
  whenButtonPressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'microbit_whenButtonPressed',
      inputs: {
        BTN: compiler.menu('microbit_menu_buttons', 'buttons', fields[0], inputs[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  isButtonPressed: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'microbit_isButtonPressed',
      inputs: {
        BTN: compiler.menu('microbit_menu_buttons', 'buttons', fields[0], inputs[0])
      }
    })
  },
  whenGesture: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'microbit_whenGesture',
      inputs: {
        GESTURE: compiler.menu('microbit_menu_gestures', 'gestures', fields[0], inputs[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  displaySymbol: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'microbit_displaySymbol',
      inputs: {
        MATRIX: compiler.menu('matrix', 'MATRIX', fields[0], inputs[0])
      }
    })
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
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'microbit_whenTilted',
      inputs: {
        DIRECTION: compiler.menu(
          'microbit_menu_tiltDirectionAny', 'tiltDirectionAny', fields[0], inputs[0]
        )
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  isTilted: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'microbit_isTilted',
      inputs: {
        DIRECTION: compiler.menu(
          'microbit_menu_tiltDirectionAny', 'tiltDirectionAny', fields[0], inputs[0]
        )
      }
    })
  },
  getTiltAngle: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'microbit_getTiltAngle',
      inputs: {
        DIRECTION: compiler.menu(
          'microbit_menu_tiltDirection', 'tiltDirection', fields[0], inputs[0]
        )
      }
    })
  },
  whenPinConnected: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'microbit_whenPinConnected',
      inputs: {
        PIN: compiler.menu('microbit_menu_touchPins', 'touchPins', fields[0], inputs[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  }
} satisfies Bindings;
