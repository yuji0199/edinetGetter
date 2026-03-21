import requests

login_data = {
    "username": "admin",
    "password": "password"
}
resp = requests.post("http://127.0.0.1:8000/api/auth/login", data=login_data)
token = resp.json().get("access_token")

headers = {
    "Authorization": f"Bearer {token}"
}
sync_resp = requests.post("http://127.0.0.1:8000/api/edinet/sync?target_date=2026-02-25&limit=3", headers=headers)
print("Status Code:", sync_resp.status_code)
print("Response:", sync_resp.text)
