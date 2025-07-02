import os
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores.pgvector import PGVector
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

CONNECTION_STRING = "postgresql+psycopg2://admin:admin@localhost:5432/plcnext_data"

COLLECTION_NAME = "plcnext_documents"

EMBEDDING_MODEL = "BAAI/bge-m3"

DATA_PATH = "data"

def main():
    """
    ฟังก์ชันหลักสำหรับกระบวนการ Ingestion ทั้งหมด
    1. โหลดเอกสาร (Load)
    2. แบ่งเอกสารเป็นชิ้นเล็กๆ (Split)
    3. สร้าง Embedding และจัดเก็บลง Vector Store (Embed & Store)
    """
    print("--- เริ่มกระบวนการป้อนข้อมูล (Ingestion) ---")

    # 1. โหลดเอกสารจากโฟลเดอร์ /data
    print(f"กำลังโหลดเอกสารจากโฟลเดอร์ '{DATA_PATH}'...")
    loader = DirectoryLoader(DATA_PATH, glob="**/*", show_progress=True, use_multithreading=True)
    documents = loader.load()
    if not documents:
        print("ไม่พบเอกสารในโฟลเดอร์ที่ระบุ! กรุณาตรวจสอบว่ามีไฟล์ใน /data หรือไม่")
        return
    print(f"โหลดเอกสารสำเร็จทั้งหมด {len(documents)} ไฟล์")

    # 2. แบ่งเอกสารเป็นชิ้นเล็กๆ (Chunking)
    print("กำลังแบ่งเอกสารเป็นชิ้นเล็กๆ (chunks)...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(documents)
    print(f"แบ่งเอกสารออกเป็น {len(chunks)} chunks")

    # 3. สร้าง Embedding และจัดเก็บลง Vector Store (pgVector)
    print(f"กำลังสร้าง Embeddings ด้วยโมเดล '{EMBEDDING_MODEL}' และจัดเก็บลงฐานข้อมูล...")
    print("ขั้นตอนนี้อาจใช้เวลานานขึ้นอยู่กับจำนวนข้อมูลและประสิทธิภาพของเครื่อง...")

    # สร้าง Embeddings model
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL, model_kwargs={'device': 'cuda'})

    # ทำการล้างข้อมูลเก่าใน collection (ถ้ามี) และสร้างใหม่ โดยใช้ from_documents เพื่อสร้างและเก็บข้อมูลในครั้งเดียว
    PGVector.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        connection_string=CONNECTION_STRING,
        pre_delete_collection=True,
    )

    print("--- กระบวนการป้อนข้อมูลเสร็จสิ้นสมบูรณ์! ---")
    print(f"ข้อมูลถูกจัดเก็บใน Collection: '{COLLECTION_NAME}' เรียบร้อยแล้ว")

if __name__ == "__main__":
    main()
