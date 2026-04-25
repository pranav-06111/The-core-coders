-- Run this in your Supabase SQL Editor

-- 1. Create custom users table that links to Supabase Auth
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create doctors_profile table
CREATE TABLE IF NOT EXISTS doctors_profile (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    specialty TEXT,
    license_number TEXT,
    clinic_name TEXT,
    clinic_address TEXT,
    experience TEXT,
    fee INTEGER DEFAULT 800,
    rating REAL DEFAULT 4.9,
    reviews INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE
);

-- 3. Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    consultation_type TEXT NOT NULL,
    concern TEXT,
    status TEXT DEFAULT 'upcoming',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) but allow service role to bypass it
-- For simplicity, since the backend handles everything via the Service Role Key, 
-- we can just leave RLS off or enable it and allow the backend full access.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Allow read/write for all authenticated users (or you can restrict further)
CREATE POLICY "Allow full access for authenticated users" ON users FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow full access for authenticated users" ON doctors_profile FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow full access for authenticated users" ON appointments FOR ALL TO authenticated USING (true);
