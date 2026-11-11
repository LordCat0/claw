import { globalStyle, style } from '@vanilla-extract/css';
import { theme } from '../../styles/theme.css';

export const sidebar = style({
  minWidth: 0,
  overflowWrap: 'anywhere',
  '@media': {
    '(max-width: 800px)': {
      gridRow: 1
    }
  }
});

export const install = style({
  paddingBottom: 24
});

export const section = style({
  padding: '20px 0',
  borderBottom: `1px solid ${theme.color.border}`
});

export const label = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  margin: '0 0 12px',
  color: theme.color.muted,
  fontSize: 13,
  fontWeight: 500
});

export const command = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 48,
  paddingLeft: 12,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.surface,
  color: theme.color.muted
});

export const commandText = style({
  flex: 1,
  minWidth: 0,
  padding: '12px 0',
  color: theme.color.text,
  fontSize: 13,
  userSelect: 'all'
});

export const copy = style({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  alignSelf: 'stretch',
  width: 44,
  border: 0,
  background: 'transparent',
  color: theme.color.muted,
  ':hover': {
    color: theme.brand.primary
  }
});

export const copyStatus = style({
  margin: '8px 0 0',
  color: theme.color.muted,
  fontSize: 12
});

export const link = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  color: theme.color.text,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.6,
  textDecoration: 'none',
  ':hover': {
    color: theme.brand.primary,
    textDecoration: 'underline'
  }
});

export const downloads = style({
  display: 'flex',
  alignItems: 'center',
  gap: 16
});

export const total = style({
  flexShrink: 0,
  fontSize: 20,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums'
});

export const chart = style({
  flex: 1,
  minWidth: 0,
  color: theme.brand.primary
});

globalStyle(`${chart} svg`, {
  display: 'block',
  width: '100%',
  height: 44
});

export const period = style({
  margin: '8px 0 0',
  color: theme.color.muted,
  fontSize: 11
});

export const facts = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  margin: 0,
  paddingTop: 20,
  borderBottom: `1px solid ${theme.color.border}`
});

export const value = style({
  margin: 0,
  fontSize: 15,
  fontWeight: 600
});

export const lastPublish = style({
  gridColumn: '1 / -1',
  padding: '20px 0',
  borderTop: `1px solid ${theme.color.border}`
});

export const collaborators = style({
  display: 'grid',
  gap: 12,
  margin: 0,
  padding: 0,
  listStyle: 'none'
});

export const collaborator = style({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14
});

export const avatar = style({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: 32,
  height: 32,
  overflow: 'hidden',
  borderRadius: '50%',
  background: theme.color.surface
});

export const avatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover'
});
