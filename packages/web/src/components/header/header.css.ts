import { style } from '@vanilla-extract/css';
import { theme } from '../../styles/theme.css';

export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: 32,
  padding: '20px 40px',
  borderTop: `4px solid ${theme.brand.primary}`,
  borderBottom: `1px solid ${theme.color.border}`,
  '@media': {
    '(max-width: 640px)': {
      flexWrap: 'wrap',
      gap: 16,
      padding: '16px 20px'
    }
  }
});

export const homeLink = style({
  display: 'block',
  flexShrink: 0,
  width: 44
});

export const search = style({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  gap: 12,
  minWidth: 0,
  padding: '0 16px',
  background: theme.color.surface,
  color: theme.color.muted,
  ':focus-within': {
    outline: `2px solid ${theme.brand.primary}`,
    outlineOffset: 0
  },
  '@media': {
    '(max-width: 640px)': {
      order: 1,
      flexBasis: '100%'
    }
  }
});

export const searchInput = style({
  width: '100%',
  minWidth: 0,
  height: 44,
  border: 0,
  background: 'transparent',
  color: theme.color.text,
  ':focus': {
    outline: 'none'
  },
  '::placeholder': {
    color: theme.color.muted
  }
});

export const account = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 12,
  minWidth: 176,
  marginLeft: 'auto'
});

export const signIn = style({
  minHeight: 44,
  padding: '0 16px',
  border: 0,
  background: 'transparent',
  color: theme.color.text,
  whiteSpace: 'nowrap',
  ':hover': {
    textDecoration: 'underline'
  }
});

export const signUp = style({
  minHeight: 44,
  padding: '0 20px',
  border: 0,
  background: theme.brand.primary,
  color: '#FFFFFF',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  ':hover': {
    background: theme.brand.secondary
  }
});
