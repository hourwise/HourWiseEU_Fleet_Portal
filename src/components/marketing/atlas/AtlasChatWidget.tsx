import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { AtlasChatPanel } from './AtlasChatPanel';

export function AtlasChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  useEffect(() => {
    // Show a little notification after a few seconds on first load
    const timer = setTimeout(() => {
      if (!isOpen) setHasNewMessage(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    setHasNewMessage(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Launcher Button */}
      <div className="fixed bottom-6 right-6 z-[9999]">
        <button
          onClick={toggleOpen}
          className={`relative h-14 w-14 lg:h-16 lg:w-16 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl ${
            isOpen
              ? 'bg-hw-navy-900 border border-white/10 rotate-90'
              : 'bg-hw-blue-600 hover:scale-110 active:scale-95 shadow-hw-blue-600/30'
          }`}
          aria-label={isOpen ? "Close Atlas Preview" : "Open Atlas Preview"}
        >
          {isOpen ? (
            <X size={24} className="text-hw-white -rotate-90" />
          ) : (
            <Sparkles size={28} className="text-white" />
          )}

          {/* New Message Badge */}
          {!isOpen && hasNewMessage && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hw-teal-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-hw-teal-500 border-2 border-hw-navy-950 items-center justify-center">
                <span className="text-[10px] font-bold text-white">1</span>
              </span>
            </span>
          )}

          {/* Launcher Label (Desktop only) */}
          {!isOpen && (
            <span className="absolute right-full mr-4 px-4 py-2 bg-hw-navy-900 border border-white/10 rounded-xl text-xs font-bold text-hw-white whitespace-nowrap hidden lg:block shadow-2xl animate-in slide-in-from-right-2 fade-in duration-500">
              Ask Atlas Preview
            </span>
          )}
        </button>

        {/* Chat Panel */}
        <div className={`fixed bottom-0 right-0 w-full h-[85vh] lg:bottom-24 lg:right-6 lg:w-[400px] lg:h-[600px] lg:rounded-3xl border-t lg:border border-white/10 shadow-2xl z-[10000] transition-all duration-500 transform origin-bottom-right ${
          isOpen
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-10 opacity-0 scale-95 pointer-events-none'
        }`}>
          {isOpen && <AtlasChatPanel onClose={() => setIsOpen(false)} />}
        </div>
      </div>
    </>
  );
}
