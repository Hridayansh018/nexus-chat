from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from router.upload import router as upload_router
from router.chat import router as chat_router
from router.cleanup_router import router as delete_document

app = FastAPI(
    title="PDF RAG Chat API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(delete_document)