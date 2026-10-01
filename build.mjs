// Copies src/ to dist/, adds the Supabase browser bundle and writes config.js
// from environment variables (Vercel project settings, or a local .env file).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

// Load .env for local builds; real environment variables win.
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(src, dist, { recursive: true });

const require = createRequire(import.meta.url);
const supabaseUmd = join(dirname(require.resolve('@supabase/supabase-js/package.json')), 'dist', 'umd', 'supabase.js');
cpSync(supabaseUmd, join(dist, 'vendor', 'supabase.js'));

writeFileSync(
  join(dist, 'config.js'),
  'window.APP_CONFIG = ' + JSON.stringify({ supabaseUrl: url, supabaseAnonKey: anonKey }) + ';\n'
);

console.log(
  url && anonKey
    ? 'Built dist/ with Supabase at ' + url
    : 'Built dist/ WITHOUT Supabase keys: the app will show a setup notice.'
);
