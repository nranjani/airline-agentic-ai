
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from dotenv import load_dotenv
import requests
import os

load_dotenv()

llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="llama-3.3-70b-versatile",
    temperature=0.3
)

BOOKING_SERVICE_URL = "http://localhost:8080/api/bookings"

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    intent: str
    pnr: str
    booking_data: dict
    needs_escalation: bool
    session_id: str

def lookup_booking(pnr: str) -> dict:
    try:
        response = requests.get(f"{BOOKING_SERVICE_URL}/{pnr}")
        if response.status_code == 200:
            return response.json()
        return {"error": f"Booking {pnr} not found"}
    except Exception as e:
        return {"error": str(e)}

def cancel_booking(pnr: str) -> dict:
    try:
        response = requests.put(f"{BOOKING_SERVICE_URL}/{pnr}/cancel")
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def request_refund(pnr: str) -> dict:
    try:
        response = requests.post(f"{BOOKING_SERVICE_URL}/{pnr}/refund")
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def extract_pnr(text: str) -> str:
    import re
    words = text.upper().split()
    for word in words:
        if re.match(r'^[A-Z0-9]{6}$', word):
            return word
    return ""

def detect_intent(state: AgentState) -> AgentState:
    last_message = state["messages"][-1].content.lower()
    if any(w in last_message for w in ["book", "flight", "ticket", "search", "find", "fly"]):
        intent = "BOOKING"
    elif any(w in last_message for w in ["cancel", "cancellation"]):
        intent = "CANCEL"
    elif any(w in last_message for w in ["refund", "money back", "reimburse"]):
        intent = "REFUND"
    elif any(w in last_message for w in ["agent", "human", "person", "escalate", "speak", "talk"]):
        intent = "ESCALATE"
    else:
        intent = "GENERAL"
    pnr = extract_pnr(state["messages"][-1].content)
    return {**state, "intent": intent, "pnr": pnr}

def handle_booking(state: AgentState) -> AgentState:
    system_prompt = """You are a booking assistant for Prime Airlines.
RULES: Reply in max 1-2 short sentences. Ask ONE thing only. No lists.
Ask: origin city first. Then destination. Then date. Then passengers. Then cabin class. Then confirm with PNR."""
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {**state, "messages": state["messages"] + [response]}

def handle_cancel(state: AgentState) -> AgentState:
    pnr = state.get("pnr", "")
    booking_info = ""
    if pnr:
        booking_data = lookup_booking(pnr)
        if "error" not in booking_data:
            result = cancel_booking(pnr)
            if "error" in result:
                booking_info = f"Cannot cancel: {result['error']}"
            else:
                booking_info = f"Booking {pnr} cancelled successfully."
        else:
            booking_info = f"Booking {pnr} not found."
    else:
        booking_info = "No PNR yet."
    system_prompt = f"""You are a cancellation assistant for Prime Airlines.
RULES: Reply in max 1-2 short sentences. Ask ONE thing only. No lists.
Status: {booking_info}
If no PNR: ask only "What is your booking reference number?"
If cancelled: say done and ask if they want a refund.
If Basic Economy: say travel credit only applies."""
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {**state, "messages": state["messages"] + [response]}

def handle_refund(state: AgentState) -> AgentState:
    pnr = state.get("pnr", "")
    refund_info = ""
    if pnr:
        result = request_refund(pnr)
        if "error" in result:
            refund_info = f"Issue: {result['error']}"
        else:
            refund_info = f"Refund initiated for {pnr}."
    else:
        refund_info = "No PNR yet."
    system_prompt = f"""You are a refund assistant for Prime Airlines.
RULES: Reply in max 1-2 short sentences. No lists.
Status: {refund_info}
If no PNR: ask only "What is your booking reference number?"
If refund initiated: confirm and say 7-10 business days for credit card."""
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {**state, "messages": state["messages"] + [response]}

def handle_escalate(state: AgentState) -> AgentState:
    system_prompt = """You are an assistant for Prime Airlines.
RULES: Reply in exactly 2 short sentences only.
Tell the customer you are connecting them to a live agent and wait is 2-3 minutes."""
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {**state, "messages": state["messages"] + [response], "needs_escalation": True}

def handle_general(state: AgentState) -> AgentState:
    system_prompt = """You are a helpful assistant for Prime Airlines.
RULES: Reply in max 1-2 short sentences. No lists. Ask ONE question if needed.
Help with bookings, cancellations, refunds, baggage, and Prime Rewards."""
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {**state, "messages": state["messages"] + [response]}

def route_intent(state: AgentState) -> Literal["booking", "cancel", "refund", "escalate", "general"]:
    intent = state.get("intent", "GENERAL")
    routes = {"BOOKING": "booking", "CANCEL": "cancel", "REFUND": "refund", "ESCALATE": "escalate", "GENERAL": "general"}
    return routes.get(intent, "general")

def build_agent():
    graph = StateGraph(AgentState)
    graph.add_node("detect_intent", detect_intent)
    graph.add_node("booking", handle_booking)
    graph.add_node("cancel", handle_cancel)
    graph.add_node("refund", handle_refund)
    graph.add_node("escalate", handle_escalate)
    graph.add_node("general", handle_general)
    graph.set_entry_point("detect_intent")
    graph.add_conditional_edges("detect_intent", route_intent, {
        "booking": "booking", "cancel": "cancel", "refund": "refund",
        "escalate": "escalate", "general": "general"
    })
    graph.add_edge("booking", END)
    graph.add_edge("cancel", END)
    graph.add_edge("refund", END)
    graph.add_edge("escalate", END)
    graph.add_edge("general", END)
    return graph.compile()

if __name__ == "__main__":
    agent = build_agent()
    print("Prime Airlines Agent ready")
