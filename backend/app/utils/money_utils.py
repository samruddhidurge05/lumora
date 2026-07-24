"""
money_utils.py — Financial Precision & Money Quantization Utility

Provides standardized, zero-loss 2-decimal half-up rounding across
purchase service, order creation, commission generation, payout queue,
and financial reporting.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Union


def quantize_money(amount: Union[float, int, str, Decimal, None]) -> float:
    """
    Quantizes any monetary amount to exactly 2 decimal places using ROUND_HALF_UP.
    Returns standard Python float suitable for database storage and JSON serialization.

    Examples:
        quantize_money(5.974) -> 5.97
        quantize_money(5.975) -> 5.98
        quantize_money(6.0)   -> 6.0
        quantize_money(None)  -> 0.0
    """
    if amount is None:
        return 0.0
    try:
        # Convert to string first to avoid binary floating-point representation artifacts
        val_str = str(amount).strip()
        if not val_str or val_str == "None":
            return 0.0
        d = Decimal(val_str)
        quantized = d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return float(quantized)
    except Exception:
        try:
            d = Decimal(float(amount))
            quantized = d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return float(quantized)
        except Exception:
            return 0.0


def quantize_money_str(amount: Union[float, int, str, Decimal, None]) -> str:
    """
    Quantizes amount and formats as string with exactly 2 decimal places (e.g., '6.00').
    """
    q = quantize_money(amount)
    return f"{q:.2f}"
