import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'frontera-secret-key-129847129';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'Frontera2026!';

function generateToken(email) {
    const payload = JSON.stringify({ email, exp: Date.now() + 24 * 60 * 60 * 1000 });
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    return Buffer.from(payload).toString('base64') + '.' + signature;
}

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    const emailStr = String(email).trim().toLowerCase();
    if (!emailStr.endsWith('@fronteraener.ca')) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    if (password !== LOGIN_PASSWORD) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    const token = generateToken(emailStr);
    return res.status(200).json({ token });
}
