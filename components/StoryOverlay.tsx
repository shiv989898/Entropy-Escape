import React, { useEffect, useState } from 'react';
import { StoryBeat } from '../types';
import { Terminal, Cpu } from 'lucide-react';

interface StoryOverlayProps {
    beat: StoryBeat | null;
    onComplete: () => void;
}

export const StoryOverlay: React.FC<StoryOverlayProps> = ({ beat, onComplete }) => {
    const [lineIndex, setLineIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        if (!beat) return;
        setLineIndex(0);
        setCharIndex(0);
        setDisplayedText('');
    }, [beat]);

    useEffect(() => {
        if (!beat) return;
        
        const currentLine = beat.text[lineIndex];
        if (!currentLine) return;

        if (charIndex < currentLine.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + currentLine[charIndex]);
                setCharIndex(prev => prev + 1);
            }, 30); // Typing speed
            return () => clearTimeout(timeout);
        }
    }, [beat, lineIndex, charIndex]);

    const handleNext = () => {
        if (!beat) return;
        const currentLine = beat.text[lineIndex];
        
        // If typing not done, finish line immediately
        if (charIndex < currentLine.length) {
            setDisplayedText(currentLine);
            setCharIndex(currentLine.length);
            return;
        }

        // Next line
        if (lineIndex < beat.text.length - 1) {
            setLineIndex(prev => prev + 1);
            setCharIndex(0);
            setDisplayedText('');
        } else {
            onComplete();
        }
    };

    if (!beat) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 text-white" onClick={handleNext}>
            <div className="max-w-3xl w-full p-8 space-y-8 cursor-pointer">
                {/* Speaker Identity */}
                <div className="flex items-center gap-4 border-b border-gray-700 pb-4">
                    <div className={`p-4 rounded-full border-2 ${beat.speaker === 'PROXY' ? 'border-cyan-500 bg-cyan-900/20' : 'border-red-500 bg-red-900/20'}`}>
                        {beat.speaker === 'PROXY' ? <Terminal size={48} className="text-cyan-400" /> : <Cpu size={48} className="text-red-400" />}
                    </div>
                    <div>
                        <h2 className={`text-2xl font-bold font-mono tracking-widest ${beat.speaker === 'PROXY' ? 'text-cyan-400' : 'text-red-400'}`}>
                            {beat.speaker}
                        </h2>
                        <div className="text-xs text-gray-500 font-mono">SECURE_CHANNEL_ESTABLISHED</div>
                    </div>
                </div>

                {/* Text Content */}
                <div className="min-h-[150px]">
                    <p className="text-2xl font-mono leading-relaxed text-gray-200 shadow-lg">
                        {displayedText}
                        <span className="animate-pulse inline-block w-3 h-6 bg-white ml-1 align-middle"></span>
                    </p>
                </div>

                {/* Footer Hint */}
                <div className="text-right text-sm text-gray-600 font-mono animate-pulse">
                    CLICK TO CONTINUE {'>'}
                </div>
            </div>
        </div>
    );
};