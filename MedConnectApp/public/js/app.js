// ── STATE
let user = null, selDoc = null, selSlot = null, activeSpec = 'all', role = 'patient';
const API_URL = '/api';

// Look for token on load
document.addEventListener('DOMContentLoaded', () => {
    // Fetch config for Google Auth
    fetch('/api/config')
        .then(r => r.json())
        .then(cfg => {
            if (cfg.googleClientId && window.google) {
                google.accounts.id.initialize({
                    client_id: cfg.googleClientId,
                    callback: handleGoogleResponse
                });
                const btnOpts = { theme: "outline", size: "large", width: 340 };
                const btnSignin = document.getElementById('googleBtnSignin');
                const btnSignup = document.getElementById('googleBtnSignup');
                if (btnSignin) google.accounts.id.renderButton(btnSignin, btnOpts);
                if (btnSignup) google.accounts.id.renderButton(btnSignup, btnOpts);
            }
        })
        .catch(err => console.error('Failed to load config', err));

    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
            if (res.ok) return res.json();
            throw new Error('Invalid token');
        })
        .then(data => {
            loginOK(data.user, false, token);
        })
        .catch(err => {
            localStorage.removeItem('token');
        });
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.querySelectorAll('.dark-mode-toggle').forEach(btn => btn.textContent = '☀️');
    }
});

let DOCS = [];
let APPTS = { up: [], past: [], rx: [] };

const SLOTS = ["09:00 AM","10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM","06:00 PM"];
const ICONS = {
  'Video Call':`<svg viewBox="0 0 24 24" fill="none" stroke="#005F6B" stroke-width="2"><rect x="2" y="7" width="15" height="10" rx="2"/><polyline points="17 9 22 7 22 17 17 15"/></svg>`,
  'Audio Call':`<svg viewBox="0 0 24 24" fill="none" stroke="#005F6B" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.82-.82a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  'Download PDF':`<svg viewBox="0 0 24 24" fill="none" stroke="#005F6B" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  'Chat':`<svg viewBox="0 0 24 24" fill="none" stroke="#005F6B" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};

// ── NAV
function go(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  window.scrollTo(0, 0);
}

// ── AUTH
async function handleGoogleResponse(response) {
    const token = response.credential;
    if (!token) return;

    toast('Authenticating with Google...', 'info');

    let payload = { token, role };
    
    // If signing up as a doctor, we need to pass the extra fields
    if (role === 'doctor') {
        const specialty = document.getElementById('su-spec') ? document.getElementById('su-spec').value : '';
        const license = document.getElementById('su-license') ? document.getElementById('su-license').value.trim() : '';
        const clinic = document.getElementById('su-clinic') ? document.getElementById('su-clinic').value.trim() : '';
        const clinicAddr = document.getElementById('su-addr1') ? document.getElementById('su-addr1').value.trim() : '';
        
        // If they are on the signup page (the fields are visible), require them
        const isSignup = document.getElementById('page-signup').classList.contains('active');
        if (isSignup && (!license || !clinic || !clinicAddr)) {
            toast('Please complete doctor verification details before continuing with Google', 'error');
            return;
        }
        
        if (isSignup) {
            payload.specialty = specialty;
            payload.license = license;
            payload.clinic = clinic;
            payload.clinicAddr = clinicAddr;
        }
    }

    try {
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Google Login failed');
        
        loginOK(data.user, data.isNewUser, data.token);
    } catch (err) {
        toast(err.message, 'error');
    }
}

async function emailSignIn() {
  const email = document.getElementById('si-email').value.trim();
  const password = document.getElementById('si-pw').value;
  if (!email || !email.includes('@')) { toast('Please enter a valid email', 'error'); return; }
  if (!password) { toast('Please enter your password', 'error'); return; }
  
  toast('Signing you in...', 'info');
  
  try {
      const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      loginOK(data.user, false, data.token);
  } catch (err) {
      toast(err.message, 'error');
  }
}

async function emailSignUp() {
  const firstName = document.getElementById('su-fn').value.trim();
  const lastName = document.getElementById('su-ln').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const password = document.getElementById('su-pw').value;
  const phone = document.getElementById('su-phone').value.trim();
  const terms = document.getElementById('su-terms').checked;
  
  if (!firstName || !lastName || !email || !password || !terms) {
      toast('Please fill all required fields and accept terms', 'error'); return;
  }
  
  let payload = { firstName, lastName, email, password, phone, role };
  
  if (role === 'doctor') {
      payload.specialty = document.getElementById('su-spec').value;
      payload.license = document.getElementById('su-license').value.trim();
      payload.clinic = document.getElementById('su-clinic').value.trim();
      payload.clinicAddr = document.getElementById('su-addr1').value.trim();
      if (!payload.license || !payload.clinic || !payload.clinicAddr) {
          toast('Please complete doctor verification details', 'error'); return;
      }
  }

  toast('Creating your account...', 'info');

  try {
      const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      
      loginOK(data.user, true, data.token);
  } catch (err) {
      toast(err.message, 'error');
  }
}

function loginOK(u, isNew, token) {
  user = u;
  if (token) localStorage.setItem('token', token);
  
  // Set initial for avatar if not present
  u.init = u.init || u.name.charAt(0).toUpperCase();

  if (u.role === 'doctor') {
    const firstName = u.name.split(' ')[0];
    document.getElementById('dName').textContent = firstName;
    document.getElementById('dAvatar').textContent = u.init;
    document.getElementById('dWelcomeName').textContent = firstName;
    document.getElementById('dProfileName').textContent = 'Dr. ' + u.name;
    document.getElementById('dProfileAvatar').textContent = u.init;
    go('doctor');
    loadDoctorDashboard();
    buildWeekGrid();
    setTimeout(() => toast(isNew ? `Welcome Dr. ${firstName}! Your portal is ready 🩺` : `Welcome back, Dr. ${firstName}!`, 'success'), 300);
  } else {
    document.getElementById('uName').textContent = u.name.split(' ')[0];
    document.getElementById('uAvatar').textContent = u.init;
    go('app');
    loadDoctors();
    loadPatientDashboard();
    setTimeout(() => toast(isNew ? `Welcome to MedConnect, ${u.name.split(' ')[0]}! 🎉` : `Welcome back, ${u.name.split(' ')[0]}!`, 'success'), 300);
  }
}

function logout() {
  user = null;
  localStorage.removeItem('token');
  go('landing');
  toast('Signed out successfully', 'success');
}

function setRole(r) {
  role = r;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  const suTab = document.getElementById('rtab-' + r);
  const siTab = document.getElementById('si-rtab-' + r);
  if (suTab) suTab.classList.add('active');
  if (siTab) siTab.classList.add('active');
  const suDoctorFields = document.getElementById('su-doctor-fields');
  if (suDoctorFields) suDoctorFields.style.display = r === 'doctor' ? 'block' : 'none';
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
}

// ── APP
function showSec(s) {
  document.querySelectorAll('.app-section').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.appnav-links a').forEach(x => x.classList.remove('active'));
  document.getElementById('sec-' + s).classList.add('active');
  document.getElementById('nav-' + s).classList.add('active');
  
  if (s === 'dash') loadPatientDashboard();
}

async function loadDoctors() {
    try {
        const res = await fetch(`${API_URL}/doctors`);
        const data = await res.json();
        DOCS = data.doctors || [];
        filterDocs();
    } catch (err) {
        console.error("Failed to load doctors", err);
    }
}

function renderDocs(list) {
  const grid = document.getElementById('docsGrid');
  if (!grid) return;
  grid.innerHTML = list.map(d => `
    <div class="doctor-card" onclick="openBook(${d.id})">
      <div class="doc-header">
        <div class="doc-avatar" style="background:${d.color}">${d.init}</div>
        <div class="doc-info"><h4>${d.name}</h4><p>${d.spec} · ${d.exp} exp</p><p style="font-size:11px;color:var(--text-muted);margin-top:2px">🌐 English, Hindi</p></div>
      </div>
      <div class="doc-tags">
        <span class="doc-tag ${d.avail?'available':'busy'}">${d.avail?'● Available Now':'● Busy'}</span>
        <span class="doc-tag">${d.spec}</span>
      </div>
      <div class="doc-meta">
        <div class="doc-rating"><span>★</span> ${d.rating} <small style="font-weight:400;color:var(--text-muted)">(${d.reviews})</small></div>
        <div class="doc-fee">From <strong>₹${d.fee}</strong></div>
      </div>
      <button class="book-btn">${d.avail?'Book Consultation →':'Join Waitlist'}</button>
    </div>`).join('');
}

function filterDocs() {
  const q = document.getElementById('srch').value.toLowerCase();
  let list = DOCS;
  if (activeSpec !== 'all') list = list.filter(d => d.spec === activeSpec);
  if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || d.spec.toLowerCase().includes(q));
  renderDocs(list);
}

function filterSpec(s, el) {
  activeSpec = s;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filterDocs();
}

function openBook(id) {
  selDoc = DOCS.find(d => d.id === id);
  selSlot = null;
  document.getElementById('aDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('mDocInfo').innerHTML = `
    <div class="doc-avatar" style="background:${selDoc.color};width:48px;height:48px;border-radius:12px;font-size:16px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">${selDoc.init}</div>
    <div><strong style="color:var(--navy);font-size:15px">${selDoc.name}</strong><p style="color:var(--text-muted);font-size:13px">${selDoc.spec} · ₹${selDoc.fee}/consult</p></div>`;
  const avail = SLOTS.filter((_,i) => i!==2 && i!==5);
  document.getElementById('tSlots').innerHTML = avail.map(t => `<div class="time-slot" onclick="pickSlot(this,'${t}')">${t}</div>`).join('');
  document.getElementById('bModal').classList.add('open');
}

function pickSlot(el, s) {
  document.querySelectorAll('.time-slot').forEach(x => x.classList.remove('selected'));
  el.classList.add('selected');
  selSlot = s;
}

function closeModal() { document.getElementById('bModal').classList.remove('open'); }

async function confirmBook() {
  const date = document.getElementById('aDate').value;
  const type = document.getElementById('cType').value;
  const concern = document.getElementById('concern') ? document.getElementById('concern').value : '';

  if (!selSlot) { toast('Please select a time slot', 'error'); return; }
  if (!date) { toast('Please select a date', 'error'); return; }

  const token = localStorage.getItem('token');
  try {
      const res = await fetch(`${API_URL}/appointments`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ doctorId: selDoc.id, date, time: selSlot, type, concern })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to book');

      document.getElementById('mBody').innerHTML = `
        <div class="success-box">
          <div class="success-ico"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
          <h3>Appointment Confirmed!</h3>
          <p>Your consultation with <strong>${selDoc.name}</strong> is booked for <strong>${new Date(date).toLocaleDateString('en-IN',{day:'numeric',month:'long'})}</strong> at <strong>${selSlot}</strong>.</p>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px">A confirmation email has been sent.</p>
          <button class="confirm-btn" onclick="closeModal();showSec('dash')">View Dashboard →</button>
        </div>`;
  } catch (err) {
      toast(err.message, 'error');
  }
}

async function loadPatientDashboard() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/dashboard`, { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await res.json();
        
        APPTS.up = data.upcoming ? data.upcoming.map(a => ({ doc: a.doctorName, spec: a.spec, date: a.date, time: a.time, type: a.type, status: a.status })) : [];
        APPTS.past = data.past ? data.past.map(a => ({ doc: a.doctorName, spec: a.spec, date: a.date, time: a.time, type: a.type, status: a.status })) : [];
        
        renderDash();
        fetchVitals();
    } catch (err) {
        console.error("Dashboard error", err);
    }
}

function renderDash() {
  renderList('list-up', APPTS.up);
  renderList('list-past', APPTS.past);
  renderList('list-rx', APPTS.rx);
}

function renderList(id, data) {
  const container = document.getElementById(id);
  if (!container) return;
  if (!data.length) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><h4>No records yet</h4><p>Book a consultation to get started</p></div>`;
    return;
  }
  container.innerHTML = data.map(a => `
    <div class="appt-card">
      <div class="appt-icon">${ICONS[a.type]||ICONS['Video Call']}</div>
      <div class="appt-info"><h4>${a.doc}</h4><p>${a.spec||'Consultation'} · ${a.date} at ${a.time} · ${a.type}</p></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span class="appt-badge ${a.status}">${a.status==='upcoming'?'Upcoming':'Completed'}</span>
        ${a.status==='completed' ? `<button class="export-btn" onclick="exportPDF(this.closest('.appt-card'), '${a.doc}', '${a.date}')">${ICONS['Download PDF']||'📄'} Export PDF</button>` : ''}
      </div>
    </div>`).join('');
}

function switchTab(t, el) {
  document.querySelectorAll('.dash-tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.dash-panel').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
  const panel = document.getElementById('tab-'+t);
  if (panel) panel.classList.add('active');
}

function toast(msg, type='success') {
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.className = 'toast ' + type + ' show';
  setTimeout(() => el.className = 'toast', 3200);
}

// ── DOCTOR
function showDocSec(s) {
  document.querySelectorAll('.doc-section').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.docnav-links a').forEach(x => x.classList.remove('active'));
  document.getElementById('dsec-' + s).classList.add('active');
  document.getElementById('dnav-' + s).classList.add('active');
}

let docOnline = true;
function toggleDocStatus() {
  docOnline = !docOnline;
  const btn = document.getElementById('docStatusBtn');
  const dot = document.getElementById('statusDot');
  const lbl = document.getElementById('statusLabel');
  if(!btn) return;
  if (docOnline) {
    btn.classList.add('available');
    dot.classList.add('on');
    lbl.textContent = 'Available Now';
    toast('You are now available for consultations', 'success');
  } else {
    btn.classList.remove('available');
    dot.classList.remove('on');
    lbl.textContent = 'Set Unavailable';
    toast('You are now offline', 'info');
  }
}

async function loadDoctorDashboard() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/dashboard`, { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await res.json();
        
        const container = document.getElementById('doc-today-appts');
        if (!container) return;
        
        let appts = data.appointments || [];
        document.getElementById('dTodayCount').innerText = appts.length;
        
        if (appts.length === 0) {
            container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">No appointments scheduled.</div>`;
            return;
        }

        container.innerHTML = appts.map(a => `
          <div class="doc-appt-item">
            <div class="doc-appt-time"><strong>${a.time.split(' ')[0]}</strong><span>${a.time.split(' ')[1]}</span></div>
            <div class="doc-appt-details"><h5>${a.patientName}</h5><p>${a.type} · ${a.date}</p></div>
            <button class="doc-appt-action">Start Call</button>
          </div>
        `).join('');
    } catch (err) {
        console.error("Dashboard error", err);
    }
}

function buildWeekGrid() {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const sampleSlots = [
    [{name:'Priya M.',type:'Video'},{name:'Rahul S.',type:'Video'}],
    [{name:'Ankit P.',type:'Audio'}],
    [{name:'Sunita R.',type:'Video'}],
    [],
    [{name:'Nisha J.',type:'Audio'}],
    [],
    []
  ];
  const grid = document.getElementById('weekGrid');
  if (!grid) return;
  grid.innerHTML = days.map((d, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const isToday = date.toDateString() === today.toDateString();
    const slots = sampleSlots[i];
    const slotHtml = slots.length
      ? slots.map(s => `<div class="day-slot"><p>${s.name}</p><span>${s.type}</span></div>`).join('')
      : `<div class="day-slot empty-slot"><p>No appts</p></div>`;
    return `<div class="day-col ${isToday?'today':''}">
      <div class="day-head"><span>${d}</span><strong>${date.getDate()}</strong></div>
      ${slotHtml}
    </div>`;
  }).join('');
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Setup modal close outside click
const bModal = document.getElementById('bModal');
if(bModal) {
    window.addEventListener('click', e => { if (e.target === bModal) closeModal(); });
}

// ── NEW FEATURES (DARK MODE, PDF EXPORT, VITALS) ──

function toggleDarkMode() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const btns = document.querySelectorAll('.dark-mode-toggle');
    if (isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        btns.forEach(btn => btn.textContent = '🌙');
        toast('Light mode activated', 'info');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        btns.forEach(btn => btn.textContent = '☀️');
        toast('Dark mode activated', 'info');
    }
    
    // Re-render vitals chart to update its text colors
    if (typeof vitalsData !== 'undefined' && vitalsData.length > 0) {
        renderVitalsChart();
    }
}

function exportPDF(element, docName, date) {
    toast('Generating PDF...', 'info');
    // Hide the button itself before export
    const btn = element.querySelector('.export-btn');
    if (btn) btn.style.display = 'none';

    const opt = {
        margin:       10,
        filename:     `Consultation_${docName.replace(/\s+/g,'_')}_${date}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        if (btn) btn.style.display = 'inline-flex';
        toast('PDF Downloaded!', 'success');
    });
}

let vitalsChartInstance = null;
let vitalsData = [];

async function fetchVitals() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/vitals`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to fetch vitals');
        const data = await res.json();
        vitalsData = data.vitals || [];
        renderVitalsChart();
    } catch (err) {
        console.error("Vitals fetch error", err);
    }
}

function renderVitalsChart() {
    const canvas = document.getElementById('vitalsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const dates = vitalsData.map(v => v.date);
    const weights = vitalsData.map(v => v.weight);
    const hr = vitalsData.map(v => v.heart_rate);

    if (vitalsChartInstance) {
        vitalsChartInstance.destroy();
    }

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#F8FAFC' : '#1B3A5C';

    vitalsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.length ? dates : ['No Data'],
            datasets: [
                {
                    label: 'Weight (kg)',
                    data: weights.length ? weights : [0],
                    borderColor: '#005F6B',
                    backgroundColor: 'rgba(0,95,107,0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Heart Rate (bpm)',
                    data: hr.length ? hr : [0],
                    borderColor: '#3B82F6',
                    backgroundColor: 'transparent',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                x: { ticks: { color: textColor } },
                y: { ticks: { color: textColor } }
            }
        }
    });
}

async function saveVitals() {
    const date = document.getElementById('vDate').value;
    const weight = document.getElementById('vWeight').value;
    const bp = document.getElementById('vBp').value;
    const hr = document.getElementById('vHr').value;

    if (!date) { toast('Please enter a date', 'error'); return; }

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/vitals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ date, weight, blood_pressure: bp, heart_rate: hr })
        });
        if (!res.ok) throw new Error('Failed to save vitals');
        toast('Vitals saved successfully!', 'success');
        
        // Reset form
        document.getElementById('vWeight').value = '';
        document.getElementById('vBp').value = '';
        document.getElementById('vHr').value = '';
        
        // Refetch and update
        fetchVitals();
    } catch (err) {
        toast(err.message, 'error');
    }
}

