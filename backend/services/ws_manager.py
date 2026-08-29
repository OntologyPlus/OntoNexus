from typing import Dict, Set
from fastapi import WebSocket
import json
from datetime import datetime


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            text = json.dumps(message, ensure_ascii=False)
            dead = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(text)
                except Exception:
                    dead.add(ws)
            self.active_connections[user_id] -= dead

    async def broadcast(self, message: dict):
        text = json.dumps(message, ensure_ascii=False)
        for user_id in list(self.active_connections.keys()):
            dead = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(text)
                except Exception:
                    dead.add(ws)
            self.active_connections[user_id] -= dead

    async def send_agent_progress(self, user_id: str, step: str, detail: str):
        """发送Agent执行进度"""
        if user_id:
            await self.send_to_user(user_id, {
                "type": "agent_progress",
                "step": step,
                "detail": detail,
                "timestamp": datetime.utcnow().isoformat()
            })

manager = ConnectionManager()
