"""
Customer Support API - /api/support
=====================================
Endpoints for customers to create and manage support tickets.

Rate limit: 5 tickets per customer per 24-hour window.
Support tickets are stored as Conversation rows with type='support_ticket'.
The assigned admin is always the first User with role=='admin' found in the DB.
"""

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth_router import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

router = APIRouter()

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    """Return an offset-aware UTC datetime."""
    return datetime.now(tz=timezone.utc)


def _get_admin(db: Session) -> User:
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No admin account found. Cannot create support ticket.",
        )
    return admin


def _get_ticket_or_403(ticket_id: int, current_user: User, db: Session) -> Conversation:
    """Fetch the ticket and verify the caller is the ticket owner."""
    ticket = (
        db.query(Conversation)
        .filter(
            Conversation.id == ticket_id,
            Conversation.type == "support_ticket",
        )
        .first()
    )
    if ticket is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )
    if ticket.buyer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    return ticket


# ---------------------------------------------------------------------------
# POST /  - Create a new support ticket
# ---------------------------------------------------------------------------

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_support_ticket(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new support ticket.

    Body: { "title": str, "category": str, "description": str }

    Rate-limited to 5 tickets per customer per 24 hours.
    Returns: { "ticket_id": int, "status": "open" }
    """
    title: str = payload.get("title", "").strip()
    category: str = payload.get("category", "").strip()
    description: str = payload.get("description", "").strip()

    if not title:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="title is required.")
    if not description:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="description is required.")

    # -- Rate limit: 5 tickets per customer per 24 h -------------------------
    cutoff = _utcnow() - timedelta(hours=24)

    # created_at may be timezone-aware or naive depending on DB driver; normalise
    recent_count = (
        db.query(Conversation)
        .filter(
            Conversation.buyer_id == current_user.id,
            Conversation.type == "support_ticket",
            Conversation.created_at >= cutoff,
        )
        .count()
    )
    if recent_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded: maximum 5 support tickets per 24 hours.",
        )

    # -- Look up admin -------------------------------------------------------
    admin = _get_admin(db)

    # -- Create Conversation (ticket) ----------------------------------------
    conv = Conversation(
        buyer_id=current_user.id,
        seller_id=admin.id,          # support tickets always target the admin
        type="support_ticket",
        status="open",
        category=category or None,
        title=title,
    )
    db.add(conv)
    db.flush()  # get conv.id before committing

    # -- Attach the opening message ------------------------------------------
    first_msg = Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=description,
    )
    db.add(first_msg)
    db.commit()
    db.refresh(conv)

    return {"ticket_id": conv.id, "status": "open"}


# ---------------------------------------------------------------------------
# GET /me  - List current customer's tickets
# ---------------------------------------------------------------------------

@router.get("/me")
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all support tickets belonging to the authenticated customer."""
    tickets = (
        db.query(Conversation)
        .filter(
            Conversation.buyer_id == current_user.id,
            Conversation.type == "support_ticket",
        )
        .order_by(Conversation.created_at.desc())
        .all()
    )

    return [
        {
            "id": t.id,
            "title": t.title,
            "category": t.category,
            "status": t.status,
            "type": t.type,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "buyer_id": t.buyer_id,
        }
        for t in tickets
    ]


# ---------------------------------------------------------------------------
# GET /{ticket_id}/messages  - Thread view
# ---------------------------------------------------------------------------

@router.get("/{ticket_id}/messages")
def get_ticket_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all messages for a ticket.
    Only the ticket owner can access this endpoint (403 otherwise).
    """
    ticket = _get_ticket_or_403(ticket_id, current_user, db)

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == ticket.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "sender_id": m.sender_id,
            "content": m.content,
            "is_read": m.is_read,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


# ---------------------------------------------------------------------------
# POST /{ticket_id}/reply  - Customer reply
# ---------------------------------------------------------------------------

@router.post("/{ticket_id}/reply", status_code=status.HTTP_201_CREATED)
def reply_to_ticket(
    ticket_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a reply message to an existing support ticket.

    Body: { "content": str }

    Returns 403 if the caller is not the ticket owner.
    Returns 409 if the ticket is already closed.
    """
    ticket = _get_ticket_or_403(ticket_id, current_user, db)

    if ticket.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This ticket is closed and cannot accept new replies.",
        )

    content: str = payload.get("content", "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="content is required.",
        )

    msg = Message(
        conversation_id=ticket.id,
        sender_id=current_user.id,
        content=content,
    )
    db.add(msg)
    # Reopen the ticket to 'pending' to notify admin there's a new reply
    if ticket.status == "resolved":
        ticket.status = "pending"
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
