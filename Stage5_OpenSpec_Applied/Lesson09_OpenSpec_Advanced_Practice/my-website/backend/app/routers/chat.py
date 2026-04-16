import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from openai import OpenAI

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.schemas.chat import (
    CreateConversationRequest,
    ConversationResponse,
    MessageResponse,
    SendMessageRequest,
)
from app.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

router = APIRouter()

deepseek_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


def _build_system_prompt(user: User, db: Session) -> str:
    # Count today's goals (from mock — in future this would query real data)
    return (
        "你是 StudyPal 学习助手。当前用户的学习数据：\n"
        f"- 连续学习天数：{user.streak_days}\n"
        f"- 用户等级：Lv.{user.level}\n"
        f"- 邮箱：{user.email}\n\n"
        "请基于以上数据给出个性化学习建议。回复使用中文，支持 Markdown 格式。"
    )


def _get_user_conversation(conversation_id: str, user: User, db: Session) -> Conversation:
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="conversation not found")
    return conv


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    body: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = Conversation(user_id=current_user.id, title=body.title or "新对话")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/conversations", response_model=List[ConversationResponse])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
        .all()
    )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def list_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_user_conversation(conversation_id, current_user, db)
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )


@router.post("/conversations/{conversation_id}/messages")
def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_user_conversation(conversation_id, current_user, db)

    # Save user message
    user_msg = Message(conversation_id=conv.id, role="user", content=body.content)
    db.add(user_msg)
    db.commit()

    # Build messages for DeepSeek
    history = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    system_prompt = _build_system_prompt(current_user, db)
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})

    def event_generator():
        full_content = ""
        try:
            stream = deepseek_client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    full_content += delta.content
                    yield f"data: {json.dumps({'delta': delta.content}, ensure_ascii=False)}\n\n"

            yield "data: [DONE]\n\n"

            # Save assistant message after stream completes
            assistant_msg = Message(conversation_id=conv.id, role="assistant", content=full_content)
            db.add(assistant_msg)
            db.commit()

            # Auto-update conversation title from first user message
            if conv.title == "新对话" and body.content:
                conv.title = body.content[:50]
                db.commit()

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
