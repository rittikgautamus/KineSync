# KineSync Technical Specification (v1.0)

## 1. Project Overview
KineSync is a sports science data pipeline designed to synchronize asynchronous tactical event data (StatsBomb) with synchronous physical biometric telemetry (Polar). The system evaluates "Technical Resilience" by matching the physiological state of a player at the exact moment of a technical action to identify fatigue-induced errors versus technical skill gaps.

## 2. Pipeline Architecture
The pipeline consists of three sequential processing stages:

### Stage 1: Tactical Extraction (`parse_statsbomb.py`)
- **Objective**: Extract player-specific technical events and resolve absolute match timestamps.
- **Event Filtering**: Filters for high-impact tactical events: `Pass`, `Dribble`, `Shot`, `Ball Recovery`, and `Clearance`.
- **Temporal Synchronization**: 
    - Resolves actual kickoff time using match metadata.
    - Applies period-specific offsets to handle halftime and extra-time gaps:
        - Period 2: +15 min (Halftime)
        - Period 3: +20 min (Halftime + gap)
        - Period 4: +22 min (HT + ET gap + ET halftime)
        - Period 5: +27 min (Penalty shootout gap)
- **Output**: `match_data/{match}/statsbomb/parsed/parsed_events_{player}.csv`

### Stage 2: Biometric Synthesis (`generate_polar_mock.py`)
- **Objective**: Generate a realistic 1Hz biometric telemetry dataset mimicking Polar Team Pro outputs.
- **Synthesis Logic**:
    - **Baseline**: Logarithmic growth over match duration with sinusoidal variance.
    - **Event-Driven Spikes**: HR increases based on event type intensity:
        - `Shot`: +17 bpm
        - `Dribble`: +15 bpm
        - `Ball Recovery`: +13 bpm
        - `Clearance`: +11 bpm
        - `Pass`: +9 bpm
    - **Physiological Limits**: HR is clipped between 60 bpm and a player-specific `PLAYER_MAX_HR` (default: 198 bpm).
    - **Speed Mapping**: Speed [km/h] is synthesized based on HR intensity (High HR $\rightarrow$ High Speed).
- **Output**: `match_data/{match}/polar/polar_mock_{player}.csv`

### Stage 3: Resilience Analysis & Export (`generate_engine_xml.py`)
- **Objective**: Merge datasets and categorize the "Technical Resilience" of each action.
- **Synchronization**: Inner join of tactical and biometric data on `Date` and `Time`.
- **Resilience Evaluation Matrix**:
    Based on `PLAYER_MAX_HR` (198 bpm):
    - **Fatigue Threshold**: $\ge 90\%$ Max HR ($\approx 178$ bpm)
    - **Skill Threshold**: $\le 80\%$ Max HR ($\approx 158$ bpm)

| Outcome | Heart Rate % | Resilience Category |
| :--- | :--- | :--- |
| Unsuccessful | $\ge 90\%$ | **Fatigue-Induced Error** |
| Unsuccessful | $\le 80\%$ | **Technical Skill Error** |
| Unsuccessful | $80\% - 90\%$ | Standard Error |
| Successful | $\ge 90\%$ | **High-Stress Success** |
| Successful | $< 90\%$ | Standard Success |

- **Output**: `match_data/{match}/hudl/su_enriched_timeline.xml`

## 3. Output Specification (Hudl Sportscode XML)
The final output is a strictly formatted XML file compliant with the Hudl Sportscode standard to allow direct drag-and-drop into video analysis software.

- **Clip Window**: Each identified "Key Event" (Fatigue Error, Skill Error, or High-Stress Success) is exported as a clip with a window of **+/- 3 seconds** around the event timestamp.
- **Labeling Schema**:
    - `Player`: The name of the analyzed player.
    - `Action Type`: The tactical event type (e.g., "Pass").
    - `Heart Rate at Event`: The exact BPM recorded at the event second.

## 4. Data Schema Summary

| Stage | Input | Output | Format |
| :--- | :--- | :--- | :--- |
| **Extraction** | StatsBomb JSON | `parsed_events_{p}.csv` | CSV |
| **Synthesis** | `parsed_events_{p}.csv` | `polar_mock_{p}.csv` | CSV |
| **Analysis** | Tactical CSV + Polar CSV | `su_enriched_timeline.xml` | XML |