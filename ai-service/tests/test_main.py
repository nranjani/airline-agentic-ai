from fastapi.testclient import TestClient
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "airline-agentic-ai"

def test_agent_sessions_empty():
    response = client.get("/agent/sessions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_agent_session_not_found():
    response = client.get("/agent/sessions/nonexistent123")
    assert response.status_code == 200
    assert "error" in response.json()
