import { cpSync } from 'node:fs';

cpSync('src/assets', 'dist/src/assets', { recursive: true });
cpSync('src/internal', 'dist/src/internal', { recursive: true });
