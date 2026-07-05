import React from 'react';
import { AtlasMessage } from './atlasTypes';
import { Bot, User } from 'lucide-react';

interface AtlasMessageBubbleProps {
  message: AtlasMessage;
}

export function AtlasMessageBubble({ message }: AtlasMessageBubbleProps) {
  const isAtlas = message.role === 'atlas';

  return (
    <div className={`flex ${isAtlas ? 'justify-start' : 'justify-end'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex max-w-[85%] ${isAtlas ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isAtlas ? 'bg-hw-blue-600 mr-2 shadow-lg shadow-hw-blue-600/20' : 'bg-white/10 ml-2 border border-white/10'
        }`}>
          {isAtlas ? <Bot size={16} className="text-white" /> : <User size={16} className="text-hw-slate-300" />}
        </div>

        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isAtlas
            ? 'bg-hw-navy-800 text-hw-slate-200 rounded-tl-none border border-white/5'
            : 'bg-hw-blue-600 text-white rounded-tr-none shadow-lg shadow-hw-blue-600/10'
        }`}>
          {message.text}
        </div>
      </div>
    </div>
  );
}
