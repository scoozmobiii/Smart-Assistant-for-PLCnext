# ไฟล์: backend/main.py
# คำอธิบาย: นี่คือเวอร์ชันที่อัปเดตแล้ว โดยเพิ่มส่วนของ CORSMiddleware
# เพื่ออนุญาตการเชื่อมต่อจากหน้าเว็บ Frontend ของเรา

from fastapi import FastAPI
from pydantic import BaseModel
from langchain_community.vectorstores.pgvector import PGVector
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# [เพิ่มใหม่] Import CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware

# --- การตั้งค่าพื้นฐาน ---
CONNECTION_STRING = "postgresql+psycopg2://admin:admin@localhost:5432/plcnext_data"
COLLECTION_NAME = "plcnext_documents"
EMBEDDING_MODEL = "BAAI/bge-m3"
LLM_MODEL = "llama3"

# --- เริ่มสร้าง FastAPI App ---
app = FastAPI(
    title="PLCnext AI Agent Chatbot API",
    description="API สำหรับแชทบอทผู้ช่วยอัจฉริยะสำหรับ PLCnext",
    version="1.0.0"
)

# [เพิ่มใหม่] ตั้งค่า CORS
# เราจะอนุญาตการเชื่อมต่อทั้งหมด (*) เพื่อความง่ายในการพัฒนา
# นี่คือส่วนที่สำคัญที่สุดในการแก้ไขครั้งนี้
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # อนุญาตทุก Method (GET, POST, OPTIONS, etc.)
    allow_headers=["*"], # อนุญาตทุก Header
)


# --- เตรียมส่วนประกอบของ RAG Pipeline ---
# (โค้ดส่วนนี้เหมือนเดิมทุกประการ)

# 1. เตรียม Embedding Model
embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL, model_kwargs={'device': 'cuda'})

# 2. เชื่อมต่อกับ Vector Store ที่มีอยู่แล้ว
vectorstore = PGVector(
    connection_string=CONNECTION_STRING,
    collection_name=COLLECTION_NAME,
    embedding_function=embeddings
)

# 3. สร้าง Retriever จาก Vector Store เพื่อใช้ค้นหาข้อมูล
retriever = vectorstore.as_retriever()

# 4. สร้าง LLM
llm = ChatOllama(model=LLM_MODEL)

# 5. สร้าง Prompt Template
template = """
คุณคือผู้ช่วย AI ที่เชี่ยวชาญด้าน PLCnext ของ Phoenix Contact โดยเฉพาะ
หน้าที่ของคุณคือการตอบคำถามโดยใช้ข้อมูลจาก "Context" ที่ให้มาเท่านั้น ห้ามตอบโดยใช้ความรู้เดิมของคุณเด็ดขาด
จงตอบคำถามของผู้ใช้ให้กระชับ ชัดเจน และเป็นประโยชน์ที่สุด โดยอ้างอิงจากข้อมูลที่ให้มา

Context:
{context}

Question:
{question}

Helpful Answer (in Thai):
"""
prompt = ChatPromptTemplate.from_template(template)

# 6. สร้าง RAG Chain
rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# --- สร้าง API Endpoint ---
class ChatRequest(BaseModel):
    query: str

@app.get("/")
def read_root():
    return {"message": "Welcome to PLCnext Chatbot API!"}


@app.post("/chat/text")
def chat_with_rag(request: ChatRequest):
    response_text = rag_chain.invoke(request.query)
    return {"answer": response_text}

# --- ส่วนที่ทำให้สามารถรัน App ได้โดยตรง (สำหรับทดสอบ) ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
