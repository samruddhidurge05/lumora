"""
Admin Support API — P3-M7
=========================
Endpoints for administrators to manage customer support tickets.
All endpoints require admin role via require_admin_role dependency.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User

router = APIRouter()

# ── Valid support ticket status values ────────────────────────────────────────
VALID_STATUSES = ["open", "pending", "resolved", "closed"]


# ── Request / Response Schemas ────────────────────────────────────────────────

class ReplyRequest(BaseModel):
    content: str


class StatusUpdateRequest(BaseModel):
    status: str


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_ticket_or_404(ticket_id: int, db: Session) -> Conversation:
    ticket = (
        db.query(Conversation)
        .filter(Conversation.id == ticket_id, Conversation.type == "support_ticket")
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Support ticket {ticket_id} not found.",
        )
    return ticket


# ── GET /tickets ──────────────────────────────────────────────────────────────

@router.get("/tickets")
def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """
    List all support tickets with buyer names.
    Optional ?status= filter. Paginated (default 20 per page).
    """
    query = (
        db.query(Conversation, User.name.label("buyer_name"))
        .join(User, Conversation.buyer_id == User.id)
        .filter(Conversation.type == "support_ticket")
    )

    if status_filter:
        query = query.filter(Conversation.status == status_filter)

    total = query.count()
    rows = query.order_by(Conversation.updated_at.desc()).offset(skip).limit(limit).all()

    tickets = []
    for conv, buyer_name in rows:
        tickets.append(
            {
                "id": conv.id,
                "title": conv.title,
                "category": conv.category,
                "status": conv.status,
                "buyer_id": conv.buyer_id,
                "buyer_name": buyer_name,
                "created_at": conv.created_at.isoformat() if conv.created_at else None,
                "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
                "resolved_at": conv.resolved_at.isoformat() if conv.resolved_at else None,
            }
        )

    return {"total": total, "skip": skip, "limit": limit, "tickets": tickets}


# ── GET /{ticket_id}/messages ─────────────────────────────────────────────────

@router.get("/{ticket_id}/messages")
def get_ticket_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """
    Return the full message thread for a support ticket.
    Marks all customer messages (sender_id != admin.id) as is_read=True.
    """
    ticket = _get_ticket_or_404(ticket_id, db)

    # Mark customer messages as read
    db.query(Message).filter(
        Message.conversation_id == ticket_id,
        Message.sender_id != admin_user.id,
        Message.is_read == False,  # noqa: E712
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == ticket_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return {
        "ticket_id": ticket_id,
        "messages": [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "content": m.content,
                "is_read": m.is_read,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


# ── POST /{ticket_id}/reply ───────────────────────────────────────────────────

@router.post("/{ticket_id}/reply", status_code=status.HTTP_201_CREATED)
def reply_to_ticket(
    ticket_id: int,
    body: ReplyRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """
    Post an admin reply to a support ticket.
    Inserts a Message with sender_id=admin.id and sets ticket status to 'pending'.
    """
    ticket = _get_ticket_or_404(ticket_id, db)

    if not body.content or not body.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reply content cannot be empty.",
        )

    # Insert admin message
    new_message = Message(
        conversation_id=ticket_id,
        sender_id=admin_user.id,
        content=body.content.strip(),
        is_read=False,
    )
    db.add(new_message)

    # Set ticket status to 'pending' (awaiting customer response)
    ticket.status = "pending"
    ticket.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(new_message)

    return {
        "message_id": new_message.id,
        "ticket_id": ticket_id,
        "sender_id": new_message.sender_id,
        "content": new_message.content,
        "created_at": new_message.created_at.isoformat() if new_message.created_at else None,
        "ticket_status": ticket.status,
    }


# ── PUT /{ticket_id}/status ───────────────────────────────────────────────────

@router.put("/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_role),
):
    """
    Update the status of a support ticket.
    Valid values: open, pending, resolved, closed.
    Sets resolved_at=now() when status is 'resolved' or 'closed'.
    """
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{body.status}'. Must be one of: {VALID_STATUSES}.",
        )

    ticket = _get_ticket_or_404(ticket_id, db)

    ticket.status = body.status
    ticket.updated_at = datetime.now(timezone.utc)

    # Set resolved_at timestamp when resolving or closing
    if body.status in ("resolved", "closed"):
        ticket.resolved_at = datetime.now(timezone.utc)
    else:
        # Clear resolved_at if re-opening
        ticket.resolved_at = None

    db.commit()
    db.refresh(ticket)

    return {
        "ticket_id": ticket_id,
        "status": ticket.status,
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
    }
