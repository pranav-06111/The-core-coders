# MedConnect

A full-stack Node.js/Express application for telehealth services, featuring doctor discovery, appointment booking, authentication (Google OAuth), and an SQLite database.

## Prerequisites
- Node.js installed

## How to Run Locally (After Cloning from GitHub)

Since sensitive files (like `.env`) and the `node_modules` folder are intentionally ignored and not uploaded to GitHub, follow these steps to run the application on any new machine.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pranav-06111/The-core-coders.git
   cd The-core-coders
   ```

2. **Install all dependencies:**
   ```bash
   npm install
   ```

3. **Set up your environment variables:**
   Create a new file named `.env` in the root folder of the project and add the necessary secret keys (e.g., database URLs, Auth secrets, API keys). Make sure you copy over the values from your original `.env` file since they aren't stored on GitHub.

   *Example `.env`:*
   ```env
   # Add your environment variables here
   PORT=3000
   ```

4. **Start the application:**
   ```bash
   npm start
   # or `node server.js`
   ```

5. **Open in browser:**
   Open [http://localhost:3000](http://localhost:3000) (or whichever port you configured).
