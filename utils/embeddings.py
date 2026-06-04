from sentence_transformers import SentenceTransformer
import numpy as np

embedding_manager = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding_model():
    return embedding_manager

def create_embeddings(texts: list[str]) -> np.ndarray:
    embeddings = embedding_manager.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True 
    )
    return embeddings


def embed_query(q:str)->np.ndarray:
    embedding = embedding_manager.encode(
        q,
        convert_to_numpy=True,
        normalize_embeddings=True
    )
    return embedding.reshape(1, -1)

def create_chunk_embeddings(chunks):
    texts = [chunk.page_content for chunk in chunks]
    vectors = embedding_manager.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    return {
        "texts":texts,
        "vectors":vectors,
        "metadata":[chunk.metadata for chunk in chunks]     
    }