import app from './app.ts';
import gracefulShutdown from 'http-graceful-shutdown';
import database from './services/database.ts';
import s3 from './services/s3.ts';
import { env } from './config.ts';

try {
  await database.initializeDatabase();
} catch (error) {
  console.error('Could not initialize PostgreSQL', error);
  await database.close();
  s3.close();
  process.exit(1);
}

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`CDN listening on port ${env.PORT}`);
});

gracefulShutdown(server, {
  onShutdown: async () => {
    try {
      await database.close();
    } catch (error) {
      console.error('Could not close PostgreSQL connections', error);
      throw error;
    } finally {
      s3.close();
    }
  }
});
