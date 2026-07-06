import json
import csv

# 1. Load the JSON data
input_filename = 'highhelp/output.json'
output_filename = 'highhelp/output.csv'

try:
    with open(input_filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
except FileNotFoundError:
    print(f"Error: Could not find the file '{input_filename}'")
    data = []

# Safe parsing of the JSON structure (handles lists, dicts, or nested list of dicts)
results = []
if isinstance(data, list):
    for item in data:
        if isinstance(item, dict):
            # If the list elements are dicts containing the "results" key
            if "results" in item and isinstance(item["results"], list):
                results.extend(item["results"])
            # If the list elements are the raw records directly
            else:
                results.append(item)
elif isinstance(data, dict):
    results = data.get("results", [])

# Rule 1: Filter out deleted records (keep only is_deleted == 0)
active_records = [r for r in results if isinstance(r, dict) and r.get("is_deleted") == 0]


# -------------------------------------------------------------------------
# Rule 2 (Interpretation A): Deduplicate by user_id, keeping the lowest numeric rank.
# (If a user has duplicate entries, keep the one with the best/lowest numerical rank)
# -------------------------------------------------------------------------
# processed_data = {}
# for record in active_records:
#     user_id = record.get("user_id")
#     rank = record.get("rank")
    
#     if user_id not in processed_data or rank < processed_data[user_id].get("rank"):
#         processed_data[user_id] = record

# final_records = list(processed_data.values())


# -------------------------------------------------------------------------
# Rule 2 (Interpretation B - ALTERNATIVE):
# Deduplicate by rank, keeping the record with the lowest aggregate score.
# (If you prefer this logic, uncomment this block and comment out Interpretation A above)
# -------------------------------------------------------------------------
processed_data = {}
for record in active_records:
    rank = record.get("rank")
    aggregate = record.get("aggregate")
    
    if rank not in processed_data or aggregate < processed_data[rank].get("aggregate"):
        processed_data[rank] = record
final_records = list(processed_data.values())
# -------------------------------------------------------------------------


# 3. Save the final processed records to output.csv
if final_records:
    # Identify headers based on the keys of the first item
    headers = final_records[0].keys()
    
    with open(output_filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()
        writer.writerows(final_records)
        
    print(f"Successfully processed {len(final_records)} records and saved to {output_filename}")
else:
    print("No records found matching the criteria.")