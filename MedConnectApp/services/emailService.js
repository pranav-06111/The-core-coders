const nodemailer = require('nodemailer');

// Setup Email Transport
let transporter;

async function setupTransporter() {
    try {
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            // Use Production SMTP
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            console.log('Production SMTP email account configured.');
        } else {
            // Fallback to Ethereal for local dev
            let testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            console.log('Ethereal email test account configured.');
        }
    } catch (err) {
        console.error('Failed to configure email test account', err);
    }
}

setupTransporter();

async function sendAppointmentConfirmationEmail(patientEmail, doctorName, date, time) {
    if (!transporter) return;
    try {
        let info = await transporter.sendMail({
            from: '"MedConnect" <no-reply@medconnect.local>',
            to: patientEmail,
            subject: 'Appointment Confirmed - MedConnect',
            text: `Your appointment with ${doctorName} is confirmed for ${date} at ${time}.`,
            html: `<p>Your appointment with <strong>${doctorName}</strong> is confirmed for <strong>${date}</strong> at <strong>${time}</strong>.</p>
                   <p>Please join via the dashboard 5 minutes before the scheduled time.</p>
                   <p>Thank you for using MedConnect!</p>`,
        });

        console.log('Confirmation email sent. Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return info;
    } catch (error) {
        console.error('Error sending confirmation email:', error);
    }
}

module.exports = {
    sendAppointmentConfirmationEmail
};
