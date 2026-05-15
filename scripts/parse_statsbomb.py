import glob
import json
import os
import sys
import argparse
import pandas as pd
import datetime

METADATA_FILES = [
    "match_data/{match}/statsbomb/metadata.json",
    "match_data/{match}/statsbomb/match_metadata.json",
    "match_data/{match}/metadata.json",
    "match_data/metadata/wc2022_matches.json",
]


def normalize_name(text):
    return ''.join(ch for ch in str(text).lower() if ch.isalnum())


def match_name_matches_alias(match_name, home_name, away_name):
    key = normalize_name(match_name)
    home = normalize_name(home_name)
    away = normalize_name(away_name)
    return key in {f"{home}vs{away}", f"{away}vs{home}", f"{home}{away}", f"{away}{home}"} or (home in key and away in key)


def find_match_metadata(match_name, metadata_list):
    for item in metadata_list:
        home = item.get('home_team', {}).get('home_team_name') or item.get('home_team', {}).get('country', {}).get('name')
        away = item.get('away_team', {}).get('away_team_name') or item.get('away_team', {}).get('country', {}).get('name')
        if home and away and match_name_matches_alias(match_name, home, away):
            return item
    return None


def load_match_metadata(match_name):
    for template in METADATA_FILES:
        metadata_path = template.format(match=match_name)
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            if isinstance(metadata, list):
                match_entry = find_match_metadata(match_name, metadata)
                if match_entry:
                    return metadata_path, match_entry
                raise FileNotFoundError(f"No matching entry for '{match_name}' in {metadata_path}")

            return metadata_path, metadata
    raise FileNotFoundError(
        "No metadata file found. Create one at match_data/{match}/statsbomb/metadata.json, "
        "match_data/{match}/metadata.json, or match_data/metadata/wc2022_matches.json"
    )


def parse_date(value):
    if isinstance(value, (list, tuple)) and len(value) == 3:
        return datetime.date(*value)
    if isinstance(value, str):
        return datetime.datetime.strptime(value, '%Y-%m-%d').date()
    raise ValueError('Unsupported date format in match metadata')


def parse_time(value):
    if isinstance(value, int):
        return datetime.time(value, 0, 0)
    if isinstance(value, str):
        for fmt in ('%H:%M:%S.%f', '%H:%M:%S', '%H:%M'):
            try:
                return datetime.datetime.strptime(value, fmt).time()
            except ValueError:
                continue
    if isinstance(value, dict):
        hour = int(value.get('hour', 0))
        minute = int(value.get('minute', 0))
        return datetime.time(hour, minute, 0)
    raise ValueError('Unsupported kickoff time format in match metadata')


def parse_event_timestamp(timestamp):
    if not timestamp:
        return None
    for fmt in ('%H:%M:%S.%f', '%H:%M:%S', '%H:%M'):
        try:
            return datetime.datetime.strptime(timestamp, fmt).time()
        except ValueError:
            continue
    return None


def resolve_kickoff(match_name):
    metadata_path, metadata = load_match_metadata(match_name)
    date_value = metadata.get('match_date') or metadata.get('date')
    time_value = metadata.get('kick_off') or metadata.get('kickoff_time') or metadata.get('kickoff') or metadata.get('start_time')

    if date_value is None or time_value is None:
        raise ValueError(
            f"Metadata {metadata_path} must contain both 'match_date' and one of "
            f"'kick_off', 'kickoff_time', 'kickoff', or 'start_time'."
        )

    match_date = parse_date(date_value)
    kickoff_time = parse_time(time_value)
    kickoff = datetime.datetime.combine(match_date, kickoff_time)
    print(f"Using kickoff metadata from {metadata_path}: {kickoff}")
    return kickoff


def parse_statsbomb_events(match_name, player_name):
    event_dir = f"match_data/{match_name}/statsbomb/events"
    json_files = sorted(glob.glob(os.path.join(event_dir, "*.json")))

    if not json_files:
        raise FileNotFoundError(f"No StatsBomb JSON files found in {event_dir}")

    kickoff = resolve_kickoff(match_name)
    parsed_events = []

    for json_path in json_files:
        print(f"Parsing {json_path} for '{player_name}'...")
        with open(json_path, 'r', encoding='utf-8') as f:
            events = json.load(f)

        for event in events:
            current_player = event.get('player', {}).get('name', '')
            if player_name.lower() not in current_player.lower():
                continue

            event_type = event.get('type', {}).get('name')
            if event_type not in ['Pass', 'Dribble', 'Shot', 'Ball Recovery', 'Clearance']:
                continue

            period = event.get('period', 1)
            minute = event.get('minute', 0)
            second = event.get('second', 0)
            timestamp = parse_event_timestamp(event.get('timestamp'))

            if timestamp is not None:
                absolute_seconds = (timestamp.hour * 3600) + (timestamp.minute * 60) + timestamp.second
            else:
                absolute_seconds = (minute * 60) + second

            # The KineSync halftime offset logic
            if period == 2:
                absolute_seconds += (15 * 60)  # 15 min halftime gap
            elif period == 3:
                absolute_seconds += (20 * 60)  # 15 min halftime + 5 min gap before ET
            elif period == 4:
                absolute_seconds += (22 * 60)  # 15 HT + 5 ET gap + 2 min ET halftime
            elif period == 5:
                absolute_seconds += (27 * 60)  # Gap before Penalty Shootout

            event_time = kickoff + datetime.timedelta(seconds=absolute_seconds)

            outcome = 'Successful'
            if event_type == 'Pass' and event.get('pass', {}).get('outcome'):
                outcome = 'Unsuccessful'
            elif event_type == 'Dribble' and event.get('dribble', {}).get('outcome', {}).get('name') != 'Complete':
                outcome = 'Unsuccessful'

            parsed_events.append({
                'Date': event_time.strftime('%Y-%m-%d'),
                'Time': event_time.strftime('%H:%M:%S'),
                'Minute': minute,
                'Second': second,
                'Event_Type': event_type,
                'Outcome': outcome,
                'StatsBomb_ID': event.get('id')
            })

    if not parsed_events:
        raise ValueError(f"No events found for player '{player_name}' in match '{match_name}'")

    df = pd.DataFrame(parsed_events)
    output_file = f"match_data/{match_name}/statsbomb/parsed/parsed_events_{player_name.replace(' ', '_').lower()}.csv"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    df.to_csv(output_file, index=False)

    print(f"✅ Extracted {len(df)} technical events for {player_name}.")
    print(f"✅ Saved: {output_file}")
    return output_file

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Parse StatsBomb events for a player.')
    parser.add_argument('--match', required=True, help='Match name (e.g., arg_vs_fra)')
    parser.add_argument('--player', required=True, help='Player name to filter (substring match)')
    args = parser.parse_args()

    try:
        parse_statsbomb_events(args.match, args.player)
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)
