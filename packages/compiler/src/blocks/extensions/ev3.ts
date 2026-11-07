import type { Bindings } from '../../types.ts';

export default {
  motorTurnClockwise: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'ev3_menu_motorPorts',
        fields: {
          motorPorts: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'ev3_motorTurnClockwise',
        inputs: {
          PORT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          TIME: inputs[1]
        }
      };
    }
  },
  motorTurnCounterClockwise: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'ev3_menu_motorPorts',
        fields: {
          motorPorts: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'ev3_motorTurnCounterClockwise',
        inputs: {
          PORT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          TIME: inputs[1]
        }
      };
    }
  },
  motorSetPower: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'ev3_menu_motorPorts',
        fields: {
          motorPorts: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'ev3_motorSetPower',
        inputs: {
          PORT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          POWER: inputs[1]
        }
      };
    }
  },
  getMotorPosition: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'ev3_menu_motorPorts',
        fields: {
          motorPorts: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'ev3_getMotorPosition',
        inputs: {
          PORT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  whenButtonPressed: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'ev3_menu_sensorPorts',
        fields: {
          sensorPorts: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'ev3_whenButtonPressed',
        inputs: {
          PORT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
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
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'ev3_menu_sensorPorts',
        fields: {
          sensorPorts: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'ev3_buttonPressed',
        inputs: {
          PORT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
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
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'note',
        fields: {
          NOTE: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'ev3_beep',
        inputs: {
          NOTE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          TIME: inputs[1]
        }
      };
    }
  }
} satisfies Bindings;
