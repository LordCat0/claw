import { style } from '@vanilla-extract/css';

export const page = style({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh'
});

export const main = style({
  display: 'grid',
  flex: 1,
  placeItems: 'center',
  padding: 40
});

export const logo = style({
  width: 'clamp(120px, 20vw, 200px)'
});
