import pandas as pd
import xml.etree.ElementTree as ET
from xml.dom import minidom
import os
import sys
import argparse

def apply_resilience_logic(row, max_hr):
    hr = row['Heart Rate [bpm]']
    outcome = row['Outcome']

    if pd.isna(hr):
        return 'Standard Action'

    fatigue_threshold = max_hr * 0.90
    skill_threshold = max_hr * 0.80

    if outcome == 'Unsuccessful':
        if hr >= fatigue_threshold:
            return 'Fatigue-Induced Error'
        elif hr <= skill_threshold:
            return 'Technical Skill Error'
        else:
            return 'Standard Error'
    elif outcome == 'Successful':
        if hr >= fatigue_threshold:
            return 'High-Stress Success'
        else:
            return 'Standard Success'

    return 'Standard Action'

def generate_hudl_xml(merged_df, output_path, player_name):
    print('Generating Hudl Sportscode XML...')

    file_elem = ET.Element('file')
    instances_elem = ET.SubElement(file_elem, 'instances')
    instance_id = 1

    key_events = merged_df[merged_df['Resilience_Category'].isin([
        'Fatigue-Induced Error',
        'Technical Skill Error',
        'High-Stress Success',
    ])]

    for _, row in key_events.iterrows():
        match_seconds = (row['Minute'] * 60) + row['Second']
        start_time = max(0, match_seconds - 3)
        end_time = match_seconds + 3

        instance = ET.SubElement(instances_elem, 'instance')
        ET.SubElement(instance, 'ID').text = str(instance_id)
        ET.SubElement(instance, 'start').text = str(start_time)
        ET.SubElement(instance, 'end').text = str(end_time)
        ET.SubElement(instance, 'code').text = str(row['Resilience_Category'])

        label_player = ET.SubElement(instance, 'label')
        ET.SubElement(label_player, 'group').text = 'Player'
        ET.SubElement(label_player, 'text').text = player_name

        label_action = ET.SubElement(instance, 'label')
        ET.SubElement(label_action, 'group').text = 'Action Type'
        ET.SubElement(label_action, 'text').text = str(row['Event_Type'])

        label_hr = ET.SubElement(instance, 'label')
        ET.SubElement(label_hr, 'group').text = 'Heart Rate at Event'
        ET.SubElement(label_hr, 'text').text = f"{int(row['Heart Rate [bpm]'])} bpm"

        instance_id += 1

    xml_str = ET.tostring(file_elem, encoding='utf-8')
    parsed_xml = minidom.parseString(xml_str)
    pretty_xml = parsed_xml.toprettyxml(indent='  ')

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(pretty_xml)

    print(f"✅ Successfully created Sportscode XML: {output_path}")
    print(f"   Total categorized clips generated: {len(key_events)}")


def main():
    parser = argparse.ArgumentParser(description='Generate Hudl Sportscode XML from tactical and biometric data.')
    parser.add_argument('--match', required=True, help='Match name (e.g., arg_vs_fra)')
    parser.add_argument('--player', required=True, help='Player name (used to find CSVs)')
    args = parser.parse_args()

    try:
        tactical_csv = f"match_data/{args.match}/statsbomb/parsed/parsed_events_{args.player.replace(' ', '_').lower()}.csv"
        physical_csv = f"match_data/{args.match}/polar/polar_mock_{args.player.replace(' ', '_').lower()}.csv"
        output_xml = f"match_data/{args.match}/hudl/su_enriched_timeline.xml"

        print('Loading Tactical and Physical datasets...')
        df_tactical = pd.read_csv(tactical_csv)
        df_physical = pd.read_csv(physical_csv)

        print('Synchronizing datasets based on exact timestamps...')
        merged_df = pd.merge(df_tactical, df_physical, on=['Date', 'Time'], how='inner')
        print(f"✅ Successfully synced {len(merged_df)} events with physical telemetry.")

        print('Applying Technical Resilience Logic...')
        player_max_hr = 198
        merged_df['Resilience_Category'] = merged_df.apply(lambda row: apply_resilience_logic(row, player_max_hr), axis=1)

        os.makedirs(os.path.dirname(output_xml), exist_ok=True)
        generate_hudl_xml(merged_df, output_xml, args.player)
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
