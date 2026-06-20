import { state } from './state.js';
import { MATCH_CONFIG, CONFIG } from './constants.js';
import * as analytics from './analytics.js';

/**
 * KineSync UI Module
 * Handles all DOM manipulations and Chart.js rendering.
 */

export function updateStatus(el, message, type = 'success') {
    if (!el) return;
    el.textContent = message;
    el.className = `status ${type}`;
}

export function logAction(message, type = 'info') {
    const logBox = document.getElementById('action-log');
    if (!logBox) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

export function unlockStep(stepId) {
    const step = document.getElementById(stepId);
    if (!step) return;
    step.classList.remove('locked');
    step.classList.add('active');
}

export function renderMatchDataPanel() {
    const matchDataSummary = document.getElementById('match-data-summary');
    if (!matchDataSummary) return;

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

export function renderPlayerDataPanel() {
    const playerDataSummary = document.getElementById('player-data-summary');
    if (!playerDataSummary) return;

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

export function renderBiometricsPanel() {
    const biometricsInfo = document.getElementById('biometric-info');
    if (!biometricsInfo) return;

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

export function renderBiometricChart() {
    const canvas = document.getElementById('biometric-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (state.charts.biometric) {
        state.charts.biometric.destroy();
    }

    const hrs = state.biometricData.filter(d => d.hr !== null).map(d => d.hr);
    const dynamicMinY = hrs.length > 0 ? Math.max(60, Math.min(...hrs) - 10) : 60;

    state.charts.biometric = new Chart(ctx, {
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

    const activeRawDiv = document.getElementById('biometric-raw-active');
    const inactiveRawDiv = document.getElementById('biometric-raw-inactive');

    const generateTable = (data) => {
        const rows = data.map(d => `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">${d.second}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">${d.hr}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">${d.speed}</td>
            </tr>
        `).join('');

        return `
            <table style="width: 100%; border-collapse: collapse; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; text-align: left; margin-bottom: 1.5rem;">
                <thead style="background: var(--bg-dark); color: #94a3b8;">
                    <tr>
                                <th style="padding: 8px 12px; border-bottom: 2px solid var(--border-color);">Timestamp(s)</th>
                                <th style="padding: 8px 12px; border-bottom: 2px solid var(--border-color);">HR(bpm)</th>
                                <th style="padding: 8px 12px; border-bottom: 2px solid var(--border-color);">Speed(m/s)</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };

    if (activeRawDiv) {
        const activeData = state.biometricData.filter(d => d.hr !== null);
        activeRawDiv.innerHTML = `
            <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.5rem; font-size: 0.9rem;">Active Telemetry (On-Pitch)</div>
            ${generateTable(activeData)}
        `;
    }
    if (inactiveRawDiv) {
        const inactiveData = state.biometricData.filter(d => d.hr === null);
        inactiveRawDiv.innerHTML = `
            <div style="font-weight: 600; color: #94a3b8; margin-bottom: 0.5rem; font-size: 0.9rem;">Inactive Telemetry (Off-Pitch)</div>
            ${generateTable(inactiveData)}
        `;
    }
}

export function renderHudlPanel() {
    const hudlSummary = document.getElementById('hudl-summary');
    if (!hudlSummary) return;

    if (!state.hudlXml) {
        hudlSummary.innerHTML = '<p>No Hudl XML preview generated yet. Press the button to preview your latest run.</p>';
        return;
    }

    hudlSummary.innerHTML = `
        <p><strong>Hudl file:</strong> enriched_timeline.xml</p>
        <p><strong>Key clips:</strong> ${state.hudlClipCount}</p>
        <p class="muted">Interactive chart below shows resilience events mapped to HR curve.</p>
    `;
    
    if (document.getElementById('hudl-xml')?.classList.contains('active')) {
        renderHudlChart();
    }
}

export function renderTeamSummary() {
    const container = document.getElementById('team-stats-summary');
    if (!container) return;

    const teamA = state.teamAStats ? { name: state.teamNames[0] || 'Team A', summary: state.teamAStats.summary } : null;
    const teamB = state.teamBStats ? { name: state.teamNames[1] || 'Team B', summary: state.teamBStats.summary } : null;

    const renderTeamTable = (team) => {
        if (!team) return `<div class="muted">No data generated</div>`;
        const { maxHr, minHr, avgHr, unitMins, unitPlayers, unitStats } = team.summary;
        
        const units = [
            { id: 'Defender', label: 'Defenders' },
            { id: 'Midfielder', label: 'Midfielders' },
            { id: 'Attacker', label: 'Attackers' }
        ];

        return `
            <div style="margin-bottom: 1.5rem;">
                <div style="font-weight: bold; color: var(--primary); margin-bottom: 0.5rem; font-size: 1rem;">${team.name}</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: rgba(255,255,255,0.03); border-radius: 4px; overflow: hidden; border: 1px solid var(--border);">
                    <thead>
                        <tr style="background: rgba(0,0,0,0.2); color: #94a3b8; text-align: left;">
                            <th style="padding: 6px 8px; border-bottom: 1px solid var(--border);">Metric</th>
                            <th style="padding: 6px 8px; border-bottom: 1px solid var(--border);">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 6px 8px; border-bottom: 1px solid var(--border);">Overall HR (Min/Avg/Max)</td>
                            <td style="padding: 6px 8px; border-bottom: 1px solid var(--border); font-family: monospace;">${minHr} / ${avgHr} / ${maxHr} bpm</td>
                        </tr>
                        ${units.map(u => `
                            <tr>
                                <td style="padding: 6px 8px; border-bottom: 1px solid var(--border);">
                                    ${u.label} (${unitPlayers[u.id].length})
                                </td>
                                <td style="padding: 6px 8px; border-bottom: 1px solid var(--border); font-family: monospace;">
                                    ${unitMins[u.id].toFixed(1)}m | Min: ${unitStats[u.id].min} / Avg: ${unitStats[u.id].avg} / Max: ${unitStats[u.id].max} bpm
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    container.innerHTML = `
        <div>${renderTeamTable(teamA)}</div>
        <div>${renderTeamTable(teamB)}</div>
    `;
}

export function updateTeamButtons() {
    const btnA = document.getElementById('btn-gen-team-a');
    const btnB = document.getElementById('btn-gen-team-b');
    
    if (btnA && state.teamNames[0]) btnA.textContent = `Generate Avg Biometrics ${state.teamNames[0]}`;
    if (btnB && state.teamNames[1]) btnB.textContent = `Generate Avg Biometrics ${state.teamNames[1]}`;
}

export function renderHudlChart() {
    const canvas = document.getElementById('hudl-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (state.charts.hudl) {
        state.charts.hudl.destroy();
    }

    const scatterData = state.resilienceEvents.map(event => ({
        x: (event.timestamp / 60).toFixed(2),
        y: event.hr,
        category: event.category,
        type: event.type,
        minute: Math.floor(event.timestamp / 60),
        second: event.timestamp % 60
    }));

    if (state.subInTime !== null && state.subInTime > 0) {
        scatterData.push({
            x: (state.subInTime / 60).toFixed(2),
            y: 110,
            category: 'Substitution',
            type: 'Subbed In',
            minute: Math.floor(state.subInTime / 60),
            second: state.subInTime % 60
        });
    }

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

    const pointColors = scatterData.map(d => {
        if (d.category === 'Substitution') return '#3b82f6';
        if (d.category === 'Fatigue-Induced Error') return '#ef4444';
        if (d.category === 'Technical Skill Error') return '#eab308';
        return '#22c55e';
    });

    const pointStyles = scatterData.map(d => d.category === 'Substitution' ? 'triangle' : 'circle');
    const pointRadii = scatterData.map(d => d.category === 'Substitution' ? 9 : 6);
    const dynamicMinY = Math.min(...state.biometricData.map(d => d.hr || 200)) - 10;

    state.charts.hudl = new Chart(ctx, {
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
            interaction: { mode: 'nearest', intersect: true },
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

    const rawDiv = document.getElementById('hudl-raw');
    if (rawDiv) {
        rawDiv.textContent = state.hudlXml;
    }
}

export function renderSquadChart(onUnitClick) {
    const canvas = document.getElementById('squad-radar-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (onUnitClick) state.onUnitClick = onUnitClick;
    if (state.charts.squad) state.charts.squad.destroy();

    const datasets = [];

    // Team A Units
    if (state.teamAStats) {
        const unitsA = [
            { key: 'DefenderA', label: 'Def A', statsKey: 'Defender', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.3)' },
            { key: 'MidfielderA', label: 'Mid A', statsKey: 'Midfielder', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.3)' },
            { key: 'AttackerA', label: 'Att A', statsKey: 'Attacker', color: '#93c5fd', bg: 'rgba(147, 197, 253, 0.3)' }
        ];
        unitsA.forEach(u => {
            if (state.chartVisibility[u.key] && state.teamAStats.unitStats[u.statsKey]) {
                datasets.push({
                    label: `${state.teamNames[0] || 'Team A'} ${u.label.replace(' A', '')}`,
                    data: analytics.calculateNormalizedStats(state.teamAStats.unitStats[u.statsKey]),
                    backgroundColor: u.bg,
                    borderColor: u.color,
                    pointBackgroundColor: u.color,
                    borderWidth: 2
                });
            }
        });
    }

    // Team B Units
    if (state.teamBStats) {
        const unitsB = [
            { key: 'DefenderB', label: 'Def B', statsKey: 'Defender', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.3)' },
            { key: 'MidfielderB', label: 'Mid B', statsKey: 'Midfielder', color: '#f87171', bg: 'rgba(248, 113, 113, 0.3)' },
            { key: 'AttackerB', label: 'Att B', statsKey: 'Attacker', color: '#fca5a5', bg: 'rgba(252, 165, 165, 0.3)' }
        ];
        unitsB.forEach(u => {
            if (state.chartVisibility[u.key] && state.teamBStats.unitStats[u.statsKey]) {
                datasets.push({
                    label: `${state.teamNames[1] || 'Team B'} ${u.label.replace(' B', '')}`,
                    data: analytics.calculateNormalizedStats(state.teamBStats.unitStats[u.statsKey]),
                    backgroundColor: u.bg,
                    borderColor: u.color,
                    pointBackgroundColor: u.color,
                    borderWidth: 2
                });
            }
        });
    }

    // Current Player Overlay
    if (state.player && state.chartVisibility.Player) {
        const playerStats = analytics.calculatePlayerSquadStats(state.rawEvents, state.player);
        datasets.push({
            label: `Current Player: ${state.player}`,
            data: analytics.calculateNormalizedStats(playerStats),
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: '#ffffff',
            pointBackgroundColor: '#ffffff',
            borderWidth: 4,
            pointRadius: 5,
            zIndex: 10
        });
    }

    state.charts.squad = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Resilience (High Stress Success)', 'Fatigue Decay (Red Zone Errors)', 'Base Technical Consistency', 'Physical Intensity Load'],
            datasets: datasets
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (event, activeElements) => {
                if (activeElements.length > 0 && onUnitClick) {
                    const datasetIndex = activeElements[0].datasetIndex;
                    const label = state.charts.squad.data.datasets[datasetIndex].label;
                    
                    // Determine unit from label (e.g., "Argentina Defender" or "Team A Def")
                    const unit = ['Defender', 'Midfielder', 'Attacker'].find(u => label.includes(u));
                    if (unit) {
                        onUnitClick(unit);
                    }
                }
            },
            scales: { 
                r: { 
                    angleLines: { color: '#334155' }, 
                    grid: { color: '#334155' }, 
                    pointLabels: { color: '#cbd5e1', font: { size: 13, family: 'Inter' } }, 
                    ticks: { display: false, min: 0, max: 100 } 
                } 
            },
            plugins: { 
                legend: { position: 'top', labels: { color: '#f8fafc', padding: 20, font: { size: 14 } } }, 
                tooltip: { callbacks: { label: function(ctx) { return ` ${ctx.dataset.label}: ${Math.round(ctx.raw)}%`; } } } 
            }
        }
    });
}

export function handleChartToggle(unit, isVisible) {
    state.chartVisibility[unit] = isVisible;
    renderSquadChart();
}

export function updateChartToggles() {
    try {
        const toggles = document.querySelectorAll('.chart-toggle');
        const teamA = state.teamNames[0] || 'Team A';
        const teamB = state.teamNames[1] || 'Team B';

        toggles.forEach(checkbox => {
            const unit = checkbox.dataset.unit;
            const label = checkbox.parentElement;
            if (!label) return;

            let text = '';
            if (unit === 'DefenderA') text = `${teamA} Def`;
            else if (unit === 'MidfielderA') text = `${teamA} Mid`;
            else if (unit === 'AttackerA') text = `${teamA} Att`;
            else if (unit === 'DefenderB') text = `${teamB} Def`;
            else if (unit === 'MidfielderB') text = `${teamB} Mid`;
            else if (unit === 'AttackerB') text = `${teamB} Att`;
            else if (unit === 'Player') text = `Current Player`;

            // Absolute reset of label content to prevent duplication
            const checkboxElement = checkbox.cloneNode(true);
            label.innerHTML = ''; 
            label.appendChild(checkboxElement);
            label.appendChild(document.createTextNode(` ${text}`));
            
            // Re-attach event listener because cloneNode doesn't copy them
            checkboxElement.addEventListener('change', (e) => {
                const u = e.target.dataset.unit;
                const isVisible = e.target.checked;
                handleChartToggle(u, isVisible);
            });
        });
    } catch (err) {
        console.error('Error updating chart toggles:', err);
    }
}

export function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === tabId));
    
    requestAnimationFrame(() => {
        if (tabId === 'biometrics' && state.biometricData.length > 0) {
            renderBiometricChart();
        }
        if (tabId === 'hudl-xml' && state.hudlXml) {
            renderHudlChart();
        }
        if (tabId === 'squad-data' && (state.teamAStats || state.teamBStats)) {
            renderSquadChart(state.onUnitClick);
        }
    });
}