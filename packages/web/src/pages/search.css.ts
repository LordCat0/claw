import { style } from '@vanilla-extract/css';
import { theme } from '../styles/theme.css';

export const main = style({
  maxWidth: 1280,
  margin: '0 auto',
  padding: '32px 40px',
  '@media': {
    '(max-width: 640px)': {
      padding: '24px 20px'
    }
  }
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 20,
  paddingBottom: 24,
  borderBottom: `1px solid ${theme.color.border}`
});

export const heading = style({
  margin: 0,
  fontSize: 20,
  fontWeight: 600
});

export const query = style({
  margin: '8px 0 0',
  color: theme.color.muted,
  fontSize: 14,
  overflowWrap: 'anywhere'
});

export const sort = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  color: theme.color.muted,
  fontSize: 14
});

export const select = style({
  maxWidth: '100%',
  minHeight: 40,
  padding: '0 12px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.surface,
  color: theme.color.text,
  font: 'inherit',
  cursor: 'pointer',
  ':focus-visible': {
    outline: `2px solid ${theme.brand.primary}`,
    outlineOffset: 4
  }
});

export const results = style({
  margin: 0,
  padding: 0,
  listStyle: 'none'
});

export const message = style({
  color: theme.color.muted,
  lineHeight: 1.6
});

export const pagination = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  paddingTop: 32,
  color: theme.color.muted,
  fontSize: 14
});

export const button = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 16px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.surface,
  color: theme.color.text,
  textDecoration: 'none',
  ':hover': {
    borderColor: theme.brand.primary,
    color: theme.brand.primary
  }
});
