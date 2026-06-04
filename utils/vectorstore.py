import faiss
import pickle
import os


VECTOR_DB_DIR = "vector_db"


def create_index(vectors):
    if vectors.ndim !=2:
        raise ValueError(
            f"Expected 2D embeddings, got shape {vectors.shape}"
        )
    dimensions = vectors.shape[1]
    index = faiss.IndexFlatIP(dimensions)
    index.add(vectors)
    return index

def save_index(index, document_id, index_path=None):
    doc_vector_dir = f"{VECTOR_DB_DIR}/{document_id}"
    os.makedirs(doc_vector_dir, exist_ok=True)
    full_index_path = f"{doc_vector_dir}/index.faiss"
    faiss.write_index(index, full_index_path)

def load_index(document_id, index_path=None):
    full_index_path = f"{VECTOR_DB_DIR}/{document_id}/index.faiss"
    return faiss.read_index(full_index_path)

def save_chunks(chunks, document_id, path=None):
    doc_vector_dir = f"{VECTOR_DB_DIR}/{document_id}"
    os.makedirs(doc_vector_dir, exist_ok=True)
    full_chunks_path = f"{doc_vector_dir}/chunks.pkl"
    with open(full_chunks_path, "wb") as f:
        pickle.dump(chunks, f)

def load_chunks(document_id, path=None):
    full_chunks_path = f"{VECTOR_DB_DIR}/{document_id}/chunks.pkl"
    with open(full_chunks_path, "rb") as f:
        return pickle.load(f)