const express = require('express');
const router = express.Router();
const supabase = require('../database');

// Middleware to verify Supabase JWT
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    
    // Verify token using Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Fetch custom user details (role, name) from our users table
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
    if (userError || !userData) {
        return res.status(401).json({ error: 'User profile not found' });
    }

    req.user = {
        id: data.user.id,
        email: data.user.email,
        role: userData.role,
        name: userData.name
    };
    next();
};

// Register
router.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, phone, role, specialty, license, clinic, clinicAddr } = req.body;
    
    if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const name = `${firstName} ${lastName}`;

        // 1. Create user in Supabase Auth (Using Admin to bypass email rate limits & auto-confirm)
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (createError) {
            return res.status(400).json({ error: createError.message });
        }

        // Now sign in to get the authentication token
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.status(400).json({ error: 'Failed to sign in after creation' });
        }

        const userId = authData.user.id;

        // 2. Insert into custom users table
        const { error: userError } = await supabase
            .from('users')
            .insert([{ id: userId, email, name, role, phone }]);

        if (userError) {
            console.error('Error inserting user', userError);
            return res.status(500).json({ error: 'Database error creating profile' });
        }

        // 3. If doctor, store profile info
        if (role === 'doctor') {
            const { error: docError } = await supabase
                .from('doctors_profile')
                .insert([{
                    user_id: userId,
                    specialty,
                    license_number: license,
                    clinic_name: clinic,
                    clinic_address: clinicAddr
                }]);
                
            if (docError) {
                console.error('Error inserting doctor profile', docError);
            }
        }

        // Supabase signUp returns a session if email confirmations are disabled.
        // We can return the access token.
        const token = authData.session ? authData.session.access_token : null;
        
        res.status(201).json({ 
            message: 'User created', 
            token, 
            user: { id: userId, email, role, name } 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 1. Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const userId = authData.user.id;

        // 2. Fetch custom user profile to check role
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        if (userData.role !== role) {
            return res.status(401).json({ error: 'Invalid credentials for this role' });
        }

        const token = authData.session.access_token;
        res.json({ 
            message: 'Login successful', 
            token, 
            user: { id: userId, email: userData.email, role: userData.role, name: userData.name } 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Google Auth using Supabase signInWithIdToken
router.post('/google', async (req, res) => {
    const { token, role, specialty, license, clinic, clinicAddr } = req.body;
    
    if (!token) return res.status(400).json({ error: 'No Google token provided' });

    try {
        // 1. Authenticate with Supabase using the ID token
        const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token
        });

        if (authError || !authData.user) {
            console.error('Supabase Auth Error:', authError);
            return res.status(401).json({ error: 'Google Authentication failed. ' + (authError?.message || '') });
        }

        const userId = authData.user.id;
        const email = authData.user.email;
        const name = authData.user.user_metadata?.full_name || email.split('@')[0];

        // 2. Check if user profile exists
        let isNewUser = false;
        let { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            // User does not exist in our custom table, create them
            isNewUser = true;
            
            // If role is missing, default to patient
            const userRole = role || 'patient';
            
            const { error: insertError } = await supabase
                .from('users')
                .insert([{ id: userId, email, name, role: userRole }]);
                
            if (insertError) {
                console.error('Error creating user profile:', insertError);
                return res.status(500).json({ error: 'Failed to create user profile' });
            }

            if (userRole === 'doctor') {
                const { error: docError } = await supabase
                    .from('doctors_profile')
                    .insert([{
                        user_id: userId,
                        specialty: specialty || 'General Physician',
                        license_number: license || 'Pending',
                        clinic_name: clinic || 'Pending',
                        clinic_address: clinicAddr || 'Pending'
                    }]);
                if (docError) console.error('Error creating doctor profile:', docError);
            }
            
            userData = { id: userId, email, name, role: userRole };
        }

        const accessToken = authData.session.access_token;
        res.json({
            message: 'Google login successful',
            token: accessToken,
            isNewUser,
            user: { id: userId, email, role: userData.role, name: userData.name }
        });

    } catch (error) {
        console.error('Google Auth Route Error:', error);
        res.status(500).json({ error: 'Server error during Google login' });
    }
});

router.get('/me', verifyToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
module.exports.verifyToken = verifyToken;

