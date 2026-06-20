import { CONFIG, MATCH_CONFIG } from './constants.js';
import { state, resetRunState, clearBiometricsState } from './state.js';
import * as analytics from './analytics.js';
import * as ui from './ui.js';

console.log('KineSync Engine: Module loading...');

/**
 * KineSync Orchestrator
 * wires together State, Analytics, and UI to create the Reactive Chain.
 */

const matchSelect = document.getElementById('match-select');
const playerSelect = document.getElementById('player-select');
const matchStatus = document.getElementById('match-status');
const playerStatus = document.getElementById('player-status');
const btnRegenerateBio = document.getElementById('btn-regenerate-bio');

async function loadMatchData(matchName) {
    const matchConfig = MATCH_CONFIG[matchName];
    if (!matchConfig || !matchConfig.supported) {
        ui.updateStatus(matchStatus, 'Selected match is not supported in this demo.', 'error');
        return;
    }

    try {
        state.currentLoadingMatch = matchName;
        resetRunState();
        ui.updateStatus(matchStatus, 'Loading match data...', 'info');

        const eventsRes = await fetch(matchConfig.eventsPath);
        if (!eventsRes.ok) throw new Error('Failed to load match event data.');

        state.match = matchName;
        state.rawEvents = await eventsRes.json();

        ui.updateStatus(matchStatus, `Loaded ${matchConfig.label} events.`);
        ui.logAction(`Loaded ${state.rawEvents.length} events for ${matchConfig.label}`);

        const players = Array.from(new Set(state.rawEvents.map(e => e.player?.name).filter(Boolean))).sort();
        playerSelect.innerHTML = '<option value="" disabled selected>Choose a player...</option>';
        playerSelect.value = ""; // Explicitly reset selection to default
        players.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            playerSelect.appendChild(opt);
        });

        requestAnimationFrame(async () => {
            playerSelect.disabled = false;
            ui.unlockStep('step-2');

            // Dynamic Team Identification
            state.teamNames = analytics.getTeams(state.rawEvents);
            ui.updateTeamButtons();
            ui.updateChartToggles();

            // Auto-generate Team Biometrics on match load
            if (state.teamNames.length >= 2) {
                await runTeamAnalysis(0);
                await runTeamAnalysis(1);
            }
        });
        btnRegenerateBio.disabled = true;
        ui.renderMatchDataPanel();
    } catch (err) {
        ui.updateStatus(matchStatus, `Error: ${err.message}`, 'error');
        ui.logAction(`Error loading match: ${err.message}`, 'error');
    }
}

async function runTeamAnalysis(teamIndex) {
    const teams = state.teamNames.length > 0 ? state.teamNames : analytics.getTeams(state.rawEvents);
    if (teams.length === 0) return;

    const teamName = teams[teamIndex];
    if (!teamName) return;

    const matchAtStart = state.currentLoadingMatch;
    ui.updateStatus(matchStatus, `Generating avg biometrics for ${teamName}...`, 'info');

    try {
        // Use the new Async version to prevent UI freeze and allow progress logs
        const averagedTimeline = await analytics.generateTeamBiometricsAsync(
            state.rawEvents,
            teamName,
            (current, total, player) => {
                ui.logAction(`Processing ${teamName}: Player ${current}/${total} (${player})...`, 'info');
            }
        );

        // Concurrency Check: If the user switched matches while this was processing, discard results
        if (state.currentLoadingMatch !== matchAtStart) {
            ui.logAction(`Discarding stale analysis for ${teamName} (Match changed).`, 'warn');
            return;
        }

        const summary = analytics.calculateTeamSummary(averagedTimeline, state.rawEvents, teamName);

        // Filter events for this team to calculate unit-level technical stats
        const teamEvents = state.rawEvents.filter(e => e.team?.name === teamName);
        const unitStats = analytics.analyzeSquad(teamEvents);

        const result = {
            unitStats,
            summary
        };

        if (teamIndex === 0) state.teamAStats = result;
        else state.teamBStats = result;

        ui.updateStatus(matchStatus, `Analysis complete for ${teamName}.`, 'success');
        ui.logAction(`${teamName} Analysis Complete. Averaged biometrics processed.`);
        ui.renderTeamSummary();

        if (document.getElementById('squad-data')?.classList.contains('active')) {
            ui.renderSquadChart(handleUnitClick);
        }
    } catch (err) {
        ui.logAction(`Error analyzing ${teamName}: ${err.message}`, 'error');
    }
}

function handlePlayerSelection() {
    const player = playerSelect.value;
    if (!player) return;

    state.player = player;
    clearBiometricsState();

    const { filteredEvents, subInTime, subOutTime } = analytics.filterPlayerEvents(state.rawEvents, player);

    state.filteredEvents = filteredEvents;
    state.subInTime = subInTime;
    state.subOutTime = subOutTime;

    ui.renderMatchDataPanel();
    ui.renderPlayerDataPanel();
    ui.updateStatus(playerStatus, `Extracted ${state.filteredEvents.length} technical actions for ${player}.`);
    ui.logAction(`Player selected: ${player} (${state.filteredEvents.length} events)`);

    btnRegenerateBio.disabled = false;
    runBiometricSimulation();

    // Force squad chart refresh if the squad data tab is active
    if (document.getElementById('squad-data')?.classList.contains('active')) {
        ui.renderSquadChart(handleUnitClick);
    }
}

function runBiometricSimulation() {
    const telemetry = analytics.simulateBiometrics(state.filteredEvents, state.subInTime, state.subOutTime);
    state.biometricData = telemetry;

    ui.renderBiometricsPanel();
    ui.logAction(`Generated ${telemetry.length} telemetry points`);

    runHudlExport();
}

function runHudlExport() {
    const { resilienceEvents, hudlXml, hudlClipCount } = analytics.exportToHudl(
        state.filteredEvents,
        state.biometricData,
        state.player
    );

    state.resilienceEvents = resilienceEvents;
    state.hudlXml = hudlXml;
    state.hudlClipCount = hudlClipCount;

    ui.renderHudlPanel();
    ui.logAction(`Exported ${state.hudlClipCount} resilience clips to Hudl XML`);
}

function init() {
    console.log('KineSync: Initializing...');
    try {
        matchSelect.innerHTML = '<option value="" disabled selected>Choose a match...</option>';
        Object.entries(MATCH_CONFIG).forEach(([key, config]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = config.label;
            matchSelect.appendChild(opt);
        });

        ui.renderMatchDataPanel();
        ui.renderPlayerDataPanel();
        ui.renderBiometricsPanel();
        ui.renderHudlPanel();

        matchSelect.addEventListener('change', e => loadMatchData(e.target.value));
        playerSelect.addEventListener('change', handlePlayerSelection);
        document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => ui.switchTab(button.dataset.tab)));

        btnRegenerateBio.addEventListener('click', async () => {
            ui.logAction('Manual regeneration triggered...', 'info');
            clearBiometricsState();

            // 1. Regenerate individual player telemetry
            runBiometricSimulation();

            // 2. Refresh Team-level aggregate biometrics and PUM stats
            if (state.teamNames.length >= 2) {
                ui.logAction('Refreshing team aggregate stats...', 'info');
                await runTeamAnalysis(0);
                await runTeamAnalysis(1);
            }

            // Force chart refresh if the biometrics tab is currently active
            if (document.getElementById('biometrics')?.classList.contains('active')) {
                ui.renderBiometricChart();
            }

            // Force PUM table refresh
            ui.renderTeamSummary();
        });

        // NEW: Handle Unit Clicks from Radar Chart (Macro -> Micro interaction)
        window.handleUnitClick = (unitType) => {
            const playersInUnit = analytics.getPlayersByUnit(state.rawEvents, unitType);

            if (playersInUnit.length > 0) {
                // 1. Filter the dropdown to only show players in this unit
                playerSelect.innerHTML = '';
                const defaultOpt = document.createElement('option');
                defaultOpt.value = "";
                defaultOpt.textContent = "Choose a player...";
                playerSelect.appendChild(defaultOpt);

                playersInUnit.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    playerSelect.appendChild(opt);
                });

                // 2. Auto-select the highest impact player
                playerSelect.value = playersInUnit[0];

                // 3. Trigger existing selection logic
                handlePlayerSelection();

                // 4. Visual feedback via status update
                ui.updateStatus(playerStatus, `Filtered by ${unitType}s. Displaying: ${playersInUnit[0]}`, 'success');
                ui.logAction(`Coach selected Macro Unit: ${unitType}. Filtering squad roster...`, 'info');
            } else {
                ui.updateStatus(playerStatus, `No players found for ${unitType}s.`, 'error');
                ui.logAction(`Coach selected Macro Unit: ${unitType}. No players found.`, 'error');
            }
        };

        // Initialize chart toggles
        document.querySelectorAll('.chart-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const unit = e.target.dataset.unit;
                const isVisible = e.target.checked;
                ui.handleChartToggle(unit, isVisible);
            });
        });

        // Team Analysis Buttons
        document.getElementById('btn-gen-team-a')?.addEventListener('click', () => runTeamAnalysis(0));
        document.getElementById('btn-gen-team-b')?.addEventListener('click', () => runTeamAnalysis(1));

        ui.logAction('Engine initialized. Ready for match selection.');
        console.log('KineSync: Initialization complete.');
    } catch (err) {
        console.error('KineSync: Initialization failed:', err);
    }
}

document.addEventListener('DOMContentLoaded', init);