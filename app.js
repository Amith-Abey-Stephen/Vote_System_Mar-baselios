// --- FIREBASE CONFIGURATION ---
// Replace these placeholder strings with your actual Firebase project credentials.
// To run in local offline "Demo Mode" for testing, leave these fields empty.
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: ""
};

// --- SYSTEM STATE ---
let electionState = 'running'; // 'configuring', 'running', 'paused', 'ended'
let isDemoMode = true;
let db = null;

// Default Candidate Structures
let candidates = {
  hb: [
    { id: 'candidate1', name: 'Aarav Sharma', class: '10A', votes: 14 },
    { id: 'candidate2', name: 'Ethan Davis', class: '10B', votes: 9 },
    { id: 'candidate3', name: 'Vivaan Nair', class: '10C', votes: 18 },
    { id: 'candidate4', name: 'Kabir Sen', class: '10D', votes: 6 }
  ],
  hg: [
    { id: 'candidate1', name: 'Ananya Iyer', class: '10A', votes: 21 },
    { id: 'candidate2', name: 'Diya Patil', class: '10B', votes: 12 },
    { id: 'candidate3', name: 'Kiara Roy', class: '10C', votes: 8 },
    { id: 'candidate4', name: 'Meera Joshi', class: '10D', votes: 15 }
  ],
  sc: [
    { id: 'candidate1', name: 'Arjun Mehta', class: '10A', votes: 11 },
    { id: 'candidate2', name: 'Rohan Verma', class: '10B', votes: 19 },
    { id: 'candidate3', name: 'Dev Patel', class: '10C', votes: 7 },
    { id: 'candidate4', name: 'Siddharth Rao', class: '10D', votes: 14 }
  ]
};

// Default Audit log
let auditLog = [
  { timestamp: Date.now() - 3600000 * 2, deviceId: 'VTIC-VOTING-01', hb: 'candidate3', hg: 'candidate1', sc: 'candidate2' },
  { timestamp: Date.now() - 3600000 * 1.5, deviceId: 'VTIC-VOTING-01', hb: 'candidate1', hg: 'candidate4', sc: 'candidate4' },
  { timestamp: Date.now() - 3600000 * 0.5, deviceId: 'VTIC-VOTING-01', hb: 'candidate2', hg: 'candidate1', sc: 'candidate2' }
];

// Active tabs
let activeResultsTab = 'hb';
let activeConfigRole = 'hb';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  loadFirebaseConfig();
  initDashboard();
});

function initClock() {
  setInterval(() => {
    const clock = document.getElementById('live-clock');
    const now = new Date();
    clock.textContent = now.toLocaleTimeString();
  }, 1000);
}

// Write line into event logs monitor
function addLogLine(level, msg) {
  const logMsg = `[${level}] ${msg}`;
  if (level === 'ERROR') console.error(logMsg);
  else if (level === 'WARN') console.warn(logMsg);
  else console.log(logMsg);

  const consoleLog = document.getElementById('audit-log-console');
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  
  const div = document.createElement('div');
  div.className = `serial-line ${level.toLowerCase()}`;
  div.textContent = `[${timeStr}] [${level}] ${msg}`;
  
  consoleLog.appendChild(div);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function clearAuditConsole() {
  document.getElementById('audit-log-console').innerHTML = '';
  addLogLine('INFO', 'Audit log cleared locally.');
}

// --- FIREBASE LOADER & CONNECTORS ---
async function loadFirebaseConfig() {
  try {
    const response = await fetch('config.json');
    if (response.ok) {
      const text = await response.text();
      // Resiliently remove literal newlines/carriage returns that break JSON parsing
      const cleanText = text.replace(/[\n\r]/g, '');
      const config = JSON.parse(cleanText);
      
      // Trim values in case of any trailing spaces or newlines
      if (config.apiKey) config.apiKey = config.apiKey.trim();
      if (config.authDomain) config.authDomain = config.authDomain.trim();
      if (config.projectId) config.projectId = config.projectId.trim();
      
      if (config.apiKey && config.projectId) {
        initializeFirebase(config);
        return;
      }
    }
  } catch (e) {
    console.error("Configuration JSON parsing error:", e);
  }

  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId) {
    initializeFirebase(FIREBASE_CONFIG);
  } else {
    setupDemoMode();
  }
}

function initializeFirebase(config) {
  try {
    firebase.initializeApp(config);
    db = firebase.firestore();
    isDemoMode = false;
    
    // Update Badge
    const badge = document.getElementById('connection-status-badge');
    badge.textContent = 'Live Firestore';
    badge.className = 'badge-live';
    
    addLogLine('INFO', `Successfully connected to Firestore Project: ${config.projectId}`);
    
    // Listen for Auth changes
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('signout-btn').style.display = 'block';
        addLogLine('INFO', `Admin logged in successfully: ${user.email}`);
        
        // Bind Real-time Snapshot listeners once authenticated
        bindFirestoreListeners();
      } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('signout-btn').style.display = 'none';
        addLogLine('WARN', 'Admin access required. Please sign in.');
      }
    });
  } catch (err) {
    console.error("Firebase init failed", err);
    addLogLine('ERROR', `Firebase connection failed: ${err.message}. Falling back to Demo Mode.`);
    setupDemoMode();
  }
}

function setupDemoMode() {
  isDemoMode = true;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('signout-btn').style.display = 'none';
  
  const badge = document.getElementById('connection-status-badge');
  badge.textContent = 'Demo Mode';
  badge.className = 'badge-demo';
  
  addLogLine('WARN', 'Operating in offline Demo Mode. Configurations are saved locally in the browser.');
  
  // Refresh UI based on local variables
  updateStandings();
  refreshStats();
  renderCandidateFields();
  renderDeviceMonitor();
}

// --- FIRESTORE LISTENERS ---
function bindFirestoreListeners() {
  // 1. Listen to Candidate configuration settings
  db.collection('election').doc('candidates').onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data.hb) candidates.hb = data.hb;
      if (data.hg) candidates.hg = data.hg;
      if (data.sc) candidates.sc = data.sc;
      
      addLogLine('INFO', 'Synchronized candidate metadata configs from Firestore.');
      updateStandings();
      renderCandidateFields();
    } else {
      // Document doesn't exist, seed it with default candidates structure (with 0 votes)
      const cleanCandidates = JSON.parse(JSON.stringify(candidates));
      ['hb', 'hg', 'sc'].forEach(role => {
        cleanCandidates[role].forEach(c => c.votes = 0);
      });
      db.collection('election').doc('candidates').set(cleanCandidates);
      addLogLine('INFO', 'Seeded initial clean candidates structure in Firestore.');
    }
  }, err => addLogLine('ERROR', `Candidates listener failed: ${err.message}`));

  // 2. Listen to Election operational status
  db.collection('election').doc('status').onSnapshot(doc => {
    if (doc.exists) {
      electionState = doc.data().state || 'running';
      refreshStats();
      addLogLine('INFO', `Synchronized status from Firestore: ${electionState.toUpperCase()}`);
    } else {
      db.collection('election').doc('status').set({ state: 'running' });
    }
  }, err => addLogLine('ERROR', `Status listener failed: ${err.message}`));

  // 3. Listen to Votes collection for real-time counts
  db.collection('votes').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
    auditLog = [];
    
    // Reset local counts to 0 before recount
    ['hb', 'hg', 'sc'].forEach(role => {
      candidates[role].forEach(c => c.votes = 0);
    });

    snapshot.forEach(doc => {
      const data = doc.data();
      const voteItem = {
        timestamp: data.timestamp ? (data.timestamp.seconds ? data.timestamp.seconds * 1000 : parseInt(data.timestamp)) : Date.now(),
        deviceId: data.deviceId || 'ESP32-NODE',
        hb: data.headBoy,
        hg: data.headGirl,
        sc: data.sportsCaptain
      };
      
      auditLog.push(voteItem);
      
      // Increment tallies based on candidate IDs
      incrementTally('hb', data.headBoy);
      incrementTally('hg', data.headGirl);
      incrementTally('sc', data.sportsCaptain);
    });

    if (snapshot.size > 0 && auditLog.length > 0) {
      const latest = auditLog[0];
      const hbName = getCandidateName('hb', latest.hb);
      const hgName = getCandidateName('hg', latest.hg);
      const scName = getCandidateName('sc', latest.sc);
      addLogLine('INFO', `New Vote Registered: HB[${hbName}], HG[${hgName}], SC[${scName}]`);
    }

    updateStandings();
    refreshStats();
  }, err => addLogLine('ERROR', `Votes listener failed: ${err.message}`));

  // 4. Listen to Devices telemetry
  db.collection('devices').onSnapshot(snapshot => {
    const container = document.getElementById('device-monitor-container');
    container.innerHTML = '';
    
    if (snapshot.empty) {
      container.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Waiting for hardware terminal telemetry...</div>`;
      return;
    }

    snapshot.forEach(doc => {
      const d = doc.data();
      const deviceId = doc.id;
      const online = d.online || false;
      const lastActive = d.lastActive ? new Date(d.lastActive * 1000).toLocaleTimeString() : 'N/A';
      const ip = d.ipAddress || '0.0.0.0';
      const queue = d.pendingVotes || '0';
      const ssid = d.ssid || 'Unknown';

      const card = document.createElement('div');
      card.className = 'device-card-row';
      card.innerHTML = `
        <div class="device-info-left">
          <h5>${deviceId}</h5>
          <p>IP: ${ip} | SSID: ${ssid} | Last Telemetry: ${lastActive}</p>
        </div>
        <div style="display:flex; align-items:center; gap: 10px;">
          <span style="font-size:11px; color:var(--text-muted);">Queue: ${queue}</span>
          <span class="device-status-badge ${online ? 'badge-online' : 'badge-offline'}">${online ? 'online' : 'offline'}</span>
        </div>
      `;
      container.appendChild(card);
    });
  }, err => addLogLine('ERROR', `Devices listener failed: ${err.message}`));
}

function incrementTally(role, candidateId) {
  const cand = candidates[role].find(c => c.id === candidateId);
  if (cand) cand.votes++;
}

function getCandidateName(role, id) {
  const cand = candidates[role].find(c => c.id === id);
  return cand ? cand.name : id;
}

// --- ADMIN / SYSTEM HANDLERS ---
function initDashboard() {
  let activePage = localStorage.getItem('vtic_active_page') || 'results';
  if (activePage === 'database') activePage = 'results';
  navigateToPage(activePage);
  switchResultTab('hb');
  renderCandidateFields();
}

function navigateToPage(pageId) {
  localStorage.setItem('vtic_active_page', pageId);
  
  const pages = ['results', 'candidates', 'devices', 'logs'];
  pages.forEach(p => {
    const btn = document.getElementById(`menu-btn-${p}`);
    if (btn) btn.classList.remove('active');
    
    const sec = document.getElementById(`page-${p}`);
    if (sec) sec.classList.remove('active');
  });

  const activeBtn = document.getElementById(`menu-btn-${pageId}`);
  if (activeBtn) activeBtn.classList.add('active');

  const activeSec = document.getElementById(`page-${pageId}`);
  if (activeSec) activeSec.classList.add('active');
  
  addLogLine('INFO', `Navigated to dashboard view: ${pageId.toUpperCase()}`);

  // Automatically dismiss sidebar drawer on mobile after navigation selection
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
  if (overlay && overlay.classList.contains('active')) {
    overlay.classList.remove('active');
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

function changeElectionStatus(state) {
  electionState = state;
  if (isDemoMode) {
    refreshStats();
    addLogLine('INFO', `Status updated locally to: ${state.toUpperCase()}`);
  } else {
    db.collection('election').doc('status').update({ state: state })
      .then(() => addLogLine('INFO', `Status uploaded to Firestore: ${state.toUpperCase()}`))
      .catch(err => addLogLine('ERROR', `Status upload failed: ${err.message}`));
  }
}

// Render inputs in Candidates setup panel
function renderCandidateFields() {
  const container = document.getElementById('candidate-inputs-list');
  if (!container) return;
  container.innerHTML = '';
  
  const list = candidates[activeConfigRole];
  list.forEach((cand, idx) => {
    const div = document.createElement('div');
    div.className = 'candidate-input-row';
    div.innerHTML = `
      <span class="cand-lbl">Cand ${idx + 1}</span>
      <input type="text" class="form-input" id="cfg-name-${idx}" value="${cand.name}">
      <input type="text" class="form-input" id="cfg-class-${idx}" value="${cand.class}">
    `;
    container.appendChild(div);
  });
}

// Save button triggers inside candidate editor
function saveCandidateData() {
  const list = candidates[activeConfigRole];
  list.forEach((cand, idx) => {
    cand.name = document.getElementById(`cfg-name-${idx}`).value || `Candidate ${idx + 1}`;
    cand.class = document.getElementById(`cfg-class-${idx}`).value || '10A';
  });

  if (isDemoMode) {
    updateStandings();
    refreshStats();
    addLogLine('INFO', `Saved candidate config locally for: ${activeConfigRole.toUpperCase()}`);
  } else {
    db.collection('election').doc('candidates').set(candidates)
      .then(() => addLogLine('INFO', `Uploaded config changes to Firestore.`))
      .catch(err => addLogLine('ERROR', `Upload config failed: ${err.message}`));
  }
}

// Switch between Candidate setup role options (HB, HG, SC)
document.getElementById('role-select-input').addEventListener('change', (e) => {
  activeConfigRole = e.target.value;
  renderCandidateFields();
});

// Switch results tab selector (HB, HG, SC)
function switchResultTab(tab) {
  activeResultsTab = tab;
  document.getElementById('tab-hb').className = tab === 'hb' ? 'tab-btn active' : 'tab-btn';
  document.getElementById('tab-hg').className = tab === 'hg' ? 'tab-btn active' : 'tab-btn';
  document.getElementById('tab-sc').className = tab === 'sc' ? 'tab-btn active' : 'tab-btn';
  updateStandings();
}

// Render dynamic standings cards
function updateStandings() {
  const container = document.getElementById('candidate-standings-container');
  container.innerHTML = '';
  
  const list = candidates[activeResultsTab];
  const maxVotes = Math.max(...list.map(c => c.votes));
  const sorted = [...list].sort((a, b) => b.votes - a.votes);
  
  let barClass = 'fill-hb';
  if (activeResultsTab === 'hg') barClass = 'fill-hg';
  if (activeResultsTab === 'sc') barClass = 'fill-sc';

  sorted.forEach(cand => {
    const pct = maxVotes > 0 ? ((cand.votes / maxVotes) * 100).toFixed(0) : 0;
    const isLeader = cand.votes > 0 && cand.votes === maxVotes;
    
    const card = document.createElement('div');
    card.className = `candidate-standing-card ${isLeader ? 'leader' : ''}`;
    card.innerHTML = `
      <div class="candidate-info">
        <div class="cand-name-class">
          <h4>${cand.name}</h4>
          <span>Class: ${cand.class}</span>
        </div>
        <div class="cand-votes-pct">
          <div class="cand-votes">${cand.votes} votes</div>
          <div class="cand-pct">${pct}% of leader</div>
        </div>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill ${barClass}" style="width: ${pct}%"></div>
      </div>
      ${isLeader ? `<div class="trophy-badge">🏆 Leader</div>` : ''}
    `;
    container.appendChild(card);
  });

  updateLeadersMarquee();
}

function updateLeadersMarquee() {
  const getLeaderName = (role) => {
    let max = -1;
    let leader = null;
    candidates[role].forEach(c => {
      if (c.votes > max) {
        max = c.votes;
        leader = c;
      }
    });
    return leader && leader.votes > 0 ? `${leader.name} (${leader.votes})` : 'None';
  };

  const hbLeader = getLeaderName('hb');
  const hgLeader = getLeaderName('hg');
  const scLeader = getLeaderName('sc');

  document.getElementById('leaders-marquee-val').textContent = `HB: ${hbLeader} | HG: ${hgLeader} | SC: ${scLeader}`;
}

function refreshStats() {
  const totalVotes = candidates.hb.reduce((a, b) => a + b.votes, 0);
  document.getElementById('total-votes-val').textContent = totalVotes;
  
  const statusVal = document.getElementById('status-val');
  statusVal.textContent = electionState.charAt(0).toUpperCase() + electionState.slice(1);
  if (electionState === 'running') {
    statusVal.style.color = 'var(--color-green)';
  } else if (electionState === 'paused') {
    statusVal.style.color = 'var(--color-yellow)';
  } else {
    statusVal.style.color = 'var(--color-red)';
  }
}

// Render Device status table in Demo mode
function renderDeviceMonitor() {
  if (!isDemoMode) return; // Managed by Firestore in Live mode

  const container = document.getElementById('device-monitor-container');
  container.innerHTML = `
    <div class="device-card-row">
      <div class="device-info-left">
        <h5>VTIC-VOTING-01</h5>
        <p>IP: 192.168.1.144 | SSID: VTIC-SECURE-WLAN | Last Telemetry: Just Now</p>
      </div>
      <div style="display:flex; align-items:center; gap: 10px;">
        <span style="font-size:11px; color:var(--text-muted);">Queue: 0</span>
        <span class="device-status-badge badge-online">online</span>
      </div>
    </div>
  `;
}

// --- REPORTING EXPORTERS ---
function exportCSVData() {
  let csv = "Timestamp,Device ID,Head Boy,Head Girl,Sports Captain\n";
  auditLog.forEach(row => {
    const date = new Date(row.timestamp).toISOString();
    csv += `"${date}","${row.deviceId}","${row.hb}","${row.hg}","${row.sc}"\n`;
  });
  
  triggerDownload(csv, `vtic_election_audit_log_${Date.now()}.csv`);
  addLogLine('INFO', 'Exported vote audit logs as CSV.');
}

function exportExcelSummary() {
  let csv = "Role Category,Candidate ID,Candidate Name,Class,Votes count\n";
  ['hb', 'hg', 'sc'].forEach(role => {
    const roleName = role === 'hb' ? 'Head Boy' : role === 'hg' ? 'Head Girl' : 'Sports Captain';
    candidates[role].forEach(c => {
      csv += `"${roleName}","${c.id}","${c.name}","${c.class}",${c.votes}\n`;
    });
  });

  triggerDownload(csv, `vtic_election_results_${Date.now()}.csv`);
  addLogLine('INFO', 'Exported election totals summaries.');
}

function triggerDownload(content, filename) {
  const encoded = encodeURI("data:text/csv;charset=utf-8," + content);
  const link = document.createElement("a");
  link.setAttribute("href", encoded);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateWinnersCertificate() {
  const getLeader = (role) => {
    let max = -1;
    let leader = null;
    candidates[role].forEach(c => {
      if (c.votes > max) {
        max = c.votes;
        leader = c;
      }
    });
    return leader && leader.votes > 0 ? `${leader.name} (${leader.class}) - ${leader.votes} Votes` : 'No Votes Recorded';
  };

  document.getElementById('cert-winner-hb').textContent = getLeader('hb');
  document.getElementById('cert-winner-hg').textContent = getLeader('hg');
  document.getElementById('cert-winner-sc').textContent = getLeader('sc');
  document.getElementById('cert-date').textContent = new Date().toLocaleDateString();

  const container = document.getElementById('print-certificate-container');
  container.style.display = 'block';
  
  window.print();
  
  setTimeout(() => {
    container.style.display = 'none';
  }, 1000);
  
  addLogLine('INFO', 'Generated print cert for winners.');
}

// --- AUTHENTICATION HANDLERS ---
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorMsgDiv = document.getElementById('login-error-msg');
  
  errorMsgDiv.style.display = 'none';
  
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(err => {
      console.error("Login failed:", err);
      errorMsgDiv.textContent = `Login failed: ${err.message}`;
      errorMsgDiv.style.display = 'block';
    });
}

function handleGoogleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const errorMsgDiv = document.getElementById('login-error-msg');
  errorMsgDiv.style.display = 'none';
  
  firebase.auth().signInWithPopup(provider)
    .catch(err => {
      console.error("Google sign in failed:", err);
      errorMsgDiv.textContent = `Google sign in failed: ${err.message}`;
      errorMsgDiv.style.display = 'block';
    });
}

function handleSignOut() {
  firebase.auth().signOut()
    .then(() => {
      addLogLine('INFO', 'Admin signed out successfully.');
      window.location.reload();
    })
    .catch(err => {
      console.error("Sign out failed:", err);
      addLogLine('ERROR', `Sign out failed: ${err.message}`);
    });
}
