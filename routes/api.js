const express = require('express');
const router = express.Router();
const db = require('../database');
const emailService = require('../services/emailService');
const { verifyToken } = require('./auth');

// Get all verified doctors
router.get('/doctors', (req, res) => {
    db.all(`SELECT u.id, u.name, dp.specialty, dp.experience, dp.fee, dp.rating, dp.reviews, dp.is_available as avail 
            FROM users u
            JOIN doctors_profile dp ON u.id = dp.user_id
            WHERE u.role = 'doctor'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching doctors' });
        
        const doctors = rows.map(r => ({
            id: r.id,
            name: r.name,
            spec: r.specialty,
            exp: r.experience,
            fee: r.fee,
            rating: r.rating,
            reviews: r.reviews,
            avail: r.avail === 1,
            init: r.name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase(),
            color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color per run for demo
        }));

        res.json({ doctors });
    });
});

// Book an appointment (Protected)
router.post('/appointments', verifyToken, (req, res) => {
    const { doctorId, date, time, type, concern } = req.body;
    const patientId = req.user.id;
    const patientName = req.user.name;
    const patientEmail = req.user.email;

    if (!doctorId || !date || !time || !type) {
        return res.status(400).json({ error: 'Missing appointment details' });
    }

    db.run(`INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, consultation_type, concern, status)
            VALUES (?, ?, ?, ?, ?, ?, 'upcoming')`,
        [patientId, doctorId, date, time, type, concern],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to book appointment' });

            // Fetch doctor name
            db.get(`SELECT name FROM users WHERE id = ?`, [doctorId], (errD, doctor) => {
                let docName = doctor ? doctor.name : 'your doctor';
                
                // Trigger confirmation email
                emailService.sendAppointmentConfirmationEmail(patientEmail, docName, date, time).then(x => {
                    console.log('Email sent process completed async.');
                });

                res.status(201).json({ message: 'Appointment Confirmed', appointmentId: this.lastID });
            });
        }
    );
});

// Get Dashboard Info (Protected)
router.get('/dashboard', verifyToken, (req, res) => {
    const userId = req.user.id;
    const role = req.user.role; // 'patient' or 'doctor'
    
    // For patients: fetch their upcoming/past appointments
    if (role === 'patient') {
        db.all(`SELECT a.id, u.name as doctorName, dp.specialty as spec, a.appointment_date as date, a.appointment_time as time, a.consultation_type as type, a.status 
                FROM appointments a
                JOIN users u ON a.doctor_id = u.id
                JOIN doctors_profile dp ON u.doctor_id = dp.user_id
                WHERE a.patient_id = ? ORDER BY a.created_at DESC`, [userId], (err, rows) => {
                    
            if (err) return res.status(500).json({ error: 'Failed to fetch dashboard data' });

            const upcoming = rows.filter(r => r.status === 'upcoming');
            const past = rows.filter(r => r.status === 'completed');

            res.json({ upcoming, past });
        });
    } else {
        // For doctors: fetch their appointments
        db.all(`SELECT a.id, u.name as patientName, a.appointment_date as date, a.appointment_time as time, a.consultation_type as type, a.status 
                FROM appointments a
                JOIN users u ON a.patient_id = u.id
                WHERE a.doctor_id = ? ORDER BY a.created_at DESC`, [userId], (err, rows) => {
            
            if (err) return res.status(500).json({ error: 'Failed to fetch dashboard data' });
            
            res.json({ appointments: rows });
        });
    }
});

module.exports = router;
