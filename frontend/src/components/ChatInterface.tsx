import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Bot, User, Sparkles, Lightbulb, AlertTriangle, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient, { notifyHubChanged } from '../api/client';
import MarkdownRenderer from './MarkdownRenderer';
import { ActionCards, DataCards, FollowUpButtons, WorkbenchAction, WorkbenchDataCard, FollowUp } from './ChatWorkbenchCards';
import { COPY, stripSystemJargon } from '../copy';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  timestamp: Date;
  isTyping?: boolean;
  isStreaming?: boolean;
  actions?: WorkbenchAction[];
  dataCards?: WorkbenchDataCard[];
  followUps?: FollowUp[];
  analysisSteps?: string[];
}

const QUICK_QUESTIONS = [
  { icon: TrendingUp, label: COPY.ask.whyGap, question: '为什么这块达成差' },
  { icon: Target, label: COPY.ask.tryWhatIf, question: '如果覆盖提升会怎样' },
  { icon: Lightbulb, label: COPY.ask.giveAdvice, question: '给出可执行建议' },
  { icon: AlertTriangle, label: COPY.ask.submit, question: '接受建议' },
];

function stepFromChunk(chunk: any): string | null {
  const text = String(chunk.content || chunk.skill || '');
  if (chunk.type === 'routing' || chunk.type === 'intent') return COPY.ask.stepRel;
  if (chunk.type === 'skill' || chunk.type === 'reasoning') {
    if (/what-if|simulator/i.test(text)) return COPY.ask.stepSim;
    if (/recommend|accept/i.test(text)) return COPY.ask.stepAdvice;
    return COPY.ask.stepVisit;
  }
  if (chunk.type === 'thinking') return COPY.ask.stepRel;
  return null;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [failedMessages, setFailedMessages] = useState<Set<string>>(new Set());
  const [pinnedObjectId, setPinnedObjectId] = useState<string | null>(null);
  const [lastDecisionId, setLastDecisionId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem('ontonexus_chat_messages');
    const savedThreadId = localStorage.getItem('ontonexus_thread_id');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed[0]?.id === 'welcome') parsed[0].content = COPY.ask.welcome;
        setMessages(parsed);
        if (parsed.length <= 1) {
          setShowQuickQuestions(true);
        }
      } catch {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
        content: COPY.ask.welcome,
          timestamp: new Date(),
        }]);
      }
    } else {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: COPY.ask.welcome,
        timestamp: new Date(),
      }]);
    }
    if (savedThreadId) {
      setThreadId(savedThreadId);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ontonexus_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (threadId) {
      localStorage.setItem('ontonexus_thread_id', threadId);
    }
  }, [threadId]);

  const applyChunk = useCallback((messageId: string, chunk: any) => {
    if (chunk.type === 'thinking' || chunk.type === 'intent' || chunk.type === 'skill' || chunk.type === 'reasoning' || chunk.type === 'routing') {
      const step = stepFromChunk(chunk);
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const steps = m.analysisSteps || [];
        const nextSteps = step && !steps.includes(step) ? [...steps, step] : steps;
        return { ...m, thinking: COPY.ask.analyzing, analysisSteps: nextSteps };
      }));
    } else if (chunk.type === 'answer') {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: m.content + (chunk.content || '') } : m
      ));
    } else if (chunk.type === 'content') {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: chunk.content || chunk.answer || m.content } : m
      ));
    } else if (chunk.type === 'actions') {
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const steps = m.analysisSteps || [];
        const nextSteps = steps.includes(COPY.ask.stepSubmit) ? steps : [...steps, COPY.ask.stepSubmit];
        return { ...m, actions: chunk.actions || m.actions, analysisSteps: nextSteps };
      }));
    } else if (chunk.type === 'data_card' && chunk.data_card) {
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, dataCards: [...(m.dataCards || []), chunk.data_card] }
          : m
      ));
    } else if (chunk.type === 'follow_ups') {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, followUps: chunk.follow_ups || m.followUps } : m
      ));
    } else if (chunk.type === 'done') {
      setThreadId(chunk.thread_id);
      if (chunk.decision_id) setLastDecisionId(chunk.decision_id);
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              content: m.content || chunk.answer || chunk.content || '',
              isStreaming: false,
              actions: chunk.actions || m.actions,
              dataCards: chunk.data_cards || m.dataCards,
              followUps: chunk.follow_ups || m.followUps,
            }
          : m
      ));
    } else if (chunk.type === 'error') {
      console.error('Stream error:', chunk.content);
      setFailedMessages(fPrev => new Set(fPrev).add(messageId));
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, content: chunk.content || '抱歉，服务暂时不可用。请稍后再试。', isStreaming: false }
          : m
      ));
    }
  }, []);

  const handleApproveCard = useCallback(async (actionId: string) => {
    const userId = localStorage.getItem('user_id') || 'admin';
    try {
      const result = await apiClient.approveAction(actionId, userId);
      const nextStatus = result.status === 'executed' ? 'executed' : result.status === 'blocked' ? 'failed' : 'pending';
      setMessages(prev => prev.map(m => ({
        ...m,
        actions: (m.actions || []).map(a =>
          a.action_id === actionId ? { ...a, status: nextStatus as WorkbenchAction['status'], description: result.message } : a
        ),
      })));
      notifyHubChanged();
    } catch {
      setMessages(prev => prev.map(m => ({
        ...m,
        actions: (m.actions || []).map(a =>
          a.action_id === actionId ? { ...a, status: 'failed' } : a
        ),
      })));
    }
  }, []);

  const sendText = async (question: string) => {
    if (!question.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);
    setShowQuickQuestions(false);

    const streamingMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      thinking: '',
      analysisSteps: [],
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, streamingMessage]);

    const userId = localStorage.getItem('user_id') || 'admin';
    const context = {
      object_id: pinnedObjectId || undefined,
      parent_decision_id: lastDecisionId,
    };

    try {
      await apiClient.chatStream(
        question,
        userId,
        (chunk) => applyChunk(streamingMessage.id, chunk),
        (error) => {
          console.error('Stream error:', error);
          setMessages(prev => prev.map(m =>
            m.id === streamingMessage.id
              ? {
                  ...m,
                  content: m.content || '抱歉，服务暂时不可用。请稍后再试。',
                  isStreaming: false,
                }
              : m
          ));
        },
        threadId,
        context
      );
    } catch (error) {
      setFailedMessages(prev => new Set(prev).add(streamingMessage.id));
      setMessages(prev => prev.map(m =>
        m.id === streamingMessage.id
          ? {
              ...m,
              content: '抱歉，服务暂时不可用。请稍后再试。',
              isStreaming: false,
            }
          : m
      ));
    } finally {
      setIsSending(false);
      setMessages(prev => {
        const msg = prev.find(m => m.id === streamingMessage.id);
        if (msg && !msg.content && !msg.isStreaming) {
          setFailedMessages(fPrev => new Set(fPrev).add(streamingMessage.id));
        }
        return prev;
      });
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    await sendText(inputValue.trim());
  };

  const handleAcceptSuggestion = async (action: WorkbenchAction) => {
    await sendText(`接受建议 ${action.action_type || action.title} ${action.object_id || ''}`);
    notifyHubChanged();
  };

  const handleQuickQuestion = (question: string) => {
    sendText(question);
  };

  const handleRetry = async (messageId: string) => {
    setFailedMessages(prev => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex < 0) return;
    let userMsg = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i].content;
        break;
      }
    }
    if (!userMsg) return;
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const retryStreamingMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      thinking: '',
      analysisSteps: [],
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, retryStreamingMessage]);
    const userId = localStorage.getItem('user_id') || 'admin';
    setIsSending(true);
    try {
      await apiClient.chatStream(
        userMsg,
        userId,
        (chunk) => applyChunk(retryStreamingMessage.id, chunk),
        (error) => {
          console.error('Stream error:', error);
          setFailedMessages(fPrev => new Set(fPrev).add(retryStreamingMessage.id));
          setMessages(prev => prev.map(m =>
            m.id === retryStreamingMessage.id
              ? {
                  ...m,
                  content: m.content || '抱歉，服务暂时不可用。请稍后再试。',
                  isStreaming: false,
                }
              : m
          ));
        },
        threadId,
        { object_id: pinnedObjectId || undefined, parent_decision_id: lastDecisionId }
      );
    } catch (error) {
      setFailedMessages(fPrev => new Set(fPrev).add(retryStreamingMessage.id));
      setMessages(prev => prev.map(m =>
        m.id === retryStreamingMessage.id
          ? {
              ...m,
              content: '抱歉，服务暂时不可用。请稍后再试。',
              isStreaming: false,
            }
          : m
      ));
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-white backdrop-blur-xl border-b border-gray-100 p-5 sticky top-0 z-10 shadow-lg shadow-black/5">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-brand-500/15 rounded-xl ring-1 ring-brand-500/20">
            <MessageSquare className="text-brand-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              {COPY.ask.title}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-500/20">
                在线
              </span>
            </h2>
            <p className="text-xs text-gray-800 mt-0.5">{COPY.ask.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' 
                    ? 'bg-brand-500 text-white' 
                    : 'bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-brand-400'
                }`}>
                  {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div className={`rounded-2xl p-3 ${
                  message.role === 'user'
                    ? 'bg-brand-500 text-white rounded-br-md'
                    : 'bg-white border border-gray-100 text-gray-700 rounded-bl-md shadow-sm'
                }`}>
                  {message.isTyping ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-gray-800 ml-2">{COPY.ask.analyzing}</span>
                    </div>
                  ) : (
                    <>
                      {message.isStreaming && (message.analysisSteps?.length || message.thinking) ? (
                        <div className="mb-2 space-y-1">
                          {(message.analysisSteps && message.analysisSteps.length > 0
                            ? message.analysisSteps
                            : [COPY.ask.analyzing]
                          ).map((step) => (
                            <div key={step} className="text-xs text-gray-500">{step}</div>
                          ))}
                        </div>
                      ) : null}
                      {message.content ? (
                        <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                          <MarkdownRenderer content={stripSystemJargon(message.content)} />
                        </div>
                      ) : message.isStreaming ? (
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-xs text-gray-800 ml-2">{COPY.ask.analyzing}</span>
                        </div>
                      ) : null}
                      {message.role === 'assistant' && (
                        <>
                          <DataCards
                            cards={message.dataCards || []}
                            onRowClick={(row) => {
                              const oid = String(row.id || '');
                              if (oid) setPinnedObjectId(oid);
                            }}
                          />
                          <ActionCards
                            actions={message.actions || []}
                            onApprove={handleApproveCard}
                            onAccept={handleAcceptSuggestion}
                            disabled={isSending}
                            currentUserId={localStorage.getItem('user_id') || undefined}
                          />
                          <FollowUpButtons
                            items={message.followUps || []}
                            onPick={(q) => sendText(q)}
                            disabled={isSending}
                          />
                        </>
                      )}
                      <p className={`text-[10px] mt-1 ${message.role === 'user' ? 'text-white/70' : 'text-gray-700'}`}>
                        {formatTime(message.timestamp)}
                      </p>
                      {!message.isStreaming && failedMessages.has(message.id) && (
                        <button
                          onClick={() => handleRetry(message.id)}
                          className="flex items-center space-x-1 mt-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                        >
                          <RefreshCw size={12} />
                          <span>重试</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {pinnedObjectId && (
        <div className="px-4 py-2 bg-brand-50 border-t border-brand-100 text-xs text-brand-800 flex items-center justify-between">
          <span>{COPY.ask.pinned}</span>
          <button type="button" className="underline" onClick={() => setPinnedObjectId(null)}>取消</button>
        </div>
      )}

      {showQuickQuestions && messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles size={14} className="text-brand-400" />
            <span className="text-xs font-medium text-gray-800">快捷问题</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickQuestion(q.question)}
                className="flex items-center space-x-2 px-3 py-2 bg-white rounded-lg border border-gray-100 hover:border-brand-500/30 hover:bg-brand-500/5 transition-colors text-xs text-gray-600"
              >
                <q.icon size={14} className="text-brand-400" />
                <span>{q.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="输入您的问题，如：张主任最近怎么样？"
            className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 text-sm"
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className={`p-3 rounded-xl transition-colors ${
              inputValue.trim() && !isSending
                ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/30'
                : 'bg-gray-100 text-gray-700 cursor-not-allowed'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
