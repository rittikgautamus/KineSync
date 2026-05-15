# KineSync | Technical Resilience Demo

KineSync is a professional sports science demonstration tool that evaluates "Technical Resilience" by synchronizing tactical event data with biometric telemetry.

## 🚀 The Web Demo
The project has pivoted from a CLI tool to a **zero-infrastructure, client-side web application**. All processing occurs in the browser's memory, ensuring 100% data privacy and instant feedback.

### Key Features
- **Edge-Computed Pipeline**: Tactical extraction, biometric synthesis, and resilience analysis are performed entirely in JavaScript.
- **Direct Data Sourcing**: Fetches raw StatsBomb event data directly from official open-data repositories.
- **Hudl Integration**: Generates Hudl Sportscode compliant XML timelines for immediate video analysis.
- **Professional Dashboard**: A sequential "Evaluation Journey" with a real-time action log and data explorer.

## 🛠️ Local Setup
To run the demo locally:
1. Clone the repository.
2. Launch a local static server from the root directory:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser and navigate to: `http://localhost:8000`

## 📈 Pipeline Workflow
1. **Match Selection**: Load a preconfigured match dataset.
2. **Player Selection**: Filter technical actions for a specific player.
3. **Biometric Simulation**: Generate a synthetic 1Hz HR and speed telemetry stream.
4. **Resilience Analysis**: Classify actions as Fatigue-Induced Errors, Technical Skill Errors, or High-Stress Successes.
5. **Export**: Preview and download the enriched Hudl XML timeline.

## 📂 Project Structure
- `index.html`: The main application UI.
- `style.css`: Professional B2B styling and layout.
- `engine.js`: The core compute engine (JS translation of the original Python pipeline).
- `REQUIREMENTS.md`: Detailed technical specifications.
- `AGENT_TESTING.md`: Standardized verification procedures.