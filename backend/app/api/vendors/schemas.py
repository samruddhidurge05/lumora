import re
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List


class VendorProfileSchema(BaseModel):
    displayName: str
    email:       str
    phone:       Optional[str] = ""
    storeName:   Optional[str] = ""
    storeBio:    Optional[str] = ""
    storeUrl:    Optional[str] = ""
    # website/github/twitter kept for backward-compat (StoreSettings still uses them)
    website:     Optional[str] = ""
    country:     Optional[str] = ""
    github:      Optional[str] = ""
    twitter:     Optional[str] = ""
    avatar:      Optional[str] = ""
    # Payment information
    upiId:             Optional[str] = None
    accountHolderName: Optional[str] = None
    bankName:          Optional[str] = None
    accountNumber:     Optional[str] = None
    ifscCode:          Optional[str] = None

    @field_validator("displayName")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Display name must be at least 3 characters.")
        if len(v) > 50:
            raise ValueError("Display name must be at most 50 characters.")
        if not re.match(r"^[\w\s.\-']+$", v, re.UNICODE):
            raise ValueError("Display name contains invalid characters.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", v):
            raise ValueError("Enter a valid email address.")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return v
        cleaned = v.strip()
        if not re.match(r"^\d{10}$", cleaned):
            raise ValueError("Phone number must be exactly 10 digits.")
        return cleaned

    @field_validator("storeName")
    @classmethod
    def validate_store_name(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return v
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Store name must be at least 3 characters.")
        if len(v) > 50:
            raise ValueError("Store name must be at most 50 characters.")
        if not re.match(r"^[\w\s\-_]+$", v):
            raise ValueError("Store name: letters, numbers, spaces, hyphens and underscores only.")
        return v

    @field_validator("storeUrl")
    @classmethod
    def validate_store_url(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return v
        v = v.strip()
        if not re.match(r"^https?://[^\s/$.?#].[^\s]*$", v):
            raise ValueError("Store URL must be a valid URL (e.g. https://mystore.com).")
        return v

    @field_validator("storeBio")
    @classmethod
    def validate_store_bio(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        if len(v.strip()) == 0 and len(v) > 0:
            raise ValueError("Bio cannot be only whitespace.")
        if len(v) > 500:
            raise ValueError("Bio must be at most 500 characters.")
        return v

    @field_validator("upiId")
    @classmethod
    def validate_upi(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()

        # No spaces allowed
        if " " in v:
            raise ValueError("UPI ID must not contain spaces.")

        # Exactly one @
        parts = v.split("@")
        if len(parts) != 2:
            raise ValueError("UPI ID must contain exactly one '@' (e.g. rahul@ybl).")

        local, handle = parts

        # Local part: 2-50 chars, alphanumeric . _ -
        if not local or not re.match(r"^[\w.\-]{2,50}$", local):
            raise ValueError("UPI ID local part is invalid. Only letters, numbers, dot, hyphen, underscore allowed.")

        # Handle: lowercase letters/digits only
        if not handle or not re.match(r"^[a-z][a-z0-9]{1,19}$", handle):
            raise ValueError("UPI handle must be lowercase letters/digits (e.g. ybl, okaxis, paytm).")

        # Whitelist of known PSP handles
        VALID_HANDLES = {
            "ybl", "ibl", "oksbi", "okhdfcbank", "okaxis", "okicici",
            "paytm", "apl", "axl", "upi", "ptyes", "pthdfc", "ptsbi",
            "icici", "hdfcbank", "sbi", "axisbank", "kotak", "indus",
            "rbl", "federal", "bob", "boi", "pnb", "citi", "hsbc",
            "allahabad", "canara", "uco", "vijaya", "dena", "syndicate",
            "obc", "oriental", "united", "corporation", "central", "indian",
            "mahb", "idbi", "idfc", "idfcbank", "idfcfirst", "equitas",
            "aubank", "ujjivan", "esaf", "utib", "jsb", "scb", "dlb",
            "naviaxis", "fbl", "timecosmos", "kaypay", "tapicici",
            "rajgovt", "barodampay", "abfspay", "axisgo", "sliceaxis",
            "jupiteraxis", "niyoicici", "fifederal", "waaxis", "goaxb",
            "juspay", "tpaxis", "amazonpay", "qubemoney",
        }
        if handle.lower() not in VALID_HANDLES:
            raise ValueError(
                f"'{handle}' is not a recognized UPI PSP handle. "
                "Use handles like ybl, okaxis, okhdfcbank, paytm, oksbi, etc."
            )
        return v

    @field_validator("accountHolderName")
    @classmethod
    def validate_holder_name(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()
        if not re.match(r"^[a-zA-Z\s]+$", v):
            raise ValueError("Account holder name: letters and spaces only.")
        return v

    @field_validator("bankName")
    @classmethod
    def validate_bank_name(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()
        if re.match(r"^\d+$", v):
            raise ValueError("Bank name cannot be numbers only.")
        if not re.match(r"^[a-zA-Z\s&().,\-]+$", v):
            raise ValueError("Bank name contains invalid characters.")
        return v

    @field_validator("accountNumber")
    @classmethod
    def validate_account_number(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip()
        if not re.match(r"^\d{9,18}$", v):
            raise ValueError("Account number must be 9–18 digits.")
        return v

    @field_validator("ifscCode")
    @classmethod
    def validate_ifsc(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        v = v.strip().upper()
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", v):
            raise ValueError("IFSC must be in format ABCD0123456 (e.g. SBIN0001234).")
        return v


class StoreSettingsSchema(BaseModel):
    storeName:          Optional[str]  = ""
    tagline:            Optional[str]  = ""
    bio:                Optional[str]  = ""
    website:            Optional[str]  = ""
    twitter:            Optional[str]  = ""
    instagram:          Optional[str]  = ""
    refundPolicy:       Optional[str]  = ""
    supportEmail:       Optional[str]  = ""
    responseTime:       Optional[str]  = "24 hours"
    announcement:       Optional[str]  = ""
    announcementActive: Optional[bool] = False
    vacationMode:       Optional[bool] = False
    vacationMessage:    Optional[str]  = ""


class WithdrawalSchema(BaseModel):
    amount:      float
    method:      str
    upiId:       Optional[str] = None
    bankAccount: Optional[str] = None


class ReviewReplySchema(BaseModel):
    reply: str


class VendorProductAffiliateSettingsSchema(BaseModel):
    affiliate_enabled: bool = False
    commission_type: str = "percentage"
    commission_value: float = 0.0
    affiliate_cookie_days: Optional[int] = 30
    affiliate_visibility: Optional[str] = "public"
    affiliate_program_status: Optional[str] = "active"

