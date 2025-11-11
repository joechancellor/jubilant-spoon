from fastapi.testclient import TestClient
from src.app import app, activities

client = TestClient(app)


def reset_activities():
    # reset in-memory activities to a known state for tests
    activities.clear()
    activities.update({
        "Test Club": {
            "description": "A test activity",
            "schedule": "Now",
            "max_participants": 3,
            "participants": ["alice@example.com"]
        }
    })


def test_get_activities():
    reset_activities()
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert "Test Club" in data
    assert data["Test Club"]["description"] == "A test activity"


def test_signup_success():
    reset_activities()
    resp = client.post("/activities/Test%20Club/signup?email=bob@example.com")
    assert resp.status_code == 200
    data = resp.json()
    assert "Signed up bob@example.com for Test Club" in data.get("message", "")
    # verify participant added
    assert "bob@example.com" in activities["Test Club"]["participants"]


def test_signup_already_signed():
    reset_activities()
    # alice already signed
    resp = client.post("/activities/Test%20Club/signup?email=alice@example.com")
    assert resp.status_code == 400
    data = resp.json()
    assert data.get("detail") == "Student already signed up for this activity"


def test_unregister_success():
    reset_activities()
    resp = client.delete("/activities/Test%20Club/unregister?email=alice@example.com")
    assert resp.status_code == 200
    data = resp.json()
    assert "Unregistered alice@example.com from Test Club" in data.get("message", "")
    assert "alice@example.com" not in activities["Test Club"]["participants"]


def test_unregister_not_registered():
    reset_activities()
    resp = client.delete("/activities/Test%20Club/unregister?email=charlie@example.com")
    assert resp.status_code == 404
    data = resp.json()
    assert data.get("detail") == "Student not registered for this activity"
