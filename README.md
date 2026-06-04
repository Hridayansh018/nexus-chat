# NexusPDF — AI Document Intelligence

A FastAPI-based Retrieval-Augmented Generation (RAG) system that lets you upload PDF files and ask questions about their contents using AI.

## How It Works

1. **Upload** a PDF → Extract text, split into chunks, generate embeddings, store in vector database
2. **Ask** a question → Embed query, find similar chunks, build context, stream LLM response
3. **Get Answer** → AI-powered response with source citations

## Tech Stack

- **Backend:** FastAPI, LangChain, FAISS, Sentence-Transformers
- **Frontend:** Vanilla JavaScript with streaming responses
- **LLM:** OpenRouter API (`openai/gpt-oss-120b:free`)
- **Embedding Model:** `all-MiniLM-L6-v2`

---

## 📁 Project Structure

```
chat_with_pdf/
├── main.py                    # FastAPI app entry point
├── schema.py                  # Pydantic request/response models
├── .env                       # Environment variables (API keys)
├── .env.example               # Example environment config
├── requirements.txt           # Python dependencies
│
├── router/                    # API endpoints
│   ├── upload.py              # POST /upload-file/ - PDF upload & processing
│   ├── chat.py                # POST /chat/ - Question answering
│   └── cleanup_router.py      # GET/DELETE /documents/{document_id}
│
├── utils/                     # Business logic & pipelines
│   ├── embeddings.py          # Vector embedding generation
│   ├── llmclient.py           # LLM client initialization
│   ├── pdfloader.py           # PDF text extraction
│   ├── rag.py                 # RAG pipeline & streaming
│   ├── retriever.py           # Semantic search for chunks
│   ├── splitter.py            # Text chunking strategy
│   ├── vectorstore.py         # FAISS index management
│   └── cleanup.py             # Cleanup utilities
│
├── static/                    # Frontend files
│   ├── index.html             # Main UI
│   ├── app.js                 # Frontend logic & API calls
│   ├── styles.css             # UI styling
│   └── config.js              # API configuration
│
├── uploads/                   # Uploaded PDFs (organized by document_id)
└── vector_db/                 # FAISS indexes (organized by document_id)
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.13+
- [OpenRouter API Key](https://openrouter.ai/keys)
- Frontend: Any modern browser

### Installation

```bash
# Clone & setup
git clone <repo-url>
cd chat_with_pdf
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure
echo "OPENROUTER_API_KEY=your-key" > .env

# Run backend
uvicorn main:app --reload --port 8000

# Run frontend (in another terminal)
cd static
python -m http.server 5500
```

Access at: `http://localhost:5500`

---

## 📖 API Endpoints & Routes

### **1. POST `/upload-file/`** — Upload & Process PDF

**File:** `router/upload.py` (lines 13-63)

**Request:**
```bash
curl -X POST http://localhost:8000/upload-file/ \
  -F "file=@document.pdf"
```

**Response:**
```json
{
  "message": "PDF processed successfully",
  "filename": "document.pdf",
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "pages": 10,
  "chunks": 42
}
```

**Process Flow:**
1. **Line 14-19:** Validate file is PDF, reject if not
2. **Line 20:** Clear old vector stores
3. **Line 22-24:** Generate unique document ID, create document directory
4. **Line 27-29:** Save PDF to `uploads/{document_id}/`
5. **Line 31:** Extract text from PDF using PyPDFLoader
6. **Line 41-42:** Split text into overlapping chunks (1000 chars, 200 overlap)
7. **Line 50-52:** Generate embeddings for all chunks
8. **Line 53-56:** Create FAISS index, save index & chunks to `vector_db/{document_id}/`
9. **Line 58-63:** Return metadata with `document_id`

---

### **2. POST `/chat/`** — Ask Question

**File:** `router/chat.py` (lines 8-12)

**Request:**
```bash
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "550e8400-e29b-41d4-a716-446655440000",
    "question": "What is process scheduling?"
  }'
```

**Response:** Streaming NDJSON
```
{"type": "sources", "sources": [{"index": 1, "page": 2, "preview": "..."}]}
{"type": "text", "content": "Process scheduling"}
{"type": "text", "content": " is..."}
{"type": "done"}
```

**Process Flow:**
1. **Line 9-12:** Accept `ChatRequest` with `document_id` & `question`
2. Stream response via `ask_question()` generator
3. Return NDJSON format with sources and streamed text

---

### **3. GET `/documents/{document_id}`** — Check Document Exists

**File:** `router/cleanup_router.py` (lines 8-13)

**Request:**
```bash
curl http://localhost:8000/documents/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{"exists": true, "document_id": "550e8400-e29b-41d4-a716-446655440000"}
```

**Logic:**
- Check if `uploads/{document_id}/` directory exists
- Return `{"exists": true}` or `{"exists": false}`

---

### **4. DELETE `/documents/{document_id}`** — Delete Document

**File:** `router/cleanup_router.py` (lines 16-20)

**Request:**
```bash
curl -X DELETE http://localhost:8000/documents/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{"message": "Document deleted"}
```

**Logic:**
- **Line 18:** Clear vector store for document
- **Line 19:** Delete document directory from `uploads/`

---

## 🛠️ Utility Modules Breakdown

### **1. `utils/embeddings.py`** — Text to Vector Conversion

**Functions:**

| Function | Purpose |
|----------|---------|
| `get_embedding_model()` | Returns SentenceTransformer model instance |
| `create_embeddings(texts)` | Convert list of strings to embedding vectors |
| `embed_query(q)` | Convert single query string to embedding vector |
| `create_chunk_embeddings(chunks)` | Convert document chunks to embeddings with metadata |

**Line-by-Line Breakdown:**

```python
# Line 1-2: Imports
from sentence_transformers import SentenceTransformer
import numpy as np

# Line 4: Load embedding model once (reused for all requests)
embedding_manager = SentenceTransformer('all-MiniLM-L6-v2')

# Line 6-7: Getter for model instance
def get_embedding_model():
    return embedding_manager

# Line 9-15: Embed multiple texts at once
def create_embeddings(texts: list[str]) -> np.ndarray:
    embeddings = embedding_manager.encode(
        texts,  # List of strings
        convert_to_numpy=True,  # Return numpy array
        normalize_embeddings=True  # L2 normalization for cosine similarity
    )
    return embeddings

# Line 18-24: Embed single query (reshapes to 2D for FAISS)
def embed_query(q: str) -> np.ndarray:
    embedding = embedding_manager.encode(
        q,
        convert_to_numpy=True,
        normalize_embeddings=True
    )
    return embedding.reshape(1, -1)  # Convert (384,) → (1, 384)

# Line 26-38: Process chunks from document splitter
def create_chunk_embeddings(chunks):
    texts = [chunk.page_content for chunk in chunks]  # Extract text
    vectors = embedding_manager.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return {
        "texts": texts,  # Original text
        "vectors": vectors,  # Embedding vectors
        "metadata": [chunk.metadata for chunk in chunks]  # Page numbers, etc.
    }
```

---

### **2. `utils/llmclient.py`** — LLM Client Setup

**Configuration:** Sets up ChatOpenAI client for OpenRouter API

```python
# Line 1-2: Load environment variables from .env
from dotenv import load_dotenv
load_dotenv()

# Line 7-13: Create LLM client with OpenRouter API
llm = ChatOpenAI(
    model="openai/gpt-oss-120b:free",  # Model to use
    api_key=os.getenv("OPENROUTER_API_KEY"),  # API key from .env
    base_url="https://openrouter.ai/api/v1",  # OpenRouter endpoint
    temperature=0.7,  # Creativity (0=deterministic, 1=random)
    max_tokens=1024,  # Max response length
    streaming=True  # Enable token-by-token streaming
)
```

---

### **3. `utils/pdfloader.py`** — PDF Text Extraction

**Functions:**

```python
def load_pdf(path: str):
    # Line 4: Create PyPDF loader
    loader = PyPDFLoader(path)  # Path to PDF file
    # Line 5: Extract all pages as documents
    documents = loader.load()  # List of LangChain Document objects
    return documents  # Each has .page_content (text) and .metadata (page #)
```

**Returns:** List of LangChain `Document` objects
- `document.page_content` — Extracted text from page
- `document.metadata` — `{"page": 0, ...}`

---

### **4. `utils/splitter.py`** — Text Chunking

**Functions:**

```python
def split_documents(documents):
    # Line 4-6: Create recursive character splitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,  # Max characters per chunk
        chunk_overlap=200  # Overlapping chars to preserve context
    )
    # Line 9: Split all documents into chunks
    chunks = splitter.split_documents(documents)
    return chunks  # List of LangChain Document objects (smaller pieces)
```

**Strategy:** Splits recursively by `["\n\n", "\n", " ", ""]`
- Preserves paragraphs → sentences → words → characters
- Overlap ensures context continuity between chunks

---

### **5. `utils/vectorstore.py`** — FAISS Vector Database

**Functions:**

| Function | Purpose |
|----------|---------|
| `create_index(vectors)` | Create FAISS index from embedding vectors |
| `save_index(index, document_id)` | Save index to disk |
| `load_index(document_id)` | Load index from disk |
| `save_chunks(chunks, document_id)` | Save chunks as pickle |
| `load_chunks(document_id)` | Load chunks from pickle |

**Line-by-Line:**

```python
# Line 11-19: Create FAISS index
def create_index(vectors):
    if vectors.ndim != 2:  # Validate shape (N, 384)
        raise ValueError(...)
    dimensions = vectors.shape[1]  # Get embedding dimension (384)
    index = faiss.IndexFlatIP(dimensions)  # Inner product for cosine
    index.add(vectors)  # Add all vectors to index
    return index

# Line 21-24: Save FAISS index to disk
def save_index(index, document_id, index_path=None):
    doc_vector_dir = f"vector_db/{document_id}"
    os.makedirs(doc_vector_dir, exist_ok=True)
    full_index_path = f"{doc_vector_dir}/index.faiss"
    faiss.write_index(index, full_index_path)

# Line 26-27: Load FAISS index from disk
def load_index(document_id, index_path=None):
    full_index_path = f"vector_db/{document_id}/index.faiss"
    return faiss.read_index(full_index_path)

# Line 29-32: Save chunks as Python pickle
def save_chunks(chunks, document_id, path=None):
    doc_vector_dir = f"vector_db/{document_id}"
    os.makedirs(doc_vector_dir, exist_ok=True)
    full_chunks_path = f"{doc_vector_dir}/chunks.pkl"
    with open(full_chunks_path, "wb") as f:
        pickle.dump(chunks, f)

# Line 34-36: Load chunks from pickle
def load_chunks(document_id, path=None):
    full_chunks_path = f"vector_db/{document_id}/chunks.pkl"
    with open(full_chunks_path, "rb") as f:
        return pickle.load(f)
```

---

### **6. `utils/retriever.py`** — Semantic Search

**Functions:**

```python
def retrieve_chunks(q: str, document_id: str, k: int = 5):
    # Line 5-6: Load FAISS index and chunks for document
    index = load_index(document_id)
    chunks = load_chunks(document_id)
    
    # Line 7: Embed the user's question
    query_vector = embed_query(q)  # Shape: (1, 384)
    
    # Line 8: Search FAISS index for K most similar chunks
    scores, indices = index.search(query_vector, k)  # scores (1,5), indices (1,5)
    
    # Line 9-13: Collect matching chunks (skip -1 indices)
    results = []
    for idx in indices[0]:
        if idx == -1:  # FAISS returns -1 for invalid
            continue
        results.append(chunks[idx])
    
    return results  # Top K most relevant chunks
```

**How it works:**
1. Embed user question with same model as chunks
2. Find K nearest neighbors in FAISS index
3. Return the chunk documents with highest similarity

---

### **7. `utils/rag.py`** — RAG Pipeline & LLM Streaming

**Functions:**

```python
def build_context(documents):
    # Line 6-8: Join chunk texts with separators
    return "\n\n".join(doc.page_content for doc in documents)

def ask_question(q: str, document_id: str):
    # Line 12: Get top 5 similar chunks
    docs = retrieve_chunks(q, document_id, k=5)
    
    # Line 13-17: Build source citations for frontend
    sources = []
    for i, doc in enumerate(docs):
        page = doc.metadata.get("page", None)
        preview = doc.page_content[:150].strip()  # First 150 chars
        sources.append({"index": i+1, "page": page, "preview": preview})
    
    # Line 19: Stream sources to frontend first
    yield json.dumps({"type": "sources", "sources": sources}) + "\n"
    
    # Line 21: Build context string from chunks
    context = build_context(docs)
    
    # Line 22-37: Create system prompt with context
    prompt = f"""You are a helpful assistant.
Answer ONLY using the provided context.
If the answer is not present, say: "I couldn't find that information..."
When referencing, cite sources like [1], [2] etc.
Context: {context}
Question: {q}"""
    
    # Line 39-41: Stream LLM response token-by-token
    for chunk in llm.stream(prompt):
        if chunk.content:
            yield json.dumps({"type": "text", "content": chunk.content}) + "\n"
    
    # Line 43: Signal response complete
    yield json.dumps({"type": "done"}) + "\n"
```

---

### **8. `utils/cleanup.py`** — Cleanup Utilities

```python
def delete_document_data(document_id: str):
    # Delete entire document directory from uploads
    upload_path = f"uploads/{document_id}"
    if os.path.isdir(upload_path):
        shutil.rmtree(upload_path)  # Recursive delete
    elif os.path.isfile(upload_path):
        os.remove(upload_path)

def clear_vectorstore():
    # Delete all vector databases
    vector_db_path = "vector_db"
    if os.path.isdir(vector_db_path):
        for item in os.listdir(vector_db_path):
            item_path = os.path.join(vector_db_path, item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)  # Delete document's vector dir
            elif os.path.isfile(item_path):
                os.remove(item_path)
        if not os.listdir(vector_db_path):
            os.rmdir(vector_db_path)  # Remove empty dir

def clear_uploads():
    # Delete all uploaded documents
    if os.path.isdir("uploads"):
        for item in os.listdir("uploads"):
            item_path = os.path.join("uploads", item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            elif os.path.isfile(item_path):
                os.remove(item_path)
```

---

## 🔐 Environment Configuration

**Required `.env` file:**
```
OPENROUTER_API_KEY=your-api-key-here
```

**Frontend configuration (static/config.js):**
```javascript
window.CONFIG = {
    API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000'
};
```

**Development:** `http://localhost:8000`
**Production:** Set `REACT_APP_API_URL` in deployment platform

---

## 📊 Configuration Details

| Setting | Value | Explanation |
|---------|-------|-------------|
| **LLM Model** | `openai/gpt-oss-120b:free` | Free open-source model via OpenRouter |
| **Temperature** | 0.7 | Balanced creativity & consistency |
| **Max Tokens** | 1024 | Max response length |
| **Embedding Model** | `all-MiniLM-L6-v2` | Fast, accurate, 384-dimensional |
| **Chunk Size** | 1000 | Characters per chunk |
| **Chunk Overlap** | 200 | Context overlap between chunks |
| **Top-K Retrieval** | 5 | Most relevant chunks per query |
| **Vector DB** | FAISS IndexFlatIP | Cosine similarity search |

---

## 🎯 Data Flow Diagram

```
Upload Document:
  PDF File → PyPDFLoader → Splitter → Embeddings → FAISS Index + Chunks → ✅ Success

Ask Question:
  Question → Embedding → FAISS Search → Retrieve 5 Chunks → Build Context 
  → LLM Prompt → Stream Response → Yield JSON → ✅ Answer
```

---

## 🚀 Deployment

### Frontend (Vercel)
1. Push to GitHub
2. Connect to Vercel
3. Set environment variable: `REACT_APP_API_URL=<backend-url>`

### Backend (Railway/Render)
1. Push to GitHub
2. Deploy on Railway or Render
3. Set `OPENROUTER_API_KEY` environment variable
4. Get backend URL
5. Update frontend API_BASE_URL

---

## 📝 License

MIT

## 🤝 Contributing

Pull requests welcome!
