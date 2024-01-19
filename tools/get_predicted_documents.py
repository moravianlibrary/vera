import requests
import json
import sys
from keycloak_auth import get_token


URL = "http://localhost:8000"
TOKEN = get_token()


# Assuming you have the authentication token
headers = {
    "Authorization": f"Bearer {TOKEN}"
}

# Make the POST request
response = requests.get(
    f"{URL}/tasks/{sys.argv[1]}/documents",
    headers=headers
)

# Print the response
if response.status_code == 200:
    print(json.dumps(response.json(), indent=2))
else:
    print(response.status_code)

