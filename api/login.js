import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'frontera-secret-key-129847129';
const usersPath = '/tmp/users.json';

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

    const { email, password, mode } = req.body;
    const emailStr = String(email || '').trim().toLowerCase();

    if (!emailStr || !emailStr.endsWith('@fronteraenergy.ca')) {
        return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
    }

    let users = {};
    try {
        if (fs.existsSync(usersPath)) {
            users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        }
    } catch (e) {
        users = {};
    }

    if (mode === 'register') {
        if (password !== '2026') {
            return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
        }
        // Register user in users list
        users[emailStr] = true;
        try {
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
        } catch (e) {}
    } else {
        // Mode is login: check if email exists in users list
        if (!users[emailStr]) {
            return res.status(401).json({ error: 'No tienes acceso a archivos privados de la organización.' });
        }
    }

    const token = generateToken(emailStr);
    return res.status(200).json({ token });
}
