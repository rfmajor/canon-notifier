import sys
import json
from zoneinfo import ZoneInfo
from dateutil import parser

CEST_ZONE = ZoneInfo("Europe/Warsaw")
H_M_FORMAT = "%H:%M"
D_H_M_FORMAT = "%Y-%m-%d %H:%M"
D_FORMAT = "%Y-%m-%d"

def calculate_stats():
    filename = sys.argv[1]
    all_invocations = 0
    invocations = {}
    successes = {}
    errors = {}
    availables = {}
    last_successful_timestamps = {}
    last_available_timestamps = {}
    table_format = "| {:<15} | {:<15} | {:<15} | {:<30} | {:<15} | {:<15} | {:<30}|"

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

    header = table_format.format("Site", "Invocations", "Successes",
                              "Last success", "Errors", "Availables",
                              "Last available")
    divider = "-" * len(header)
    print(divider)
    print(header)
    print(divider)
    for k in invocations:
        print(table_format.format(k, invocations[k], successes[k],
                                  last_successful_timestamps.get(k, "None"),
                                  errors[k], availables[k],
                                  last_available_timestamps.get(k, "None")))
    print(divider)


def calculate_availability_periods():
    filename = sys.argv[1]
    was_available = {}
    current_period = {}
    saved_period = {}
    table_format = "| {:<15} | {:<40}|"
    with open(filename, 'r', encoding='utf-8') as file:
        for line in file:
            row = json.loads(line)
            timestamp = row["timestamp"]

            for availability in row["availability"]:
                site_name = availability["siteName"]
                if site_name not in was_available:
                    was_available[site_name] = False
                if site_name not in current_period:
                    current_period[site_name] = None
                if site_name not in saved_period:
                    saved_period[site_name] = []

                if availability["available"]:
                    if was_available[site_name]:
                        current_period[site_name][1] = timestamp
                    else:
                        current_period[site_name] = [timestamp, None]
                    was_available[site_name] = True
                else:
                    if was_available[site_name]:
                        saved_period[site_name].append(current_period[site_name])
                        current_period[site_name] = None
                    was_available[site_name] = False
        for site_name in current_period:
            if current_period[site_name] is not None:
                saved_period[site_name].append(current_period[site_name])

    header = table_format.format("Site", "Availability periods (CEST)")
    divider = "-" * len(header)
    print(divider)
    print(header)
    print(divider)
    for site_name in saved_period:
        date_str = ""
        first_it = True
        for p in reversed(saved_period[site_name]):
            d_from = parse_date(p[0])
            if p[1] is None:
                date_str = f"{d_from} - present"
            else:
                d_to = parse_date(p[1])

                if d_from.day == d_to.day:
                    date_str = f"{d_from.strftime(H_M_FORMAT)} - {d_to.strftime(H_M_FORMAT)}, {d_from.strftime(D_FORMAT)}"
                else:
                    date_str = f"{d_from.strftime(D_H_M_FORMAT)} - {d_to.strftime(D_H_M_FORMAT)}"
            if first_it:
                print(table_format.format(site_name, date_str))
            else:
                print(table_format.format("", date_str))
            if first_it:
                first_it = False
    print(divider)


def parse_date(timestamp):
    return parser.parse(timestamp).astimezone(CEST_ZONE)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise Exception("No filename provided")
    calculate_stats()
    calculate_availability_periods()
