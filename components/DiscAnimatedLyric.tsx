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
  const lyricAngle = 28; // Increased from 10 to provide more spacing
  const rotation = activeLyricIndex >= 0 ? -activeLyricIndex * lyricAngle : 0;
  const radius = Math.max(220, fontSize * 5.5); // Adjusted radius for new angle

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ fontFamily }}>
        <svg viewBox="-300 -300 600 600" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
                <mask id="fade-mask">
                    <rect x="-300" y="-300" width="600" height="600" fill="url(#gradient)" />
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        {/* Softer, wider gradient for a smoother fade effect */}
                        <stop offset="0%" stopColor="white" stopOpacity="0" />
                        <stop offset="30%" stopColor="white" stopOpacity="0" />
                        <stop offset="45%" stopColor="white" stopOpacity="1" />
                        <stop offset="55%" stopColor="white" stopOpacity="1" />
                        <stop offset="70%" stopColor="white" stopOpacity="0" />
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
                        
                        // Limit to 7 visible lines (active + 3 before/after) to enhance the wheel effect
                        if (activeLyricIndex !== -1 && distance > 3) return null;

                        const isActive = index === activeLyricIndex;
                        const opacity = isActive ? 1 : Math.max(0, 1 - distance * 0.25); // Softer opacity falloff
                        const scale = isActive ? 1 : Math.max(0.8, 1 - distance * 0.1);
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
                        
                        // Position text on circle, then un-rotate it to keep it upright for readability
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