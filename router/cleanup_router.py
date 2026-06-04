from utils.cleanup import delete_document_data, clear_vectorstore
from fastapi import APIRouter
import os

router = APIRouter()


@router.get("/documents/{document_id}")
async def get_document(document_id: str):
    doc_dir = f"uploads/{document_id}"
    if os.path.isdir(doc_dir):
        return {"exists": True, "document_id": document_id}
    return {"exists": False}


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    clear_vectorstore()
    delete_document_data(document_id)
    return {"message": "Document deleted"}