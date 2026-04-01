const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'medconnect.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            // Users table (Patients & Doctors)
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                password TEXT,
                name TEXT,
                role TEXT,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Doctor Profile table
            db.run(`CREATE TABLE IF NOT EXISTS doctors_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                specialty TEXT,
                license_number TEXT,
                clinic_name TEXT,
                clinic_address TEXT,
                experience TEXT,
                fee INTEGER DEFAULT 800,
                rating REAL DEFAULT 4.9,
                reviews INTEGER DEFAULT 0,
                is_available BOOLEAN DEFAULT 1,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            // Appointments table
            db.run(`CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER,
                doctor_id INTEGER,
                appointment_date TEXT,
                appointment_time TEXT,
                consultation_type TEXT,
                concern TEXT,
                status TEXT DEFAULT 'upcoming',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(patient_id) REFERENCES users(id),
                FOREIGN KEY(doctor_id) REFERENCES users(id)
            )`);
        });
    }
});

module.exports = db;
