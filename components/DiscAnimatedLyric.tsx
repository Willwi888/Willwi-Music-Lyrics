import React from 'react';
import { TimedLyric } from '../types';

interface DiscAnimatedLyricProps {
  timedLyrics: TimedLyric[];
  activeLyricIndex: number;
  fontSize: number;
  fontFamily: string;
  activeColor: string;
  nextColor: string;
}

const DiscAnimatedLyric: React.FC<DiscAnimatedLyricProps> = ({ 
    timedLyrics,
    activeLyricIndex,
    fontSize, 
    fontFamily, 
    activeColor, 
    nextColor 
}) => {
  const rotation = activeLyricIndex >= 0 ? -activeLyricIndex * 10 : 0;
  const lyricAngle = 10; // degrees between lyrics
  const radius = Math.max(200, fontSize * 6); // Dynamically adjust radius based on font size to prevent overlap

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ fontFamily }}>
        <svg viewBox="-300 -300 600 600" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
                <mask id="fade-mask">
                    <rect x="-300" y="-300" width="600" height="600" fill="url(#gradient)" />
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="white" stopOpacity="0" />
                        <stop offset="35%" stopColor="white" stopOpacity="0" />
                        <stop offset="48%" stopColor="white" stopOpacity="1" />
                        <stop offset="52%" stopColor="white" stopOpacity="1" />
                        <stop offset="65%" stopColor="white" stopOpacity="0" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                </mask>
            </defs>
            <g mask="url(#fade-mask)">
                <g style={{ 
                    transform: `rotate(${rotation}deg)`, 
                    transition: 'transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)' 
                }}>
                    {timedLyrics.map((lyric, index) => {
                        const distance = Math.abs(index - activeLyricIndex);
                        
                        // Limit to 5 visible lines (active + 2 before/after)
                        if (activeLyricIndex !== -1 && distance > 2) return null;

                        const isActive = index === activeLyricIndex;
                        const opacity = isActive ? 1 : Math.max(0, 1 - distance * 0.4); // Enhanced fade-out
                        const scale = isActive ? 1 : Math.max(0.8, 1 - distance * 0.1); // Adjusted scaling
                        const color = isActive ? activeColor : nextColor;

                        const textStyle: React.CSSProperties = {
                            fontSize: `${fontSize * scale}px`,
                            fill: color,
                            opacity: opacity,
                            textAnchor: 'middle',
                            dominantBaseline: 'middle',
                            transition: 'all 0.5s ease',
                            textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                            willChange: 'opacity, font-size, fill',
                        };
                        
                        // Position text on circle, then un-rotate it to keep it upright
                        const transform = `rotate(${index * lyricAngle}) translate(0, -${radius}) rotate(${-index * lyricAngle})`;

                        return (
                            <text
                                key={index}
                                transform={transform}
                                style={textStyle}
                            >
                                {lyric.text}
                            </text>
                        );
                    })}
                </g>
            </g>
        </svg>
    </div>
  );
};

export default DiscAnimatedLyric;