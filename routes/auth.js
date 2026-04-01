const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        req.user = decoded;
        next();
    });
};

// Register
router.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, phone, role, specialty, license, clinic, clinicAddr } = req.body;
    
    if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const name = `${firstName} ${lastName}`;

        db.run(`INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)`,
            [email, hashedPassword, name, role, phone],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }
                
                const userId = this.lastID;

                // If doctor, store profile info
                if (role === 'doctor') {
                    db.run(`INSERT INTO doctors_profile (user_id, specialty, license_number, clinic_name, clinic_address) 
                            VALUES (?, ?, ?, ?, ?)`,
                        [userId, specialty, license, clinic, clinicAddr],
                        (errDoc) => {
                            if (errDoc) {
                                console.error('Error inserting doctor profile', errDoc);
                            }
                        }
                    );
                }

                const token = jwt.sign({ id: userId, email, role, name }, JWT_SECRET, { expiresIn: '24h' });
                res.status(201).json({ message: 'User created', token, user: { id: userId, email, role, name } });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
router.post('/login', (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.get(`SELECT * FROM users WHERE email = ? AND role = ?`, [email, role], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    });
});

// Google Auth (Mock fallback if dummy client id is used)
router.post('/google', async (req, res) => {
    const { token, role } = req.body;
    res.status(200).json({ message: "Google Auth requires valid Client ID to be fully operational. Replace dummy ID in .env.", status: "mocked" });
});

router.get('/me', verifyToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
module.exports.verifyToken = verifyToken;
