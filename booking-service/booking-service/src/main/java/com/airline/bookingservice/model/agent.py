from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from dotenv import load_dotenv
import requests
import os

load_dotenv()

# ── LLM setup ──────────────────────────────────────────────
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="llama-3.3-70b-versatile",
    temperature=0.3
)

BOOKING_SERVICE_URL = "http://localhost:8080/api/bookings"

# ── State definition ────────────────────────────────────────
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    intent: str
    pnr: str
    booking_data: dict
    needs_escalation: bool
    session_id: str

# ── Tool functions ──────────────────────────────────────────
def lookup_booking(pnr: str) -> dict:
    """Look up a booking from the Spring Boot service"""
    try:
        response = requests.get(f"{BOOKING_SERVICE_URL}/{pnr}")
        if response.status_code == 200:
            return response.json()
        return {"error": f"Booking {pnr} not found"}
    except Exception as e:
        return {"error": str(e)}

def cancel_booking(pnr: str) -> dict:
    """Cancel a booking via the Spring Boot service"""
    try:
        response = requests.put(f"{BOOKING_SERVICE_URL}/{pnr}/cancel")
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def request_refund(pnr: str) -> dict:
    """Request a refund via the Spring Boot service"""
    try:
        response = requests.post(f"{BOOKING_SERVICE_URL}/{pnr}/refund")
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def extract_pnr(text: str) -> str:
    """Extract PNR from user message"""
    import re
    words = text.upper().split()
    for word in words:
        if re.match(r'^[A-Z0-9]{6}$', word):
            return word
    return ""

# ── Node functions ───────────────────────────────────────────
def detect_intent(state: AgentState) -> AgentState:
    """Detect what the user wants"""
    last_message = state["messages"][-1].content.lower()

    if any(w in last_message for w in ["book", "flight", "ticket", "search", "find"]):
        intent = "BOOKING"
    elif any(w in last_message for w in ["cancel", "cancellation"]):
        intent = "CANCEL"
    elif any(w in last_message for w in ["refund", "money back", "reimburse"]):
        intent = "REFUND"
    elif any(w in last_message for w in ["agent", "human", "person", "help", "escalate"]):
        intent = "ESCALATE"
    else:
        intent = "GENERAL"

    pnr = extract_pnr(state["messages"][-1].content)

    return {**state, "intent": intent, "pnr": pnr}

def handle_booking(state: AgentState) -> AgentState:
    """Handle flight booking requests"""
    system_prompt = """You are an airline booking assistant.
    Help the customer search for and book flights.
    Ask for: origin, destination, travel date, number of passengers, cabin class.
    Present realistic flight options with flight numbers, times, and prices.
    Generate a 6-character PNR when confirming a booking.
    Be concise and professional."""

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)

    return {**state, "messages": state["messages"] + [response]}

def handle_cancel(state: AgentState) -> AgentState:
    """Handle cancellation requests"""
    pnr = state.get("pnr", "")
    booking_info = ""

    if pnr:
        booking_data = lookup_booking(pnr)
        if "error" not in booking_data:
            state = {**state, "booking_data": booking_data}
            result = cancel_booking(pnr)
            if "error" in result:
                booking_info = f"Cancellation failed: {result['error']}"
            else:
                booking_info = f"Booking {pnr} has been cancelled. Status: {result.get('status')}"
        else:
            booking_info = f"Could not find booking {pnr}. Please check your PNR."
    else:
        booking_info = "Please provide your PNR number to cancel."

    system_prompt = f"""You are an airline cancellation assistant.
    {booking_info}
    Cancellation policy:
    - Within 24hrs: full refund for any fare type
    - Basic Economy after 24hrs: travel credit only, non-refundable
    - Main Cabin and above: free cancellation, full refund available
    Be helpful and explain next steps clearly."""

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)

    return {**state, "messages": state["messages"] + [response]}

def handle_refund(state: AgentState) -> AgentState:
    """Handle refund requests"""
    pnr = state.get("pnr", "")
    refund_info = ""

    if pnr:
        result = request_refund(pnr)
        if "error" in result:
            refund_info = f"Refund request failed: {result['error']}"
        else:
            refund_info = f"Refund initiated for {pnr}. Case number: REF-{pnr}-2026"
    else:
        refund_info = "Please provide your PNR to process a refund."

    system_prompt = f"""You are an airline refund assistant.
    {refund_info}
    Refund timelines:
    - Credit/debit card: 7-10 business days
    - Travel credit: issued within 24 hours
    - AAdvantage miles: redeposited within 72 hours
    Be clear about next steps and timeline."""

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)

    return {**state, "messages": state["messages"] + [response]}

def handle_escalate(state: AgentState) -> AgentState:
    """Handle escalation to human agent"""
    system_prompt = """You are an airline assistant.
    The customer needs to speak with a human agent.
    Acknowledge their request warmly.
    Tell them: 'I am connecting you to a live agent now.
    Your conversation history will be shared with them.'
    Estimated wait time: 2-3 minutes."""

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)

    return {**state,
            "messages": state["messages"] + [response],
            "needs_escalation": True}

def handle_general(state: AgentState) -> AgentState:
    """Handle general questions"""
    system_prompt = """You are a helpful airline customer service assistant.
    You can help with:
    - Flight bookings
    - Cancellations
    - Refunds
    - Flight status
    - Baggage policies
    - AAdvantage loyalty program
    Be concise, warm, and professional."""

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)

    return {**state, "messages": state["messages"] + [response]}

# ── Router ───────────────────────────────────────────────────
def route_intent(state: AgentState) -> Literal["booking", "cancel", "refund", "escalate", "general"]:
    intent = state.get("intent", "GENERAL")
    routes = {
        "BOOKING": "booking",
        "CANCEL": "cancel",
        "REFUND": "refund",
        "ESCALATE": "escalate",
        "GENERAL": "general"
    }
    return routes.get(intent, "general")

# ── Build the graph ──────────────────────────────────────────
def build_agent():
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("detect_intent", detect_intent)
    graph.add_node("booking", handle_booking)
    graph.add_node("cancel", handle_cancel)
    graph.add_node("refund", handle_refund)
    graph.add_node("escalate", handle_escalate)
    graph.add_node("general", handle_general)

    # Set entry point
    graph.set_entry_point("detect_intent")

    # Add conditional routing
    graph.add_conditional_edges(
        "detect_intent",
        route_intent,
        {
            "booking": "booking",
            "cancel": "cancel",
            "refund": "refund",
            "escalate": "escalate",
            "general": "general"
        }
    )

    # All nodes end after responding
    graph.add_edge("booking", END)
    graph.add_edge("cancel", END)
    graph.add_edge("refund", END)
    graph.add_edge("escalate", END)
    graph.add_edge("general", END)

    return graph.compile()

# ── Test the agent ───────────────────────────────────────────
if __name__ == "__main__":
    agent = build_agent()

    print("=" * 50)
    print("Airline Agentic AI — LangGraph Agent")
    print("=" * 50)

    # Test 1: Booking intent
    print("\nTest 1: Booking request")
    result = agent.invoke({
        "messages": [HumanMessage(content="I want to book a flight from DFW to JFK next Friday")],
        "intent": "",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": "test-001"
    })
    print("Agent:", result["messages"][-1].content[:200])

    # Test 2: Cancel with PNR
    print("\nTest 2: Cancellation request")
    result = agent.invoke({
        "messages": [HumanMessage(content="I need to cancel my booking 5381EB")],
        "intent": "",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": "test-002"
    })
    print("Agent:", result["messages"][-1].content[:200])

    # Test 3: Escalation
    print("\nTest 3: Escalation request")
    result = agent.invoke({
        "messages": [HumanMessage(content="I need to speak to a human agent")],
        "intent": "",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": "test-003"
    })
    print("Agent:", result["messages"][-1].content[:200])
    print("Escalation flag:", result["needs_escalation"])