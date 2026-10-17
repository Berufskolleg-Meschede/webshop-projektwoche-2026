import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3001);
const distDir = resolve(process.env.STATIC_DIR ?? 'dist');

// In production the same process also serves the built SPA; in dev Vite does and proxies /simulation here.
const staticDir = existsSync(distDir) ? distDir : undefined;

const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

createServer(createApp({ staticDir, corsOrigins })).listen(port, () => {
  console.log(
    `Simulation server on :${port}${staticDir ? ` (serving ${staticDir})` : ' (API only)'}${corsOrigins.length ? `, CORS: ${corsOrigins.join(', ')}` : ''}`
  );
});
