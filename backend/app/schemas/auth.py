import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("Name must be a string.")
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty or contain only whitespace.")
        if re.search(r'<[^>]*>', v) or '<' in v or '>' in v:
            raise ValueError("Name cannot contain HTML or script tags.")
        if re.search(r'[\x00-\x1f\x7f-\x9f]', v):
            raise ValueError("Name cannot contain control characters.")
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    firebase_uid: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool = True
    is_verified: bool = False
    firebase_uid: Optional[str] = None
    sqlite_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
