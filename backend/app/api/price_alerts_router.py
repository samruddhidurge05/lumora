from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.price_alert import PriceAlert
from app.models.product import Product
from app.models.notification import Notification
from app.models.user import User
from app.schemas.schemas import PriceAlertResponse, PriceAlertCreate

router = APIRouter()

@router.get("/", response_model=List[PriceAlertResponse])
def get_price_alerts(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    alerts = db.query(PriceAlert).filter(
        PriceAlert.user_id == current_user.id
    ).all()
    return alerts

@router.post("/", response_model=PriceAlertResponse)
def toggle_price_alert(
    alert_in: PriceAlertCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if alert_in.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify price alert for another user."
        )

    if alert_in.original_price < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original price cannot be negative."
        )

    # Verify product and user exist
    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, alert_in.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    user = db.query(User).filter(User.id == alert_in.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    existing = db.query(PriceAlert).filter(
        PriceAlert.user_id == alert_in.user_id,
        PriceAlert.product_id == alert_in.product_id
    ).first()
    
    if existing:
        # Toggle active state or update original price
        existing.active = alert_in.active
        existing.original_price = alert_in.original_price
        existing.target_price = alert_in.target_price or (alert_in.original_price * 0.9)
        db.commit()
        db.refresh(existing)
        return existing
        
    # Create new alert
    alert = PriceAlert(
        user_id=alert_in.user_id,
        product_id=alert_in.product_id,
        original_price=alert_in.original_price,
        target_price=alert_in.target_price or (alert_in.original_price * 0.9),
        active=True
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

@router.post("/trigger", status_code=status.HTTP_200_OK)
def trigger_price_alerts(
    product_id: int,
    new_price: float,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if current_user.role not in ("vendor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendors or admins can trigger price updates."
        )
    if new_price < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New price cannot be negative."
        )

    from app.utils.db_sync import get_product_by_id
    product = get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Resource ownership check for vendor
    user_uid = str(current_user.id)
    if current_user.role != "admin" and (product.vendor_id != user_uid and product.seller != current_user.name):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update price for this product."
        )
        
    old_price = product.price
    if new_price >= old_price:
        # Price didn't drop
        return {"message": "Price did not decrease. No notifications sent."}
        
    discount_percent = int(((old_price - new_price) / old_price) * 100)
    
    # Query all active alerts for this product
    alerts = db.query(PriceAlert).filter(
        PriceAlert.product_id == product_id,
        PriceAlert.active == True
    ).all()
    
    notifications_count = 0
    for alert in alerts:
        # Create notification for each user
        notif = Notification(
            user_id=alert.user_id,
            title="Price Drop Alert! ?",
            message=f"'{product.title}' has dropped from ?{int(old_price)} to ?{int(new_price)} ({discount_percent}% OFF).",
            category="price_drop",
            is_read=False
        )
        db.add(notif)
        
        # Update baseline target price
        alert.original_price = new_price
        alert.target_price = new_price * 0.9
        notifications_count += 1
        
    # Update product master price
    product.price = new_price
    db.commit()
    
    return {"message": f"Successfully updated price and dispatched {notifications_count} alerts."}


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    alert = db.query(PriceAlert).filter(
        PriceAlert.id == alert_id,
        PriceAlert.user_id == current_user.id
    ).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price alert not found")
        
    db.delete(alert)
    db.commit()
    return None


@router.put("/{alert_id}", response_model=PriceAlertResponse)
def update_price_alert(
    alert_id: int,
    alert_in: PriceAlertCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    alert = db.query(PriceAlert).filter(
        PriceAlert.id == alert_id,
        PriceAlert.user_id == current_user.id
    ).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Price alert not found")
        
    alert.target_price = alert_in.target_price
    alert.active = alert_in.active
    db.commit()
    db.refresh(alert)
    return alert

