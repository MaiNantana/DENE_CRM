import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');

const conn = await mysql.createConnection({
  host:     process.env.DB_HOST     || 'hr.iexcellence.cloud',
  port:     parseInt(process.env.DB_PORT || '3307'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'masterkey',
  multipleStatements: true,
});

console.log('Running schema...');
await conn.query(sql);
console.log('Database initialized successfully.');
await conn.end();
