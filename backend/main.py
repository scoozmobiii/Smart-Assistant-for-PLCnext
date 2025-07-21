from fastapi import FastAPI, File, UploadFile, Form
from pydantic import BaseModel
from langchain_community.vectorstores.pgvector import PGVector
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableBranch, RunnableLambda
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import pytesseract
from PIL import Image

# --- การตั้งค่าพื้นฐาน (เหมือนเดิม) ---
try:
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
except Exception as e:
    print(f"Warning: Could not set tesseract_cmd. Make sure Tesseract is in your PATH. Error: {e}")

CONNECTION_STRING = "postgresql+psycopg2://admin:admin@localhost:5432/plcnext_data"
COLLECTION_NAME = "plcnext_documents"
EMBEDDING_MODEL = "BAAI/bge-m3"
LLM_MODEL = "llama3"

app = FastAPI(
    title="Panya AI Assistant API",
    description="API for Panya, the AI assistant for PLCnext",
    version="1.6.0" # อัปเดตเวอร์ชัน
)
origins = ["*"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL, model_kwargs={'device': 'cuda'})
vectorstore = PGVector(connection_string=CONNECTION_STRING, collection_name=COLLECTION_NAME, embedding_function=embeddings)
retriever = vectorstore.as_retriever()
llm = ChatOllama(model=LLM_MODEL, temperature=0.1)

# --- RAG Chain (เหมือนเดิม) ---
answer_template = """
You are a highly precise technical assistant for PLCnext. Your sole purpose is to answer questions by extracting information directly from the provided context.
Follow these rules strictly:
1.  Answer ONLY based on the information found in the "Context" section.
2.  Do NOT add any information, explanations, or examples that are not present in the context.
3.  If the context provides a direct answer, quote it or rephrase it closely.
4.  Your response must be in English.

Context:
{context}

Question:
{question}

Strict Answer based ONLY on the context:
"""
answer_prompt = ChatPromptTemplate.from_template(answer_template)
answer_chain = (answer_prompt | llm | StrOutputParser())

relevance_template = """
Based on the provided Question and Context, is the information in the Context sufficient to answer the Question?
Respond with a single JSON object containing one key "is_relevant" with a value of either "yes" or "no".
<Context>{context}</Context>
<Question>{question}</Question>
"""
relevance_prompt = ChatPromptTemplate.from_template(relevance_template)
relevance_chain = (relevance_prompt | llm | JsonOutputParser())

def create_fallback_response(input_dict):
    return "I'm sorry, but I couldn't find any relevant information for this question in my knowledge base."
fallback_chain = RunnableLambda(create_fallback_response)

def retrieve_context(input_dict):
    question = input_dict["question"]
    retrieved_docs = retriever.invoke(question)
    context_str = "\n\n---\n\n".join([doc.page_content for doc in retrieved_docs])
    return {"context": context_str, "question": question}

branch = RunnableBranch(
    (lambda x: x["relevance_decision"]["is_relevant"].lower() == "yes", answer_chain),
    fallback_chain
)

full_rag_chain = (
    {"question": RunnablePassthrough()}
    | RunnableLambda(retrieve_context)
    | RunnablePassthrough.assign(relevance_decision=relevance_chain)
    | branch
)

# --- API Endpoints ---
class ChatRequest(BaseModel):
    query: str

@app.get("/")
def read_root():
    return {"message": "Welcome to Panya API!"}

@app.post("/chat/text")
def chat_with_rag(request: ChatRequest):
    response_text = full_rag_chain.invoke(request.query)
    return {"answer": response_text}

# [ปรับปรุง] Endpoint สำหรับรูปภาพ ให้รับข้อความ (query) มาด้วยได้
@app.post("/chat/image")
async def chat_with_image(file: UploadFile = File(...), query: str = Form("")):
    temp_file_path = f"temp_{file.filename}"
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        extracted_text = pytesseract.image_to_string(Image.open(temp_file_path), lang='eng')

        if not extracted_text.strip():
            return {"answer": "I'm sorry, I couldn't extract any text from the provided image."}

        # สร้าง "คำถามสุดท้าย" ที่จะส่งให้ RAG chain
        # ถ้าผู้ใช้พิมพ์คำถามมาด้วย ให้ใช้คำถามนั้นเป็นหลัก
        if query and query.strip():
            final_question = f"Regarding the following text extracted from an image: '{extracted_text.strip()}', the user asks: '{query.strip()}'"
        else: # ถ้าผู้ใช้ไม่ได้พิมพ์อะไรมา ให้ใช้ข้อความจากรูปเป็นคำถามเลย
            final_question = extracted_text.strip()

        response_text = full_rag_chain.invoke(final_question)
        
        # สร้างคำตอบที่เป็นมิตรมากขึ้น
        fallback_msg = "I'm sorry, but I couldn't find any relevant information"
        if fallback_msg not in response_text:
            final_answer = f"Based on the text from the image and your question, here is what I found:\n\n{response_text}"
            return {"answer": final_answer}
        else:
            final_answer = f"I read the following text from the image: **{extracted_text.strip()}**\n\nHowever, I couldn't find any relevant information about it in my knowledge base."
            return {"answer": final_answer}

    except Exception as e:
        print(f"Error processing image: {e}")
        return {"answer": f"I'm sorry, an error occurred while processing the image: {e}"}
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)