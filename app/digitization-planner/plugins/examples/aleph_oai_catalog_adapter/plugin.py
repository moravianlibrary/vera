from aleph_nought import AlephOAIClient, AlephOAIConfig


def main():
    client = AlephOAIClient(
        AlephOAIConfig(
            host="https://aleph.mzk.cz",
            endpoint="/OAI",
            set="MZKALL",
            base_system_number_regex=(
                r"oai:aleph.mzk.cz:(?P<base>MZK\d{2})-(?P<system_number>\d{9})"
            ),
        )
    )

    from_date = "2025-03-01T00:00:00Z"
    to_date = "2025-03-02T00:00:00Z"

    for record in client.list_records(from_date, to_date):
        yield record


if __name__ == "__main__":
    for record in main():
        print(record)
