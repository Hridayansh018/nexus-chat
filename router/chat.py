from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from schema import ChatRequest
from utils.rag import ask_question

router = APIRouter()

@router.post("/chat/")
async def chat(r: ChatRequest):
    return StreamingResponse(
        ask_question(r.question, r.document_id),
        media_type="application/x-ndjson"
    )