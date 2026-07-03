from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.review import Review
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.api.reviews.schemas import ReviewCreate, ReviewUpdate, ReviewResponse

router = APIRouter()


def _enrich(review: Review, db: Session) -> dict:
    """Return a dict matching ReviewResponse, adding reviewer_name from the User table."""
    reviewer = db.query(User).filter(User.id == review.user_id).first()
    name = None
    if reviewer:
        name = reviewer.name or reviewer.email or f"User #{reviewer.id}"
    return {
        "id": review.id,
        "user_id": review.user_id,
        "product_id": review.product_id,
        "rating": review.rating,
        "comment": review.comment,
        "reply": review.reply,
        "verified": review.verified,
        "reviewer_name": name,
        "created_at": review.created_at,
        "updated_at": getattr(review, "updated_at", None),
    }


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    review_in: ReviewCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if review_in.rating < 1.0 or review_in.rating > 5.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5."
        )

    # Check if product exists
    prod = db.query(Product).filter(Product.id == review_in.product_id).first()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Duplicate review prevention
    existing = db.query(Review).filter(
        Review.user_id == current_user.id,
        Review.product_id == review_in.product_id
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already reviewed this product")

    # Check if verified purchase: user has a completed order containing this product
    has_purchased = db.query(Order).join(OrderItem).filter(
        Order.user_id == current_user.id,
        Order.status.in_(["completed", "paid"]),
        OrderItem.product_id == review_in.product_id
    ).first() is not None

    review = Review(
        user_id=current_user.id,
        product_id=review_in.product_id,
        rating=review_in.rating,
        comment=review_in.comment,
        verified=has_purchased
    )
    db.add(review)

    # Recalculate product rating
    reviews = db.query(Review).filter(Review.product_id == review_in.product_id).all()
    all_ratings = [r.rating for r in reviews] + [review_in.rating]
    prod.rating = round(sum(all_ratings) / len(all_ratings), 1)
    prod.reviews = len(all_ratings)
    db.add(prod)

    db.commit()
    db.refresh(review)
    return _enrich(review, db)


@router.get("/", response_model=List[ReviewResponse])
def read_reviews(product_id: int, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.product_id == product_id).order_by(Review.created_at.desc()).all()
    return [_enrich(r, db) for r in reviews]


@router.get("/product/{product_id}", response_model=List[ReviewResponse])
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.product_id == product_id).order_by(Review.created_at.desc()).all()
    return [_enrich(r, db) for r in reviews]


@router.get("/me", response_model=List[ReviewResponse])
def get_my_reviews(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    reviews = db.query(Review).filter(Review.user_id == current_user.id).order_by(Review.created_at.desc()).all()
    return [_enrich(r, db) for r in reviews]


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this review")

    prod_id = review.product_id
    db.delete(review)
    db.commit()

    # Recalculate product rating
    prod = db.query(Product).filter(Product.id == prod_id).first()
    if prod:
        reviews = db.query(Review).filter(Review.product_id == prod_id).all()
        if reviews:
            all_ratings = [r.rating for r in reviews]
            prod.rating = round(sum(all_ratings) / len(all_ratings), 1)
            prod.reviews = len(all_ratings)
        else:
            prod.rating = 5.0
            prod.reviews = 0
        db.add(prod)
        db.commit()

    return None


@router.put("/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int,
    review_in: ReviewUpdate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if review.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this review")

    if review_in.rating is not None:
        if review_in.rating < 1.0 or review_in.rating > 5.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rating must be between 1 and 5.")
        review.rating = review_in.rating

    if review_in.comment is not None:
        review.comment = review_in.comment

    db.commit()
    db.refresh(review)

    # Recalculate product rating
    prod = db.query(Product).filter(Product.id == review.product_id).first()
    if prod:
        reviews = db.query(Review).filter(Review.product_id == review.product_id).all()
        if reviews:
            all_ratings = [r.rating for r in reviews]
            prod.rating = round(sum(all_ratings) / len(all_ratings), 1)
            prod.reviews = len(all_ratings)
            db.add(prod)
            db.commit()

    return _enrich(review, db)



