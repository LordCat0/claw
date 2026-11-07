import type { Bindings } from '../../types.ts';

export default {
  project: {
    whenFlagClicked: {
      kind: 'function',
      blockType: 'hat',
      args: ['body'],
      create: ({ bodies }, compiler) => ({
        opcode: 'event_whenbroadcastreceived',
        fields: {
          BROADCAST_OPTION: [compiler.stage.broadcasts[compiler.readyBroadcast], compiler.readyBroadcast]
        },
        topLevel: true,
        next: bodies[0]
      })
    },
    whenKeyPressed: {
      kind: 'function',
      blockType: 'hat',
      args: ['field', 'body'],
      create: ({ fields, bodies }) => ({
        opcode: 'event_whenkeypressed',
        fields: {
          KEY_OPTION: fields[0]
        },
        topLevel: true,
        next: bodies[1]
      })
    },
    whenBackdropSwitches: {
      kind: 'function',
      blockType: 'hat',
      args: ['field', 'body'],
      create: ({ fields, bodies }) => ({
        opcode: 'event_whenbackdropswitchesto',
        fields: {
          BACKDROP: fields[0]
        },
        topLevel: true,
        next: bodies[1]
      })
    },
    whenGreaterThan: {
      kind: 'function',
      blockType: 'hat',
      args: ['field', 4, 'body'],
      create: ({ fields, inputs, bodies }) => ({
        opcode: 'event_whengreaterthan',
        inputs: {
          VALUE: inputs[1]
        },
        fields: {
          WHENGREATERTHANMENU: fields[0]
        },
        topLevel: true,
        next: bodies[2]
      })
    },
    whenBroadcastReceived: {
      kind: 'function',
      blockType: 'hat',
      args: ['broadcast', 'body'],
      create: ({ fields, bodies }) => ({
        opcode: 'event_whenbroadcastreceived',
        fields: {
          BROADCAST_OPTION: fields[0]
        },
        topLevel: true,
        next: bodies[1]
      })
    },
    broadcast: {
      kind: 'function',
      blockType: 'command',
      args: ['broadcast'],
      create: ({ inputs }) => ({
        opcode: 'event_broadcast',
        inputs: {
          BROADCAST_INPUT: inputs[0]
        }
      })
    },
    broadcastAndWait: {
      kind: 'function',
      blockType: 'command',
      args: ['broadcast'],
      create: ({ inputs }) => ({
        opcode: 'event_broadcastandwait',
        inputs: {
          BROADCAST_INPUT: inputs[0]
        }
      })
    }
  },
  sprite: {
    whenClicked: {
      kind: 'function',
      blockType: 'hat',
      args: ['body'],
      create: ({ bodies }) => ({
        opcode: 'event_whenthisspriteclicked',
        topLevel: true,
        next: bodies[0]
      })
    },
    whenTouching: {
      kind: 'function',
      blockType: 'hat',
      args: [10, 'body'],
      create: ({ inputs, fields, bodies }, compiler) => {
        const shadow0 = compiler.insertBlock({
          opcode: 'sensing_touchingobjectmenu',
          fields: {
            TOUCHINGOBJECTMENU: fields[0] || ['', null]
          },
          shadow: true
        });

        return {
          opcode: 'event_whentouchingobject',
          inputs: {
            TOUCHINGOBJECTMENU: fields[0] ? [1, shadow0] : [3, inputs[0][1], shadow0]
          },
          topLevel: true,
          next: bodies[1]
        };
      }
    }
  }
} satisfies Record<string, Bindings>;
