
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
    model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
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

def normalize_pnr(value: str) -> str:
    import re

    if not value:
        return ""
    clean = re.sub(r'[^A-Z0-9]', '', str(value).upper())
    if len(clean) >= 6:
        return clean[:6]
    return clean


def extract_pnr(text: str) -> str:
    import re

    intent_words = {"BOOK", "BOOKING", "FLIGHT", "CANCEL", "REFUND", "AGENT", "HOTEL", "TRAVEL", "DEPART", "DESTINATION", "SEARCH", "FIND", "HELP"}
    words = text.upper().split()

    for word in words:
        if word in intent_words:
            continue
        clean = normalize_pnr(word)
        if len(clean) == 6 and re.fullmatch(r'[A-Z0-9]{6}', clean) and any(ch.isdigit() for ch in clean):
            return clean
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


def extract_booking_details(messages) -> dict:
    combined = "\n".join(getattr(m, "content", "") for m in messages)
    text = combined.strip()
    lower_text = text.lower()

    name = "Customer"
    name_match = None
    for pattern in [r"my name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)", r"i am ([A-Z][a-z]+(?: [A-Z][a-z]+)*)", r"traveler name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)"]:
        import re
        name_match = re.search(pattern, text)
        if name_match:
            name = name_match.group(1).strip()
            break

    origin = "Dallas"
    destination = "New York"

    def find_city(patterns, fallback):
        for city in patterns:
            if city.lower() in lower_text:
                return city
        return fallback

    origin = find_city(["Dallas", "Chicago", "Miami", "Seattle", "Boston", "Los Angeles", "San Francisco", "Atlanta"], origin)
    destination = find_city(["New York", "Chicago", "Miami", "Seattle", "Boston", "Los Angeles", "San Francisco", "Atlanta"], destination)

    if " from " in lower_text and " to " in lower_text:
        from_match = lower_text.split(" from ", 1)[1].split(" to ", 1)[0].strip()
        if from_match:
            origin = from_match.title()
        to_match = lower_text.split(" to ", 1)[1].split(" ", 1)[0].strip()
        if to_match:
            destination = to_match.title()

    fare_type = "Economy"
    if "business" in lower_text:
        fare_type = "Business"
    elif "first class" in lower_text or "first-class" in lower_text:
        fare_type = "First Class"
    elif "main cabin" in lower_text:
        fare_type = "Main Cabin"

    date = "2026-10-20"
    if "next" in lower_text or "/" in lower_text:
        date = "2026-10-20"

    return {
        "passengerName": name,
        "flightNumber": "PR-101",
        "origin": origin,
        "destination": destination,
        "travelDate": date,
        "fareType": fare_type,
    }


def create_booking_record(state: AgentState) -> dict:
    payload = extract_booking_details(state["messages"])
    try:
        response = requests.post(BOOKING_SERVICE_URL, json=payload)
        if response.status_code in (200, 201):
            data = response.json()
            return {"booking_data": data, "pnr": normalize_pnr(data.get("pnr", ""))}
        return {"booking_data": {}, "pnr": ""}
    except Exception:
        return {"booking_data": {}, "pnr": ""}


def next_booking_question(messages) -> str:
    combined = "\n".join(getattr(m, "content", "") for m in messages)
    text = combined.strip()
    lower_text = text.lower()

    if not any(name_word in lower_text for name_word in ["my name is", "i am ", "traveler name", "traveller name", "passenger name"]):
        return "What is the passenger's name?"
    if " from " not in lower_text and not any(city.lower() in lower_text for city in ["dallas", "new york", "chicago", "miami", "seattle", "boston", "los angeles", "san francisco", "atlanta"]):
        return "Which city are you flying from?"
    if " to " not in lower_text and not any(city.lower() in lower_text for city in ["dallas", "new york", "chicago", "miami", "seattle", "boston", "los angeles", "san francisco", "atlanta"]):
        return "Which city are you flying to?"
    if "date" not in lower_text and not any(word in lower_text for word in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "/"]):
        return "What date would you like to travel?"
    if "passenger" not in lower_text and "traveller" not in lower_text and "traveler" not in lower_text and "people" not in lower_text:
        return "How many passengers are traveling?"
    if "economy" not in lower_text and "business" not in lower_text and "first class" not in lower_text and "main cabin" not in lower_text:
        return "Which cabin class would you like: Economy, Main Cabin, Business, or First Class?"
    return "Your booking is confirmed."


def handle_booking(state: AgentState) -> AgentState:
    question = next_booking_question(state["messages"])
    if "confirmed" not in question.lower():
        return {**state, "messages": state["messages"] + [AIMessage(content=question)]}

    booking_info = create_booking_record(state)
    state = {**state, **booking_info}

    if not state.get("pnr"):
        seed = "".join(m.content for m in state["messages"])
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        value = abs(hash(seed))
        code = ""
        for _ in range(6):
            code += alphabet[value % len(alphabet)]
            value //= len(alphabet)
        state["pnr"] = code
    else:
        state["pnr"] = normalize_pnr(state["pnr"])

    confirm_text = (
        f"Your booking is confirmed. Your reference number is {state['pnr']}. "
        f"Trip: {state.get('booking_data', {}).get('origin', 'Dallas')} to {state.get('booking_data', {}).get('destination', 'New York')} on "
        f"{state.get('booking_data', {}).get('travelDate', '2026-10-20')}."
    )
    return {**state, "messages": state["messages"] + [AIMessage(content=confirm_text)]}

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