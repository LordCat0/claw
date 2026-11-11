import { assignVars, createGlobalTheme, globalStyle } from '@vanilla-extract/css';

export const lightColors = {
  background: '#FFFFFF',
  surface: '#F4F4F4',
  text: '#161616',
  muted: '#666666',
  border: '#DEDEDE'
};

export const darkColors = {
  background: '#161616',
  surface: '#222222',
  text: '#F5F5F5',
  muted: '#ABABAB',
  border: '#3A3A3A'
};

export const theme = createGlobalTheme(':root', {
  brand: {
    primary: '#DD2E44',
    secondary: '#BE1931',
    tertiary: '#161616'
  },
  color: lightColors
});

globalStyle(':root', {
  colorScheme: 'light',
  '@media': {
    '(prefers-color-scheme: dark)': {
      colorScheme: 'dark',
      vars: assignVars(theme.color, darkColors)
    }
  }
});
