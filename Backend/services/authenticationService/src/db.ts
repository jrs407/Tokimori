import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'tokimori_user',
  password: process.env.MYSQL_PASSWORD || 'tokimori_password',
  database: process.env.MYSQL_DATABASE || 'tokimori',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
