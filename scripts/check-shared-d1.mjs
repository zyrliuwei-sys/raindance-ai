import { existsSync, readFileSync } from 'node:fs';

const envPath = '.env.development';
if (existsSync(envPath)) {
  const env = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index),
          line.slice(index + 1).replace(/^['"]|['"]$/g, ''),
        ];
      })
  );

  if (env.DATABASE_PROVIDER === 'd1' && env.D1_REMOTE_HTTP === 'true') {
    const config = JSON.parse(readFileSync('wrangler.production.json', 'utf8'));
    const localId = process.env.D1_DATABASE_ID || env.D1_DATABASE_ID;
    const deployedId = config.d1_databases?.find(
      (db) => db.binding === 'DB'
    )?.database_id;
    if (!localId || !deployedId || localId !== deployedId) {
      console.error(
        'Local D1 target differs from the Worker D1 binding. Update D1_DATABASE_ID in .env.development before starting the app.'
      );
      process.exit(1);
    }
  }
}
