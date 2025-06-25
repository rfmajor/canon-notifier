import sys
import json

def main():
    if len(sys.argv) < 2:
        raise Exception("No filename provided")

    filename = sys.argv[1]
    all_invocations = 0
    invocations = {}
    successes = {}
    errors = {}
    availables = {}
    last_successful_timestamps = {}
    last_available_timestamps = {}
    table_format = "{:<15} {:<15} {:<15} {:<30} {:<15} {:<15} {:<30}"

    with open(filename, 'r', encoding='utf-8') as file:
        latest_timestamp = None
        for line in file:
            row = json.loads(line)
            all_invocations += 1
            latest_timestamp = row["timestamp"]

            for availability in row["availability"]:
                site_name = availability["siteName"]
                if site_name not in errors:
                    errors[site_name] = 0
                if site_name not in successes:
                    successes[site_name] = 0
                if site_name not in availables:
                    availables[site_name] = 0
                if site_name not in invocations:
                    invocations[site_name] = 0

                invocations[site_name] += 1
                if availability["error"]:
                    errors[site_name] += 1
                    continue
                successes[site_name] += 1
                last_successful_timestamps[site_name] = latest_timestamp

                availables[site_name] += 1 if availability["available"] else 0
                if availability["available"]:
                    last_available_timestamps[site_name] = latest_timestamp

    print(table_format.format("Site", "Invocations", "Successes",
                              "Last success", "Errors", "Availables",
                              "Last available"))
    for k in invocations:
        print(table_format.format(k, invocations[k], successes[k],
                                  last_successful_timestamps.get(k, "None"),
                                  errors[k], availables[k],
                                  last_available_timestamps.get(k, "None")))

main()
