from fastapi import FastAPI
from pydantic import BaseModel
from langchain_community.vectorstores.pgvector import PGVector
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from fastapi.middleware.cors import CORSMiddleware

CONNECTION_STRING = "postgresql+psycopg2://admin:admin@localhost:5432/plcnext_data"
COLLECTION_NAME = "plcnext_documents"
EMBEDDING_MODEL = "BAAI/bge-m3"
LLM_MODEL = "llama3"

app = FastAPI(
    title="PLCnext AI Agent Chatbot API",
    description="API สำหรับแชทบอทผู้ช่วยอัจฉริยะสำหรับ PLCnext",
    version="1.0.0"
)

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL, model_kwargs={'device': 'cuda'})

vectorstore = PGVector(
    connection_string=CONNECTION_STRING,
    collection_name=COLLECTION_NAME,
    embedding_function=embeddings
)

retriever = vectorstore.as_retriever()

llm = ChatOllama(model=LLM_MODEL)

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

rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

class ChatRequest(BaseModel):
    query: str

@app.get("/")
def read_root():
    return {"message": "Welcome to PLCnext Chatbot API!"}


@app.post("/chat/text")
def chat_with_rag(request: ChatRequest):
    response_text = rag_chain.invoke(request.query)
    return {"answer": response_text}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
