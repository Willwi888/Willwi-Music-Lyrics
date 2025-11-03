import React from 'react';
import { TimedLyric } from '../types';

interface VerticalAnimatedLyricProps {
  activeLyric: TimedLyric | null;
  nextLyric: TimedLyric | null;
  fontSize: number;
  fontFamily: string;
  activeColor: string;
  nextColor: string;
}

const VerticalAnimatedLyric: React.FC<VerticalAnimatedLyricProps> = ({ 
    activeLyric, 
    nextLyric, 
    fontSize, 
    fontFamily, 
    activeColor, 
    nextColor 
}) => {

  const commonStyle: React.CSSProperties = {
    fontFamily,
    textShadow: '0 2px 10px rgba(0,0,0,0.7)',
    width: '100%',
    textAlign: 'center',
    willChange: 'transform, opacity',
    position: 'absolute',
    left: '0',
  };

  const activeStyle: React.CSSProperties = {
    ...commonStyle,
    fontSize: `${fontSize}px`,
    color: activeColor,
    top: '40%',
    transform: 'translateY(-50%)',
    animation: 'slide-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  };

  const nextStyle: React.CSSProperties = {
    ...commonStyle,
    fontSize: `${fontSize * 0.9}px`,
    color: nextColor,
    top: '60%',
    transform: 'translateY(-50%)',
    opacity: 0.6,
    transition: 'opacity 0.5s ease',
  };
  
  return (
    <div className="w-full h-full relative">
      <style>{`
        @keyframes slide-in {
          from { 
            opacity: 0; 
            transform: translateY(-30%);
          }
          to { 
            opacity: 1; 
            transform: translateY(-50%);
          }
        }
      `}</style>
      
      {activeLyric && (
        <p style={activeStyle}>
            {activeLyric.text}
        </p>
      )}

      {nextLyric && (
        <p style={nextStyle}>
            {nextLyric.text}
        </p>
      )}
    </div>
  );
};

export default VerticalAnimatedLyric;