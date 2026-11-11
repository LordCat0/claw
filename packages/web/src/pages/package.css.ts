import { style } from '@vanilla-extract/css';
import { theme } from '../styles/theme.css';

export const main = style({
  maxWidth: 1280,
  margin: '0 auto',
  padding: '36px 40px 64px',
  '@media': {
    '(max-width: 640px)': {
      padding: '24px 20px 40px'
    }
  }
});

export const summary = style({
  paddingBottom: 28,
  overflowWrap: 'anywhere'
});

export const heading = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  margin: 0,
  fontSize: 28,
  fontWeight: 600
});

export const packageIcon = style({
  flexShrink: 0,
  color: theme.brand.primary
});

export const metadata = style({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px 16px',
  marginTop: 14,
  color: theme.color.muted,
  fontSize: 13
});

export const monospace = style({
  fontFamily: 'monospace'
});

export const visibility = style({
  padding: '3px 8px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  color: theme.color.text,
  textTransform: 'capitalize'
});

export const description = style({
  margin: '16px 0 0',
  color: theme.color.muted,
  fontSize: 15,
  lineHeight: 1.6
});

export const tabs = style({
  display: 'flex',
  overflowX: 'auto',
  borderBottom: `1px solid ${theme.color.border}`
});

export const tab = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  gap: 6,
  minHeight: 44,
  padding: '8px 16px',
  border: 0,
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: theme.color.muted,
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  ':hover': {
    background: theme.color.surface,
    color: theme.color.text
  },
  ':focus-visible': {
    outlineOffset: -4
  },
  selectors: {
    '&[data-active]': {
      borderBottomColor: theme.brand.primary,
      background: theme.color.surface,
      color: theme.brand.primary
    }
  }
});

export const layout = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  alignItems: 'start',
  gap: 56,
  paddingTop: 32,
  '@media': {
    '(max-width: 1000px)': {
      gridTemplateColumns: 'minmax(0, 1fr) 280px',
      gap: 32
    },
    '(max-width: 800px)': {
      gridTemplateColumns: 'minmax(0, 1fr)'
    }
  }
});

export const content = style({
  minWidth: 0,
  overflowWrap: 'anywhere'
});

export const subheading = style({
  margin: '0 0 20px',
  fontSize: 20,
  fontWeight: 600
});

export const message = style({
  color: theme.color.muted,
  fontSize: 14,
  lineHeight: 1.6
});

export const link = style({
  color: theme.brand.primary,
  fontWeight: 600,
  textDecoration: 'none',
  ':hover': {
    textDecoration: 'underline'
  }
});

export const keywords = style({
  marginTop: 40,
  paddingTop: 24,
  borderTop: `1px solid ${theme.color.border}`
});

export const keywordList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
});

export const keyword = style({
  padding: '6px 10px',
  borderRadius: 4,
  background: theme.color.surface,
  color: theme.color.text,
  fontSize: 13,
  textDecoration: 'none',
  ':hover': {
    color: theme.brand.primary
  }
});

export const list = style({
  margin: 0,
  padding: 0,
  listStyle: 'none'
});

export const row = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  padding: '18px 0',
  borderBottom: `1px solid ${theme.color.border}`,
  fontSize: 15
});

export const release = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12
});

export const badge = style({
  padding: '3px 7px',
  borderRadius: 4,
  background: theme.color.surface,
  color: theme.brand.primary,
  fontSize: 12
});

export const dependent = style({
  display: 'grid',
  gap: 8,
  padding: '20px 0',
  borderBottom: `1px solid ${theme.color.border}`
});

export const pagination = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 16,
  marginTop: 24,
  fontSize: 14
});

export const button = style({
  minHeight: 40,
  padding: '0 16px',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.surface,
  color: theme.color.text,
  ':hover': {
    borderColor: theme.brand.primary
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'default'
  }
});

