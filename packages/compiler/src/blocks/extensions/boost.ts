import type { Bindings } from '../../types.ts';

export default {
  motorOnFor: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'boost_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_motorOnFor',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          DURATION: inputs[1]
        }
      };
    }
  },
  motorOnForRotation: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'boost_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_motorOnForRotation',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          ROTATION: inputs[1]
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
        opcode: 'boost_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_motorOn',
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
        opcode: 'boost_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_motorOff',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  setMotorPower: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'boost_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_setMotorPower',
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
        opcode: 'boost_menu_MOTOR_ID',
        fields: {
          MOTOR_ID: fields[0] || ['', null]
        },
        shadow: true
      });
      const shadow1 = compiler.insertBlock({
        opcode: 'boost_menu_MOTOR_DIRECTION',
        fields: {
          MOTOR_DIRECTION: fields[1] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_setMotorDirection',
        inputs: {
          MOTOR_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          MOTOR_DIRECTION: fields[1] ? [1, shadow1] : [3, inputs[1][1], shadow1]
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
        opcode: 'boost_menu_MOTOR_REPORTER_ID',
        fields: {
          MOTOR_REPORTER_ID: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_getMotorPosition',
        inputs: {
          MOTOR_REPORTER_ID: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  whenColor: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'boost_menu_COLOR',
        fields: {
          COLOR: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_whenColor',
        inputs: {
          COLOR: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  seeingColor: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'boost_menu_COLOR',
        fields: {
          COLOR: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_seeingColor',
        inputs: {
          COLOR: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  whenTilted: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'boost_menu_TILT_DIRECTION_ANY',
        fields: {
          TILT_DIRECTION_ANY: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_whenTilted',
        inputs: {
          TILT_DIRECTION_ANY: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  getTiltAngle: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'boost_menu_TILT_DIRECTION',
        fields: {
          TILT_DIRECTION: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'boost_getTiltAngle',
        inputs: {
          TILT_DIRECTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  setLightHue: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'boost_setLightHue',
      inputs: {
        HUE: inputs[0]
      }
    })
  }
} satisfies Bindings;
