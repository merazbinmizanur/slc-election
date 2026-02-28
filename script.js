/* --- START OF FILE script.js --- */

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAaQykg-W2vxI6gnClCPdusj5NyE_RMpEo",
    authDomain: "slc-election.firebaseapp.com",
    projectId: "slc-election",
    storageBucket: "slc-election.firebasestorage.app",
    messagingSenderId: "536346306810",
    appId: "1:536346306810:web:f0cea5355037f6b073c143"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Constants
// ===== PREMIUM FOOTBALL / ESPORTS SYMBOLS =====
// All icons are valid in Lucide – football, whistle, and others are included.
const ALL_SYMBOLS = [
    // ⚽ Football Core
    "goal", // scoring
    "shirt", // team jersey
    "flag", // corner flag
    "shield", // defense
    "target", // accuracy / shooting
    
    // 🏆 Awards & Victory
    "trophy", // champion
    "medal", // winner
    "award", // recognition
    "crown", // king of the game
    "star", // top player
    "gem", // valuable asset
    "flame", // on fire
    "zap", // speed / power
    
    // 🎮 eSports & Gaming
    "gamepad", // modern controller
    "joystick", // classic arcade
    "monitor", // gaming screen
    "cpu", // processing power
    "radio", // team communication
    "mic", // shoutcasting
    "speaker", // crowd audio
    "camera", // streaming / replay
    
    // 📊 Strategy & Team
    "map", // tactics / formation
    "compass", // direction / positioning
];
// Added AWAY MANAGER to positions
const POSITIONS = ["President", "Vice-President", "Tournament Manager", "Recruitment Manager", "Disciplinary Manager", "Player Affairs Manager"];

// Global state
let currentID = null;
let currentName = null;
let currentRole = null; 
let currentCandidateData = null;
let selectedVotes = {};
let selectedSymbol = "";
let countdownInterval = null;

// Preview state for zoom/pan
let previewScale = 1;
let previewX = 0;
let previewY = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// Init
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    listenToGlobalSettings();
    listenToVotingPeriod();
});

// ---------- UTILITIES ----------
function switchView(id) {
    document.querySelectorAll('section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`view-${id}`);
    if(target) {
        target.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
    if (id === 'candidate-reg') {
        refreshSymbols();
        renderPositionGrid();
        selectedSymbol = ""; // Reset selected symbol
    }
}

function notify(msg, icon = 'info') {
    const toast = document.getElementById('custom-toast');
    document.getElementById('toast-message').innerText = msg;
    document.getElementById('toast-icon').setAttribute('data-lucide', icon);
    toast.classList.remove('hidden');
    lucide.createIcons();
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function generateElectionID() {
    const num = Math.floor(1000 + Math.random() * 9000);
    const char = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `SLC${num}${char}`;
}

function isValidFacebookUrl(url) {
    return url.trim().startsWith('https://www.facebook.com/');
}

function copyID() {
    const id = document.getElementById('generated-id-display').innerText;
    navigator.clipboard.writeText(id).then(() => notify("ID copied!", "copy"));
}

function copyDashboardID() {
    if(currentID) {
        navigator.clipboard.writeText(currentID).then(() => notify("ID copied!", "copy"));
    }
}

function logout() {
    currentID = null;
    currentName = null;
    currentRole = null;
    currentCandidateData = null;
    selectedVotes = {};
    if (countdownInterval) clearInterval(countdownInterval);
    switchView('landing');
}

// ---------- SYMBOL GRID ----------
async function refreshSymbols() {
    const grid = document.getElementById('symbolGrid');
    grid.innerHTML = `<div class="col-span-5 text-center text-xs text-slate-500 py-4">Loading...</div>`;
    try {
        const snap = await db.collection("candidates").get();
        const takenSymbols = snap.docs.map(doc => doc.data().symbol);
        const available = ALL_SYMBOLS.filter(s => !takenSymbols.includes(s));
        grid.innerHTML = available.map(s => `
            <div class="symbol-item group" onclick="selectSymbol('${s}', this)">
                <i data-lucide="${s}" class="w-5 h-5 text-slate-500 group-hover:text-white transition-colors"></i>
                <span class="text-[0.6rem] font-bold uppercase">${s}</span>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (e) {
        grid.innerHTML = `<div class="col-span-5 text-rose-500 text-xs">Error loading symbols</div>`;
    }
}
// Render position cards (similar to symbol grid)
function renderPositionGrid() {
    const grid = document.getElementById('position-grid');
    if (!grid) return;
    
    grid.innerHTML = POSITIONS.map(pos => `
        <div class="position-card group" onclick="selectPosition('${pos}', this)">
            <span class="text-sm font-black text-slate-300 group-hover:text-white transition-colors">${pos}</span>
        </div>
    `).join('');
    
    // Clear any previous selection
    document.getElementById('selectedPosition').value = '';
}

// Handle position selection
function selectPosition(pos, element) {
    // Remove 'selected' class from all cards
    document.querySelectorAll('.position-card').forEach(card => card.classList.remove('selected'));
    // Add 'selected' class to clicked card
    element.classList.add('selected');
    // Store the selected position in hidden input
    document.getElementById('selectedPosition').value = pos;
}

function selectSymbol(s, el) {
    selectedSymbol = s;
    document.querySelectorAll('.symbol-item').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
}

// ---------- VOTER REGISTRATION ----------
async function registerVoter() {
    const name = document.getElementById('voterName').value.trim();
    const link = document.getElementById('voterLink').value.trim();

    if (!name) return notify("Please enter your full Facebook name", "alert-circle");
    if (!link) return notify("Facebook profile link is required", "alert-circle");
    if (!isValidFacebookUrl(link)) return notify("Invalid Facebook URL", "alert-circle");

    const existing = await db.collection("voters").where("link", "==", link).get();
    if (!existing.empty) {
        notify("Account already registered. Please login.", "info");
        return;
    }

    const newID = generateElectionID();
    try {
        await db.collection("voters").doc(newID).set({
            name, link, role: "voter", hasVoted: false, timestamp: Date.now()
        });
        currentID = newID;
        currentName = name;
        currentRole = 'voter';
        document.getElementById('generated-id-display').innerText = newID;
        document.getElementById('displayName').innerText = name;
        document.getElementById('id-next-btn').innerText = 'Go to Dashboard';
        switchView('id-display');
    } catch (e) {
        notify("Registration failed. Try again.", "alert-circle");
    }
}

// ---------- VOTER LOGIN ----------
async function voterLogin() {
    const id = document.getElementById('voterLoginID').value.trim().toUpperCase();
    if (!id) return notify("Enter your Election ID", "alert-circle");

    try {
        const doc = await db.collection("voters").doc(id).get();
        if (!doc.exists) return notify("ID not found.", "alert-circle");
        const data = doc.data();
        if (data.role !== 'voter') return notify("Use candidate login.", "alert-circle");

        currentID = id;
        currentName = data.name;
        currentRole = 'voter';
        await loadVoterDashboard();
        switchView('voter-dashboard');
    } catch (e) {
        notify("Login error.", "alert-circle");
    }
}

// ---------- VOTER DASHBOARD ----------
async function loadVoterDashboard() {
    document.getElementById('voter-dashboard-name').innerText = currentName;
    document.getElementById('voter-dashboard-id-display').innerText = currentID;

    db.collection("settings").doc("global").onSnapshot((doc) => {
        if (doc.exists) {
            document.getElementById('voter-dashboard-votes').innerText = doc.data().totalVotesCast || 0;
        }
    });

    loadVotingPeriodForVoter();

    const globalDoc = await db.collection("settings").doc("global").get();
    if (globalDoc.exists && globalDoc.data().resultsRevealed) {
        showVoterResults();
    }
}

async function loadVotingPeriodForVoter() {
    const settingsDoc = await db.collection("settings").doc("global").get();
    if (!settingsDoc.exists) return;

    const data = settingsDoc.data();
    const start = data.votingStart ? new Date(data.votingStart) : null;
    const end = data.votingEnd ? new Date(data.votingEnd) : null;
    const now = new Date();

    updateCountdown(start, end, now);
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => updateCountdown(start, end, new Date()), 1000);
}

function updateCountdown(start, end, now) {
    const timerEl = document.getElementById('countdown-timer');
    const labelEl = document.getElementById('countdown-label');
    const actionArea = document.getElementById('voter-action-area');
    
    if(!timerEl || !labelEl || !actionArea) return; 

    if (!start || !end) {
        timerEl.innerText = '-- : -- : --';
        labelEl.innerText = 'Voting period not set';
        actionArea.innerHTML = '';
        return;
    }

    if (now < start) {
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        timerEl.innerText = `${days}d ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        labelEl.innerText = 'Voting starts in';
        if(actionArea.innerHTML.indexOf("Voting not yet started") === -1) {
             actionArea.innerHTML = `<p class="text-sm text-slate-400">Voting not yet started</p>`;
        }
    } else if (now >= start && now <= end) {
        const diff = end - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        timerEl.innerText = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        labelEl.innerText = 'Voting ends in';
        if(actionArea.innerHTML.indexOf("enterBooth") === -1) {
            actionArea.innerHTML = `<button onclick="enterBooth()" class="w-full py-4 bg-emerald-600 text-white text-xs font-black rounded-2xl uppercase tracking-[0.2em] shadow-lg shadow-emerald-900/30 hover:scale-[1.02] transition-transform">Go to Voting Booth</button>`;
        }
    } else if (now > end) {
        timerEl.innerText = '00:00:00';
        labelEl.innerText = 'Voting ended';
         if(actionArea.innerHTML.indexOf("Voting period has ended") === -1) {
            actionArea.innerHTML = `<p class="text-sm text-slate-400">Voting period has ended</p>`;
         }
    }
}

async function showVoterResults() {
    const area = document.getElementById('voter-results-area');
    if(area) area.classList.remove('hidden');
    
    const list = document.getElementById('voter-winners-list');
    const snap = await db.collection("candidates").get();
    const cands = snap.docs.map(d => d.data());
    let html = "";
    POSITIONS.forEach(pos => {
        const sorted = cands.filter(c => c.position === pos).sort((a,b) => b.voteCount - a.voteCount);
        if (sorted.length === 0) return;
        const winner = sorted[0];
        html += `
            <div class="winner-card">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full border-2 border-gold-500 p-1"><img src="${winner.image}" class="w-full h-full rounded-full object-cover"></div>
                    <div class="flex-1">
                        <span class="text-[10px] font-black text-gold-500 uppercase tracking-widest bg-gold-500/10 px-2 py-0.5 rounded-full">${winner.position}</span>
                        <h3 class="text-lg font-black text-white uppercase mt-1">${winner.name}</h3>
                    </div>
                    <div class="text-right">
                        <p class="text-3xl font-black text-emerald-400">${winner.voteCount}</p>
                        <p class="text-[8px] text-slate-500 font-bold uppercase">votes</p>
                    </div>
                </div>
            </div>`;
    });
    if(list) list.innerHTML = html;
}

// ---------- CANDIDATE REGISTRATION ----------
async function registerCandidate() {
    const name = document.getElementById('candName').value.trim();
    const fbLink = document.getElementById('candFbLink').value.trim();
    const image = document.getElementById('candImage').value.trim();
    const role = document.getElementById('selectedPosition').value;
if (!role) return notify("Please select a position", "alert-circle");

    if (!name) return notify("Please enter full Facebook name", "alert-circle");
    if (!fbLink) return notify("Facebook profile link is required", "alert-circle");
    if (!isValidFacebookUrl(fbLink)) return notify("Invalid Facebook URL", "alert-circle");
    if (!image) return notify("Please paste the direct photo link", "alert-circle");
    if (!selectedSymbol) return notify("Please select a symbol", "alert-circle");

    const existing = await db.collection("voters").where("link", "==", fbLink).get();
    if (!existing.empty) {
        notify("Account already registered.", "alert-circle");
        return;
    }

    const check = await db.collection("candidates").where("symbol", "==", selectedSymbol).get();
    if (!check.empty) return notify("Symbol just taken! Pick another.", "alert-circle");

    const newID = generateElectionID();
    try {
        const batch = db.batch();
        batch.set(db.collection("candidates").doc(), {
            name, image, position: role, symbol: selectedSymbol, voteCount: 0
        });
        batch.set(db.collection("voters").doc(newID), {
            name, link: fbLink, role: "candidate", hasVoted: false, timestamp: Date.now()
        });
        await batch.commit();

        currentID = newID;
        currentName = name;
        currentRole = 'candidate';
        currentCandidateData = { name, image, position: role, symbol: selectedSymbol };
        document.getElementById('generated-id-display').innerText = newID;
        document.getElementById('displayName').innerText = name;
        document.getElementById('id-next-btn').innerText = 'Go to Dashboard';
        switchView('id-display');
    } catch (e) {
        notify("Registration failed.", "alert-circle");
    }
}

// ---------- CANDIDATE LOGIN ----------
async function candidateLogin() {
    const id = document.getElementById('candidateLoginID').value.trim().toUpperCase();
    if (!id) return notify("Enter your Election ID", "alert-circle");

    try {
        const doc = await db.collection("voters").doc(id).get();
        if (!doc.exists) return notify("ID not found.", "alert-circle");
        const data = doc.data();
        if (data.role !== 'candidate') return notify("Use voter login.", "alert-circle");

        const candidatesSnap = await db.collection("candidates").where("name", "==", data.name).get();
        let candidateData = null;
        candidatesSnap.forEach(doc => { candidateData = { id: doc.id, ...doc.data() }; });

        if (!candidateData) return notify("Candidate record not found.", "alert-circle");

        currentID = id;
        currentName = data.name;
        currentRole = 'candidate';
        currentCandidateData = candidateData;
        await loadCandidateDashboard();
        switchView('candidate-dashboard');
    } catch (e) {
        notify("Login error.", "alert-circle");
    }
}

// ---------- CANDIDATE DASHBOARD ----------
async function loadCandidateDashboard() {
    document.getElementById('candidate-dashboard-name').innerText = currentName;
    document.getElementById('candidate-dashboard-id').querySelector('span').innerText = currentID;
    
    // Listen to total votes
    db.collection("settings").doc("global").onSnapshot((doc) => {
        if (doc.exists) {
            document.getElementById('candidate-dashboard-votes').innerText = doc.data().totalVotesCast || 0;
        }
    });
    
    // Load voting period and listen for changes
    loadVotingPeriodForCandidate();
    db.collection("settings").doc("global").onSnapshot(() => {
        // Only reload if candidate dashboard is visible
        if (document.getElementById('view-candidate-dashboard') && !document.getElementById('view-candidate-dashboard').classList.contains('hidden')) {
            loadVotingPeriodForCandidate();
        }
    });
}

// ---------- CARD UPDATE LOGIC ----------
function updateNominationCard() {
    if (!currentCandidateData) return;
    
    const nameEl = document.getElementById('card-cand-name');
    nameEl.innerText = currentCandidateData.name;
    nameEl.className = "font-black text-white uppercase tracking-tighter drop-shadow-lg leading-none mb-2";
    
    if (currentCandidateData.name.length > 15) {
        nameEl.classList.add('text-2xl');
    } else if (currentCandidateData.name.length > 10) {
        nameEl.classList.add('text-3xl');
    } else {
        nameEl.classList.add('text-4xl');
    }
    
    document.getElementById('card-cand-role').innerText = currentCandidateData.position;
    
    const imgEl = document.getElementById('card-cand-img');
    imgEl.src = currentCandidateData.image;
    
    document.getElementById('card-cand-symbol-text').innerText = currentCandidateData.symbol.toUpperCase();
    document.getElementById('card-cand-symbol-icon').innerHTML = `<i data-lucide="${currentCandidateData.symbol}" class="w-full h-full text-gold-400"></i>`;
    lucide.createIcons();
}

// ---------- ENHANCED PREVIEW with ZOOM & PAN ----------
function previewNominationCard() {
    if (!currentCandidateData) return;
    
    updateNominationCard();
    
    const container = document.getElementById('preview-card-container');
    container.innerHTML = '';
    
    const original = document.getElementById('nomination-card');
    const clone = original.cloneNode(true);
    clone.id = 'preview-card';
    
    // Reset preview state
    previewScale = 1;
    previewX = 0;
    previewY = 0;
    updatePreviewTransform();
    
    container.appendChild(clone);
    
    // Set up drag events
    const wrapper = document.getElementById('preview-card-wrapper');
    wrapper.style.cursor = 'grab';
    
    // Remove old listeners to avoid duplicates
    wrapper.removeEventListener('mousedown', startDrag);
    wrapper.removeEventListener('touchstart', startDragTouch);
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('touchmove', onDragTouch);
    window.removeEventListener('touchend', stopDrag);
    
    wrapper.addEventListener('mousedown', startDrag);
    wrapper.addEventListener('touchstart', startDragTouch);
    
    lucide.createIcons();
    openModal('modal-preview-card');
}

function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    dragStart.x = e.clientX - previewX;
    dragStart.y = e.clientY - previewY;
    document.getElementById('preview-card-wrapper').style.cursor = 'grabbing';
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
}

function startDragTouch(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        isDragging = true;
        dragStart.x = e.touches[0].clientX - previewX;
        dragStart.y = e.touches[0].clientY - previewY;
        document.getElementById('preview-card-wrapper').style.cursor = 'grabbing';
        window.addEventListener('touchmove', onDragTouch, { passive: false });
        window.addEventListener('touchend', stopDrag);
    }
}

function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    previewX = e.clientX - dragStart.x;
    previewY = e.clientY - dragStart.y;
    updatePreviewTransform();
}

function onDragTouch(e) {
    if (!isDragging) return;
    e.preventDefault();
    if (e.touches.length === 1) {
        previewX = e.touches[0].clientX - dragStart.x;
        previewY = e.touches[0].clientY - dragStart.y;
        updatePreviewTransform();
    }
}

function stopDrag() {
    isDragging = false;
    document.getElementById('preview-card-wrapper').style.cursor = 'grab';
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('touchmove', onDragTouch);
    window.removeEventListener('touchend', stopDrag);
}

function previewZoomIn() {
    previewScale = Math.min(previewScale + 0.25, 3);
    updatePreviewTransform();
}

function previewZoomOut() {
    previewScale = Math.max(previewScale - 0.25, 0.5);
    updatePreviewTransform();
}

function previewReset() {
    previewScale = 1;
    previewX = 0;
    previewY = 0;
    updatePreviewTransform();
}

function updatePreviewTransform() {
    const wrapper = document.getElementById('preview-card-wrapper');
    if (wrapper) {
        wrapper.style.transform = `scale(${previewScale}) translate(${previewX}px, ${previewY}px)`;
    }
}

// ---------- AFTER REGISTRATION ----------
function handleIDNext() {
    if (currentRole === 'voter') {
        loadVoterDashboard();
        switchView('voter-dashboard');
    } else if (currentRole === 'candidate') {
        loadCandidateDashboard();
        switchView('candidate-dashboard');
    }
}

// ---------- VOTING BOOTH ----------
async function enterBooth() {
    if (!currentID) return switchView('landing');
    document.getElementById('booth-user-name').innerText = currentName;
    document.getElementById('modal-current-id').innerText = currentID;

    const container = document.getElementById('ballot-container');
    container.innerHTML = `<div class="text-center py-20"><i data-lucide="loader" class="w-8 h-8 text-emerald-500 animate-spin mx-auto"></i></div>`;
    lucide.createIcons();

    const snap = await db.collection("candidates").get();
    const candidates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let html = "";
    POSITIONS.forEach(pos => {
        const cands = candidates.filter(c => c.position === pos);
        if (cands.length === 0) return;
        html += `
            <div class="mb-8">
                <div class="flex items-center gap-4 mb-4">
                    <div class="h-[1px] flex-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                    <span class="text-sm font-black uppercase text-emerald-400 tracking-[0.2em]">${pos}</span>
                    <div class="h-[1px] flex-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                </div>
                <div class="grid gap-4">
        `;
        cands.forEach(c => {
            html += `
                <label class="block relative group">
                    <input type="radio" name="${pos.replace(/\s/g,'_')}" value="${c.id}" class="peer hidden ballot-radio" onchange="trackVote('${pos}', '${c.id}')">
                    <div class="ballot-card bg-slate-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4 transition-all">
                        <div class="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0">
                            <img src="${c.image}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/100/0f172a/ffffff?text=${c.name[0]}'">
                        </div>
                        <div class="flex-1">
                            <h4 class="text-base font-black text-white uppercase">${c.name}</h4>
                            <div class="flex items-center gap-2 mt-1">
                                <i data-lucide="${c.symbol}" class="w-4 h-4 text-gold-500"></i>
                                <span class="text-[10px] font-bold text-slate-400 uppercase">${c.symbol}</span>
                            </div>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center opacity-0 scale-50 transition-all check-icon">
                            <i data-lucide="check" class="w-5 h-5 text-white"></i>
                        </div>
                    </div>
                </label>`;
        });
        html += `</div></div>`;
    });
    container.innerHTML = html;
    lucide.createIcons();
    switchView('booth');
}

function trackVote(pos, id) { selectedVotes[pos] = id; }

function openVoteConfirmModal() {
    if (Object.keys(selectedVotes).length !== POSITIONS.filter(p => document.querySelector(`input[name="${p.replace(/\s/g,'_')}"]`)).length) {
        return notify("Please select a candidate for every position", "alert-circle");
    }
    document.getElementById('confirmID').value = '';
    openModal('modal-confirm-vote');
}

async function submitFinalVote() {
    const inputID = document.getElementById('confirmID').value.trim().replace(/\s/g, '').toUpperCase();
    if (inputID !== currentID) return notify("Incorrect ID. Please try again.", "lock");

    const btn = document.getElementById('btn-final-cast');
    btn.innerHTML = "Processing...";
    btn.disabled = true;

    const voterRef = db.collection("voters").doc(currentID);
    const globalRef = db.collection("settings").doc("global");

    try {
        await db.runTransaction(async (t) => {
            const vDoc = await t.get(voterRef);
            if (!vDoc.exists) throw "Invalid ID";
            if (vDoc.data().hasVoted) throw "Already Voted";

            t.update(voterRef, { hasVoted: true, timestamp: Date.now() });
            t.set(globalRef, { totalVotesCast: firebase.firestore.FieldValue.increment(1) }, { merge: true });

            for (let pos in selectedVotes) {
                t.update(db.collection("candidates").doc(selectedVotes[pos]), {
                    voteCount: firebase.firestore.FieldValue.increment(1)
                });
            }
        });

        closeModal('modal-confirm-vote');
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#ffffff'] });
        notify("Vote successfully cast!", "check-circle");
setTimeout(() => {
    if (currentRole === 'voter') {
        loadVoterDashboard();
        switchView('voter-dashboard');
    } else if (currentRole === 'candidate') {
        loadCandidateDashboard();
        switchView('candidate-dashboard');
    }
}, 2000);
        selectedVotes = {};
    } catch (e) {
        btn.innerHTML = "Verify & Cast";
        btn.disabled = false;
        notify(e === "Already Voted" ? "You have already voted!" : "Submission error.", "alert-circle");
    }
}

// ---------- PUBLIC DASHBOARD ----------
function listenToGlobalSettings() {
    db.collection("settings").doc("global").onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            const count = data.totalVotesCast || 0;
            document.getElementById('mini-counter').innerText = `${count} Votes Cast`;
            document.getElementById('dashboard-total-votes').innerText = count;
            if (data.resultsRevealed) {
                document.getElementById('election-status-indicator').innerText = "RESULTS PUBLISHED";
                document.getElementById('election-status-indicator').classList.add('text-emerald-400');
                showPublicResults();
            }
        }
    });
}

async function showPublicResults() {
    document.getElementById('results-locked-msg').classList.add('hidden');
    document.getElementById('results-area').classList.remove('hidden');
    const list = document.getElementById('winners-list');
    const snap = await db.collection("candidates").get();
    const cands = snap.docs.map(d => d.data());
    let html = "";
    POSITIONS.forEach(pos => {
        const sorted = cands.filter(c => c.position === pos).sort((a,b) => b.voteCount - a.voteCount);
        if (sorted.length === 0) return;
        const winner = sorted[0];
        html += `
            <div class="winner-card">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full border-2 border-gold-500 p-1"><img src="${winner.image}" class="w-full h-full rounded-full object-cover"></div>
                    <div class="flex-1">
                        <span class="text-[10px] font-black text-gold-500 uppercase tracking-widest bg-gold-500/10 px-2 py-0.5 rounded-full">${winner.position}</span>
                        <h3 class="text-lg font-black text-white uppercase mt-1">${winner.name}</h3>
                    </div>
                    <div class="text-right">
                        <p class="text-3xl font-black text-emerald-400">${winner.voteCount}</p>
                        <p class="text-[8px] text-slate-500 font-bold uppercase">votes</p>
                    </div>
                </div>
            </div>`;
    });
    list.innerHTML = html;
}

// ---------- ADMIN FUNCTIONS ----------
function openAdminLogin() {
    document.getElementById('admin-login-view').classList.remove('hidden');
    document.getElementById('admin-dashboard-view').classList.add('hidden');
    document.getElementById('adminKey').value = '';
    openModal('modal-admin');
}

function verifyAdmin() {
    const key = document.getElementById('adminKey').value;
    if (key === '00110011') {
        document.getElementById('admin-login-view').classList.add('hidden');
        document.getElementById('admin-dashboard-view').classList.remove('hidden');
        loadAdminData();
        loadAdminVotingPeriod();
    } else {
        notify("Access Denied", "lock");
    }
}

async function loadAdminData() {
    const globalDoc = await db.collection("settings").doc("global").get();
    const totalVotes = globalDoc.exists ? globalDoc.data().totalVotesCast || 0 : 0;
    document.getElementById('admin-total-votes').innerText = totalVotes;

    const snap = await db.collection("candidates").get();
    const candidates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const sorted = candidates.sort((a, b) => b.voteCount - a.voteCount);
    
    document.getElementById('admin-candidate-list').innerHTML = sorted.map(c => `
        <div class="flex justify-between items-center py-2 border-b border-white/5">
            <div>
                <span class="font-bold text-white">${c.name}</span>
                <span class="text-[9px] text-slate-500 block">${c.position}</span>
            </div>
            <span class="text-lg font-black text-emerald-400">${c.voteCount}</span>
        </div>
    `).join('');
}

async function loadAdminVotingPeriod() {
    const globalDoc = await db.collection("settings").doc("global").get();
    if (globalDoc.exists) {
        const data = globalDoc.data();
        if (data.votingStart) document.getElementById('votingStart').value = data.votingStart.slice(0,16);
        if (data.votingEnd) document.getElementById('votingEnd').value = data.votingEnd.slice(0,16);
    }
}

function saveVotingPeriod() {
    const start = document.getElementById('votingStart').value;
    const end = document.getElementById('votingEnd').value;
    if (!start || !end) return notify("Set start and end times", "alert-circle");

    db.collection("settings").doc("global").set({
        votingStart: start, votingEnd: end
    }, { merge: true }).then(() => notify("Period saved!", "check-circle"));
}

function revealResults() {
    db.collection("settings").doc("global").set({ resultsRevealed: true }, { merge: true });
    notify("Results Public!", "check-circle");
    closeModal('modal-admin');
}

async function downloadResultsImage() {
    const snap = await db.collection("candidates").get();
    const candidates = snap.docs.map(doc => doc.data());
    const sorted = candidates.sort((a, b) => b.voteCount - a.voteCount);
    
    document.getElementById('export-candidates').innerHTML = sorted.map(c => `
        <div class="flex items-center gap-3 bg-slate-900 p-3 rounded-xl">
            <img src="${c.image}" class="w-10 h-10 rounded-full object-cover border border-gold-500" onerror="this.src='https://via.placeholder.com/40/0f172a/gold?text=${c.name[0]}'">
            <div class="flex-1">
                <p class="text-sm font-black text-white">${c.name}</p>
                <p class="text-[8px] text-gold-400 uppercase">${c.position}</p>
            </div>
            <div class="text-right">
                <span class="text-xl font-black text-emerald-400">${c.voteCount}</span>
                <p class="text-[7px] text-slate-500">votes</p>
            </div>
        </div>
    `).join('');

    const card = document.getElementById('export-card');
    card.classList.remove('hidden');
    
    setTimeout(() => {
        html2canvas(card, { scale: 2, backgroundColor: "#020617", useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = `SLC-Results-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
            card.classList.add('hidden');
            notify("Image downloaded", "check-circle");
        });
    }, 500);
}

function listenToVotingPeriod() {
    db.collection("settings").doc("global").onSnapshot(() => {
        const dash = document.getElementById('view-voter-dashboard');
        if (currentRole === 'voter' && dash && !dash.classList.contains('hidden')) {
            loadVotingPeriodForVoter();
        }
    });
}

function toggleSection(section) {
    const options = document.getElementById(`${section}-options`);
    const chevron = document.getElementById(`${section}-chevron`);
    if(!options || !chevron) return;

    if (options.classList.contains('hidden')) {
        if (section === 'voter') {
            document.getElementById('candidate-options')?.classList.add('hidden');
            const candChevron = document.getElementById('candidate-chevron');
            if(candChevron) candChevron.style.transform = 'rotate(0deg)';
        } else {
            document.getElementById('voter-options')?.classList.add('hidden');
            const voteChevron = document.getElementById('voter-chevron');
            if(voteChevron) voteChevron.style.transform = 'rotate(0deg)';
        }
        options.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)';
    } else {
        options.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)';
    }
    lucide.createIcons();
}

// Load voting period for candidate dashboard
async function loadVotingPeriodForCandidate() {
    const settingsDoc = await db.collection("settings").doc("global").get();
    if (!settingsDoc.exists) return;
    
    const data = settingsDoc.data();
    const start = data.votingStart ? new Date(data.votingStart) : null;
    const end = data.votingEnd ? new Date(data.votingEnd) : null;
    const now = new Date();
    
    updateCandidateCountdown(start, end, now);
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => updateCandidateCountdown(start, end, new Date()), 1000);
}

// Update candidate countdown display
function updateCandidateCountdown(start, end, now) {
    const timerEl = document.getElementById('candidate-countdown-timer');
    const labelEl = document.getElementById('candidate-countdown-label');
    const actionArea = document.getElementById('candidate-action-area');
    
    if (!timerEl || !labelEl || !actionArea) return;
    
    if (!start || !end) {
        timerEl.innerText = '-- : -- : --';
        labelEl.innerText = 'Voting period not set';
        actionArea.innerHTML = '';
        return;
    }
    
    if (now < start) {
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        timerEl.innerText = `${days}d ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        labelEl.innerText = 'Voting starts in';
        if (actionArea.innerHTML.indexOf("Voting not yet started") === -1) {
            actionArea.innerHTML = `<p class="text-sm text-slate-400">Voting not yet started</p>`;
        }
    } else if (now >= start && now <= end) {
        const diff = end - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        timerEl.innerText = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        labelEl.innerText = 'Voting ends in';
        if (actionArea.innerHTML.indexOf("enterBooth") === -1) {
            actionArea.innerHTML = `<button onclick="enterBooth()" class="w-full py-4 bg-emerald-600 text-white text-xs font-black rounded-2xl uppercase tracking-[0.2em] shadow-lg shadow-emerald-900/30 hover:scale-[1.02] transition-transform">Go to Voting Booth</button>`;
        }
    } else if (now > end) {
        timerEl.innerText = '00:00:00';
        labelEl.innerText = 'Voting ended';
        if (actionArea.innerHTML.indexOf("Voting period has ended") === -1) {
            actionArea.innerHTML = `<p class="text-sm text-slate-400">Voting period has ended</p>`;
        }
    }
}
