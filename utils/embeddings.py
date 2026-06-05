from huggingface_hub import InferenceClient
import numpy as np
import os

client = InferenceClient(
    provider="hf-inference",
    api_key=os.getenv("HF_TOKEN")
)

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def create_embeddings(texts: list[str]) -> np.ndarray:
    vectors = client.feature_extraction(
        texts,
        model=EMBEDDING_MODEL
    )

    return np.array(vectors)


def embed_query(q: str) -> np.ndarray:
    vector = client.feature_extraction(
        q,
        model=EMBEDDING_MODEL
    )

    return np.array(vector).reshape(1, -1)


def create_chunk_embeddings(chunks):
    texts = [chunk.page_content for chunk in chunks]

    vectors = client.feature_extraction(
        texts,
        model=EMBEDDING_MODEL
    )

    vectors = np.array(vectors)

    return {
        "texts": texts,
        "vectors": vectors,
        "metadata": [chunk.metadata for chunk in chunks]
    }