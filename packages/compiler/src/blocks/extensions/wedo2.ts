import type { Bindings } from '../../types.ts';

export default {
  motorOnFor: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_motorOnFor',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          DURATION: inputs[1]
        }
      };
    }
  },
  motorOn: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_motorOn',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  motorOff: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_motorOff',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  startMotorPower: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_startMotorPower',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          POWER: inputs[1]
        }
      };
    }
  },
  setMotorDirection: {
    kind: 'function',
    blockType: 'command',
    args: [10, 10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });
      const shadow1 = compiler.insertBlock({
        opcode: 'wedo2_menu_MOTOR_DIRECTION',
        fields: {
          MOTOR_DIRECTION: fields[1] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_setMotorDirection',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          MOTOR_DIRECTION: fields[1] ? [1, shadow1] : [3, inputs[1][1], shadow1]
        }
      };
    }
  },
  setLightHue: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'wedo2_setLightHue',
      inputs: {
        HUE: inputs[0]
      }
    })
  },
  playNoteFor: {
    kind: 'function',
    blockType: 'command',
    args: [4, 4],
    create: ({ inputs }) => ({
      opcode: 'wedo2_playNoteFor',
      inputs: {
        NOTE: inputs[0],
        DURATION: inputs[1]
      }
    })
  },
  whenDistance: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 4, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_OP',
        fields: {
          OP: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_whenDistance',
        inputs: {
          OP: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          REFERENCE: inputs[1]
        },
        topLevel: true,
        next: bodies[2]
      };
    }
  },
  whenTilted: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_TILT_DIRECTION_ANY',
        fields: {
          TILT_DIRECTION_ANY: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_whenTilted',
        inputs: {
          TILT_DIRECTION_ANY: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  getDistance: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'wedo2_getDistance'
    })
  },
  isTilted: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'wedo2_menu_TILT_DIRECTION_ANY',
        fields: {
          TILT_DIRECTION_ANY: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_isTilted',
        inputs: {
          TILT_DIRECTION_ANY: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
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
        opcode: 'wedo2_menu_TILT_DIRECTION',
        fields: {
          TILT_DIRECTION: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'wedo2_getTiltAngle',
        inputs: {
          TILT_DIRECTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  }
} satisfies Bindings;
