import requests
import json
from keycloak_auth import get_token


URL = "http://localhost:8000"
TOKEN = get_token()


# Assuming you have the authentication token
headers = {
    "Authorization": f"Bearer {TOKEN}"
}

# Make the POST request
response = requests.get(
    f"{URL}/documents",
    json={"id_list": [1, 2, 3]},
    headers=headers
)

# Print the response
if response.status_code == 200:
    print(json.dumps(response.json(), indent=2))
else:
    print(response.status_code)

