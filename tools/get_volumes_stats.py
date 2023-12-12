import requests
import urllib.parse

BATCH_SIZE = 10000
K7_HOST = "https://api.kramerius.mzk.cz/search"
FIELDS = ["root.pid", "own_parent.pid", "pid", "own_parent.title", "date.str",
          "publishers.search", "languages.facet", "publication_places.search"]
FIELDS_URL = urllib.parse.quote(",".join(FIELDS))
QUERY_VOLUMES = urllib.parse.quote("model:periodicalvolume")
QUERY_PERIODICALS = urllib.parse.quote("model:periodical")
QUERY_PERIODICAL_CHILDREN = "model:(periodicalitem OR supplement) " \
    "AND own_parent.pid:\"{VOLUME_PID}\""
QUERY_PAGES_COUNT = "own_parent.pid:\"{PARENT_PID}\""


def get_stats_for_query(query):
    response = requests.get(query)
    response_json = response.json()
    stats = []

    for doc in response_json["response"]["docs"]:
        stats.append([doc.get(field) for field in FIELDS])
    return stats


def get_pages_count(volume_pid):
    query = urllib.parse.quote(
        QUERY_PERIODICAL_CHILDREN.format(VOLUME_PID=volume_pid))
    response = requests.get(
        f"{K7_HOST}/api/client/v7.0/search?q={query}&rows=10000&fl=pid"
    )

    children = response.json()["response"]["docs"]
    pages_count = 0
    for child in children:
        query = urllib.parse.quote(
            QUERY_PAGES_COUNT.format(PARENT_PID=child.get("pid")))
        response = requests.get(
            f"{K7_HOST}/api/client/v7.0/search?q={query}&rows=0"
        )
        pages_count += response.json()["response"]["numFound"]
    return pages_count


def unpack_list(_list):
    if _list is None:
        return "not_found"
    return _list[0] if len(_list) == 1 else "multiple"


response = requests.get(
    f"{K7_HOST}/api/client/v7.0/search?"
    f"q={QUERY_VOLUMES}&fl={FIELDS_URL}&rows=0"
)
num_found = response.json()["response"]["numFound"]
batch_count = num_found // BATCH_SIZE

volumes_stats = []
for batch in range(batch_count + 1):
    offset = BATCH_SIZE * batch
    query = f"{K7_HOST}/api/client/v7.0/search?q={QUERY_VOLUMES}" \
            f"&fl={FIELDS_URL}&rows={BATCH_SIZE}&start={offset}"
    volumes_stats.extend(get_stats_for_query(query))


response = requests.get(f"{K7_HOST}/api/client/v7.0/search"
                        f"?q={QUERY_PERIODICALS}&fl={FIELDS_URL}&rows=0")
num_found = response.json()["response"]["numFound"]
batch_count = num_found // BATCH_SIZE

periodicals_stats = []
for batch in range(batch_count + 1):
    offset = BATCH_SIZE * batch
    query = f"{K7_HOST}/api/client/v7.0/search?q={QUERY_PERIODICALS}" \
        f"&fl={FIELDS_URL}&rows={BATCH_SIZE}&start={offset}"
    periodicals_stats.extend(get_stats_for_query(query))

periodicals_dict = {sublist[0]: sublist[1:] for sublist in periodicals_stats}

for volume in volumes_stats:
    if volume[0] != volume[1]:
        print(f"{volume[2]}||wrong_level_volume")
        continue

    periodical = periodicals_dict.get(volume[0])
    if periodical is None:
        print(f"{volume[2]}||root_does_not_exists")
        continue

    pid, title, year, publishers, languages, places = volume[2:]

    if title is None:
        title = periodical[2]
    if publishers is None:
        publishers = periodical[4]
    if languages is None:
        languages = periodical[5]
    if places is None:
        places = periodical[6]

    publisher = unpack_list(publishers)
    language = unpack_list(languages)
    place = unpack_list(places)
    pages_count = get_pages_count(pid)

    print(f"{pid}||{title}||{year}||{publisher}||{language}||{place}"
          f"||{pages_count}")
