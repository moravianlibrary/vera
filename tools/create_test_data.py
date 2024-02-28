import requests
from keycloak_auth import get_token


URL = "http://localhost:8000"


def create_test_category_tree():
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Odbor Periodik"
        })
    root_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Morava",
        "parent_id": root_id,
        "percentage": 20
        })
    child1_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Výroční zprávy",
        "parent_id": root_id,
        "assignable": True
        })
    child2_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Kontinuita",
        "parent_id": root_id,
        "assignable": True
        })
    child3_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Dary",
        "parent_id": root_id,
        "assignable": True
        })
    child4_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Projekty",
        "parent_id": root_id
        })
    child5_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Noviny",
        "parent_id": child1_id,
        "assignable": True
        })
    grandchild11_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Časopisy",
        "parent_id": child1_id,
        "assignable": True
        })
    grandchild12_id = response.json()['id']
    response = requests.post(f"{URL}/categories/category", json={
        "name": "Alkaro",
        "parent_id": child5_id,
        "assignable": True
        })
    grandchild51_id = response.json()['id']

    response = requests.put(f"{URL}/categories/distribution", json=[
        {
            "id": root_id,
            "percentage": 100
            }
        ])

    response = requests.put(f"{URL}/categories/distribution",
                            params={"parent_id": root_id},
                            json=[{
                                "id": child1_id,
                                "percentage": 20
                                }, {
                                "id": child2_id,
                                "percentage": 20
                                }, {
                                "id": child3_id,
                                "percentage": 20
                                }, {
                                "id": child4_id,
                                "percentage": 20
                                }, {
                                "id": child5_id,
                                "percentage": 20
                                }])

    response = requests.put(f"{URL}/categories/distribution",
                            params={"parent_id": child1_id},
                            json=[{
                                "id": grandchild11_id,
                                "percentage": 50
                                }, {
                                "id": grandchild12_id,
                                "percentage": 50
                                }])

    response = requests.put(f"{URL}/categories/distribution",
                            params={"parent_id": child5_id},
                            json=[{
                                "id": grandchild51_id,
                                "percentage": 100
                                }])


def create_test_quota():
    requests.post(f"{URL}/categories/quota", json={
        "name": "Prosinec 2023",
        "pages_count": 994
        })


def create_test_documents():
    token = get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        # "Content-Type": "application/json"
    }

    endpoint = f"{URL}/categories/descriptors?assignable=True"
    response = requests.get(endpoint)
    category_ids = [item['id'] for item in response.json()]
    category_index = 0

    for sysno in open('test_sysnos.txt', 'r').readlines():
        data = {
            "identifier_type": "Sysno",
            "value": f"{sysno.strip()}"
        }

        category_id = category_ids[category_index]
        endpoint = (f"{URL}/catalogs"
                    f"?category_id={category_id}"
                    f"&insert_digitized=true")
        requests.post(endpoint, headers=headers, json=data)
        category_index = (category_index + 1) % len(category_ids)


if __name__ == "__main__":
    create_test_category_tree()
    create_test_quota()
    create_test_documents()
