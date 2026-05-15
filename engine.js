/**
 * KineSync Compute Engine v2.0
 * Browser-first implementation for preconfigured matches.
 */

const CONFIG = {
    PLAYER_MAX_HR: 198,
    FATIGUE_THRESHOLD: 0.90,
    SKILL_THRESHOLD: 0.80,
    EVENT_IMPACT: {
        'Shot': 17,
        'Dribble': 15,
        'Ball Recovery': 13,
        'Clearance': 11,
        'Pass': 9
    },
    PERIOD_OFFSETS: {
        1: 0,
        2: 15 * 60,
        3: 20 * 60,
        4: 22 * 60,
        5: 27 * 60
    }
};

const MATCH_CONFIG = {
    arg_vs_fra: {
        label: 'Argentina vs France (World Cup Final)',
        eventsPath: 'https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/3869685.json',
        supported: true
    },
    fra_vs_mor: {
        label: 'France vs Morocco (Semi-Final)',
        eventsPath: 'match_data/fra_vs_mor/statsbomb/events/xxxxxxxx.json',
        supported: false,
        note: 'Match data not yet committed to the repo'
    }
};

let state = {
    match: null,
    player: null,
    rawEvents: [],
    filteredEvents: [],
    biometricData: [],
    hudlXml: '',
    hudlClipCount: 0
};

const matchSelect = document.getElementById('match-select');
const playerSelect = document.getElementById('player-select');
const btnGenerate = document.getElementById('btn-generate');
const btnExport = document.getElementById('btn-export');

const matchStatus = document.getElementById('match-status');
const playerStatus = document.getElementById('player-status');
const simStatus = document.getElementById('sim-status');
const exportStatus = document.getElementById('export-status');

const matchDataSummary = document.getElementById('match-data-summary');
const playerDataSummary = document.getElementById('player-data-summary');
const biometricsInfo = document.getElementById('biometric-info');
const biometricText = document.getElementById('biometric-text');
const hudlSummary = document.getElementById('hudl-summary');
const hudlText = document.getElementById('hudl-text');

function randomNormal(mean = 0, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
}

function updateStatus(el, message, type = 'success') {
    el.textContent = message;
    el.className = `status ${type}`;
}

function logAction(message, type = 'info') {
    const logBox = document.getElementById('action-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

function unlockStep(stepId) {
    const step = document.getElementById(stepId);
    step.classList.remove('locked');
    step.classList.add('active');
}

function renderMatchDataPanel() {
    if (!state.match) {
        matchDataSummary.innerHTML = '<p>No match selected.</p>';
        return;
    }
    const matchConfig = MATCH_CONFIG[state.match];
    const matchName = matchConfig.label;
    const totalEvents = state.rawEvents.length;
    const eventTypes = state.rawEvents.reduce((acc, event) => {
        const type = event.type?.name;
        if (type && CONFIG.EVENT_IMPACT[type]) {
            acc[type] = (acc[type] || 0) + 1;
        }
        return acc;
    }, {});

    const rawUrl = matchConfig.eventsPath;

    matchDataSummary.innerHTML = `
        <p><strong>Selected match:</strong> ${matchName}</p>
        <p><strong>Total events in dataset:</strong> ${totalEvents}</p>
        <div class="summary-grid">
            <div><strong>By action type</strong></div>
            <div>${['Pass','Dribble','Shot','Ball Recovery','Clearance'].map(type => `<div>${type}: ${eventTypes[type] || 0}</div>`).join('')}</div>
        </div>
        <p class="muted">Source: <a href="${rawUrl}" target="_blank" style="color: var(--primary); text-decoration: underline;">View Raw StatsBomb JSON on GitHub</a></p>
    `;
}

function renderPlayerDataPanel() {
    if (!state.player) {
        playerDataSummary.innerHTML = '<p>No player selected.</p>';
        return;
    }
    const totalEvents = state.filteredEvents.length;
    const eventTypes = state.filteredEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        acc[event.outcome] = (acc[event.outcome] || 0) + 1;
        return acc;
    }, {});

    const matchConfig = MATCH_CONFIG[state.match];
    const rawUrl = matchConfig.eventsPath;

    playerDataSummary.innerHTML = `
        <p><strong>Selected player:</strong> ${state.player}</p>
        <p><strong>Total technical actions:</strong> ${totalEvents}</p>
        <div class="summary-grid">
            <div><strong>By action type</strong></div>
            <div>${['Pass','Dribble','Shot','Ball Recovery','Clearance'].map(type => `<div>${type}: ${eventTypes[type] || 0}</div>`).join('')}</div>
            <div><strong>By outcome</strong></div>
            <div><div>Successful: ${eventTypes.Successful || 0}</div><div>Unsuccessful: ${eventTypes.Unsuccessful || 0}</div></div>
        </div>
        <p class="muted" style="margin-top: 1rem;">Source: <a href="${rawUrl}" target="_blank" style="color: var(--primary); text-decoration: underline;">View Raw Match Data on GitHub</a></p>
    `;
}

function renderBiometricsPanel() {
    const hasData = state.biometricData.length > 0;
    if (!hasData) {
        biometricsInfo.innerHTML = '<p>No biometric data generated yet. Use the button on the left to create a new run.</p>';
        biometricText.textContent = '';
        return;
    }
    
    const hrs = state.biometricData.map(d => d.hr);
    const minHr = Math.min(...hrs);
    const maxHr = Math.max(...hrs);
    const avgHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);

    biometricsInfo.innerHTML = `
        <p><strong>Biometric file:</strong> biometrics.csv</p>
        <p><strong>Rows generated:</strong> ${state.biometricData.length}</p>
        <p><strong>Stats:</strong> Min: ${minHr} | Max: ${maxHr} | Avg: ${avgHr} bpm</p>
        <p><strong>Last generated:</strong> ${new Date().toLocaleTimeString()}</p>
        <p class="muted">This file is overwritten each time you regenerate biometrics.</p>
    `;

    let text = 'Sec | HR (bpm) | Speed (km/h)\n';
    text += '----------------------------------\n';
    state.biometricData.forEach(row => {
        text += `${row.second.toString().padEnd(3)} | ${row.hr.toString().padEnd(4)} | ${row.speed.toString().padEnd(5)}\n`;
    });
    biometricText.textContent = text;
}

function renderHudlPanel() {
    if (!state.hudlXml) {
        hudlSummary.innerHTML = '<p>No Hudl XML preview generated yet. Press the button to preview your latest run.</p>';
        hudlText.textContent = '';
        return;
    }

    hudlSummary.innerHTML = `
        <p><strong>Hudl file:</strong> enriched_timeline.xml</p>
        <p><strong>Key clips:</strong> ${state.hudlClipCount}</p>
        <p class="muted">The preview updates whenever you generate a new Hudl run.</p>
    `;
    hudlText.textContent = state.hudlXml;
}

function resetRunState() {
    state.filteredEvents = [];
    state.biometricData = [];
    state.hudlXml = '';
    state.hudlClipCount = 0;
    btnGenerate.disabled = true;
    btnExport.disabled = true;
    renderMatchDataPanel();
    renderPlayerDataPanel();
    renderBiometricsPanel();
    renderHudlPanel();
}

async function loadMatchData(matchName) {
    const matchConfig = MATCH_CONFIG[matchName];
    if (!matchConfig || !matchConfig.supported) {
        updateStatus(matchStatus, 'Selected match is not supported in this demo.', 'error');
        return;
    }

    try {
        const eventsRes = await fetch(matchConfig.eventsPath);
        if (!eventsRes.ok) throw new Error('Failed to load match event data.');

        state.match = matchName;
        state.player = null;
        state.rawEvents = await eventsRes.json();
        resetRunState();

        updateStatus(matchStatus, `Loaded ${matchConfig.label} events.`);
        logAction(`Loaded ${state.rawEvents.length} events for ${matchConfig.label}`);
        
        const players = Array.from(new Set(state.rawEvents.map(e => e.player?.name).filter(Boolean))).sort();
        playerSelect.innerHTML = '<option value="" disabled selected>Choose a player...</option>';
        players.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            playerSelect.appendChild(opt);
        });

        playerSelect.disabled = false;
        unlockStep('step-2');
        renderMatchDataPanel();
    } catch (err) {
        updateStatus(matchStatus, `Error: ${err.message}`, 'error');
        logAction(`Error loading match: ${err.message}`, 'error');
    }
}

function filterPlayerEvents() {
    const player = playerSelect.value;
    state.player = player;

    state.filteredEvents = state.rawEvents.filter(e => {
        const isPlayer = e.player?.name?.toLowerCase().includes(player.toLowerCase());
        const isEvent = ['Pass', 'Dribble', 'Shot', 'Ball Recovery', 'Clearance'].includes(e.type?.name);
        return isPlayer && isEvent;
    }).map(e => {
        const period = e.period || 1;
        const minute = e.minute || 0;
        const second = e.second || 0;
        const absoluteSeconds = (minute * 60) + second + (CONFIG.PERIOD_OFFSETS[period] || 0);
        let outcome = 'Successful';
        if (e.type.name === 'Pass' && e.pass?.outcome) outcome = 'Unsuccessful';
        else if (e.type.name === 'Dribble' && e.dribble?.outcome?.name !== 'Complete') outcome = 'Unsuccessful';
        return { timestamp: absoluteSeconds, type: e.type.name, outcome, id: e.id, minute, second };
    });

    btnGenerate.disabled = false;
    btnExport.disabled = true;
    state.biometricData = [];
    state.hudlXml = '';
    state.hudlClipCount = 0;

    renderMatchDataPanel();
    renderPlayerDataPanel();
    renderBiometricsPanel();
    renderHudlPanel();
    updateStatus(playerStatus, `Extracted ${state.filteredEvents.length} technical actions for ${player}.`);
    logAction(`Player selected: ${player} (${state.filteredEvents.length} events)`);
    unlockStep('step-3');
}

function simulateBiometrics() {
    const events = state.filteredEvents;
    const startTime = 0;
    const endTime = events.length > 0 ? Math.max(...events.map(e => e.timestamp)) + 120 : 5400;
    const timeline = [];

    for (let second = startTime; second <= endTime; second++) {
        const minutes = second / 60;
        let hr = 110 + (12 * Math.log1p(minutes)) + (2 * Math.sin(second / 45));
        events.forEach(event => {
            const delta = Math.abs(second - event.timestamp);
            if (delta <= 10) {
                const baseSpike = CONFIG.EVENT_IMPACT[event.type] || 12;
                const actualSpike = baseSpike + randomNormal(0, 2);
                hr += actualSpike * Math.exp(-0.25 * delta);
            }
        });
        hr += randomNormal(0, 1.2);
        hr = Math.max(60, Math.min(CONFIG.PLAYER_MAX_HR, hr));
        const speed = hr > CONFIG.PLAYER_MAX_HR * 0.85 ? (Math.random() * 13 + 15) : (Math.random() * 10);
        timeline.push({ second, hr: Math.round(hr), speed: parseFloat(speed.toFixed(1)) });
    }

    state.biometricData = timeline;
    btnExport.disabled = false;
    renderBiometricsPanel();
    updateStatus(simStatus, `Generated biometric data for ${timeline.length} seconds.`);
    logAction(`Generated ${timeline.length} telemetry points`);
    unlockStep('step-4');
}

function exportToHudl() {
    const tactical = state.filteredEvents;
    const biometric = state.biometricData;
    
    const analysis = [];
    tactical.forEach(event => {
        const bio = biometric.find(item => item.second === event.timestamp);
        if (!bio) return;
        const hrPercent = bio.hr / CONFIG.PLAYER_MAX_HR;
        let category = 'Standard Action';
        if (event.outcome === 'Unsuccessful') {
            category = hrPercent >= CONFIG.FATIGUE_THRESHOLD ? 'Fatigue-Induced Error' :
                       hrPercent <= CONFIG.SKILL_THRESHOLD ? 'Technical Skill Error' : 'Standard Error';
        } else {
            category = hrPercent >= CONFIG.FATIGUE_THRESHOLD ? 'High-Stress Success' : 'Standard Success';
        }
        analysis.push({ ...event, hr: bio.hr, category });
    });

    const keyEvents = analysis.filter(event => ['Fatigue-Induced Error', 'Technical Skill Error', 'High-Stress Success'].includes(event.category));
    state.hudlClipCount = keyEvents.length;
    state.hudlXml = `<?xml version="1.0" encoding="UTF-8"?>\n<file>\n  <instances>\n${keyEvents.map((event, idx) => {
        const start = Math.max(0, event.timestamp - 3);
        const end = event.timestamp + 3;
        return `    <instance>\n      <ID>${idx + 1}</ID>\n      <start>${start}</start>\n      <end>${end}</end>\n      <code>${event.category}</code>\n      <label><group>Player</group><text>${state.player}</text></label>\n      <label><group>Action Type</group><text>${event.type}</text></label>\n      <label><group>Heart Rate at Event</group><text>${event.hr} bpm</text></label>\n    </instance>\n`;
    }).join('')}  </instances>\n</file>`;

    renderHudlPanel();
    updateStatus(exportStatus, `Hudl preview generated with ${state.hudlClipCount} clips.`);
    logAction(`Exported ${state.hudlClipCount} resilience clips to Hudl XML`);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === tabId));
}

function init() {
    matchSelect.innerHTML = '<option value="" disabled selected>Choose a match...</option>';
    Object.entries(MATCH_CONFIG).forEach(([key, config]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = config.label;
        matchSelect.appendChild(opt);
    });

    renderMatchDataPanel();
    renderPlayerDataPanel();
    renderBiometricsPanel();
    renderHudlPanel();

    matchSelect.addEventListener('change', e => loadMatchData(e.target.value));
    playerSelect.addEventListener('change', filterPlayerEvents);
    btnGenerate.addEventListener('click', simulateBiometrics);
    btnExport.addEventListener('click', exportToHudl);
    document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));

    logAction('Engine initialized. Ready for match selection.');
}

document.addEventListener('DOMContentLoaded', init);