# KineSync Technical Specification (v2.0)

## 1. Project Overview
KineSync is a sports science product designed to evaluate "Technical Resilience" by synchronizing tactical event data with biometric telemetry. The current pivot delivers a browser-based demo for preconfigured matches, optimized for a fast demo experience.

## 2. Core Logic
The application still uses the same three-stage resilience evaluation model:

### Stage 1: Tactical Extraction
- **Objective**: Identify player-specific technical actions and assign absolute match timestamps.
- **Event Filtering**: Supports only the following event types: `Pass`, `Dribble`, `Shot`, `Ball Recovery`, and `Clearance`.
- **Temporal Synchronization**: Applies fixed period offsets for match timelines.

### Stage 2: Biometric Synthesis
- **Objective**: Generate a synthetic 1Hz telemetry signal in the browser.
- **Synthesis Logic**:
    - Baseline log growth and sine-wave variance.
    - Event-driven HR spikes based on action intensity.
    - Noise injection using a Box-Muller random normal generator.
    - HR values clipped between 60 bpm and `198 bpm`.

### Stage 3: Resilience Analysis & Export
- **Objective**: Classify player actions based on heart rate at event time.
- **Resilience Matrix**:
    - `Fatigue-Induced Error` for unsuccessful actions with HR ≥ 90% of max.
    - `Technical Skill Error` for unsuccessful actions with HR ≤ 80% of max.
    - `High-Stress Success` for successful actions with HR ≥ 90% of max.

## 3. Browser Demo Implementation
This version is specifically designed for a limited, supported-match browser demo.

### Supported Matches
- Matches are hardcoded in `engine.js` via a `MATCH_CONFIG` object.
- Only preconfigured matches that have committed JSON event data are supported.
- The current demo is built around the `arg_vs_fra` match.

### Client-Side Data Flow
- `index.html` provides the UI.
- `engine.js` fetches committed JSON event files from `match_data/`.
- All parsing, filtering, simulation, and XML generation happens in-memory in the browser.
- No backend service or Python runtime is required for the demo.

### Deployment Strategy
- Redeploy as a static site on GitHub Pages or any static hosting provider.
- Add new supported matches by committing their event JSON files and updating `MATCH_CONFIG`.

## 4. Output Specification
- The demo generates Hudl Sportscode XML via the browser.
- The XML is offered as a download and opened in a new browser tab for verification.

## 5. Local Browser Preview
- Launch a local static server from the repo root.
- Open `http://localhost:8000` and use the browser demo.

## 6. Notes
- The original Python pipeline scripts remain in the repo for reference.
- The browser demo is the recommended path for this fast-to-market release.
