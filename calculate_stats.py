import sys
import json
import pprint

def main():
    if len(sys.argv) < 2:
        raise Exception("No filename provided")

    filename = sys.argv[1]
    invocations = 0
    successes = {}
    errors = {}
    availables = {}

    with open(filename, 'r', encoding='utf-8') as file:
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

                if availability["error"]:
                    errors[site_name] += 1
                    continue
                successes[site_name] += 1
                availables[site_name] += 1 if availability["available"] else 0
            invocations += 1
    stats = {"invocations": invocations, "successes": successes,
            "errors": errors, "availables": availables}

    pprint.pprint(stats)

main()
