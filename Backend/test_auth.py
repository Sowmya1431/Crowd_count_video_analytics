# Test Backend Authentication
# Run this after starting the backend server

import requests
import json

BASE_URL = "http://127.0.0.1:5000/api"

def test_register():
    print("\n=== Testing Registration ===")
    # Register as user
    user_data = {
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "password": "password123",
        "role": "user"
    }
    
    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)
    print(f"Register User: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Register as admin with same email
    admin_data = {
        "first_name": "Test",
        "last_name": "Admin",
        "email": "test@example.com",
        "password": "admin123",
        "role": "admin"
    }
    
    response = requests.post(f"{BASE_URL}/auth/register", json=admin_data)
    print(f"Register Admin (same email): {response.status_code}")
    print(f"Response: {response.json()}")

def test_login():
    print("\n=== Testing Login ===")
    # Login as admin
    login_data = {
        "email": "test@example.com",
        "password": "admin123",
        "role": "admin"
    }
    
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print(f"Login Admin: {response.status_code}")
    result = response.json()
    print(f"Response: {result}")
    
    if response.status_code == 200:
        token = result.get("token")
        print(f"\n✅ Token received: {token[:50]}...")
        return token
    return None

def test_admin_endpoints(token):
    print("\n=== Testing Admin Endpoints ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test get users
    response = requests.get(f"{BASE_URL}/admin/users", headers=headers)
    print(f"Get Users: {response.status_code}")
    if response.status_code == 200:
        print(f"Users: {response.json()}")
    else:
        print(f"Error: {response.json()}")
    
    # Test get profile
    response = requests.get(f"{BASE_URL}/admin/profile", headers=headers)
    print(f"Get Profile: {response.status_code}")
    if response.status_code == 200:
        print(f"Profile: {response.json()}")
    else:
        print(f"Error: {response.json()}")
    
    # Test get feeds
    response = requests.get(f"{BASE_URL}/admin/feeds", headers=headers)
    print(f"Get Feeds: {response.status_code}")
    if response.status_code == 200:
        print(f"Feeds: {len(response.json())} feeds found")
    else:
        print(f"Error: {response.json()}")

if __name__ == "__main__":
    print("🚀 Starting Backend Tests...")
    print("Make sure the backend server is running on http://127.0.0.1:5000")
    
    try:
        test_register()
        token = test_login()
        if token:
            test_admin_endpoints(token)
        else:
            print("\n❌ Login failed, cannot test admin endpoints")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    print("\n✅ Tests completed!")
