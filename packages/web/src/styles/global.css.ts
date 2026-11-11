import { globalStyle } from '@vanilla-extract/css';
import { theme } from './theme.css';

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box'
});

globalStyle('html', {
  scrollbarGutter: 'stable'
});

globalStyle('body', {
  margin: 0,
  minWidth: 320,
  background: theme.color.background,
  color: theme.color.text,
  fontFamily: 'Arial, Helvetica, sans-serif'
});

globalStyle('button, input', {
  font: 'inherit'
});

globalStyle('button', {
  cursor: 'pointer'
});

globalStyle('a:focus-visible, button:focus-visible, input:focus-visible', {
  outline: `2px solid ${theme.brand.primary}`,
  outlineOffset: 4
});
