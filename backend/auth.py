import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models.user import User

SECRET_KEY = os.environ.get("SECRET_KEY", "ontonexus-dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user


def identity_from_user(user) -> SimpleNamespace:
    """Copy user fields off the ORM instance so SSE generators survive session close."""
    if user is None:
        return SimpleNamespace(id="system", role="user", display_name=None, username=None)
    if isinstance(user, SimpleNamespace):
        return user
    if isinstance(user, dict):
        return SimpleNamespace(
            id=user.get("id") or "system",
            role=user.get("role") or "user",
            display_name=user.get("display_name"),
            username=user.get("username"),
        )
    return SimpleNamespace(
        id=getattr(user, "id", None) or "system",
        role=getattr(user, "role", None) or "user",
        display_name=getattr(user, "display_name", None),
        username=getattr(user, "username", None),
    )


def require_auth(
    user: Optional[User] = Depends(get_current_user),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user
