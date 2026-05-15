# About

KineSync converts raw sports data into a coach-ready video timeline. It combines StatsBomb tactical events with Polar-style biometric telemetry and produces a Hudl Sportscode XML file.

## Data flow
- Raw StatsBomb events and freeze frames are stored under `match_data/{match_name}/statsbomb/`
- Match metadata is stored under `match_data/metadata/`
- Synthetic or real Polar telemetry lives in `match_data/{match_name}/polar/`
- Hudl output is written to `match_data/{match_name}/hudl/`
- Scripts accept `--match` and `--player` arguments and construct all file paths dynamically

## Pipeline phases

### 1. Tactical extraction (`parse_statsbomb.py`)
- Input: StatsBomb event JSON files
- Filters events by player name (substring match)
- Extracts key technical actions: Pass, Dribble, Shot, Ball Recovery, Clearance
- Normalizes event success/failure
- Converts match time into continuous timestamp values, including a second-half offset
- Output: `match_data/{match_name}/statsbomb/parsed/parsed_events_{player}.csv`

### 2. Biometric ingestion / simulation (`generate_polar_mock.py`)
- Input: parsed events CSV
- Builds a 1Hz time series representing player heart rate and speed
- Simulates HR drift and event-triggered spikes for higher-intensity actions
- Output: `match_data/{match_name}/polar/polar_mock_{player}.csv`

### 3. Evaluation engine (`generate_engine_xml.py`)
- Inputs: parsed events CSV and polar mock/telemetry CSV
- Merges data on timestamp to align each event with the exact HR value
- Applies evaluation rules:
  - Unsuccessful event + HR >= 90% max → `Fatigue-Induced Error`
  - Unsuccessful event + HR <= 80% max → `Technical Skill Error`
  - Successful event + HR >= 90% max → `High-Stress Success`
- Output: `match_data/{match_name}/hudl/su_enriched_timeline.xml`

## XML structure
- Hudl Sportscode compliant XML
- Contains a root `<file>` element with nested `<instances>` and `<instance>` entries
- Each instance includes ID, start/end times, code category, and labels for Player, Action Type, and Heart Rate

## Notes
- The mock Polar generator is for development and demonstration; real Polar CSV files can replace it.
- Keep the workspace folder structure exact for scripts to resolve paths correctly.
