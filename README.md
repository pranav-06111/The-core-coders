<div align="center">
  <img src="https://via.placeholder.com/120x120/4A90E2/FFFFFF?text=MC" alt="MedConnect Logo" width="120" />
  <h1>MedConnect</h1>
  <p><em>Modern Telehealth & Doctor Discovery Platform</em></p>
  
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E.svg)](https://supabase.com/)
</div>

<br />

## 🌟 Overview

**MedConnect** is a full-stack telehealth application designed to bridge the gap between patients and healthcare professionals. It offers a seamless, premium user interface for patients to discover top-rated doctors, book instant video or audio consultations, and manage their health records. 

For doctors, MedConnect provides a powerful dashboard to manage appointments, set availability, and securely access patient consultation histories.

## ✨ Features

- **🔐 Secure Authentication**: Real Google Identity Services (OAuth) and Email/Password login powered by Supabase Auth.
- **👨‍⚕️ Role-Based Access**: Dedicated portals and dashboards tailored for both Patients and Doctors.
- **📅 Appointment Booking**: Frictionless scheduling system with instant time-slot reservations.
- **📧 Automated Emails**: Instant appointment confirmation emails sent via Nodemailer.
- **🚀 Production-Ready**: Configured with `helmet` for security, `compression` for speed, and ready for deployment on Render or Vercel.

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3 (Custom Design System, Glassmorphism), Vanilla JavaScript.
- **Backend**: Node.js, Express.js.
- **Database & Auth**: Supabase (PostgreSQL), Supabase Auth.
- **Integrations**: Google Identity Services (GSI), Nodemailer (SMTP).

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18 or higher)
- A Supabase Project (for Database and Auth)
- Google Cloud Console Project (for Google OAuth)

### 1. Clone the Repository
```bash
git clone https://github.com/pranav-06111/The-core-coders.git
cd The-core-coders
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and add the following keys:
```env
JWT_SECRET=your_super_secret_jwt_key
PORT=3000

# Google Auth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_service_role_key

# Email SMTP (Optional - Defaults to Ethereal for testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 4. Database Setup
1. Go to your Supabase Dashboard -> SQL Editor.
2. Paste the contents of `supabase_schema.sql` and click **Run** to generate the required tables and security policies.

### 5. Run the Application
```bash
npm run dev
```
Navigate to `http://localhost:3000` in your browser.

## 🌐 Deployment
This project includes a `vercel.json` for easy deployment to Vercel, and a `"start"` script configured for platforms like Render or Heroku. Remember to add your `.env` variables to your hosting platform's environment settings.

---
<div align="center">
  Built with ❤️ by The Core Coders
</div>
