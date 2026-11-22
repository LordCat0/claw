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
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'videoSensing_videoOn',
      inputs: {
        ATTRIBUTE: compiler.menu(
          'videoSensing_menu_ATTRIBUTE',
          'ATTRIBUTE',
          fields[0],
          inputs[0]
        ),
        SUBJECT: compiler.menu('videoSensing_menu_SUBJECT', 'SUBJECT', fields[1], inputs[1])
      }
    })
  },
  videoToggle: {
    kind: 'function',
    blockType: 'command',
    args: [10],
    create: ({ inputs, fields }, compiler) => ({
      opcode: 'videoSensing_videoToggle',
      inputs: {
        VIDEO_STATE: compiler.menu(
          'videoSensing_menu_VIDEO_STATE',
          'VIDEO_STATE',
          fields[0],
          inputs[0]
        )
      }
    })
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
