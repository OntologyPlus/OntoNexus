from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from auth import SECRET_KEY, ALGORITHM
from services.ws_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    token = websocket.query_params.get("token")
    try:
        payload = jwt.decode(token or "", SECRET_KEY, algorithms=[ALGORITHM])
        if str(payload.get("sub")) != str(user_id):
            raise JWTError("user mismatch")
    except JWTError:
        await websocket.close(code=1008)
        return
    await manager.connect(websocket, user_id)
    await manager.send_to_user(user_id, {"type": "connected", "message": "WebSocket connected"})
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_to_user(user_id, {"type": "echo", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
