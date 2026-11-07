import type { Bindings } from '../../types.ts';

export default {
  whenGesture: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'gdxfor_menu_gestureOptions',
        fields: {
          gestureOptions: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'gdxfor_whenGesture',
        inputs: {
          GESTURE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
  },
  whenForcePushedOrPulled: {
    kind: 'function',
    blockType: 'hat',
    args: [10, 'body'],
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'gdxfor_menu_pushPullOptions',
        fields: {
          pushPullOptions: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'gdxfor_whenForcePushedOrPulled',
        inputs: {
          PUSH_PULL: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        },
        topLevel: true,
        next: bodies[1]
      };
    }
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
    create: ({ inputs, fields, bodies }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'gdxfor_menu_tiltAnyOptions',
        fields: {
          tiltAnyOptions: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'gdxfor_whenTilted',
        inputs: {
          TILT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
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
        opcode: 'gdxfor_menu_tiltAnyOptions',
        fields: {
          tiltAnyOptions: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'gdxfor_isTilted',
        inputs: {
          TILT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  getTilt: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'gdxfor_menu_tiltOptions',
        fields: {
          tiltOptions: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'gdxfor_getTilt',
        inputs: {
          TILT: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
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
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'gdxfor_menu_axisOptions',
        fields: {
          axisOptions: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'gdxfor_getSpinSpeed',
        inputs: {
          DIRECTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  getAcceleration: {
    kind: 'function',
    blockType: 'reporter',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'gdxfor_menu_axisOptions',
        fields: {
          axisOptions: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'gdxfor_getAcceleration',
        inputs: {
          DIRECTION: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  }
} satisfies Bindings;
