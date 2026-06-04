from fastapi import APIRouter, File, UploadFile, HTTPException
import shutil
from utils.pdfloader import load_pdf
from utils.splitter import split_documents
from utils.embeddings import create_chunk_embeddings
from utils.vectorstore import create_index, save_index, save_chunks
from utils.cleanup import clear_vectorstore, clear_uploads
import os
import uuid

router = APIRouter()

@router.post("/upload-file/")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )
    clear_vectorstore()
    
    document_id = str(uuid.uuid4())
    doc_dir = f"uploads/{document_id}"
    os.makedirs(doc_dir, exist_ok=True)
    
    path = f"{doc_dir}/{file.filename}"

    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    documents = load_pdf(path)

    # debug 2
    print(
    repr(
        documents[0].page_content
    )
)
    
    # print("First page content:")
    # print(repr(documents[0].page_content[:500]))
    chunks = split_documents(documents)
    print("Chunks:", len(chunks))

    # debug 1
    if len(chunks) == 0:
        raise HTTPException(
            status_code=400,
            detail="No text chunks could be extracted from the PDF"
        )
    embedding_data = create_chunk_embeddings(chunks)
    vectors = embedding_data['vectors']
    index = create_index(vectors)
    save_index(index, document_id)
    save_chunks(chunks, document_id)

    return {
        "message": "PDF processed successfully",
        "filename": file.filename,
        "document_id": document_id,
        "pages": len(documents),
        "chunks": len(chunks)
    }