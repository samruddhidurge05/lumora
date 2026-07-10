from pydantic import BaseModel
from typing import Optional, List


class VendorProfileSchema(BaseModel):
    displayName: str
    email:       str
    phone:       Optional[str] = ""
    storeName:   Optional[str] = ""
    storeBio:    Optional[str] = ""
    storeUrl:    Optional[str] = ""
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

