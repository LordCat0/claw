import meow from 'meow';
import chalk from 'chalk';
import build from './commands/build.ts';
import ci from './commands/ci.ts';
import init from './commands/init.ts';
import install from './commands/install.ts';
import login from './commands/login.ts';
import logout from './commands/logout.ts';
import publish from './commands/publish.ts';
import uninstall from './commands/uninstall.ts';

const help = `
    Usage
      $ claw build
      $ claw ci
      $ claw init [project|package] [name]
      $ claw install [package[@version] ...]
      $ claw login
      $ claw logout
      $ claw publish
      $ claw uninstall <package> ...
  `;

const cli = meow({
  importMeta: import.meta,
  commands: [
    'build',
    'ci',
    'init',
    'install',
    'login',
    'logout',
    'publish',
    'uninstall'
  ],
  help,
  allowUnknownFlags: false
});

const args = cli.input;

const handleError = (error: Error | string) => {
  const message = error instanceof Error ? error.message : error;

  console.error(chalk.red(`Error: ${chalk.underline(message)}`));
  process.exitCode = 1;
};
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);

switch (cli.command) {
  case 'build':
    await build();
    break;
  case 'ci':
    await ci();
    break;
  case 'init':
    await init(args);
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
    cli.showHelp();
}
