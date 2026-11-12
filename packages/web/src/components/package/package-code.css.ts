import { style } from '@vanilla-extract/css';
import { theme } from '../../styles/theme.css';

export const browser = style({
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  overflow: 'hidden'
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: 6,
  borderBottom: `1px solid ${theme.color.border}`,
  background: theme.color.surface
});

export const back = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  gap: 6,
  minHeight: 32,
  padding: '4px 8px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.background,
  color: theme.color.text,
  fontSize: 13,
  ':hover': {
    borderColor: theme.brand.primary
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'default'
  }
});

export const path = style({
  minWidth: 0,
  margin: 0,
  fontFamily: 'monospace',
  fontSize: 13,
  fontWeight: 600,
  overflowWrap: 'anywhere'
});

export const list = style({
  margin: 0,
  padding: 0,
  listStyle: 'none'
});

export const entry = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  minHeight: 16,
  padding: '10px 16px',
  border: 0,
  background: theme.color.background,
  color: theme.color.muted,
  textAlign: 'left',
  fontSize: 13,
  selectors: {
    'li + li > &': {
      borderTop: `1px solid ${theme.color.border}`
    }
  },
  ':hover': {
    background: theme.color.surface
  },
  ':focus-visible': {
    outlineOffset: -3
  }
});

export const folder = style({
  color: theme.brand.primary
});

export const name = style({
  flex: 1,
  minWidth: 0,
  color: theme.color.text,
  overflowWrap: 'anywhere'
});

export const empty = style({
  margin: 0,
  padding: 20,
  color: theme.color.muted,
  fontSize: 14
});

export const source = style({
  display: 'flex',
  maxHeight: '70vh',
  overflow: 'auto',
  fontFamily: 'monospace',
  fontSize: 13,
  lineHeight: 1.7,
  tabSize: 2,
  overflowWrap: 'normal',
  ':focus-visible': {
    outline: `2px solid ${theme.brand.primary}`,
    outlineOffset: -2
  }
});

export const lineNumbers = style({
  flexShrink: 0,
  margin: 0,
  padding: '16px 12px',
  borderRight: `1px solid ${theme.color.border}`,
  color: theme.color.muted,
  font: 'inherit',
  textAlign: 'right',
  userSelect: 'none'
});

export const code = style({
  margin: 0,
  padding: 16,
  font: 'inherit'
});
