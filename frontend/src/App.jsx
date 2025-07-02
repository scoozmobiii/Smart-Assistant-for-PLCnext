import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, Mic, Bot, User, Plus, Copy, Check, PanelLeft, BrainCircuit } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const CodeBlock = ({ language, value }) => {
    const [isCopied, setIsCopied] = useState(false);
    const handleCopy = () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };
    return (
        <div className="relative my-2 text-sm font-mono">
            <div className="flex items-center justify-between bg-gray-200 text-gray-600 px-4 py-1.5 rounded-t-md">
                <span className="text-xs">{language || 'code'}</span>
                <CopyToClipboard text={value} onCopy={handleCopy}>
                    <button className="flex items-center gap-1.5 text-xs hover:text-gray-900 transition-colors">
                        {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        {isCopied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}
                    </button>
                </CopyToClipboard>
            </div>
            <SyntaxHighlighter language={language} style={prism} customStyle={{ margin: 0, borderRadius: '0 0 0.375rem 0.375rem', padding: '1rem' }}>
                {value}
            </SyntaxHighlighter>
        </div>
    );
};

const MessageContent = ({ text }) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)\n```/g;
    const parts = text.split(codeBlockRegex);
    return (
        <div>
            {parts.map((part, index) => {
                if (index % 3 === 2) {
                    const language = parts[index - 1] || 'plaintext';
                    return <CodeBlock key={index} language={language} value={part.trim()} />;
                } else if (index % 3 === 0) {
                    return <p key={index} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: part.replace(/\n/g, '<br />') }}></p>;
                }
                return null;
            })}
        </div>
    );
};

const Message = ({ text, sender }) => {
    const isUser = sender === 'user';
    return (
        <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500 text-white order-2' : 'bg-gray-700 text-white'}`}>
                {isUser ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className={`max-w-2xl px-5 py-3 rounded-xl shadow-sm break-words ${isUser ? 'bg-blue-500 text-white order-1' : 'bg-white text-gray-800 border'}`}>
                <MessageContent text={text} />
            </div>
        </div>
    );
};

function App() {
    const [messages, setMessages] = useState([
        { text: 'สวัสดีครับ ผมคือ Panya ผู้ช่วย AI สำหรับ PLCnext มีอะไรให้ช่วยเหลือไหมครับ', sender: 'bot' },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

    const handleFeatureNotImplemented = () => {
        alert('ฟีเจอร์นี้ยังไม่เปิดใช้งาน');
    };

    return (
        <div className="flex h-screen bg-white text-gray-800 font-sans">
            <aside className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72 p-4' : 'w-0 p-0'}`}>
                <div className={`flex-shrink-0 mb-6 flex items-center gap-3 overflow-hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-blue-500 text-white p-2 rounded-lg">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Panya</h1>
                    </div>
                </div>
                <div className={`overflow-hidden transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
                    <button className="flex items-center justify-center gap-2 w-full p-2.5 mb-4 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors text-sm font-semibold">
                        <Plus size={16} />
                        New Chat
                    </button>
                    <div className="flex-1 overflow-y-auto">
                        {/* History placeholder */}
                    </div>
                    <div className="absolute bottom-4 left-4 text-xs text-gray-400">
                        &copy; 2025 Panya
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col bg-gray-100">
                <header className="flex items-center p-2 bg-white border-b border-gray-200">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                        <PanelLeft size={20} />
                    </button>
                    <h2 className="ml-2 font-semibold text-gray-700">Smart Assistant for PLCnext</h2>
                </header>

                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-4xl mx-auto">
                        {messages.map((msg, index) => (
                            <Message key={index} text={msg.text} sender={msg.sender} />
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-3 justify-start mb-6">
                                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-gray-700 text-white"><Bot size={20} /></div>
                                <div className="max-w-lg px-5 py-4 rounded-xl shadow-sm bg-white border">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </main>
                
                <footer className="p-4 bg-gray-100/80 backdrop-blur-sm">
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 bg-white border border-gray-300 rounded-full p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-400 transition-all">
                            <button type="button" onClick={handleFeatureNotImplemented} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors" aria-label="Attach file"><Paperclip size={20} /></button>
                            <button type="button" onClick={handleFeatureNotImplemented} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors" aria-label="Use microphone"><Mic size={20} /></button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="ถามคำถามเกี่ยวกับ PLCnext..."
                                className="flex-1 bg-transparent focus:outline-none px-2 text-gray-800 placeholder-gray-500"
                                disabled={isLoading}
                            />
                            <button type="submit" className="bg-blue-500 text-white p-2.5 rounded-full font-semibold hover:bg-blue-600 transition-colors shadow-sm disabled:bg-blue-300 disabled:cursor-not-allowed flex-shrink-0" disabled={isLoading || !input.trim()} aria-label="Send message"><Send size={20} /></button>
                        </form>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default App;
