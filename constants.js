/**
 * KineSync Global Constants and Configuration
 */

export const CONFIG = {
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

export const MATCH_CONFIG = {
    argentina_vs_france: {
        label: 'Argentina vs France (World Cup Final)',
        eventsPath: 'match_data/argentina_vs_france/statsbomb/events/3869685.json',
        supported: true
    },
    argentina_vs_croatia: {
        label: 'Argentina vs Croatia (Semi-Final)',
        eventsPath: 'match_data/argentina_vs_croatia/statsbomb/events/3869519.json',
        supported: true
    },
    argentina_vs_australia: {
        label: 'Argentina vs Australia (Round of 16)',
        eventsPath: 'match_data/argentina_vs_australia/statsbomb/events/3869151.json',
        supported: true
    },
    serbia_vs_switzerland: {
        label: 'Serbia vs Switzerland (Group Stage)',
        eventsPath: 'match_data/serbia_vs_switzerland/statsbomb/events/3857256.json',
        supported: true
    }
};

export const POSITIONS = {
    'Goalkeeper': 'Defender', 'Right Center Back': 'Defender', 'Center Back': 'Defender', 'Left Center Back': 'Defender', 'Right Back': 'Defender', 'Left Back': 'Defender', 'Right Wing Back': 'Defender', 'Left Wing Back': 'Defender',
    'Right Defensive Midfield': 'Midfielder', 'Center Defensive Midfield': 'Midfielder', 'Left Defensive Midfield': 'Midfielder', 'Right Midfield': 'Midfielder', 'Center Midfield': 'Midfielder', 'Left Midfield': 'Midfielder', 'Right Attacking Midfield': 'Midfielder', 'Center Attacking Midfield': 'Midfielder', 'Left Attacking Midfield': 'Midfielder',
    'Right Wing': 'Attacker', 'Left Wing': 'Attacker', 'Secondary Striker': 'Attacker', 'Center Forward': 'Attacker', 'Striker': 'Attacker', 'Left Center Forward': 'Attacker', 'Right Center Forward': 'Attacker'
};
