import { style } from '@vanilla-extract/css';
import { theme } from '../../styles/theme.css';

export const result = style({
  padding: '24px 0',
  borderBottom: `1px solid ${theme.color.border}`,
  overflowWrap: 'anywhere'
});

export const name = style({
  margin: 0,
  fontSize: 20,
  fontWeight: 600
});

export const description = style({
  margin: '10px 0 0',
  color: theme.color.muted,
  fontSize: 15,
  lineHeight: 1.6
});

export const metadata = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px 24px',
  marginTop: 16,
  color: theme.color.muted,
  fontSize: 13
});

export const detail = style({
  display: 'flex',
  alignItems: 'center',
  gap: 6
});

export const version = style({
  fontFamily: 'monospace'
});
