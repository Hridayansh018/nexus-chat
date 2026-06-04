from sentence_transformers import SentenceTransformer
import numpy as np

_embedding_manager = None

def get_embedding_model():
    global _embedding_manager

    if _embedding_manager is None:
        _embedding_manager = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

    return _embedding_manager

def create_embeddings(texts: list[str]) -> np.ndarray:
    model = get_embedding_model()
    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True 
    )
    return embeddings


def embed_query(q:str)->np.ndarray:
    model = get_embedding_model()
    embedding = model.encode(
        q,
        convert_to_numpy=True,
        normalize_embeddings=True
    )
    return embedding.reshape(1, -1)

def create_chunk_embeddings(chunks):
    model = get_embedding_model()
    texts = [chunk.page_content for chunk in chunks]
    vectors = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    return {
        "texts":texts,
        "vectors":vectors,
        "metadata":[chunk.metadata for chunk in chunks]     
    }