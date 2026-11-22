import type { Bindings, CallArguments } from '../../types.ts';

const partIds: Record<string, string> = {
  'left eye': '0',
  'right eye': '1',
  'nose': '2',
  'mouth': '3',
  'left ear': '4',
  'right ear': '5',
  'between eyes': '6',
  'top of head': '7'
};

function partField (field: CallArguments['fields'][number]) {
  const part = String(field[0]);
  return [Object.hasOwn(partIds, part) ? partIds[part] : part, null];
}

export default {
  goToPart: {
    kind: 'function',
    blockType: 'command',
    args: ['field'],
    create: ({ fields }) => ({
      opcode: 'faceSensing_goToPart',
      fields: {
        PART: partField(fields[0])
      }
    })
  },
  pointInFaceTiltDirection: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'faceSensing_pointInFaceTiltDirection'
    })
  },
  setSizeToFaceSize: {
    kind: 'function',
    blockType: 'command',
    args: [],
    create: () => ({
      opcode: 'faceSensing_setSizeToFaceSize'
    })
  },
  whenTilted: {
    kind: 'function',
    blockType: 'hat',
    args: ['field', 'body'],
    create: ({ fields, bodies }) => ({
      opcode: 'faceSensing_whenTilted',
      fields: {
        DIRECTION: fields[0]
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  whenSpriteTouchesPart: {
    kind: 'function',
    blockType: 'hat',
    args: ['field', 'body'],
    create: ({ fields, bodies }) => ({
      opcode: 'faceSensing_whenSpriteTouchesPart',
      fields: {
        PART: partField(fields[0])
      },
      topLevel: true,
      next: bodies[1]
    })
  },
  whenFaceDetected: {
    kind: 'function',
    blockType: 'hat',
    args: ['body'],
    create: ({ bodies }) => ({
      opcode: 'faceSensing_whenFaceDetected',
      topLevel: true,
      next: bodies[0]
    })
  },
  faceIsDetected: {
    kind: 'function',
    blockType: 'reporter',
    resultType: 'boolean',
    args: [],
    create: () => ({
      opcode: 'faceSensing_faceIsDetected'
    })
  },
  faceTilt: {
    kind: 'function',
    blockType: 'reporter',
    resultType: 'number',
    args: [],
    create: () => ({
      opcode: 'faceSensing_faceTilt'
    })
  },
  faceSize: {
    kind: 'function',
    blockType: 'reporter',
    resultType: 'number',
    args: [],
    create: () => ({
      opcode: 'faceSensing_faceSize'
    })
  }
} satisfies Bindings;
