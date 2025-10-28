import React from 'react';

interface AnimatedLyricProps {
  text: string;
  type: 'active' | 'next';
  fontSize: number;
  fontFamily: string;
  color: string;
}

const AnimatedLyric: React.FC<AnimatedLyricProps> = ({ text, type, fontSize, fontFamily, color }) => {
  const commonStyle: React.CSSProperties = {
    fontFamily,
    color,
    textShadow: '0 2px 10px rgba(0,0,0,0.7)',
    position: 'absolute',
    width: '120%', 
    left: '-10%',
    textAlign: 'center',
    willChange: 'transform, opacity',
  };

  const activeStyle: React.CSSProperties = {
    ...commonStyle,
    fontSize: `${fontSize}px`,
    top: '-0.5em',
    animation: 'fan-in 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
  };

  const nextStyle: React.CSSProperties = {
    ...commonStyle,
    fontSize: `${fontSize * 0.9}px`,
    top: '1.2em',
    opacity: 0.7,
    transform: 'rotate(-7deg)',
    transition: 'opacity 0.5s ease, top 0.5s ease',
  };
  
  return (
    <>
      <style>{`
        @keyframes fan-in {
          from { 
            opacity: 0; 
            transform: rotate(-20deg) translateY(20px) scale(0.9); 
          }
          to { 
            opacity: 1; 
            transform: rotate(-7deg) translateY(0) scale(1);
          }
        }
      `}</style>
      <p style={type === 'active' ? activeStyle : nextStyle}>
        {text}
      </p>
    </>
  );
};

export default AnimatedLyric;
