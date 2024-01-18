import requests
from keycloak_auth import get_token


URL = "http://localhost:8000"
TOKEN = get_token()


# Assuming you have the necessary data to create the task
task_data = {
    "task_type": "PredictVolumePages"  # or "SyncFromCatalog"
}

# Assuming you have the necessary data for the query parameter
query_data = {
    "id_list": [1, 2, 3]
}

# Assuming you have the authentication token
headers = {
    "Authorization": f"Bearer {TOKEN}"
}

# Make the POST request
response = requests.post(
    f"{URL}/tasks",
    json={"task": task_data, "query": query_data},
    headers=headers
)

# Print the response
print(response.status_code)
if response.status_code == 200:
    print(response.json())

