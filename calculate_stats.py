import sys
import json
from zoneinfo import ZoneInfo
from dateutil import parser

CEST_ZONE = ZoneInfo("Europe/Warsaw")
H_M_FORMAT = "%H:%M"
D_H_M_FORMAT = "%Y-%m-%d %H:%M"
D_H_M_S_FORMAT = "%Y-%m-%d %H:%M:%S"
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

    rows = []
    for k in invocations:
        last_successful = last_successful_timestamps.get(k, "None")
        if last_successful != "None":
            last_successful = parse_date(last_successful).strftime(D_H_M_S_FORMAT)
        last_available = last_available_timestamps.get(k, "None")
        if last_available != "None":
            last_available = parse_date(last_available).strftime(D_H_M_S_FORMAT)
        rows.append([k, invocations[k], successes[k], last_successful,
                     errors[k], availables[k], last_available])

    print(as_table(["Site", "Invocations", "Successes", "Last success (CEST)",
                    "Errors", "Availables", "Last available (CEST)"], rows))


def calculate_availability_periods():
    filename = sys.argv[1]
    was_available = {}
    current_period = {}
    saved_period = {}
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
                        current_period[site_name][1] = timestamp
                        saved_period[site_name].append(current_period[site_name])
                        current_period[site_name] = None
                    was_available[site_name] = False
        for site_name in current_period:
            if current_period[site_name] is not None:
                saved_period[site_name].append(current_period[site_name])

    rows = []
    for site_name in saved_period:
        date_str = ""
        dates = []
        for p in reversed(saved_period[site_name]):
            d_from = parse_date(p[0])
            if p[1] is None:
                date_str = f"{d_from.strftime(H_M_FORMAT)} - present, {d_from.strftime(D_FORMAT)}"
            else:
                d_to = parse_date(p[1])

                if d_from.day == d_to.day:
                    date_str = f"{d_from.strftime(H_M_FORMAT)} - {d_to.strftime(H_M_FORMAT)}, {d_from.strftime(D_FORMAT)}"
                else:
                    date_str = f"{d_from.strftime(D_H_M_FORMAT)} - {d_to.strftime(D_H_M_FORMAT)}"
            dates.append(date_str)
        if len(dates) > 0:
            rows.append([site_name, dates])
    print(as_table(["Site", "Availability periods (CEST)"], rows))


def parse_date(timestamp):
    return parser.parse(timestamp).astimezone(CEST_ZONE)


def as_table(header, rows):
    for r in rows:
        if len(header) != len(r):
            raise Exception("Header and rows need to have the same length")
    result = ""
    widths = [0] * len(header)
    for i, item in enumerate(header):
        if len(item) > widths[i]:
            widths[i] = len(item)
    for row in rows:
        for i, col in enumerate(row):
            if isinstance(col, list):
                for c in col:
                    if len(c) > widths[i]:
                        widths[i] = len(c)
            else:
                str_len = len(str(col))
                if str_len > widths[i]:
                    widths[i] = str_len
    table_format = "| " + " | ".join(["{:<" + str(w) + "}" for w in widths]) + " |"
    t_header = table_format.format(*header)
    t_divider = "-" * len(t_header)

    result += f"{t_divider}\n"
    result += f"{t_header}\n"
    result += f"{t_divider}\n"

    for r in rows:
        col_max_items = max([len(col) if isinstance(col, list) else 1 for col in r])
        if col_max_items > 1:
            col_idx = 0
            while col_idx < col_max_items:
                cols = []
                for col in r:
                    if isinstance(col, list):
                        if len(col) > col_idx:
                            cols.append(col[col_idx])
                        else:
                            cols.append("")
                    elif col_idx == 0:
                        cols.append(col)
                    else:
                        cols.append("")
                t_row = table_format.format(*cols)
                result += f"{t_row}\n"
                col_idx += 1
        else:
            t_row = table_format.format(*r)
            result += f"{t_row}\n"

    result += f"{t_divider}\n"

    return result

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise Exception("No filename provided")
    calculate_stats()
    calculate_availability_periods()
