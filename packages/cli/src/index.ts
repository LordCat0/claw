import meow from 'meow';
import build from './commands/build.ts';

// meow
const cli = meow({
  importMeta: import.meta,
  help: `
    Usage
      $ claw build

    Compile main.claw into main.sb3 in the current directory.
  `,
  allowUnknownFlags: false,
  flags: {
    help: { type: 'boolean' }
  }
});

if (cli.flags.help) {
  cli.showHelp(0);
}

if (cli.input[0] !== 'build' || cli.input.length !== 1) {
  cli.showHelp();
}

try {
  await build();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
