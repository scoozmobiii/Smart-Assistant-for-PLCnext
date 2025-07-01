import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Component สำหรับแสดงแต่ละข้อความ (ย้ายมาไว้ในไฟล์เดียวกันเพื่อความง่าย)
const Message = ({ text, sender }) => {
    const isUser = sender === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div 
                className={`max-w-xl px-4 py-3 rounded-2xl shadow-md ${isUser ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br />') }}
            >
            </div>
        </div>
    );
};

// Component หลักของ App
function App() {
    const [messages, setMessages] = useState([
        { text: 'สวัสดีครับ! ผมคือผู้ช่วย AI สำหรับ PLCnext มีอะไรให้ผมช่วยเหลือไหมครับ?', sender: 'bot' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const API_URL = 'http://localhost:8000/chat/text';
            const response = await axios.post(API_URL, { query: input });
            const botMessage = { text: response.data.answer, sender: 'bot' };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการเชื่อมต่อ: ", error);
            const errorMessage = { text: 'ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์', sender: 'bot' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 bg-gray-100 font-sans">
            <header className="text-center mb-4">
                <h1 className="text-3xl font-bold text-gray-800">PLCnext AI Assistant</h1>
                <p className="text-gray-500">ขับเคลื่อนโดย LLaMA 3 และ RAG</p>
            </header>

            <main className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-lg p-6 overflow-y-auto">
                {messages.map((msg, index) => (
                    <Message key={index} text={msg.text} sender={msg.sender} />
                ))}
                {isLoading && (
                    <div className="flex justify-start mb-4">
                        <div className="max-w-xl px-4 py-3 rounded-2xl shadow-md bg-white text-gray-800">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </main>

            <footer className="mt-4">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="พิมพ์คำถามของคุณที่นี่..."
                        className="flex-1 p-4 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-semibold hover:bg-blue-700 transition shadow-md disabled:bg-blue-300 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        ส่ง
                    </button>
                </form>
            </footer>
        </div>
    );
}

export default App;
