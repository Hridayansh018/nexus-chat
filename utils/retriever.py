from utils.embeddings import embed_query
from utils.vectorstore import load_index, load_chunks

def retrieve_chunks(q: str, document_id: str, k: int = 5):
    index = load_index(document_id)
    chunks = load_chunks(document_id)
    query_vector = embed_query(q)
    scores, indices = index.search(query_vector, k)
    results = []
    for idx in indices[0]:
        if idx == -1:
            continue
        results.append(chunks[idx])
    return results