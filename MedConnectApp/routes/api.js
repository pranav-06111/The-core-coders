const express = require('express');
const router = express.Router();
const supabase = require('../database');
const emailService = require('../services/emailService');
const { verifyToken } = require('./auth');

// Get all verified doctors
router.get('/doctors', async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('users')
            .select(`
                id,
                name,
                doctors_profile!inner (
                    specialty,
                    experience,
                    fee,
                    rating,
                    reviews,
                    is_available
                )
            `)
            .eq('role', 'doctor');

        if (error) {
            console.error('Error fetching doctors:', error);
            return res.status(500).json({ error: 'Database error fetching doctors' });
        }

        const doctors = rows.map(r => ({
            id: r.id,
            name: r.name,
            spec: r.doctors_profile[0]?.specialty || '',
            exp: r.doctors_profile[0]?.experience || '',
            fee: r.doctors_profile[0]?.fee || 800,
            rating: r.doctors_profile[0]?.rating || 4.9,
            reviews: r.doctors_profile[0]?.reviews || 0,
            avail: r.doctors_profile[0]?.is_available === true,
            init: r.name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase(),
            color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color per run for demo
        }));

        res.json({ doctors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching doctors' });
    }
});

// Book an appointment (Protected)
router.post('/appointments', verifyToken, async (req, res) => {
    const { doctorId, date, time, type, concern } = req.body;
    const patientId = req.user.id;
    const patientName = req.user.name;
    const patientEmail = req.user.email;

    if (!doctorId || !date || !time || !type) {
        return res.status(400).json({ error: 'Missing appointment details' });
    }

    try {
        const { data: apptData, error: apptError } = await supabase
            .from('appointments')
            .insert([{
                patient_id: patientId,
                doctor_id: doctorId,
                appointment_date: date,
                appointment_time: time,
                consultation_type: type,
                concern: concern || '',
                status: 'upcoming'
            }])
            .select()
            .single();

        if (apptError) {
            console.error('Error booking appointment:', apptError);
            return res.status(500).json({ error: 'Failed to book appointment' });
        }

        // Fetch doctor name
        const { data: docData } = await supabase
            .from('users')
            .select('name')
            .eq('id', doctorId)
            .single();

        let docName = docData ? docData.name : 'your doctor';
        
        // Trigger confirmation email
        emailService.sendAppointmentConfirmationEmail(patientEmail, docName, date, time).then(x => {
            console.log('Email sent process completed async.');
        }).catch(e => console.error('Email sending failed', e));

        res.status(201).json({ message: 'Appointment Confirmed', appointmentId: apptData.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during booking' });
    }
});

// Get Dashboard Info (Protected)
router.get('/dashboard', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const role = req.user.role; // 'patient' or 'doctor'
    
    try {
        // For patients: fetch their upcoming/past appointments
        if (role === 'patient') {
            const { data: rows, error } = await supabase
                .from('appointments')
                .select(`
                    id,
                    appointment_date,
                    appointment_time,
                    consultation_type,
                    status,
                    doctor:users!doctor_id (
                        name,
                        doctors_profile (
                            specialty
                        )
                    )
                `)
                .eq('patient_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching patient dashboard:', error);
                return res.status(500).json({ error: 'Failed to fetch dashboard data' });
            }

            const mappedRows = rows.map(r => ({
                id: r.id,
                doctorName: r.doctor?.name || 'Unknown Doctor',
                spec: r.doctor?.doctors_profile?.[0]?.specialty || '',
                date: r.appointment_date,
                time: r.appointment_time,
                type: r.consultation_type,
                status: r.status
            }));

            const upcoming = mappedRows.filter(r => r.status === 'upcoming');
            const past = mappedRows.filter(r => r.status === 'completed');

            res.json({ upcoming, past });
        } else {
            // For doctors: fetch their appointments
            const { data: rows, error } = await supabase
                .from('appointments')
                .select(`
                    id,
                    appointment_date,
                    appointment_time,
                    consultation_type,
                    status,
                    patient:users!patient_id (
                        name
                    )
                `)
                .eq('doctor_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching doctor dashboard:', error);
                return res.status(500).json({ error: 'Failed to fetch dashboard data' });
            }

            const mappedRows = rows.map(r => ({
                id: r.id,
                patientName: r.patient?.name || 'Unknown Patient',
                date: r.appointment_date,
                time: r.appointment_time,
                type: r.consultation_type,
                status: r.status
            }));

            res.json({ appointments: mappedRows });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching dashboard' });
    }
});

// Get Vitals (Protected)
router.get('/vitals', verifyToken, async (req, res) => {
    const userId = req.user.id;
    if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can access vitals' });

    try {
        const { data: rows, error } = await supabase
            .from('vitals')
            .select('id, date, weight, blood_pressure, heart_rate')
            .eq('patient_id', userId)
            .order('date', { ascending: true }); // order by date for chart

        if (error) {
            console.error('Error fetching vitals:', error);
            return res.status(500).json({ error: 'Database error fetching vitals' });
        }

        res.json({ vitals: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching vitals' });
    }
});

// Post Vitals (Protected)
router.post('/vitals', verifyToken, async (req, res) => {
    const userId = req.user.id;
    if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can access vitals' });

    const { date, weight, blood_pressure, heart_rate } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        const { data, error } = await supabase
            .from('vitals')
            .insert([{
                patient_id: userId,
                date,
                weight: weight || null,
                blood_pressure: blood_pressure || null,
                heart_rate: heart_rate || null
            }])
            .select()
            .single();

        if (error) {
            console.error('Error saving vitals:', error);
            return res.status(500).json({ error: 'Database error saving vitals' });
        }

        res.status(201).json({ message: 'Vitals saved successfully', vital: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error saving vitals' });
    }
});

module.exports = router;

