from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Profile ────────────────────────────────────────────────────────────────────

class AffiliateProfileResponse(BaseModel):
    id: int
    user_id: int
    referral_code: str
    commission_rate: float
    total_earnings: float
    total_clicks: int
    total_sales: int
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AffiliateProfileUpdate(BaseModel):
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None


# ── Commission ─────────────────────────────────────────────────────────────────

class CommissionResponse(BaseModel):
    id: int
    product_name: Optional[str] = None
    sale_amount: float
    commission_amt: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CommissionCreate(BaseModel):
    affiliate_id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    sale_amount: float
    commission_amt: float
    order_id: Optional[int] = None


# ── Payout ─────────────────────────────────────────────────────────────────────

class PayoutResponse(BaseModel):
    id: int
    amount: float
    method: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PayoutRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in INR to withdraw")
    method: str = Field(default="upi", description="upi or bank")
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None


# ── Stats ──────────────────────────────────────────────────────────────────────

class AffiliateStats(BaseModel):
    total_earnings: float
    total_clicks: int
    total_sales: int
    pending_earnings: float
    paid_earnings: float
    conversion_rate: float
    referral_code: str
    referral_link: str


# ── Click Tracking ─────────────────────────────────────────────────────────────

class ClickTrackResponse(BaseModel):
    tracked: bool
    referral_code: str


# ── Top Product (used in dashboard + analytics) ────────────────────────────────

class TopProductItem(BaseModel):
    product_name: str
    total_sales: int
    commission_earned: float
    revenue_generated: float


# ── Monthly Earnings Item ──────────────────────────────────────────────────────

class MonthlyEarningsItem(BaseModel):
    month: str          # e.g. "Jun 2026"
    earnings: float
    sales: int


# ── Dashboard Summary ──────────────────────────────────────────────────────────

class DashboardSummaryResponse(BaseModel):
    """Single-call response for the Affiliate Dashboard home tab."""
    stats: AffiliateStats
    recent_commissions: List[CommissionResponse]
    recent_payouts: List[PayoutResponse]
    top_products: List[TopProductItem]
    monthly_earnings: List[MonthlyEarningsItem]


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsResponse(BaseModel):
    """Detailed analytics for the affiliate."""
    total_clicks: int
    total_sales: int
    conversion_rate: float
    revenue_generated: float          # sum of sale_amount (the original product prices)
    total_commission_earned: float
    pending_earnings: float
    paid_earnings: float
    top_products: List[TopProductItem]
    monthly_earnings: List[MonthlyEarningsItem]


# ── Reports ───────────────────────────────────────────────────────────────────

class CommissionReportItem(BaseModel):
    id: int
    product_name: Optional[str]
    sale_amount: float
    commission_amt: float
    status: str
    date: str                         # ISO date string for display

    class Config:
        from_attributes = True


class PayoutReportItem(BaseModel):
    id: int
    amount: float
    method: str
    status: str
    date: str

    class Config:
        from_attributes = True


class ReportResponse(BaseModel):
    """Summary report of all affiliate activity."""
    period: str                       # e.g. "All time"
    total_commissions: int
    total_payout_requests: int
    total_revenue_referred: float     # sum of sale_amount
    total_earned: float               # sum of commission_amt (all statuses)
    total_paid: float                 # sum of commission_amt where status=paid
    total_pending: float              # sum of commission_amt where status=pending
    commissions: List[CommissionReportItem]
    payouts: List[PayoutReportItem]


# ── Referral Links ─────────────────────────────────────────────────────────────

class ReferralLinkCreate(BaseModel):
    product_id: int
    name: Optional[str] = None


class ReferralLinkResponse(BaseModel):
    id: int
    affiliate_id: int
    product_id: int
    referral_code: str
    name: Optional[str] = None
    clicks_count: int
    is_active: bool
    created_at: datetime
    referral_url: str

    class Config:
        from_attributes = True
