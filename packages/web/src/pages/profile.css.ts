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
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 24,
  paddingBottom: 28,
  borderBottom: `1px solid ${theme.color.border}`,
  overflowWrap: 'anywhere'
});

export const avatar = style({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: 96,
  height: 96,
  overflow: 'hidden',
  borderRadius: '50%',
  background: theme.color.surface,
  color: theme.color.muted,
  fontSize: 32
});

export const avatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover'
});

export const name = style({
  margin: 0,
  fontSize: 28,
  fontWeight: 600
});

export const username = style({
  margin: '8px 0 0',
  color: theme.color.muted,
  fontSize: 15
});

export const heading = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: '28px 0 0',
  fontSize: 20,
  fontWeight: 600
});

export const message = style({
  color: theme.color.muted,
  fontSize: 14,
  lineHeight: 1.6
});

export const results = style({
  margin: 0,
  padding: 0,
  listStyle: 'none'
});

export const pagination = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
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
