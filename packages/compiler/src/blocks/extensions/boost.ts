import type { Bindings } from '../../types.ts';

export default {
  motorOnFor: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_motorOnFor',
      inputs: {
        MOTOR_ID: compiler.menu('boost_menu_MOTOR_ID', 'MOTOR_ID', fields[0], inputs[0]),
        DURATION: inputs[1]
      }
    })
  },
  motorOnForRotation: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_motorOnForRotation',
      inputs: {
        MOTOR_ID: compiler.menu('boost_menu_MOTOR_ID', 'MOTOR_ID', fields[0], inputs[0]),
        ROTATION: inputs[1]
      }
    })
  },
  motorOn: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_motorOn',
      inputs: {
        MOTOR_ID: compiler.menu('boost_menu_MOTOR_ID', 'MOTOR_ID', fields[0], inputs[0])
      }
    })
  },
  motorOff: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_motorOff',
      inputs: {
        MOTOR_ID: compiler.menu('boost_menu_MOTOR_ID', 'MOTOR_ID', fields[0], inputs[0])
      }
    })
  },
  setMotorPower: {
    kind: 'function',
    blockType: 'command',
    args: [10, 4],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_setMotorPower',
      inputs: {
        MOTOR_ID: compiler.menu('boost_menu_MOTOR_ID', 'MOTOR_ID', fields[0], inputs[0]),
        POWER: inputs[1]
      }
    })
  },
  setMotorDirection: {
    kind: 'function',
    blockType: 'command',
    args: [10, 10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_setMotorDirection',
      inputs: {
        MOTOR_ID: compiler.menu('boost_menu_MOTOR_ID', 'MOTOR_ID', fields[0], inputs[0]),
        MOTOR_DIRECTION: compiler.menu(
          'boost_menu_MOTOR_DIRECTION',
          'MOTOR_DIRECTION',
          fields[1],
          inputs[1]
        )
      }
    })
  },
  getMotorPosition: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_getMotorPosition',
      inputs: {
        MOTOR_REPORTER_ID: compiler.menu(
          'boost_menu_MOTOR_REPORTER_ID',
          'MOTOR_REPORTER_ID',
          fields[0],
          inputs[0]
        )
      }
    })
  },
  whenColor: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'boost_whenColor',
      inputs: {
        COLOR: compiler.menu('boost_menu_COLOR', 'COLOR', fields[0], inputs[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  seeingColor: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_seeingColor',
      inputs: {
        COLOR: compiler.menu('boost_menu_COLOR', 'COLOR', fields[0], inputs[0])
      }
    })
  },
  whenTilted: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'boost_whenTilted',
      inputs: {
        TILT_DIRECTION_ANY: compiler.menu(
          'boost_menu_TILT_DIRECTION_ANY',
          'TILT_DIRECTION_ANY',
          fields[0],
          inputs[0]
        )
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  getTiltAngle: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'boost_getTiltAngle',
      inputs: {
        TILT_DIRECTION: compiler.menu(
          'boost_menu_TILT_DIRECTION',
          'TILT_DIRECTION',
          fields[0],
          inputs[0]
        )
      }
    })
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
