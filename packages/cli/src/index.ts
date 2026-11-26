import meow from 'meow';
import chalk from 'chalk';
import build from './commands/build.ts';
import ci from './commands/ci.ts';
import install from './commands/install.ts';
import login from './commands/login.ts';
import logout from './commands/logout.ts';
import publish from './commands/publish.ts';
import uninstall from './commands/uninstall.ts';

// meow
const cli = meow({
  importMeta: import.meta,
  help: `
    Usage
      $ claw build
      $ claw ci
      $ claw install [package[@version] ...]
      $ claw login
      $ claw logout
      $ claw publish
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
  const message = error instanceof Error ? error.message : error;

  console.error(chalk.red(`Error: ${chalk.underline(message)}`));
  process.exitCode = 1;
};
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);

const [command, ...args] = cli.input;
switch (command) {
  case 'build':
    await build();
    break;
  case 'ci':
    await ci();
    break;
  case 'install':
    await install(args);
    break;
  case 'login':
    await login();
    break;
  case 'logout':
    await logout();
    break;
  case 'publish':
    await publish();
    break;
  case 'uninstall':
    await uninstall(args);
    break;
  default:
    if (command) {
      throw new Error(
        `Unknown command '${command}'. Run claw --help for usage.`
      );
    }

    cli.showHelp();
}
