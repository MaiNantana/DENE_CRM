import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'hr.iexcellence.cloud',
  port:     parseInt(process.env.DB_PORT || '3307'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'masterkey',
  database: process.env.DB_NAME     || 'mtcrm',
  charset:  'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,
  timezone: '+07:00',
});

// ตั้ง charset ทุก connection ให้รองรับ UTF-8 / ภาษาไทย
pool.on('connection', conn => {
  conn.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
});

export default pool;
