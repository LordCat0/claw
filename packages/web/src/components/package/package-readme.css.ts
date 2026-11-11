import { globalStyle, style } from '@vanilla-extract/css';
import { theme } from '../../styles/theme.css';

export const readme = style({
  fontSize: 15,
  lineHeight: 1.75,
  overflowWrap: 'anywhere'
});

globalStyle(`${readme} > :first-child`, {
  marginTop: 0
});

globalStyle(`${readme} h1, ${readme} h2`, {
  paddingBottom: 12,
  borderBottom: `1px solid ${theme.color.border}`,
  lineHeight: 1.3
});

globalStyle(`${readme} h1`, {
  fontSize: 30
});

globalStyle(`${readme} h2`, {
  marginTop: 32,
  fontSize: 23
});

globalStyle(`${readme} h3, ${readme} h4, ${readme} h5, ${readme} h6`, {
  marginTop: 24,
  lineHeight: 1.4
});

globalStyle(`${readme} a`, {
  color: theme.brand.primary,
  textUnderlineOffset: 3
});

globalStyle(`${readme} img`, {
  maxWidth: '100%',
  height: 'auto'
});

globalStyle(`${readme} pre`, {
  maxWidth: '100%',
  overflowX: 'auto',
  padding: 20,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 4,
  background: theme.color.surface,
  lineHeight: 1.6,
  overflowWrap: 'normal'
});

globalStyle(`${readme} code`, {
  padding: '2px 5px',
  borderRadius: 3,
  background: theme.color.surface,
  fontSize: '0.9em'
});

globalStyle(`${readme} pre code`, {
  padding: 0,
  background: 'transparent'
});

globalStyle(`${readme} blockquote`, {
  marginLeft: 0,
  paddingLeft: 20,
  borderLeft: `3px solid ${theme.brand.primary}`,
  color: theme.color.muted
});

globalStyle(`${readme} table`, {
  display: 'block',
  maxWidth: '100%',
  overflowX: 'auto',
  borderCollapse: 'collapse'
});

globalStyle(`${readme} th, ${readme} td`, {
  padding: '8px 12px',
  border: `1px solid ${theme.color.border}`,
  textAlign: 'left'
});

globalStyle(`${readme} hr`, {
  margin: '24px 0',
  border: 0,
  borderTop: `1px solid ${theme.color.border}`
});
