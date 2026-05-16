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
        eventsPath: 'https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/3869519.json',
        supported: true
    },
    ned_vs_usa: {
        label: 'Netherlands vs USA (Round of 16)',
        eventsPath: 'https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/3869151.json',
        supported: true
    },
    eng_vs_usa: {
        label: 'England vs USA (Group Stage)',
        eventsPath: 'https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/3857256.json',
        supported: true
    }
};

let state = {
    match: null,
    player: null,
    rawEvents: [],
    filteredEvents: [],
    biometricData: [],
    resilienceEvents: [],
    hudlXml: '',
    hudlClipCount: 0,
    subInTime: null,
    subOutTime: null
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
const hudlSummary = document.getElementById('hudl-summary');

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
        <p class="muted">Interactive chart below shows HR over time.</p>
    `;

}

function renderBiometricChart() {
    const canvas = document.getElementById('biometric-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (window.biometricChartInstance) {
        window.biometricChartInstance.destroy();
    }

    const hrs = state.biometricData.filter(d => d.hr !== null).map(d => d.hr);
    const dynamicMinY = hrs.length > 0 ? Math.max(60, Math.min(...hrs) - 10) : 60;

    window.biometricChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: state.biometricData.map(d => (d.second / 60).toFixed(2)),
            datasets: [{
                label: 'Heart Rate (bpm)',
                data: state.biometricData.map(d => d.hr),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    title: { display: true, text: 'Minutes' },
                    grid: { 
                        color: (context) => {
                            const val = parseFloat(context.tick.value);
                            return [0, 45, 90, 120].includes(Math.round(val)) ? '#666' : '#333';
                        }
                    },
                    ticks: { 
                        color: '#f8fafc',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10,
                        callback: function(value, index, values) {
                            const label = this.getLabelForValue(value);
                            const val = parseFloat(label);
                            if (isNaN(val)) return label;
                            if (Number.isInteger(Math.round(val * 100) / 100)) {
                                if (Math.round(val) === val) return val + "'";
                            }
                            return null;
                        }
                    }
                },
                y: { 
                    title: { display: true, text: 'BPM' },
                    grid: { color: '#333' },
                    ticks: { color: '#94a3b8' },
                    min: dynamicMinY
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });

    // Populate raw data preview
    const rawDiv = document.getElementById('biometric-raw');
    if (rawDiv) {
        const csvHeader = 'Timestamp(s),HR(bpm),Speed(m/s)\n';
        const csvRows = state.biometricData
            .map(d => `${d.second},${d.hr},${d.speed}`)
            .join('\n');
        rawDiv.textContent = csvHeader + csvRows;
    }
}

function renderHudlPanel() {
    if (!state.hudlXml) {
        hudlSummary.innerHTML = '<p>No Hudl XML preview generated yet. Press the button to preview your latest run.</p>';
        return;
    }

    hudlSummary.innerHTML = `
        <p><strong>Hudl file:</strong> enriched_timeline.xml</p>
        <p><strong>Key clips:</strong> ${state.hudlClipCount}</p>
        <p class="muted">Interactive chart below shows resilience events mapped to HR curve.</p>
    `;
    
    if (document.getElementById('hudl-xml').classList.contains('active')) {
        renderHudlChart();
    }
}

function renderHudlChart() {
    const canvas = document.getElementById('hudl-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.hudlChartInstance) {
        window.hudlChartInstance.destroy();
    }

    // 1. Prepare scatter data from resilience events
    const scatterData = state.resilienceEvents.map(event => ({
        x: (event.timestamp / 60).toFixed(2),
        y: event.hr,
        category: event.category,
        type: event.type,
        minute: Math.floor(event.timestamp / 60),
        second: event.timestamp % 60
    }));

    // 2. Inject "Sub In" Marker if applicable
    if (state.subInTime !== null && state.subInTime > 0) {
        scatterData.push({
            x: (state.subInTime / 60).toFixed(2),
            y: 110, // Baseline HR for entering pitch
            category: 'Substitution',
            type: 'Subbed In',
            minute: Math.floor(state.subInTime / 60),
            second: state.subInTime % 60
        });
    }

    // 3. Inject "Sub Out" Marker if applicable
    if (state.subOutTime !== null) {
        const exitHR = state.biometricData.find(d => d.second === state.subOutTime)?.hr || 160;
        scatterData.push({
            x: (state.subOutTime / 60).toFixed(2),
            y: exitHR,
            category: 'Substitution',
            type: 'Subbed Out',
            minute: Math.floor(state.subOutTime / 60),
            second: state.subOutTime % 60
        });
    }

    // 4. Dynamic Styling (Colors, Shapes, Sizes)
    const pointColors = scatterData.map(d => {
        if (d.category === 'Substitution') return '#3b82f6'; // Bright Blue
        if (d.category === 'Fatigue-Induced Error') return '#ef4444'; // Red
        if (d.category === 'Technical Skill Error') return '#eab308'; // Yellow
        return '#22c55e'; // Green
    });

    const pointStyles = scatterData.map(d => {
        return d.category === 'Substitution' ? 'triangle' : 'circle';
    });

    const pointRadii = scatterData.map(d => {
        return d.category === 'Substitution' ? 9 : 6;
    });

    const dynamicMinY = Math.min(...state.biometricData.map(d => d.hr || 200)) - 10;

    window.hudlChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: state.biometricData.map(d => (d.second / 60).toFixed(2)),
            datasets: [
                {
                    type: 'scatter',
                    label: 'Match Events',
                    data: scatterData,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointStyle: pointStyles,
                    pointRadius: pointRadii,
                    pointHoverRadius: 10,
                    z: 10
                },
                {
                    type: 'line',
                    label: 'Heart Rate (bpm)',
                    data: state.biometricData.map(d => d.hr),
                    borderColor: 'rgba(148, 163, 184, 0.4)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3,
                    spanGaps: false,
                    z: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) { 
                                const d = context.raw;
                                return `${d.minute}'${d.second.toString().padStart(2, '0')}" | ${d.type} (${d.y} BPM) - ${d.category}`;
                            }
                            return `HR: ${context.raw} BPM`;
                        }
                    }
                },
                legend: { labels: { color: '#f8fafc' } }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Minutes', color: '#94a3b8' },
                    grid: { color: '#333' },
                    ticks: {
                        color: '#f8fafc',
                        maxTicksLimit: 10,
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            const val = parseFloat(label);
                            if (Number.isInteger(Math.round(val * 100) / 100)) {
                                if (Math.round(val) === val) return val + "'";
                            }
                            return null;
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'BPM', color: '#94a3b8' },
                    grid: { color: '#333' },
                    ticks: { color: '#94a3b8' },
                    min: dynamicMinY
                }
            }
        }
    });

    // Populate raw XML preview
    const rawDiv = document.getElementById('hudl-raw');
    if (rawDiv) {
        rawDiv.textContent = state.hudlXml;
    }
}

/**
 * Cascading State Management
 * Clears downstream data to prevent stale state and user confusion.
 */
function clearExportState() {
    state.resilienceEvents = [];
    state.hudlXml = '';
    state.hudlClipCount = 0;
    btnExport.disabled = true;
    renderHudlPanel();
}

function clearBiometricsState() {
    clearExportState();
    state.biometricData = [];
    renderBiometricsPanel();
}

function resetRunState() {
    // Clear everything from Player selection onwards
    state.player = null;
    state.filteredEvents = [];
    clearBiometricsState();
    
    playerSelect.value = '';
    btnGenerate.disabled = true;
    
    renderMatchDataPanel();
    renderPlayerDataPanel();
}

async function loadMatchData(matchName) {
    const matchConfig = MATCH_CONFIG[matchName];
    if (!matchConfig || !matchConfig.supported) {
        updateStatus(matchStatus, 'Selected match is not supported in this demo.', 'error');
        return;
    }

    try {
        // 1. Immediate UI feedback and state reset
        resetRunState();
        updateStatus(matchStatus, 'Loading match data...', 'info');
        
        const eventsRes = await fetch(matchConfig.eventsPath);
        if (!eventsRes.ok) throw new Error('Failed to load match event data.');

        state.match = matchName;
        state.rawEvents = await eventsRes.json();
        
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

    // 1. Clear downstream state (Biometrics and Export)
    clearBiometricsState();

    // Extract substitution times from StatsBomb data
    let subIn = null;
    let subOut = null;

    state.rawEvents.forEach(e => {
        if (e.type?.name === 'Substitution') {
            const period = e.period || 1;
            const minute = e.minute || 0;
            const second = e.second || 0;
            const absoluteSeconds = (minute * 60) + second + (CONFIG.PERIOD_OFFSETS[period] || 0);

            // Player coming off - Use exact match to avoid false positives
            if (e.player?.name === player) {
                subOut = absoluteSeconds;
            }
            // Player coming on - Use exact match
            if (e.substitution?.replacement?.name === player) {
                subIn = absoluteSeconds;
            }
        }
    });

    // Ensure defaults for all cases:
    // 1. Starter -> Finished: subIn=0, subOut=matchEnd
    // 2. Starter -> Subbed Out: subIn=0, subOut=timestamp
    // 3. Subbed In -> Finished: subIn=timestamp, subOut=matchEnd
    // 4. Subbed In -> Subbed Out: subIn=timestamp, subOut=timestamp
    
    const matchEndTime = state.rawEvents.length > 0 
        ? Math.max(...state.rawEvents.map(e => (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0))) 
        : 5400;

    // CRITICAL FIX: Use absolute seconds for state, but ensure we don't overwrite 
    // if the player was subbed in AND subbed out.
    state.subInTime = subIn !== null ? subIn : 0;
    state.subOutTime = subOut !== null ? subOut : matchEndTime;

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
    
    renderMatchDataPanel();
    renderPlayerDataPanel();
    renderBiometricsPanel();
    renderHudlPanel();
    updateStatus(playerStatus, `Extracted ${state.filteredEvents.length} technical actions for ${player}.`);
    logAction(`Player selected: ${player} (${state.filteredEvents.length} events)`);
    unlockStep('step-3');
}

function simulateBiometrics() {
    // Clear downstream export state before new simulation
    clearExportState();

    const events = state.filteredEvents;
    
    // Always generate from 0 to 150 minutes (9000s) to provide full match context
    const startTime = 0;
    const endTime = 150 * 60; 
    
    const timeline = [];

    for (let second = startTime; second <= endTime; second++) {
        const minutes = second / 60;
        
        // Only simulate HR if the player is actually on the pitch
        if (second < state.subInTime || second > state.subOutTime) {
            timeline.push({ second, hr: null, speed: 0 });
            continue;
        }

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
    
    // Store raw events for the mixed chart scatter plot
    state.resilienceEvents = keyEvents;

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
    
    // Use requestAnimationFrame to ensure DOM is updated before rendering
    requestAnimationFrame(() => {
        if (tabId === 'biometrics' && state.biometricData.length > 0) {
            renderBiometricChart();
        }
        if (tabId === 'hudl-xml' && state.hudlXml) {
            renderHudlChart();
        }
    });
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