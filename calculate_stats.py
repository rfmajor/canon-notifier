import sys
import json
import pprint
from collections import OrderedDict

def main():
    if len(sys.argv) < 2:
        raise Exception("No filename provided")

    filename = sys.argv[1]
    all_invocations = 0
    invocations = {}
    successes = {}
    errors = {}
    availables = {}

    with open(filename, 'r', encoding='utf-8') as file:
        latest_timestamp = None
        for line in file:
            row = json.loads(line)
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
                availables[site_name] += 1 if availability["available"] else 0
            all_invocations += 1
            latest_timestamp = row["timestamp"]
    stats = OrderedDict({
                "allInvocations": all_invocations,
                "latestTimestamp": latest_timestamp,
                "invocations": invocations,
                "successes": successes,
                "errors": errors,
                "availables": availables
            })

    pprint.pprint(stats)

main()
