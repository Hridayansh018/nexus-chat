import os
import shutil


def delete_document_data(document_id: str):
    upload_path = f"uploads/{document_id}"
    if os.path.isdir(upload_path):
        shutil.rmtree(upload_path)
    elif os.path.isfile(upload_path):
        os.remove(upload_path)


def clear_vectorstore():
    vector_db_path = "vector_db"
    if os.path.isdir(vector_db_path):
        for item in os.listdir(vector_db_path):
            item_path = os.path.join(vector_db_path, item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            elif os.path.isfile(item_path):
                os.remove(item_path)
        if not os.listdir(vector_db_path):
            os.rmdir(vector_db_path)


def clear_uploads():
    if os.path.isdir("uploads"):
        for item in os.listdir("uploads"):
            item_path = os.path.join("uploads", item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            elif os.path.isfile(item_path):
                os.remove(item_path)