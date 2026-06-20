/**
 * KineSync State Manager
 * Encapsulates application state and provides controlled mutation methods.
 */

export const state = {
    currentLoadingMatch: null,
    match: null,
    player: null,
    rawEvents: [],
    filteredEvents: [],
    biometricData: [],
    resilienceEvents: [],
    hudlXml: '',
    hudlClipCount: 0,
    subInTime: null,
    subOutTime: null,
    squadStats: null,
    teamNames: [],
    teamAStats: null,
    teamBStats: null,
    
    // Chart instances stored here to avoid window pollution
    charts: {
        biometric: null,
        hudl: null,
        squad: null
    },
    onUnitClick: null,
    chartVisibility: {
        DefenderA: true,
        MidfielderA: true,
        AttackerA: true,
        DefenderB: true,
        MidfielderB: true,
        AttackerB: true,
        Player: true
    }
};

/**
 * Clears downstream data to prevent stale state.
 * Reactive Chain: Match -> Squad -> Player -> Biometrics -> Export
 */
export function clearExportState() {
    state.resilienceEvents = [];
    state.hudlXml = '';
    state.hudlClipCount = 0;
}

export function clearBiometricsState() {
    clearExportState();
    state.biometricData = [];
}

export function resetRunState() {
    state.player = null;
    state.filteredEvents = [];
    state.teamNames = [];
    state.teamAStats = null;
    state.teamBStats = null;
    state.squadStats = null;
    state.match = null;
    state.rawEvents = [];
    clearBiometricsState();
}
