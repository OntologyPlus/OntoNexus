from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.ws_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    await manager.send_to_user(user_id, {"type": "connected", "message": "WebSocket connected"})
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_to_user(user_id, {"type": "echo", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
