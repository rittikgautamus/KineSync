# Agent Testing Instructions: KineSync Web Demo

This document provides a standardized procedure for verifying the end-to-end functionality of the KineSync browser-based demonstration.

## 1. Environment Setup
To run the demo locally, a static web server is required to allow the browser to `fetch()` the JSON data files.

**Command to launch server:**
```bash
# From the project root /home/user/projects/KineSync
python3 -m http.server 8000
```

**Access URL:**
Open a web browser and navigate to: `http://localhost:8000`

## 2. Step-by-Step Testing Flow

### Step 1: Match Selection
- **Action**: Select a match from the "Match Selection" dropdown (e.g., "Argentina vs France").
- **Expected Result**: 
    - The "Match Selection" status updates to "Loaded [Match Name] events."
    - The "Player Selection" step unlocks (becomes active).
    - The Action Log on the right displays: `✓ Loaded [X] events, [Y] players available`.

### Step 2: Player Selection
- **Action**: Select a player from the "Player Selection" dropdown (e.g., "Enzo Fernandez").
- **Expected Result**:
    - The "Player Selection" status updates to "Extracted [N] technical actions for [Player]."
    - The "Generate Biometrics" step unlocks.
    - The Action Log displays: `✓ Player selected: [Player] ([N] events)`.

### Step 3: Biometric Simulation
- **Action**: Click the "Generate Biometrics" button.
- **Expected Result**:
    - The "Biometric Simulation" status updates.
    - The **Biometric Stats** panel on the right populates with:
        - Generation Time
        - Total Points (approx. 300-5400)
        - Min/Max/Avg Heart Rate
    - The Action Log displays: `✓ Generated [X] telemetry points` and `✓ Stats computed and displayed`.
    - The "Export to Hudl" step unlocks.

### Step 4: Regeneration Test
- **Action**: Click the "Generate Biometrics" button again.
- **Expected Result**:
    - The Biometric Stats update (Max/Min/Avg HR should vary slightly due to stochastic noise).
    - The Generation Time updates to the current time.
    - The Action Log adds new entries for the regeneration event.

### Step 5: Hudl Export (Pending Implementation)
- **Action**: Click the "Export to Hudl" button.
- **Expected Result**:
    - A file named `enriched_timeline_[player].xml` is downloaded.
    - The XML opens in a new browser tab.
    - The XML contains `<instance>` tags for Fatigue Errors, Skill Errors, and High-Stress Successes.

## 3. Validation Criteria
| Feature | Pass Criteria |
| :--- | :--- |
| **Data Loading** | No 404 errors in browser console; match data loads correctly. |
| **Player Filtering** | Player dropdown is populated dynamically from the JSON. |
| **Simulation** | HR values are clipped between 60 and 198 bpm. |
| **UI State** | Steps unlock sequentially; locked steps cannot be interacted with. |
| **Logging** | Every major action is timestamped and logged in the RHS panel. |