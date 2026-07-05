import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, MessageCircle, Info } from 'lucide-react';
import { AtlasMessage, AtlasMode } from './atlasTypes';
import { AtlasMessageBubble } from './AtlasMessageBubble';
import { AtlasSuggestionChips } from './AtlasSuggestionChips';
import { findAtlasAnswer, FALLBACK_ANSWER } from './atlasMatcher';
import { AtlasFeedbackForm } from './AtlasFeedbackForm';

interface AtlasChatPanelProps {
  onClose: () => void;
}

const INITIAL_MESSAGE: AtlasMessage = {
  id: 'welcome',
  role: 'atlas',
  text: "Hi, I’m Atlas Preview. I can answer common questions about HourWise EU, the driver app, the fleet portal, tachograph analysis and early access. What would you like to know?",
  createdAt: new Date(),
};

const INITIAL_CHIPS = [
  'What is HourWise?',
  'Driver app',
  'Fleet portal',
  'Tachograph analysis',
  'Pricing',
  'Early access',
  'Suggest a feature'
];

export function AtlasChatPanel({ onClose }: AtlasChatPanelProps) {
  const [mode, setMode] = useState<AtlasMode>('chat');
  const [messages, setMessages] = useState<AtlasMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [currentChips, setCurrentChips] = useState<string[]>(INITIAL_CHIPS);
  const [feedbackInput, setFeedbackInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentChips]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: AtlasMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setCurrentChips([]);

    // Process answer
    setTimeout(() => {
      if (text.toLowerCase() === 'suggest a feature') {
        setMode('collectingFeedback');
        return;
      }

      const match = findAtlasAnswer(text);

      const atlasMsg: AtlasMessage = {
        id: (Date.now() + 1).toString(),
        role: 'atlas',
        text: match ? match.answer : FALLBACK_ANSWER,
        createdAt: new Date(),
        intentId: match?.id,
      };

      setMessages(prev => [...prev, atlasMsg]);

      if (match && match.followUps) {
        setCurrentChips(match.followUps);
      } else if (!match) {
        setCurrentChips(['Leave a question', 'Suggest a feature', 'Join early access']);
      }
    }, 600);
  };

  const handleChipClick = (chip: string) => {
    if (chip === 'Suggest a feature' || chip === 'Leave a question') {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      setFeedbackInput(lastUserMsg?.text || '');
      setMode('collectingFeedback');
      return;
    }

    if (chip === 'Join early access' || chip === 'Early access') {
      const el = document.getElementById('early-access');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        onClose();
      }
      return;
    }

    handleSendMessage(chip);
  };

  const handleOpenFeedback = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    setFeedbackInput(lastUserMsg?.text || '');
    setMode('collectingFeedback');
  };

  const activeIntentId = [...messages].reverse().find(m => m.role === 'atlas' && m.intentId)?.intentId;

  return (
    <div className="flex flex-col h-full bg-hw-navy-900 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-hw-navy-950 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="h-10 w-10 bg-hw-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-hw-blue-600/30">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-hw-teal-500 border-2 border-hw-navy-950 rounded-full"></div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-hw-white leading-none">Atlas Preview</h2>
              <span className="text-[8px] font-bold px-1.5 py-0.5 bg-hw-blue-600/20 text-hw-blue-600 rounded uppercase tracking-widest border border-hw-blue-600/10">Beta</span>
            </div>
            <p className="text-[10px] text-hw-slate-500 mt-1">Guided Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-hw-slate-400 hover:text-hw-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Warning/Preview Banner */}
      <div className="px-6 py-2 bg-hw-blue-600/5 border-b border-white/5 flex items-center space-x-2">
        <Info size={12} className="text-hw-blue-600 shrink-0" />
        <p className="text-[9px] text-hw-slate-400 italic leading-none">
          Atlas Preview can answer common questions and collect feedback.
        </p>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar" ref={scrollRef}>
        {mode === 'chat' ? (
          <>
            <div className="space-y-4">
              {messages.map((msg) => (
                <AtlasMessageBubble key={msg.id} message={msg} />
              ))}
            </div>
            <AtlasSuggestionChips chips={currentChips} onChipClick={handleChipClick} />

            {/* Direct Contact Prompt (visible if any messages exist beyond welcome) */}
            {messages.length > 1 && (
              <div className="mt-8 pt-8 border-t border-white/5 text-center">
                <p className="text-[10px] text-hw-slate-500 mb-3 uppercase tracking-widest font-bold">Still have questions?</p>
                <button
                  onClick={handleOpenFeedback}
                  className="inline-flex items-center text-[10px] font-bold text-hw-blue-600 hover:text-hw-blue-500 transition-colors uppercase tracking-widest"
                >
                  <MessageCircle size={14} className="mr-2" />
                  Message Atlas Team Directly
                </button>
              </div>
            )}
          </>
        ) : (
          <AtlasFeedbackForm
            initialMessage={feedbackInput}
            matchedIntentId={activeIntentId}
            onClose={() => setMode('chat')}
            onSuccess={() => {}}
          />
        )}
      </div>

      {/* Input Area */}
      {mode === 'chat' && (
        <div className="p-4 bg-hw-navy-950 border-t border-white/5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Atlas about HourWise..."
              className="w-full bg-hw-navy-900 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-hw-white placeholder:text-hw-slate-600 focus:outline-none focus:border-hw-blue-600 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-hw-blue-600 text-white rounded-lg disabled:opacity-50 disabled:bg-hw-slate-800 transition-all hover:scale-105"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
