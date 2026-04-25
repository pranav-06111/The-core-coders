const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Use the SERVICE_ROLE key here if you need to bypass RLS, or anon key if RLS is set up.

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env file.');
}

const db = createClient(supabaseUrl, supabaseKey);

console.log('Connected to Supabase client.');

module.exports = db;
