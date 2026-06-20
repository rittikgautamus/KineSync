import { CONFIG, POSITIONS } from './constants.js';

/**
 * Analytics Engine for KineSync
 * Pure functions for data processing and simulation.
 */

export function randomNormal(mean = 0, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
}

/**
 * Internal helper to calculate HR at a specific timestamp, 
 * accounting for base physiological curve and event-driven spikes.
 */
function _getEventHR(timestamp, eventImpacts) {
    const minutes = timestamp / 60;
    let hr = 110 + (12 * Math.log1p(minutes)) + (2 * Math.sin(timestamp / 45));

    for (let i = 0; i < eventImpacts.length; i++) {
        const event = eventImpacts[i];
        const delta = Math.abs(timestamp - event.timestamp);
        if (delta <= 10) {
            hr += event.impact * Math.exp(-0.25 * delta);
        }
    }
    return hr;
}

/**
 * Processes raw StatsBomb events to extract a specific player's technical timeline.
 */
export function filterPlayerEvents(rawEvents, player) {
    let subIn = null;
    let subOut = null;

    rawEvents.forEach(e => {
        if (e.type?.name === 'Substitution') {
            const period = e.period || 1;
            const minute = e.minute || 0;
            const second = e.second || 0;
            const absoluteSeconds = (minute * 60) + second + (CONFIG.PERIOD_OFFSETS[period] || 0);

            if (e.player?.name === player) subOut = absoluteSeconds;
            if (e.substitution?.replacement?.name === player) subIn = absoluteSeconds;
        }
    });

    const matchEndTime = rawEvents.length > 0 
        ? Math.max(...rawEvents.map(e => (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0))) 
        : 5400;

    const subInTime = subIn !== null ? subIn : 0;
    const subOutTime = subOut !== null ? subOut : matchEndTime;

    const filteredEvents = rawEvents.filter(e => {
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

    return { filteredEvents, subInTime, subOutTime };
}

/**
 * Simulates heart rate telemetry based on tactical intensity.
 */
export function simulateBiometrics(filteredEvents, subInTime, subOutTime) {
    const startTime = 0;
    const endTime = 150 * 60; 
    const timeline = [];

    const eventImpacts = filteredEvents.map(e => ({
        timestamp: e.timestamp,
        impact: (CONFIG.EVENT_IMPACT[e.type] || 12) + randomNormal(0, 2)
    }));

    for (let second = startTime; second <= endTime; second++) {
        if (second < subInTime || second > subOutTime) {
            timeline.push({ second, hr: null, speed: 0 });
            continue;
        }

        let hr = _getEventHR(second, eventImpacts);
        hr += randomNormal(0, 1.2);
        hr = Math.max(60, Math.min(CONFIG.PLAYER_MAX_HR, hr));
        const speed = hr > CONFIG.PLAYER_MAX_HR * 0.85 ? (Math.random() * 13 + 15) : (Math.random() * 10);
        timeline.push({ second, hr: Math.round(hr), speed: parseFloat(speed.toFixed(1)) });
    }

    return timeline;
}

/**
 * Maps biometric peaks to tactical errors to generate Hudl XML.
 */
export function exportToHudl(tactical, biometric, player) {
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
    
    const hudlClipCount = keyEvents.length;
    const hudlXml = `<?xml version="1.0" encoding="UTF-8"?>\n<file>\n  <instances>\n${keyEvents.map((event, idx) => {
        const start = Math.max(0, event.timestamp - 3);
        const end = event.timestamp + 3;
        return `    <instance>\n      <ID>${idx + 1}</ID>\n      <start>${start}</start>\n      <end>${end}</end>\n      <code>${event.category}</code>\n      <label><group>Player</group><text>${player}</text></label>\n      <label><group>Action Type</group><text>${event.type}</text></label>\n      <label><group>Heart Rate at Event</group><text>${event.hr} bpm</text></label>\n    </instance>\n`;
    }).join('')}  </instances>\n</file>`;

    return { resilienceEvents: keyEvents, hudlXml, hudlClipCount };
}

/**
 * Calculates normalized scores for radar charts.
 */
export function calculateNormalizedStats(stats) {
    const resilience = stats.highStressSuccess / ((stats.highStressSuccess + stats.fatigueError) || 1) * 100;
    
    const totalErrors = stats.fatigueError + stats.standardError + stats.skillError;
    const decay = totalErrors > 0 ? (stats.fatigueError / totalErrors) * 100 : 0;
    
    const normalActions = stats.standardSuccess + stats.standardError + stats.skillError;
    const consistency = normalActions > 0 ? (stats.standardSuccess / normalActions) * 100 : 0;
    
    const avgHR = stats.actions > 0 ? (stats.hrSum / stats.actions) : 120;
    const intensity = Math.max(0, Math.min(100, ((avgHR - 120) / 70) * 100));
    
    return [resilience, decay, consistency, intensity];
}

/**
 * Analyzes the full squad to group performance by positional units.
 */
export function calculatePlayerSquadStats(rawEvents, playerName) {
    const matchEndTime = rawEvents.length > 0 
        ? Math.max(...rawEvents.map(e => (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0))) 
        : 5400;

    const playerEvents = rawEvents.filter(e => e.player?.name === playerName);
    const stats = { actions: 0, highStressSuccess: 0, fatigueError: 0, standardSuccess: 0, standardError: 0, skillError: 0, hrSum: 0 };

    let subIn = null, subOut = null;
    playerEvents.forEach(e => {
        if (e.type?.name === 'Substitution') {
            const absSec = (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0);
            if (e.player?.name === playerName) subOut = absSec;
            if (e.substitution?.replacement?.name === playerName) subIn = absSec;
        }
    });
    const pSubIn = subIn !== null ? subIn : 0;
    const pSubOut = subOut !== null ? subOut : matchEndTime;

    const tactical = playerEvents.filter(e => ['Pass', 'Dribble', 'Shot', 'Ball Recovery', 'Clearance'].includes(e.type?.name)).map(e => {
        const absSec = (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0);
        let outcome = 'Successful';
        if (e.type.name === 'Pass' && e.pass?.outcome) outcome = 'Unsuccessful';
        else if (e.type.name === 'Dribble' && e.dribble?.outcome?.name !== 'Complete') outcome = 'Unsuccessful';
        return { timestamp: absSec, outcome, type: e.type.name };
    });

    tactical.forEach(event => {
        if (event.timestamp < pSubIn || event.timestamp > pSubOut) return;
        
        // Re-use the event impacts for consistency
        const eventImpacts = tactical.map(te => ({
            timestamp: te.timestamp,
            impact: (CONFIG.EVENT_IMPACT[te.type] || 12)
        }));

        const hr = _getEventHR(event.timestamp, eventImpacts);
        const cappedHr = Math.max(60, Math.min(CONFIG.PLAYER_MAX_HR, hr));
        const hrPercent = cappedHr / CONFIG.PLAYER_MAX_HR;
        
        stats.actions++;
        stats.hrSum += cappedHr;

        if (event.outcome === 'Successful') {
            if (hrPercent >= CONFIG.FATIGUE_THRESHOLD) stats.highStressSuccess++;
            else stats.standardSuccess++;
        } else {
            if (hrPercent >= CONFIG.FATIGUE_THRESHOLD) stats.fatigueError++;
            else if (hrPercent <= CONFIG.SKILL_THRESHOLD) stats.skillError++;
            else stats.standardError++;
        }
    });

    return stats;
}

export function getTeams(rawEvents) {
    const teams = Array.from(new Set(rawEvents.map(e => e.team?.name).filter(Boolean)));
    return teams.length >= 2 ? [teams[0], teams[1]] : teams;
}

/**
 * Finds players belonging to a specific tactical unit and returns them 
 * sorted by their total technical actions (impact).
 * @param {Array} rawEvents - The full match event dataset.
 * @param {string} unitType - 'Defender', 'Midfielder', or 'Attacker'.
 * @returns {Array} Sorted list of player names.
 */
export function getPlayersByUnit(rawEvents, unitType) {
    const playerUnitMap = new Map(); // name -> { count: 0, position: null }

    rawEvents.forEach(e => {
        const playerName = e.player?.name;
        if (!playerName) return;

        if (!playerUnitMap.has(playerName)) {
            playerUnitMap.set(playerName, { count: 0, position: null });
        }

        const entry = playerUnitMap.get(playerName);
        
        // Count technical actions
        if (['Pass', 'Dribble', 'Shot', 'Ball Recovery', 'Clearance'].includes(e.type?.name)) {
            entry.count++;
        }

        // Capture position from the first available event
        if (!entry.position && e.position?.name) {
            entry.position = e.position.name;
        }
    });

    // Filter by unit type and sort by count
    const playersInUnit = [];
    playerUnitMap.forEach((data, name) => {
        if (data.position && POSITIONS[data.position] === unitType) {
            playersInUnit.push({ name, count: data.count });
        }
    });

    return playersInUnit.sort((a, b) => b.count - a.count).map(p => p.name);
}

export async function generateTeamBiometricsAsync(rawEvents, teamName, onProgress) {
    const teamPlayers = Array.from(new Set(
        rawEvents.filter(e => e.team?.name === teamName).map(e => e.player?.name).filter(Boolean)
    ));

    const allTimelines = [];
    for (let i = 0; i < teamPlayers.length; i++) {
        const player = teamPlayers[i];
        if (onProgress) onProgress(i + 1, teamPlayers.length, player);
        
        const { filteredEvents, subInTime, subOutTime } = filterPlayerEvents(rawEvents, player);
        allTimelines.push(simulateBiometrics(filteredEvents, subInTime, subOutTime));
        
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    const averagedTimeline = [];
    const totalSeconds = allTimelines[0]?.length || 0;

    for (let s = 0; s < totalSeconds; s++) {
        const activePlayers = allTimelines.filter(t => t[s]?.hr !== null);
        if (activePlayers.length === 0) {
            averagedTimeline.push({ second: s, hr: null, speed: 0 });
            continue;
        }

        const avgHr = activePlayers.reduce((sum, t) => sum + t[s].hr, 0) / activePlayers.length;
        const avgSpeed = activePlayers.reduce((sum, t) => sum + t[s].speed, 0) / activePlayers.length;
        averagedTimeline.push({ second: s, hr: Math.round(avgHr), speed: parseFloat(avgSpeed.toFixed(1)) });
    }

    return averagedTimeline;
}

/**
 * Calculates team-wide aggregate stats from the averaged biometric timeline.
 * FIX: Uses the provided averagedTimeline (simulated data) instead of re-simulating 
 * with a deterministic formula to ensure regeneration works.
 */
export function calculateTeamSummary(averagedTimeline, rawEvents, teamName) {
    const hrs = averagedTimeline.filter(d => d.hr !== null).map(d => d.hr);
    const maxHr = hrs.length > 0 ? Math.max(...hrs) : 0;
    const minHr = hrs.length > 0 ? Math.min(...hrs) : 0;
    const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;

    const unitMins = { 'Attacker': 0, 'Midfielder': 0, 'Defender': 0 };
    const unitPlayers = { 'Attacker': [], 'Midfielder': [], 'Defender': [] };
    const unitStats = {
        'Attacker': { min: Infinity, max: -Infinity, sum: 0, count: 0 },
        'Midfielder': { min: Infinity, max: -Infinity, sum: 0, count: 0 },
        'Defender': { min: Infinity, max: -Infinity, sum: 0, count: 0 }
    };
    
    const teamPlayers = Array.from(new Set(rawEvents.filter(e => e.team?.name === teamName).map(e => e.player?.name).filter(Boolean)));

    teamPlayers.forEach(player => {
        const playerEvents = rawEvents.filter(e => e.player?.name === player);
        const posEvent = playerEvents.find(e => e.position?.name);
        if (!posEvent) return;
        const unit = POSITIONS[posEvent.position.name] || 'Midfielder';
        
        unitPlayers[unit].push(player);

        const tactical = playerEvents.filter(e => ['Pass', 'Dribble', 'Shot', 'Ball Recovery', 'Clearance'].includes(e.type?.name));
        
        // Find the simulated HR for this player's events from the averaged timeline (approximation)
        // Note: For unit-level summary, we aggregate the averaged spikes
        tactical.forEach(event => {
            const absSec = (event.minute * 60) + event.second + (CONFIG.PERIOD_OFFSETS[event.period || 1] || 0);
            
            // We look for the smoothed averaged HR at this exact time
            const bioAtTime = averagedTimeline.find(t => t.second === absSec);
            if (!bioAtTime || bioAtTime.hr === null) return;

            const hr = bioAtTime.hr;
            
            unitStats[unit].min = Math.min(unitStats[unit].min, hr);
            unitStats[unit].max = Math.max(unitStats[unit].max, hr);
            unitStats[unit].sum += hr;
            unitStats[unit].count++;
        });

        let subIn = 0, subOut = 5400;
        playerEvents.forEach(e => {
            if (e.type?.name === 'Substitution') {
                const absSec = (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0);
                if (e.player?.name === player) subOut = absSec;
                if (e.substitution?.replacement?.name === player) subIn = absSec;
            }
        });
        unitMins[unit] += (subOut - subIn) / 60;
    });

    const unitFinal = {};
    Object.keys(unitStats).forEach(unit => {
        const s = unitStats[unit];
        unitFinal[unit] = {
            min: s.count > 0 ? s.min : 0,
            max: s.count > 0 ? s.max : 0,
            avg: s.count > 0 ? Math.round(s.sum / s.count) : 0
        };
    });

    return { maxHr, minHr, avgHr, unitMins, unitPlayers, unitStats: unitFinal };
}

export function analyzeSquad(rawEvents) {
    const players = Array.from(new Set(rawEvents.map(e => e.player?.name).filter(Boolean)));
    const matchEndTime = rawEvents.length > 0 
        ? Math.max(...rawEvents.map(e => (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0))) 
        : 5400;

    const unitStats = {
        'Attacker': { actions: 0, highStressSuccess: 0, fatigueError: 0, standardSuccess: 0, standardError: 0, skillError: 0, hrSum: 0 },
        'Midfielder': { actions: 0, highStressSuccess: 0, fatigueError: 0, standardSuccess: 0, standardError: 0, skillError: 0, hrSum: 0 },
        'Defender': { actions: 0, highStressSuccess: 0, fatigueError: 0, standardSuccess: 0, standardError: 0, skillError: 0, hrSum: 0 }
    };

    players.forEach(playerName => {
        const playerEvents = rawEvents.filter(e => e.player?.name === playerName);
        
        const posEvent = playerEvents.find(e => e.position?.name);
        if (!posEvent) return;
        const unit = POSITIONS[posEvent.position.name] || 'Midfielder';

        let subIn = null, subOut = null;
        playerEvents.forEach(e => {
            if (e.type?.name === 'Substitution') {
                const absSec = (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0);
                if (e.player?.name === playerName) subOut = absSec;
                if (e.substitution?.replacement?.name === playerName) subIn = absSec;
            }
        });
        const pSubIn = subIn !== null ? subIn : 0;
        const pSubOut = subOut !== null ? subOut : matchEndTime;

        const tactical = playerEvents.filter(e => ['Pass', 'Dribble', 'Shot', 'Ball Recovery', 'Clearance'].includes(e.type?.name)).map(e => {
            const absSec = (e.minute * 60) + e.second + (CONFIG.PERIOD_OFFSETS[e.period || 1] || 0);
            let outcome = 'Successful';
            if (e.type.name === 'Pass' && e.pass?.outcome) outcome = 'Unsuccessful';
            else if (e.type.name === 'Dribble' && e.dribble?.outcome?.name !== 'Complete') outcome = 'Unsuccessful';
            return { timestamp: absSec, outcome, type: e.type.name };
        });

        tactical.forEach(event => {
            if (event.timestamp < pSubIn || event.timestamp > pSubOut) return;
            
            // Re-use the event impacts for consistency
            const eventImpacts = tactical.map(te => ({
                timestamp: te.timestamp,
                impact: (CONFIG.EVENT_IMPACT[te.type] || 12)
            }));

            const hr = _getEventHR(event.timestamp, eventImpacts);
            const cappedHr = Math.max(60, Math.min(CONFIG.PLAYER_MAX_HR, hr));
            const hrPercent = cappedHr / CONFIG.PLAYER_MAX_HR;
            
            unitStats[unit].actions++;
            unitStats[unit].hrSum += cappedHr;

            if (event.outcome === 'Successful') {
                if (hrPercent >= CONFIG.FATIGUE_THRESHOLD) unitStats[unit].highStressSuccess++;
                else unitStats[unit].standardSuccess++;
            } else {
                if (hrPercent >= CONFIG.FATIGUE_THRESHOLD) unitStats[unit].fatigueError++;
                else if (hrPercent <= CONFIG.SKILL_THRESHOLD) unitStats[unit].skillError++;
                else unitStats[unit].standardError++;
            }
        });
    });

    return unitStats;
}