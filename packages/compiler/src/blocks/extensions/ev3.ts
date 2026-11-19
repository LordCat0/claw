import type { Bindings } from '../../types.ts';

export default {
  motorTurnClockwise: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'ev3_motorTurnClockwise',
      inputs: {
        PORT: compiler.menu('ev3_menu_motorPorts', 'motorPorts', fields[0], inputs[0]),
        TIME: inputs[1]
      }
    })
  },
  motorTurnCounterClockwise: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'ev3_motorTurnCounterClockwise',
      inputs: {
        PORT: compiler.menu('ev3_menu_motorPorts', 'motorPorts', fields[0], inputs[0]),
        TIME: inputs[1]
      }
    })
  },
  motorSetPower: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'ev3_motorSetPower',
      inputs: {
        PORT: compiler.menu('ev3_menu_motorPorts', 'motorPorts', fields[0], inputs[0]),
        POWER: inputs[1]
      }
    })
  },
  getMotorPosition: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'ev3_getMotorPosition',
      inputs: {
        PORT: compiler.menu('ev3_menu_motorPorts', 'motorPorts', fields[0], inputs[0])
      }
    })
  },
  whenButtonPressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'ev3_whenButtonPressed',
      inputs: {
        PORT: compiler.menu('ev3_menu_sensorPorts', 'sensorPorts', fields[0], inputs[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  whenDistanceLessThan: {
    kind: 'function',
    blockType: 'hat',
    args: [4, 'body'],
    create: ({ inputs, bodies }) => ({
      opcode: 'ev3_whenDistanceLessThan',
      inputs: {
        DISTANCE: inputs[0]
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  whenBrightnessLessThan: {
    kind: 'function',
    blockType: 'hat',
    args: [4, 'body'],
    create: ({ inputs, bodies }) => ({
      opcode: 'ev3_whenBrightnessLessThan',
      inputs: {
        DISTANCE: inputs[0]
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  buttonPressed: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'ev3_buttonPressed',
      inputs: {
        PORT: compiler.menu('ev3_menu_sensorPorts', 'sensorPorts', fields[0], inputs[0])
      }
    })
  },
  getDistance: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'ev3_getDistance'
    })
  },
  getBrightness: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'ev3_getBrightness'
    })
  },
  beep: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'ev3_beep',
      inputs: {
        NOTE: compiler.menu('note', 'NOTE', fields[0], inputs[0]),
        TIME: inputs[1]
      }
    })
  }
} satisfies Bindings;
