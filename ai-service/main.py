from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from agent import build_agent
from langchain_core.messages import HumanMessage
import uvicorn
import uuid
import os

load_dotenv()

app = FastAPI(title="Airline Agentic AI")

# Store agent and sessions
agent = build_agent()
sessions = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str = ""

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    intent: str
    needs_escalation: bool
    pnr: str

@app.get("/health")
def health():
    return {"status": "ok", "service": "airline-agentic-ai"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # Generate session ID if not provided
    session_id = request.session_id or str(uuid.uuid4())

    # Load or create session history
    if session_id not in sessions:
        sessions[session_id] = []

    # Add user message
    sessions[session_id].append(HumanMessage(content=request.message))

    # Run the LangGraph agent
    result = agent.invoke({
        "messages": sessions[session_id],
        "intent": "",
        "pnr": "",
        "booking_data": {},
        "needs_escalation": False,
        "session_id": session_id
    })

    # Get the reply
    reply = result["messages"][-1].content

    # Save updated history
    sessions[session_id] = result["messages"]

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        intent=result.get("intent", ""),
        needs_escalation=result.get("needs_escalation", False),
        pnr=result.get("pnr", "")
    )

@app.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    if session_id not in sessions:
        sessions[session_id] = []

    try:
        while True:
            # Receive message from browser
            message = await websocket.receive_text()

            # Add to history
            sessions[session_id].append(HumanMessage(content=message))

            # Run agent
            result = agent.invoke({
                "messages": sessions[session_id],
                "intent": "",
                "pnr": "",
                "booking_data": {},
                "needs_escalation": False,
                "session_id": session_id
            })

            reply = result["messages"][-1].content
            sessions[session_id] = result["messages"]

            # Send reply back to browser
            await websocket.send_json({
                "reply": reply,
                "intent": result.get("intent", ""),
                "needs_escalation": result.get("needs_escalation", False),
                "pnr": result.get("pnr", "")
            })

    except WebSocketDisconnect:
        print(f"Client disconnected: {session_id}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
