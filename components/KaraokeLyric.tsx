import React from 'react';
import { TimedLyric } from '../types';

interface KaraokeLyricProps {
  activeLyric: TimedLyric | null;
  currentTime: number;
  fontSize: number;
  fontFamily: string;
  activeColor: string;
  nextColor: string; // Base color of the text
}

const KaraokeLyric: React.FC<KaraokeLyricProps> = ({
  activeLyric,
  currentTime,
  fontSize,
  fontFamily,
  activeColor,
  nextColor,
}) => {
  if (!activeLyric) {
    return null;
  }

  const { text, startTime, endTime } = activeLyric;
  const duration = endTime - startTime;
  const progress = duration > 0 ? Math.min(1, Math.max(0, (currentTime - startTime) / duration)) : 0;

  const wrapperStyle: React.CSSProperties = {
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: 'bold',
    position: 'relative',
    color: nextColor, // The color of the text that is not yet "sung"
    textShadow: '0 2px 5px rgba(0,0,0,0.5)',
    textAlign: 'center',
    width: '90%',
    padding: '0 20px',
    whiteSpace: 'nowrap',
  };

  const highlightStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    color: activeColor, // The color of the "sung" text
    overflow: 'hidden',
    transition: 'clip-path 0.05s linear',
    whiteSpace: 'nowrap',
    clipPath: `inset(0 ${100 - progress * 100}% 0 0)`,
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={wrapperStyle}>
        <div style={highlightStyle}>
          {text}
        </div>
        {text}
      </div>
    </div>
  );
};

export default KaraokeLyric;
