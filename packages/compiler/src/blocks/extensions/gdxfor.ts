import type { Bindings } from '../../types.ts';

export default {
  whenGesture: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'gdxfor_whenGesture',
      inputs: {
        GESTURE: compiler.menu(
          'gdxfor_menu_gestureOptions',
          'gestureOptions',
          fields[0],
          inputs[0]
        )
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  whenForcePushedOrPulled: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'gdxfor_whenForcePushedOrPulled',
      inputs: {
        PUSH_PULL: compiler.menu(
          'gdxfor_menu_pushPullOptions',
          'pushPullOptions',
          fields[0],
          inputs[0]
        )
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  getForce: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'gdxfor_getForce'
    })
  },
  whenTilted: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => ({
      opcode: 'gdxfor_whenTilted',
      inputs: {
        TILT: compiler.menu(
          'gdxfor_menu_tiltAnyOptions',
          'tiltAnyOptions',
          fields[0],
          inputs[0]
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
      opcode: 'gdxfor_isTilted',
      inputs: {
        TILT: compiler.menu(
          'gdxfor_menu_tiltAnyOptions',
          'tiltAnyOptions',
          fields[0],
          inputs[0]
        )
      }
    })
  },
  getTilt: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'gdxfor_getTilt',
      inputs: {
        TILT: compiler.menu('gdxfor_menu_tiltOptions', 'tiltOptions', fields[0], inputs[0])
      }
    })
  },
  isFreeFalling: {
    kind: 'function',
    blockType: 'reporter',
    args: [],
    create: () => ({
      opcode: 'gdxfor_isFreeFalling'
    })
  },
  getSpinSpeed: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'gdxfor_getSpinSpeed',
      inputs: {
        DIRECTION: compiler.menu(
          'gdxfor_menu_axisOptions',
          'axisOptions',
          fields[0],
          inputs[0]
        )
      }
    })
  },
  getAcceleration: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'gdxfor_getAcceleration',
      inputs: {
        DIRECTION: compiler.menu(
          'gdxfor_menu_axisOptions',
          'axisOptions',
          fields[0],
          inputs[0]
        )
      }
    })
  }
} satisfies Bindings;
