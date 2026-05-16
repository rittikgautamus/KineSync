# KineSync | Elite Performance Analytics Demo

KineSync is a browser-first analytical tool designed for professional soccer coaches and sports scientists. It synchronizes tactical event data with simulated biometric telemetry to identify "Resilience Events"—moments where physiological fatigue directly impacts technical execution.

## 🚀 Quick Start

KineSync is a zero-install, client-side application. To launch the demo:

1. Navigate to the project root directory.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Edge).

## 🛠 How it Works: The Workflow

The application follows a linear, workflow-driven process to ensure data integrity:

### Step 1: Match Selection
Choose a high-profile match from the dropdown. KineSync fetches the raw tactical event data directly from remote StatsBomb JSON endpoints.

### Step 2: Player Analysis
Select a player from the match roster. The engine isolates all technical actions (Passes, Shots, Dribbles, etc.) and calculates the player's exact time on the pitch, accounting for substitutions.

### Step 3: Biometric Simulation
Generate a simulated heart rate (HR) curve. This simulation uses a physiological model where HR spikes are driven by the intensity of the player's tactical actions, creating a realistic cardiovascular profile.

### Step 4: Resilience Export & Analysis
Export the analysis to a **Hudl XML** format. The system automatically classifies events based on HR percentage:
- **Fatigue-Induced Error**: Unsuccessful action at $\geq 90\%$ Max HR.
- **Technical Skill Error**: Unsuccessful action at $\leq 80\%$ Max HR.
- **High-Stress Success**: Successful action at $\geq 90\%$ Max HR.

## 💻 Technical Stack

- **Frontend**: HTML5, CSS3 (Custom Properties for Dark Theme), JavaScript (ES6+).
- **Visualization**: [Chart.js](https://www.chartjs.org/) for interactive telemetry and mixed-mode scatter plots.
- **Data**: StatsBomb Open Data API (via Fetch).
- **Export**: Custom XML generator for Hudl compatibility.

## 🎯 Key Features

- **Remote Data Integration**: No local data files required; fetches live JSON from GitHub.
- **Physiological Modeling**: Event-driven BPM spikes with natural decay.
- **Cascading State Management**: Integrated reset system to prevent stale data across match/player changes.
- **B2B Design**: High-contrast, dark-themed UI optimized for elite coaching environments.

---
*KineSync — Quantifying the physiological cost of technical precision.*