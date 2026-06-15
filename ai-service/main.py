from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from agent import build_agent
from langchain_core.messages import HumanMessage, AIMessage
import uvicorn
import uuid
import os

load_dotenv()

app = FastAPI(title="Airline Agentic AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = build_agent()
sessions = {}
escalated_sessions = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str = ""

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    intent: str
    needs_escalation: bool
    pnr: str

class AgentReply(BaseModel):
    session_id: str
    message: str

@app.get("/health")
def health():
    return {"status": "ok", "service": "airline-agentic-ai"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())

    if session_id not in sessions:
        sessions[session_id] = {
            "messages": [],
            "intent": "",
            "pnr": "",
            "needs_escalation": False,
            "taken_over": False
        }

    sessions[session_id]["messages"].append(
        HumanMessage(content=request.message)
    )

    if sessions[session_id].get("taken_over"):
        # Update escalated session with new customer message
        if session_id in escalated_sessions:
            escalated_sessions[session_id]["messages"].append({
                "role": "user",
                "content": request.message,
                "intent": ""
            })
        return ChatResponse(
            reply="You are now connected to a live agent. They will respond shortly.",
            session_id=session_id,
            intent="AGENT",
            needs_escalation=True,
            pnr=sessions[session_id].get("pnr", "")
        )

    result = agent.invoke({
        "messages": sessions[session_id]["messages"],
        "intent": "",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": session_id
    })

    reply = result["messages"][-1].content
    intent = result.get("intent", "")
    needs_escalation = result.get("needs_escalation", False)
    pnr = result.get("pnr", "")

    sessions[session_id]["messages"] = result["messages"]
    sessions[session_id]["intent"] = intent
    sessions[session_id]["pnr"] = pnr
    sessions[session_id]["needs_escalation"] = needs_escalation

    if needs_escalation:
        escalated_sessions[session_id] = {
            "session_id": session_id,
            "intent": intent,
            "pnr": pnr,
            "needs_escalation": True,
            "taken_over": False,
            "messages": [
                {
                    "role": "user" if isinstance(m, HumanMessage) else "assistant",
                    "content": m.content,
                    "intent": intent if not isinstance(m, HumanMessage) else ""
                }
                for m in sessions[session_id]["messages"]
            ]
        }

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        intent=intent,
        needs_escalation=needs_escalation,
        pnr=pnr
    )

@app.get("/agent/sessions")
def get_escalated_sessions():
    return list(escalated_sessions.values())

@app.get("/agent/sessions/{session_id}")
def get_session(session_id: str):
    if session_id in escalated_sessions:
        return escalated_sessions[session_id]
    return {"error": "Session not found"}

@app.post("/agent/takeover/{session_id}")
async def takeover(session_id: str):
    if session_id in sessions:
        sessions[session_id]["taken_over"] = True
    if session_id in escalated_sessions:
        escalated_sessions[session_id]["taken_over"] = True
    return {"status": "taken_over", "session_id": session_id}

@app.post("/agent/reply")
async def agent_reply(request: AgentReply):
    session_id = request.session_id
    if session_id not in sessions:
        return {"error": "Session not found"}

    sessions[session_id]["taken_over"] = True
    agent_message = AIMessage(content=f"[Agent] {request.message}")
    sessions[session_id]["messages"].append(agent_message)

    if session_id in escalated_sessions:
        escalated_sessions[session_id]["taken_over"] = True
        escalated_sessions[session_id]["messages"].append({
            "role": "assistant",
            "content": f"[Agent] {request.message}",
            "intent": "AGENT"
        })

    return {"status": "sent", "message": request.message}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)