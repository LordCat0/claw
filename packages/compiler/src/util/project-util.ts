import type {
  ScratchBlock,
  Sprite,
  BlockOptions,
  SpriteOptions
} from '../types.ts';

const EMPTY_COSTUME_ID = '927d672925e7b99f7813735c484c6922';
export const EMPTY_COSTUME_FILE = `${EMPTY_COSTUME_ID}.svg`;

export const newSprite = (options: SpriteOptions): Sprite => ({
  isStage: options.isStage ?? false,
  name: options.name,
  variables: options.variables ?? {},
  lists: options.lists ?? {},
  broadcasts: options.broadcasts ?? {},
  blocks: options.blocks ?? {},
  comments: options.comments ?? {},
  currentCostume: options.currentCostume ?? 0,
  costumes: options.costumes ?? [{
    name: '_empty',
    bitmapResolution: 1,
    dataFormat: 'svg',
    assetId: EMPTY_COSTUME_ID,
    md5ext: EMPTY_COSTUME_FILE,
    rotationCenterX: 30.74937882782359,
    rotationCenterY: 58.864768144346826
  }],
  sounds: options.sounds ?? [],
  volume: options.volume ?? 100,
  layerOrder: options.isStage ? 0 : 1,
  tempo: options.tempo ?? 60,
  videoTransparency: options.videoTransparency ?? 50,
  videoState: options.videoState ?? 'on',
  textToSpeechLanguage: options.textToSpeechLanguage ?? null
});

export const newBlock = (options: BlockOptions): ScratchBlock => ({
  opcode: options.opcode,
  next: options.next ?? null,
  parent: options.parent ?? null,
  inputs: { ...options.inputs },
  fields: options.fields ?? {},
  shadow: options.shadow ?? false,
  topLevel: options.topLevel ?? false,
  mutation: options.mutation,
  x: options.x ?? 0,
  y: options.y ?? 0
});

