# KineSync Project Requirements (Final Specifications)

KineSync is a high-performance soccer analytics demo designed to bridge the gap between tactical event data and physiological state. The system identifies "Resilience Events"—technical errors or successes that are directly correlated with a player's heart rate and fatigue levels.

## 1. Functional Requirements

### 1.1 Data Ingestion & Processing
- **Tactical Data Source**: The system must fetch event data from remote StatsBomb JSON endpoints.
- **Match Configuration**: Support for specific high-profile matches (e.g., World Cup Finals) with pre-configured remote paths.
- **Temporal Mapping**: Convert match timestamps (Period, Minute, Second) into a linear absolute-second timeline for telemetry alignment.
- **Player Filtering**: Ability to isolate tactical events for a specific player and determine their "on-pitch" duration (Substitution In/Out).

### 1.2 Biometric Simulation
- **Heart Rate (HR) Modeling**: Generate a per-second HR curve using a base physiological decay model combined with tactical event spikes.
- **Event-Driven Spikes**: Apply specific BPM increases based on the action type:
  - Shot: +17 BPM
  - Dribble: +15 BPM
  - Ball Recovery: +13 BPM
  - Clearance: +11 BPM
  - Pass: +9 BPM
- **Physiological Constraints**: Enforce a minimum HR floor (60 BPM) and a maximum cap (198 BPM).

### 1.3 Resilience Analysis Logic
The system must classify technical actions based on the player's heart rate percentage ($\text{HR \%} = \frac{\text{Current HR}}{\text{Max HR}}$):

| Outcome | HR % Range | Classification |
| :--- | :--- | :--- |
| Unsuccessful | $\geq 90\%$ | **Fatigue-Induced Error** |
| Unsuccessful | $\leq 80\%$ | **Technical Skill Error** |
| Unsuccessful | $80\% - 90\%$ | Standard Error |
| Successful | $\geq 90\%$ | **High-Stress Success** |
| Successful | $< 90\%$ | Standard Success |

### 1.4 Integration & Export
- **Hudl XML Export**: Generate a compatible XML timeline identifying "Resilience Events" for direct import into video analysis software (Hudl).
- **Data Export**: Provide a CSV export of the generated biometric telemetry.

## 2. Technical Requirements

### 2.1 Architecture
- **Browser-First**: The application must be a client-side implementation (HTML/CSS/JS) requiring no backend server for the demo.
- **State Management**: Implement a cascading reset system:
  - Match Change $\rightarrow$ Reset Player $\rightarrow$ Reset Biometrics $\rightarrow$ Reset Export.
  - Player Change $\rightarrow$ Reset Biometrics $\rightarrow$ Reset Export.

### 2.2 Visualization
- **Telemetry Chart**: Interactive line chart (Chart.js) showing HR over time.
- **Analysis Chart**: Mixed-mode chart overlaying tactical events as scatter points on the HR curve, with dynamic colors and shapes representing resilience categories.

### 2.3 UI/UX
- **B2B Aesthetic**: Dark-themed, high-contrast interface designed for "Elite Coach" environments.
- **Workflow-Driven**: A step-by-step locked/unlocked progression (Match $\rightarrow$ Player $\rightarrow$ Simulation $\rightarrow$ Analysis).