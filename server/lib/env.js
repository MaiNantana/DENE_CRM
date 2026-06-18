import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const cwdDir = process.cwd();
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(moduleDir, '..');
const projectDir = path.resolve(moduleDir, '../..');
const searchDirs = [...new Set([
  cwdDir,
  path.dirname(cwdDir),
  projectDir,
  serverDir,
])];

for (const dir of searchDirs) {
  const envPath = path.join(dir, '.env');
  const envLocalPath = path.join(dir, '.env.local');

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
  }
}
