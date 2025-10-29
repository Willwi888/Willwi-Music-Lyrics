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
  // Constants for the 3D wheel effect
  const lyricAngle = 25; // Angle between each lyric element
  const radius = fontSize * 8; // The radius of the lyric wheel
  const rotation = activeLyricIndex >= 0 ? -activeLyricIndex * lyricAngle : 0;

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily,
    perspective: '1200px', // Creates the 3D space
    overflow: 'hidden',
  };

  const wheelStyle: React.CSSProperties = {
    position: 'relative',
    width: '1px',
    height: '1px',
    transformStyle: 'preserve-3d',
    transform: `rotateY(${rotation}deg)`,
    transition: 'transform 0.8s cubic-bezier(0.65, 0, 0.35, 1)',
  };
  
  // Create a vertical gradient mask to fade top and bottom
  const maskStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
    pointerEvents: 'none',
  };

  return (
    <div style={containerStyle}>
      <div style={wheelStyle}>
        {timedLyrics.map((lyric, index) => {
          const angle = index * lyricAngle;
          const isActive = index === activeLyricIndex;

          const distance = Math.abs(index - activeLyricIndex);
          // Only render a few lyrics around the active one for performance
          if (activeLyricIndex !== -1 && distance > 5) return null;

          // Calculate opacity based on the lyric's position in the 3D wheel
          let effectiveAngle = (angle + rotation) % 360;
          if (effectiveAngle < 0) effectiveAngle += 360;
          
          let opacity = 0;
          if (effectiveAngle < 60) {
             opacity = 1 - (effectiveAngle / 60);
          } else if (effectiveAngle > 300) {
             opacity = 1 - ((360 - effectiveAngle) / 60);
          }

          const lyricStyle: React.CSSProperties = {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px)`,
            color: isActive ? activeColor : nextColor,
            fontSize: `${fontSize}px`,
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            opacity: isActive ? 1 : Math.max(0, opacity * 0.7),
            textShadow: '0 2px 10px rgba(0,0,0,0.7)',
            transition: 'color 0.5s ease, opacity 0.5s ease',
            backfaceVisibility: 'hidden', // Hide the back of the element when it rotates away
          };

          return (
            <div key={index} style={lyricStyle}>
              {lyric.text}
            </div>
          );
        })}
      </div>
      <div style={maskStyle}></div>
    </div>
  );
};

export default DiscAnimatedLyric;
