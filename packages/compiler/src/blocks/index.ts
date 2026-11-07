import motion from './categories/motion.ts';
import looks from './categories/looks.ts';
import sound from './categories/sound.ts';
import events from './categories/events.ts';
import control from './categories/control.ts';
import sensing from './categories/sensing.ts';
import operators from './categories/operators.ts';
import data from './categories/data.ts';
import pen from './extensions/pen.ts';
import music from './extensions/music.ts';
import videoSensing from './extensions/videoSensing.ts';
import text2speech from './extensions/text2speech.ts';
import translate from './extensions/translate.ts';
import microbit from './extensions/microbit.ts';
import makeymakey from './extensions/makeymakey.ts';
import ev3 from './extensions/ev3.ts';
import wedo2 from './extensions/wedo2.ts';
import boost from './extensions/boost.ts';
import gdxfor from './extensions/gdxfor.ts';
import type { Bindings } from '../types.ts';

export const globals: Bindings = {
  ...control.globals,
  ...data.globals,
  math: {
    kind: 'object',
    members: operators.math
  },
  text: {
    kind: 'object',
    members: operators.text
  },
  project: {
    kind: 'object',
    members: {
      ...looks.project,
      ...sound.project,
      ...events.project,
      ...sensing.project
    }
  },
  sprite: {
    kind: 'object',
    members: {
      ...motion.sprite,
      ...looks.sprite,
      ...sound.sprite,
      ...events.sprite,
      ...control.sprite,
      ...sensing.sprite
    }
  }
};

export const extensions: Record<string, Bindings> = {
  pen,
  music,
  videoSensing,
  text2speech,
  translate,
  microbit,
  makeymakey,
  ev3,
  wedo2,
  boost,
  gdxfor
};
