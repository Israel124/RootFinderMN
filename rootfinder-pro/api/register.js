import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const __filename = path.resolve('api/register.js');
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";
const USERS_FILE = path.join(__dirname, '..', 'users.json');

async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  const safeEmail = sanitizeText(email, 100);
  const safePassword = sanitizeText(password, 100);

  if (!safeEmail || !safePassword) {
    return res.status(400).json({ error: "Email y contraseña requeridos" });
  }

  try {
    const users = await loadUsers();
    const existingUser = users.find(u => u.email === safeEmail);
    if (existingUser) {
      return res.status(400).json({ error: "Usuario ya existe" });
    }

    const hashedPassword = await bcrypt.hash(safePassword, 10);
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const newUser = {
      id: Date.now().toString(),
      email: safeEmail,
      password: hashedPassword,
      verified: true, // Para simplificar, marcar como verificado
      verificationCode,
      expiresAt,
      createdAt: Date.now()
    };

    users.push(newUser);
    await saveUsers(users);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET);
    res.status(201).json({ token, user: { id: newUser.id, email: newUser.email } });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
}