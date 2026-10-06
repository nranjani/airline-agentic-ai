from fastapi.testclient import TestClient
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_core.messages import HumanMessage
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


def test_groq_model_is_available():
    from agent import llm
    response = llm.invoke("Reply with just 'ok'.")
    assert isinstance(response.content, str)
    assert "ok" in response.content.lower()


def test_extract_pnr_ignores_intent_words():
    from agent import extract_pnr

    assert extract_pnr("Cancel 5381EB") == "5381EB"
    assert extract_pnr("I need refund for 6752E4") == "6752E4"


def test_booking_prompt_skips_payment_collection(monkeypatch):
    import agent

    def fake_post(url, json):
        class FakeResponse:
            status_code = 201
            def json(self):
                return {
                    "id": 1,
                    "pnr": "AB1234",
                    "origin": json["origin"],
                    "destination": json["destination"],
                    "flightNumber": json["flightNumber"],
                    "fareType": json["fareType"],
                    "status": "CONFIRMED"
                }
        return FakeResponse()

    monkeypatch.setattr(agent.requests, "post", fake_post)

    state = {
        "messages": [
            HumanMessage(content="My name is Alice Smith."),
            HumanMessage(content="I want to fly from Dallas to New York on Friday for 2 passengers in Economy"),
        ],
        "intent": "BOOKING",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": "abc123"
    }

    result = agent.handle_booking(state)

    assert result["pnr"] == "AB1234"
    assert "reference number" in result["messages"][-1].content.lower()
    assert "payment" not in result["messages"][-1].content.lower()


def test_booking_reply_never_requests_payment(monkeypatch):
    import agent

    state = {
        "messages": [
            HumanMessage(content="I want to book a flight from Dallas to New York on Friday for 2 passengers in Economy"),
        ],
        "intent": "BOOKING",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": "abc123"
    }

    result = agent.handle_booking(state)
    content = result["messages"][-1].content.lower()

    assert "what is the passenger's name" in content
    assert "card" not in content
    assert "cvv" not in content
    assert "payment" not in content
    assert "dob" not in content
    assert "passport" not in content


def test_generated_demo_pnr_is_six_characters():
    import agent

    assert agent.normalize_pnr("AB123456") == "AB1234"
    assert agent.extract_pnr("Your booking reference is AB123456") == "AB1234"
    assert len(agent.normalize_pnr("AB123456")) == 6
    assert agent.normalize_pnr("AB123456").isalnum()


def test_booking_asks_one_question_at_a_time():
    import agent

    state = {
        "messages": [HumanMessage(content="I want to book a flight")],
        "intent": "BOOKING",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": "abc123"
    }

    question = agent.next_booking_question(state["messages"])

    assert "name" in question.lower()
    assert "origin" not in question.lower()
    assert "destination" not in question.lower()
    assert "date" not in question.lower()
    assert "payment" not in question.lower()
