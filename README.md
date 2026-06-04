# PDF RAG Chat API

A FastAPI-based Retrieval-Augmented Generation (RAG) system that lets you upload PDF files and ask questions about their contents using an LLM.

## How It Works

1. **Upload** a PDF via `POST /upload-file/` — the server extracts text, splits it into chunks, generates vector embeddings (via `all-MiniLM-L6-v2`), and stores them in a FAISS index.
2. **Ask** a question via `POST /chat/` — the server embeds your question, retrieves the most relevant chunks from the index, builds a prompt with that context, and streams the LLM's answer back to you.

The LLM is accessed through OpenRouter's API (`openai/gpt-oss-120b:free`).

## Tech Stack

- **Python 3.13**
- **FastAPI** — Web framework
- **LangChain** — LLM orchestration
- **FAISS** — Vector similarity search
- **Sentence-Transformers** — Embedding model (`all-MiniLM-L6-v2`)
- **OpenRouter** — LLM API endpoint

## Project Structure

```
├── main.py                 # FastAPI application entry point
├── schema.py               # Pydantic request/response models
├── requirements.txt        # Python dependencies
├── pyproject.toml          # Project metadata
├── .env                    # Environment variables (API keys)
│
├── router/
│   ├── chat.py             # POST /chat/ endpoint
│   └── upload.py           # POST /upload-file/ endpoint
│
├── utils/
│   ├── embeddings.py       # SentenceTransformer embedding creation
│   ├── llmclient.py        # LangChain ChatOpenAI client (OpenRouter)
│   ├── pdfloader.py        # PDF document loading
│   ├── rag.py              # RAG pipeline: context + LLM streaming
│   ├── retriever.py        # FAISS similarity search
│   ├── splitter.py         # Text chunking
│   └── vectorstore.py      # FAISS index CRUD
│
├── uploads/                # Uploaded PDF files (created at runtime)
└── vector_db/              # FAISS index and chunk data (created at runtime)
```

## Setup

### Prerequisites

- Python 3.13
- An [OpenRouter API key](https://openrouter.ai/keys) (or any OpenAI-compatible API key)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd chat_with_pdf

# Create and activate a virtual environment
python -m venv venv
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# Windows (cmd):
venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create a `.env` file in the project root with your API key:

```
OPENROUTER_API_KEY=your-api-key-here
```

### Run the Server

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

## API Usage

### Health Check

```bash
curl http://localhost:8000/
```

Response: `{"message": "SERVER ONLINE"}`

### Upload a PDF

```bash
curl -X POST http://localhost:8000/upload-file/ \
  -F "file=@/path/to/document.pdf"
```

Response:
```json
{
  "message": "PDF processed successfully",
  "filename": "document.pdf",
  "pages": 12,
  "chunks": 45
}
```

### Ask a Question

```bash
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the main topic of this document?"}'
```

Returns a streaming plain-text response from the LLM.

## Configuration Details

| Setting | Value |
|---|---|
| LLM Model | `openai/gpt-oss-120b:free` |
| Temperature | 0.7 |
| Max tokens | 1024 |
| Embedding model | `all-MiniLM-L6-v2` |
| Chunk size | 1000 characters |
| Chunk overlap | 200 characters |
| Top-K retrieval | 5 chunks |
| Vector store path | `vector_db/` |
| Upload directory | `uploads/` |
