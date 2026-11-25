import meow from 'meow';
import build from './commands/build.ts';
import install from './commands/install.ts';
import uninstall from './commands/uninstall.ts';

// meow
const cli = meow({
  importMeta: import.meta,
  help: `
    Usage
      $ claw build
      $ claw install <package[@version]> ...
      $ claw uninstall <package> ...
  `,
  allowUnknownFlags: false,
  flags: {
    help: { type: 'boolean' }
  }
});

if (cli.flags.help) {
  cli.showHelp(0);
}

const handleError = (error: Error | string) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);

const [command, ...args] = cli.input;
switch (command) {
  case 'build':
    await build();
    break;
  case 'install':
    await install(args);
    break;
  case 'uninstall':
    await uninstall(args);
    break;
  default:
    cli.showHelp();
}