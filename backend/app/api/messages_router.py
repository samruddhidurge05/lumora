from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from app.db.session import get_db
from app.dependencies import get_current_user_required
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.schemas import ConversationResponse, ConversationCreate, MessageResponse, MessageCreate

router = APIRouter()

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    # Retrieve all conversations where current user is buyer or seller
    conversations = db.query(Conversation).filter(
        or_(
            Conversation.buyer_id == current_user.id,
            Conversation.seller_id == current_user.id
        )
    ).order_by(Conversation.updated_at.desc()).all()
    
    # Attach names dynamically
    for conv in conversations:
        buyer = db.query(User).filter(User.id == conv.buyer_id).first()
        seller = db.query(User).filter(User.id == conv.seller_id).first()
        conv.buyer_name = buyer.name if buyer else "Customer"
        conv.seller_name = seller.name if seller else "Creator"
        
    return conversations

@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_in: ConversationCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    # Ensure current user is one of the participants
    if current_user.id not in (conv_in.buyer_id, conv_in.seller_id) and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create conversations involving yourself."
        )

    # Check if conversation already exists
    existing = db.query(Conversation).filter(
        Conversation.buyer_id == conv_in.buyer_id,
        Conversation.seller_id == conv_in.seller_id
    ).first()
    if existing:
        # Attach names dynamically for existing
        buyer = db.query(User).filter(User.id == existing.buyer_id).first()
        seller = db.query(User).filter(User.id == existing.seller_id).first()
        existing.buyer_name = buyer.name if buyer else "Customer"
        existing.seller_name = seller.name if seller else "Creator"
        return existing
        
    conversation = Conversation(buyer_id=conv_in.buyer_id, seller_id=conv_in.seller_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    
    # Attach names dynamically
    buyer = db.query(User).filter(User.id == conversation.buyer_id).first()
    seller = db.query(User).filter(User.id == conversation.seller_id).first()
    conversation.buyer_name = buyer.name if buyer else "Customer"
    conversation.seller_name = seller.name if seller else "Creator"
    
    return conversation

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    # Verify user belongs to conversation
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    return messages

@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: int,
    message_in: MessageCreate,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    if not message_in.content or not message_in.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message content cannot be empty."
        )

    # Verify conversation exists and user is participant
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=message_in.content,
        attachment_url=message_in.attachment_url,
        is_read=False
    )
    db.add(message)
    
    # Touch conversation updated_at
    db.commit()
    db.refresh(message)
    return message

@router.put("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    # Mark all messages sent by the other participant in this conversation as read
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).update({Message.is_read: True}, synchronize_session=False)
    db.commit()
    return None
