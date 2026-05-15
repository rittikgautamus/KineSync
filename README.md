# KineSync

A sports science pipeline that synchronizes StatsBomb tactical event data with Polar biometric telemetry and generates Hudl Sportscode XML timelines.

## Requirements
- Python 3.8+
- `pandas`

## Directory architecture
Your workspace must follow this structure:

```text
match_data/
└── {match_name}/
    ├── statsbomb/
    │   ├── events/
    │   ├── freeze_frames/
    │   ├── parsed/
    │   └── metadata.json
    ├── polar/
    └── hudl/
scripts/
├── parse_statsbomb.py
├── generate_polar_mock.py
└── generate_engine_xml.py
```

## Download example data

cd /home/user/projects/KineSync

mkdir -p match_data/{match_name}/statsbomb/{events,freeze_frames,parsed}
mkdir -p match_data/{match_name}/polar
mkdir -p match_data/{match_name}/hudl
mkdir -p match_data/metadata

# Example: Argentina vs France
cd match_data/arg_vs_fra/statsbomb/events
wget https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/3869685.json
cd ../freeze_frames
wget https://raw.githubusercontent.com/statsbomb/open-data/master/data/three-sixty/3869685.json
cd ../../../..

# StatsBomb match metadata
cd match_data/metadata
wget https://raw.githubusercontent.com/statsbomb/open-data/master/data/matches/43/106.json -O wc2022_matches.json
cd ../..

## Run

uv run python scripts/parse_statsbomb.py --match arg_vs_fra --player Enzo
uv run python scripts/generate_polar_mock.py --match arg_vs_fra --player Enzo
uv run python scripts/generate_engine_xml.py --match arg_vs_fra --player Enzo

## CLI arguments

parse_statsbomb.py
- `--match` (required): Match folder name (e.g., `arg_vs_fra`)
- `--player` (required): Player name to extract (substring match)

generate_polar_mock.py
- `--match` (required): Match folder name
- `--player` (required): Player name (must match `parse_statsbomb` output)

generate_engine_xml.py
- `--match` (required): Match folder name
- `--player` (required): Player name (must match `polar_mock` output)

## Outputs
- `match_data/{match_name}/statsbomb/parsed/parsed_events_{player}.csv`
- `match_data/{match_name}/polar/polar_mock_{player}.csv` (includes Heart Rate [bpm] and Speed [km/h])
- `match_data/{match_name}/hudl/su_enriched_timeline.xml`

## Workflow summary
1. `parse_statsbomb.py` reads StatsBomb JSON, filters a player, and writes a cleaned events CSV.
2. `generate_polar_mock.py` creates a synthetic 1Hz Polar-style telemetry file.
3. `generate_engine_xml.py` merges event and HR data, then writes a Hudl-compatible XML timeline.
