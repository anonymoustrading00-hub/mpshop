import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

async function createAdmin() {
  if (!databaseUrl) return;

  const connection = await mysql.createConnection(databaseUrl);
  
  const username = "admin_root";
  const passwordHash = "$2b$10$9Sg2Com1gCSFtFhWjxkBbuLzPA9ar0ucdiPLycgbOogdudS60Uwlu"; // 'admin'
  const name = "Administrador Principal";
  const role = "admin";
  const email = "root@mpshop.com";

  console.log(`Checking if user ${username} exists...`);
  const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);

  if ((rows as any[]).length === 0) {
    console.log(`Creating user ${username}...`);
    await connection.query(
      'INSERT INTO users (username, passwordHash, name, role, email, loginMethod, openId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [username, passwordHash, name, role, email, 'traditional', 'admin_root']
    );
    console.log("Admin user created.");
  } else {
    console.log("Admin user already exists.");
  }

  await connection.end();
}

createAdmin().catch(console.error);
