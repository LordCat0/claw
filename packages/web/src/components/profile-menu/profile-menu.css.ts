import { style } from '@vanilla-extract/css';
import { theme } from '../../styles/theme.css';

export const trigger = style({
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr) 16px',
  alignItems: 'center',
  gap: 10,
  width: 176,
  minHeight: 44,
  padding: '5px 10px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.surface,
  color: theme.color.text,
  fontSize: 14,
  textAlign: 'left',
  selectors: {
    '&:hover, &[data-popup-open]': {
      borderColor: theme.brand.primary
    }
  }
});

export const avatar = style({
  display: 'grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: '50%',
  overflow: 'hidden'
});

export const avatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover'
});

export const name = style({
  display: 'block',
  maxWidth: 140,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 600
});

export const positioner = style({
  zIndex: 100
});

export const content = style({
  width: 220,
  maxWidth: 'calc(100vw - 32px)',
  padding: 4,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.background,
  color: theme.color.text,
  boxShadow: '0 8px 24px rgb(0 0 0 / 16%)',
  fontSize: 13
});

export const identity = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px'
});

export const email = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  color: theme.color.muted
});

export const separator = style({
  height: 1,
  margin: '4px 0',
  background: theme.color.border
});

export const item = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 32,
  padding: '0 8px',
  borderRadius: 2,
  cursor: 'pointer',
  outline: 'none',
  userSelect: 'none',
  selectors: {
    '&[data-highlighted]': {
      background: theme.color.surface,
      boxShadow: `inset 3px 0 ${theme.brand.primary}`
    }
  }
});
