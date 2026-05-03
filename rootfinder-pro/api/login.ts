export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (email === 'test@example.com' && password === '123') {
    const token = 'fake-token';
    res.json({ token, user: { id: '1', email } });
  } else {
    res.status(400).json({ error: "Credenciales inválidas" });
  }
}