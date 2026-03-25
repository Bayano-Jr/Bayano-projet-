import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Loader2, FileText, Trash2, Copy, Share2, ThumbsUp, Check, Menu, Plus, Paperclip, Mic, Square, X, Image as ImageIcon, MessageSquare, Upload } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { exportChatToDOCX } from '../services/exportService';
import { storageService } from '../services/storageService';
import { getAiClient } from '../services/geminiService';
import i18n from '../i18n';
import { useAlert } from '../contexts/AlertContext';

import { User as UserType } from '../types';

interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64 without prefix
}

import { getAuthToken } from '../utils/auth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  groundingChunks?: any[];
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
}

interface ChatAssistantProps {
  user: UserType | null;
  onUpdateUser: (user: UserType) => void;
  onShowPricing: () => void;
}

export default function ChatAssistant({ user, onUpdateUser, onShowPricing }: ChatAssistantProps) {
  const { showAlert, showConfirm } = useAlert();
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  
  // Attachments & Audio
  const [attachments, setAttachments] = useState<{file: File, base64: string, mimeType: string}[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const messages = currentSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const dbSessions = await storageService.getChatSessions();
        if (dbSessions.length > 0) {
          setSessions(dbSessions);
          setCurrentSessionId(dbSessions[0].id);
        } else {
          // Create default session
          const newSession: ChatSession = {
            id: Date.now().toString(),
            title: t('chat.newChat'),
            messages: [{
              id: Date.now().toString(),
              role: 'assistant',
              content: t('chat.welcome', { defaultValue: "Bonjour ! Je suis Bayano, votre assistant IA. Comment puis-je vous aider aujourd'hui ?" }),
              timestamp: new Date()
            }],
            updatedAt: new Date()
          };
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
          await storageService.saveChatSession(newSession);
        }
      } catch (err) {
        console.error("Error loading chat sessions:", err);
      } finally {
        setIsInitializing(false);
      }
    };
    loadSessions();
  }, [t]);

  const saveSessionToDb = async (session: ChatSession) => {
    try {
      await storageService.saveChatSession(session);
    } catch (err) {
      console.error("Error saving session to DB:", err);
    }
  };

  const createNewSession = async () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: t('chat.newChat'),
      messages: [{
        id: Date.now().toString(),
        role: 'assistant',
        content: t('chat.welcome'),
        timestamp: new Date()
      }],
      updatedAt: new Date()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
    await saveSessionToDb(newSession);
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setAttachments(prev => [...prev, {
          file,
          base64: base64data.split(',')[1],
          mimeType: file.type
        }]);
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAttachments(prev => [...prev, {
            file: new File([audioBlob], "audio_message.webm", { type: 'audio/webm' }),
            base64: base64data.split(',')[1],
            mimeType: 'audio/webm'
          }]);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      showAlert({ message: t('chat.micError'), type: 'error' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    if (!user) return;

    if (user.credits < 1) {
      onShowPricing();
      return;
    }

    // Deduct credits
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const sid = await getAuthToken();
      if (sid) {
        headers['Authorization'] = `Bearer ${sid}`;
      }
      const deductRes = await fetch('/api/saas/deduct', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: 1, description: t('chat.creditDeductDesc') }),
        credentials: 'include'
      });
      
      if (deductRes.ok) {
        const deductData = await deductRes.json();
        onUpdateUser({ ...user, credits: deductData.remainingCredits });
      } else {
        console.error(t('chat.creditDeductError'));
        return;
      }
    } catch (e) {
      console.error(e);
      return;
    }

    let sessionId = currentSessionId;
    let newTitle = '';
    let currentSessions = [...sessions];
    
    if (!sessionId) {
      newTitle = input.trim().substring(0, 30) || t('chat.newChat');
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: newTitle,
        messages: [],
        updatedAt: new Date()
      };
      currentSessions = [newSession, ...currentSessions];
      sessionId = newSession.id;
      setCurrentSessionId(sessionId);
    } else if (messages.length <= 1 && input.trim()) {
      newTitle = input.trim().substring(0, 30);
    }

    const newAttachments = attachments.map(a => ({
      name: a.file.name,
      mimeType: a.mimeType,
      data: a.base64
    }));

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      attachments: newAttachments,
      timestamp: new Date()
    };

    const updatedSessions = currentSessions.map(s => s.id === sessionId ? {
      ...s,
      title: newTitle || s.title,
      messages: [...s.messages, userMessage],
      updatedAt: new Date()
    } : s);
    
    setSessions(updatedSessions);
    const activeSession = updatedSessions.find(s => s.id === sessionId);
    if (activeSession) saveSessionToDb(activeSession);
    
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const ai = await getAiClient();
      
      // Build history for context (text only to save tokens, or we could send full history)
      const historyText = messages.map(m => `${m.role === 'user' ? t('chat.user') : t('chat.assistant')}: ${m.content}`).join('\n\n');
      const promptText = `${historyText}\n\n${t('chat.user')}: ${userMessage.content}\n\n${t('chat.assistant')}:`;

      const parts: any[] = [];
      if (promptText.trim()) parts.push({ text: promptText });
      
      newAttachments.forEach(a => {
        parts.push({
          inlineData: {
            data: a.data,
            mimeType: a.mimeType
          }
        });
      });

      const response = await ai.models.generateContent({
        model: model,
        contents: { parts },
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: t('chat.systemInstruction'),
        }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || t('chat.noResponse'),
        groundingChunks: chunks,
        timestamp: new Date()
      };

      const updatedSessionsWithResponse = updatedSessions.map(s => s.id === sessionId ? {
        ...s,
        messages: [...s.messages, assistantMessage],
        updatedAt: new Date()
      } : s);
      setSessions(updatedSessionsWithResponse);
      const activeSessionWithResponse = updatedSessionsWithResponse.find(s => s.id === sessionId);
      if (activeSessionWithResponse) saveSessionToDb(activeSessionWithResponse);
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('chat.error', { message: error.message || t('chat.defaultError') }),
        timestamp: new Date()
      };
      const updatedSessionsWithError = updatedSessions.map(s => s.id === sessionId ? {
        ...s,
        messages: [...s.messages, errorMessage],
        updatedAt: new Date()
      } : s);
      setSessions(updatedSessionsWithError);
      const activeSessionWithError = updatedSessionsWithError.find(s => s.id === sessionId);
      if (activeSessionWithError) saveSessionToDb(activeSessionWithError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    showConfirm({
      title: t('chat.clearChat'),
      message: t('chat.clearChatConfirm'),
      confirmText: t('chat.clear'),
      type: 'error',
      onConfirm: async () => {
        if (currentSessionId) {
          try {
            await storageService.deleteChatSession(currentSessionId);
          } catch (err) {
            console.error("Error deleting session:", err);
          }
        }
        setSessions(prev => prev.filter(s => s.id !== currentSessionId));
        setCurrentSessionId(null);
      }
    });
  };

  const exportToWord = async () => {
    if (messages.length === 0) return;
    try {
      await exportChatToDOCX(messages);
    } catch (error) {
      console.error("Export error:", error);
      showAlert({ message: t('chat.exportError'), type: 'error' });
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = (content: string) => {
    if (navigator.share) {
      navigator.share({
        title: t('chat.aiResponseTitle'),
        text: content,
      }).catch((error) => {
        if (error.name !== 'AbortError' && !error.message?.includes('Share canceled')) {
          console.error('Error sharing:', error);
        }
      });
    } else {
      navigator.clipboard.writeText(content);
      showAlert({ message: t('chat.textCopied'), type: 'success' });
    }
  };

  const handleLike = (id: string) => {
    setLikedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  return (
    <div className="flex-1 flex w-full bg-white overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-50 border-r border-slate-100 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-academic-900">{t('chat.discussions')}</h3>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-academic-900 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-academic-900 text-white rounded-xl font-bold text-sm hover:bg-academic-800 transition-colors shadow-sm"
          >
            <Plus size={16} />
            {t('chat.newChat')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => {
                setCurrentSessionId(session.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-colors flex items-center gap-3 ${currentSessionId === session.id ? 'bg-white shadow-sm border border-slate-100 text-academic-900 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <MessageSquare size={16} className={currentSessionId === session.id ? 'text-accent' : 'text-slate-400'} />
              <div className="flex-1 truncate">
                {session.title}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className={`flex-1 flex flex-col h-full min-w-0 relative transition-colors ${isDragging ? 'bg-accent/5 ring-2 ring-inset ring-accent' : 'bg-white'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center text-accent">
              <Upload size={48} className="mb-4 animate-bounce" />
              <h3 className="text-2xl font-bold font-serif">{t('chat.dropFilesHere')}</h3>
              <p className="text-slate-500 mt-2">{t('chat.supportedFiles')}</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="px-4 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-academic-900 text-white flex items-center justify-center shadow-md shrink-0">
              <Bot size={18} className="md:w-5 md:h-5" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-base md:text-lg font-serif font-bold text-academic-900 truncate max-w-[200px] md:max-w-xs">{currentSession?.title || t('chat.newChat')}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <select 
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-[10px] sm:text-xs md:text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 sm:px-2 sm:py-1.5 md:px-3 md:py-2 focus:outline-none focus:ring-2 focus:ring-accent/20 max-w-[90px] sm:max-w-[120px] md:max-w-none truncate"
            >
              <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
              <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
            </select>
            
            <button 
              onClick={exportToWord}
              disabled={messages.length === 0}
              className="p-1 sm:p-1.5 md:p-2 text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50 transition-colors"
              title={t('chat.exportWordTooltip')}
            >
              <FileText size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
            </button>
            
            <button 
              onClick={clearChat}
              disabled={!currentSessionId}
              className="p-1 sm:p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
              title={t('chat.clearChatTooltip')}
            >
              <Trash2 size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 bg-slate-50/30">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-4">
              <Bot size={48} className="md:w-16 md:h-16 mb-4 md:mb-6 text-slate-300" />
              <h3 className="text-xl md:text-2xl font-serif font-bold text-academic-900 mb-2">{t('chat.helloBayano')}</h3>
              <p className="text-sm md:text-base text-slate-500 max-w-md">
                {t('chat.bayanoIntro')}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-accent text-white' : 'bg-academic-900 text-white'
                }`}>
                  {msg.role === 'user' ? <User size={16} className="md:w-5 md:h-5" /> : <Bot size={16} className="md:w-5 md:h-5" />}
                </div>
                <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-2xl p-3 md:p-5 w-full ${
                    msg.role === 'user' 
                      ? 'bg-accent text-white rounded-tr-none' 
                      : 'bg-white border border-slate-100 shadow-sm rounded-tl-none'
                  }`}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.attachments.map((att, idx) => (
                          <div key={idx} className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs ${msg.role === 'user' ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
                            {att.mimeType.startsWith('image/') ? <ImageIcon size={12} /> : att.mimeType.startsWith('audio/') ? <Mic size={12} /> : <FileText size={12} />}
                            <span className="truncate max-w-[150px]">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm md:prose-base max-w-none prose-slate">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('chat.sources')}</p>
                            <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                              {msg.groundingChunks.map((chunk, idx) => {
                                if (chunk.web?.uri && chunk.web?.title) {
                                  return (
                                    <li key={idx} className="text-sm">
                                      <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                                        <span className="truncate max-w-[250px] md:max-w-[400px]">{chunk.web.title}</span>
                                      </a>
                                    </li>
                                  );
                                }
                                return null;
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons for Assistant */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 mt-1 ml-1">
                      <button 
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1.5 text-slate-400 hover:text-academic-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title={t('chat.copyTooltip')}
                      >
                        {copiedId === msg.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                      <button 
                        onClick={() => handleShare(msg.content)}
                        className="p-1.5 text-slate-400 hover:text-academic-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title={t('chat.shareTooltip')}
                      >
                        <Share2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleLike(msg.id)}
                        className={`p-1.5 rounded-lg transition-colors ${likedIds.has(msg.id) ? 'text-accent bg-accent/10' : 'text-slate-400 hover:text-academic-900 hover:bg-slate-100'}`}
                        title={t('chat.likeTooltip')}
                      >
                        <ThumbsUp size={14} className={likedIds.has(msg.id) ? 'fill-current' : ''} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 md:gap-4">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-academic-900 text-white flex items-center justify-center shrink-0">
                <Bot size={16} className="md:w-5 md:h-5" />
              </div>
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-none p-4 md:p-5 flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-accent" />
                <span className="text-xs md:text-sm text-slate-500 font-medium">{t('chat.aiThinking')}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 border-t border-slate-100 bg-white">
          <div className="max-w-4xl mx-auto">
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg py-1.5 pl-2 pr-8 text-xs shrink-0">
                    {att.mimeType.startsWith('image/') ? <ImageIcon size={14} className="text-slate-500" /> : att.mimeType.startsWith('audio/') ? <Mic size={14} className="text-slate-500" /> : <FileText size={14} className="text-slate-500" />}
                    <span className="truncate max-w-[120px] font-medium text-slate-700">{att.file.name}</span>
                    <button 
                      onClick={() => removeAttachment(idx)} 
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      <X size={12}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 md:p-2 focus-within:ring-2 focus-within:ring-accent/20 focus-within:bg-white transition-all shadow-inner">
              
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-2 md:p-2.5 text-slate-400 hover:text-academic-900 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
                title={t('chat.attachFile')}
              >
                <Paperclip size={20} className="md:w-5 md:h-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                multiple 
                className="hidden" 
                accept="image/*,.pdf,.doc,.docx,audio/*" 
              />

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.writeMessage')}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2.5 px-2 text-sm md:text-base min-h-[44px] max-h-[120px] md:max-h-[200px] text-slate-800 placeholder:text-slate-400"
                rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
              />

              {isRecording ? (
                <button 
                  onClick={stopRecording} 
                  className="p-2 md:p-2.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl shrink-0 animate-pulse transition-colors"
                  title={t('chat.stopRecording')}
                >
                  <Square size={20} className="fill-current md:w-5 md:h-5" />
                </button>
              ) : (
                <button 
                  onClick={startRecording} 
                  className="p-2 md:p-2.5 text-slate-400 hover:text-academic-900 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
                  title={t('chat.voiceMessage')}
                >
                  <Mic size={20} className="md:w-5 md:h-5" />
                </button>
              )}

              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent transition-colors shrink-0 shadow-sm ml-1"
              >
                <Send size={18} className={`md:w-5 md:h-5 ${(input.trim() || attachments.length > 0) && !isLoading ? 'translate-x-0.5 -translate-y-0.5 transition-transform' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
