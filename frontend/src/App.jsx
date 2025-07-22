import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, Mic, Bot, User, Plus, Copy, Check, PanelLeft, XCircle, LoaderCircle } from 'lucide-react';
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
                        {isCopied ? 'Copied!' : 'Copy code'}
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
                    const boldedText = part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    return <p key={index} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: boldedText.replace(/\n/g, '<br />') }}></p>;
                }
                return null;
            })}
        </div>
    );
};

const Message = ({ text, sender, image }) => {
    const isUser = sender === 'user';
    return (
        <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500 text-white order-2' : 'bg-gray-700 text-white'}`}>
                {isUser ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className={`max-w-2xl px-5 py-3 rounded-xl shadow-sm break-words ${isUser ? 'bg-blue-500 text-white order-1' : 'bg-white text-gray-800 border'}`}>
                {image && <img src={image} alt="Uploaded content" className="max-w-xs rounded-lg mb-2 border" />}
                {text && <MessageContent text={text} />}
            </div>
        </div>
    );
};

const VoiceRecorderModal = ({ isOpen, onClose, onTranscriptionComplete }) => {
    const [status, setStatus] = useState('idle');
    const [timer, setTimer] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setTimer(0);
            audioChunksRef.current = [];
        } else {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (status === 'recording') {
            timerIntervalRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);
        } else {
            clearInterval(timerIntervalRef.current);
            if (status !== 'idle') setTimer(0);
        }
        return () => clearInterval(timerIntervalRef.current);
    }, [status]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                onTranscriptionComplete(audioBlob);
                stream.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                setStatus('transcribing');
            };
            mediaRecorderRef.current.start();
            setStatus('recording');
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check your browser permissions.");
            onClose();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    };
    
    const handleCancel = () => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        onClose(); 
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${secs}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Voice Input</h2>
                <p className="text-gray-500 mb-6">
                    {status === 'idle' && 'Click the button to start recording.'}
                    {status === 'recording' && 'Recording... Click to stop.'}
                    {status === 'transcribing' && 'Processing your audio...'}
                </p>
                <div className="text-5xl font-mono mb-6">{formatTime(timer)}</div>
                <button
                    onClick={() => status === 'recording' ? stopRecording() : startRecording()}
                    disabled={status === 'transcribing'}
                    className={`w-20 h-20 rounded-full transition-all duration-300 flex items-center justify-center mx-auto shadow-lg ${status === 'recording' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:bg-gray-400 disabled:cursor-wait`}
                >
                    {status === 'transcribing' ? <LoaderCircle size={32} className="text-white animate-spin" /> : <Mic size={32} className="text-white" />}
                </button>
                <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-gray-800 mt-6" disabled={status === 'transcribing'}>Cancel</button>
            </div>
        </div>
    );
};

function App() {
    const [messages, setMessages] = useState([{ text: 'Hello! I am Panya, your AI assistant for PLCnext. How can I help you today?', sender: 'bot' }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!input.trim() && !selectedFile) || isLoading) return;
        setIsLoading(true);
        let userMessage;
        let apiUrl;
        let payload;
        let headers = {};
        let errorType = 'connecting to the server';
        if (selectedFile) {
            userMessage = { text: input, sender: 'user', image: previewUrl };
            apiUrl = 'http://localhost:8000/chat/image';
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('query', input);
            payload = formData;
            headers = { 'Content-Type': 'multipart/form-data' };
            errorType = 'processing the image';
        } else {
            userMessage = { text: input, sender: 'user' };
            apiUrl = 'http://localhost:8000/chat/text';
            payload = { query: input };
        }
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSelectedFile(null);
        setPreviewUrl(null);
        try {
            const response = await axios.post(apiUrl, payload, { headers });
            const botMessage = { text: response.data.answer, sender: 'bot' };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error("API Error: ", error);
            const backendError = error.response?.data?.answer || `Sorry, there was an error ${errorType}.`;
            const errorMessage = { text: backendError, sender: 'bot' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        event.target.value = null;
    };

    const cancelFileSelection = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    const handleTranscriptionComplete = async (audioBlob) => {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        try {
            const API_URL = 'http://localhost:8000/transcribe';
            const response = await axios.post(API_URL, formData);
            setInput(prevInput => (prevInput ? prevInput + ' ' : '') + response.data.text);
        } catch (error) {
            console.error("Audio Transcription Error: ", error);
            alert('Sorry, there was an error transcribing the audio.');
        } finally {
            setIsVoiceModalOpen(false);
        }
    };

    return (
        <>
            <VoiceRecorderModal 
                isOpen={isVoiceModalOpen} 
                onClose={() => setIsVoiceModalOpen(false)}
                onTranscriptionComplete={handleTranscriptionComplete}
            />
            <div className="flex h-screen bg-white text-gray-800 font-sans">
                <aside className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72 p-4' : 'w-0 p-0'}`}>
                    <div className={`flex-shrink-0 mb-6 flex items-center gap-3 overflow-hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
                        <img src="/panya-logo.png" alt="Panya Logo" className="w-10 h-10 rounded-full object-cover" />
                        <div><h1 className="text-xl font-bold text-gray-900">Panya</h1></div>
                    </div>
                    <div className={`overflow-hidden transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
                        <button className="flex items-center justify-center gap-2 w-full p-2.5 mb-4 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors text-sm font-semibold"><Plus size={16} />New Chat</button>
                        <div className="flex-1 overflow-y-auto"></div>
                        <div className="absolute bottom-4 left-4 text-xs text-gray-400">&copy; 2025 Panya</div>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col bg-gray-100">
                    <header className="flex items-center p-2 bg-white border-b border-gray-200">
                        <button onClick={() => setIsSidebarOpen(prev => !prev)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"><PanelLeft size={20} /></button>
                        <h2 className="ml-2 font-semibold text-gray-700">Smart Assistant for PLCnext</h2>
                    </header>

                    <main className="flex-1 p-6 overflow-y-auto">
                        <div className="max-w-4xl mx-auto">
                            {messages.map((msg, index) => ( <Message key={index} text={msg.text} sender={msg.sender} image={msg.image} /> ))}
                            {isLoading && ( <div className="flex items-start gap-3 justify-start mb-6"> <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-gray-700 text-white"><Bot size={20} /></div> <div className="max-w-lg px-5 py-4 rounded-xl shadow-sm bg-white border"> <div className="flex items-center space-x-2"> <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div> <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div> <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div> </div> </div> </div> )}
                            <div ref={chatEndRef} />
                        </div>
                    </main>
                    
                    <footer className="p-4 bg-gray-100/80 backdrop-blur-sm">
                        <div className="max-w-4xl mx-auto">
                            <div className={`bg-white border border-gray-300 shadow-sm focus-within:ring-2 focus-within:ring-blue-400 ${previewUrl ? 'rounded-2xl' : 'rounded-full'}`}>
                                <form onSubmit={handleSendMessage} className="p-2">
                                    {previewUrl && (
                                        <div className="relative w-28 h-28 m-2 p-1 border rounded-lg bg-gray-100">
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-md" />
                                            <button onClick={cancelFileSelection} className="absolute -top-2 -right-2 bg-gray-600 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors">
                                                <XCircle size={20} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-2">
                                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Attach file" disabled={isLoading}><Paperclip size={20} /></button>
                                        <button type="button" onClick={() => setIsVoiceModalOpen(true)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Use microphone" disabled={isLoading}><Mic size={20} /></button>
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                                            placeholder="Ask a question..."
                                            className="flex-1 bg-transparent focus:outline-none px-2 text-gray-800 placeholder-gray-500"
                                            disabled={isLoading}
                                        />
                                        <button type="submit" className="bg-blue-500 text-white p-2.5 rounded-full font-semibold hover:bg-blue-600 shadow-sm disabled:bg-blue-300 disabled:cursor-not-allowed flex-shrink-0" disabled={isLoading || (!input.trim() && !selectedFile)} aria-label="Send message"><Send size={20} /></button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
}

export default App;