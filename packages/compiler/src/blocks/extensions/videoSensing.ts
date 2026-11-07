import type { Bindings } from '../../types.ts';

export default {
  whenMotionGreaterThan: {
    kind: 'function',
    blockType: 'hat',
    args: [4, 'body'],
    create: ({ inputs, bodies }) => ({
      opcode: 'videoSensing_whenMotionGreaterThan',
      inputs: {
        REFERENCE: inputs[0]
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  videoOn: {
    kind: 'function',
    blockType: 'reporter',
    args: [10, 10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'videoSensing_menu_ATTRIBUTE',
        fields: {
          ATTRIBUTE: fields[0] || ['', null]
        },
        shadow: true
      });
      const shadow1 = compiler.insertBlock({
        opcode: 'videoSensing_menu_SUBJECT',
        fields: {
          SUBJECT: fields[1] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'videoSensing_videoOn',
        inputs: {
          ATTRIBUTE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0],
          SUBJECT: fields[1] ? [1, shadow1] : [3, inputs[1][1], shadow1]
        }
      };
    }
  },
  videoToggle: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => {
      const shadow0 = compiler.insertBlock({
        opcode: 'videoSensing_menu_VIDEO_STATE',
        fields: {
          VIDEO_STATE: fields[0] || ['', null]
        },
        shadow: true
      });

      return {
        opcode: 'videoSensing_videoToggle',
        inputs: {
          VIDEO_STATE: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
        }
      };
    }
  },
  setVideoTransparency: {
    kind: 'function',
    blockType: 'command',
    args: [4],
    create: ({ inputs }) => ({
      opcode: 'videoSensing_setVideoTransparency',
      inputs: {
        TRANSPARENCY: inputs[0]
      }
    })
  }
} satisfies Bindings;
