import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = Field("sqlite:///./test.db", env='DATABASE_URL')
    JWT_SECRET_KEY: str = Field("secret", env='JWT_SECRET_KEY')
    JWT_ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Firebase project — used for verifying Firebase ID tokens
    FIREBASE_PROJECT_ID: str = Field("", env="FIREBASE_PROJECT_ID")

    # Firebase Admin SDK service account key path (optional — enables Firestore admin features)
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = Field(None, env="FIREBASE_SERVICE_ACCOUNT_JSON")

    # Payment Gateway
    PAYMENT_GATEWAY: str = Field("mock", env="PAYMENT_GATEWAY")  # "mock" | "razorpay"
    PAYMENT_CURRENCY: str = Field("INR", env="PAYMENT_CURRENCY")

    # Razorpay — only required when PAYMENT_GATEWAY=razorpay
    RAZORPAY_KEY_ID: Optional[str] = Field(None, env="RAZORPAY_KEY_ID")
    RAZORPAY_KEY_SECRET: Optional[str] = Field(None, env="RAZORPAY_KEY_SECRET")
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = Field(None, env="RAZORPAY_WEBHOOK_SECRET")

    # Cloudflare R2 connection
    R2_ACCOUNT_ID: str | None = os.getenv("R2_ACCOUNT_ID")
    R2_ACCESS_KEY: str | None = os.getenv("R2_ACCESS_KEY")
    R2_SECRET_KEY: str | None = os.getenv("R2_SECRET_KEY")
    R2_ENDPOINT: str | None = os.getenv("R2_ENDPOINT")  # e.g. "https://your-account.r2.cloudflarestorage.com"
    R2_BUCKET_NAME: str | None = os.getenv("R2_BUCKET_NAME") # e.g. "lumora"

    # Public URL for signed downloads
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")

    # Frontend URL — used to generate shareable links (invitations, etc.)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        extra = 'ignore'

settings = Settings()
