import pandas as pd
import numpy as np
import os
import sys
import argparse

def generate_polar_mock(input_csv, output_csv):
    df = pd.read_csv(input_csv)
    df['Timestamp'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df.sort_values('Timestamp', inplace=True)

    kickoff = df['Timestamp'].iloc[0]

    start_time = kickoff
    end_time = df['Timestamp'].max() + pd.Timedelta(minutes=2)

    timeline = pd.DataFrame({'Timestamp': pd.date_range(start_time, end_time, freq='1s')})
    seconds_since_start = (timeline['Timestamp'] - start_time).dt.total_seconds()
    minutes_since_start = seconds_since_start / 60.0

    baseline_hr = 110 + (12 * np.log1p(minutes_since_start)) + (2 * np.sin(seconds_since_start / 45))
    hr = baseline_hr.copy()

    EVENT_IMPACT = {
        'Pass': 9,
        'Clearance': 11,
        'Ball Recovery': 13,
        'Dribble': 15,
        'Shot': 17
    }

    PLAYER_MAX_HR = 198

    for _, event in df.iterrows():
        event_time = event['Timestamp']
        event_type = event['Event_Type']

        base_spike = EVENT_IMPACT.get(event_type, 12)
        actual_spike = base_spike + np.random.uniform(-3, 4)

        window = timeline['Timestamp'].between(event_time - pd.Timedelta(seconds=2), event_time + pd.Timedelta(seconds=8))
        delta_seconds = (timeline.loc[window, 'Timestamp'] - event_time).dt.total_seconds().abs()
        hr.loc[window] += actual_spike * np.exp(-0.25 * delta_seconds)

    hr += np.random.normal(0, 1.2, size=len(hr))
    hr = np.clip(hr, 60, PLAYER_MAX_HR)

    output = pd.DataFrame({
        'Date': timeline['Timestamp'].dt.strftime('%Y-%m-%d'),
        'Time': timeline['Timestamp'].dt.strftime('%H:%M:%S'),
        'Heart Rate [bpm]': hr.round().astype(int),
        'Speed [km/h]': np.where(hr > (PLAYER_MAX_HR * 0.85), np.random.uniform(15, 28, len(hr)), np.random.uniform(0, 10, len(hr))).round(1)
    })

    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    output.to_csv(output_csv, index=False)
    print(f"✅ Generated mock Polar HR data: {output_csv}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate mock Polar HR data from parsed events.')
    parser.add_argument('--match', required=True, help='Match name (e.g., arg_vs_fra)')
    parser.add_argument('--player', required=True, help='Player name (used to find parsed CSV)')
    args = parser.parse_args()

    try:
        input_csv = f"match_data/{args.match}/statsbomb/parsed/parsed_events_{args.player.replace(' ', '_').lower()}.csv"
        output_csv = f"match_data/{args.match}/polar/polar_mock_{args.player.replace(' ', '_').lower()}.csv"
        generate_polar_mock(input_csv, output_csv)
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)
