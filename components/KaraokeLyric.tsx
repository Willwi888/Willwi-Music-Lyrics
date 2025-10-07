import React from 'react';

interface KaraokeLyricProps {
  text: string;
  startTime: number;
  endTime: number;
  currentTime: number;
  isPlaying: boolean;
  style?: React.CSSProperties;
}

const KaraokeLyric: React.FC<KaraokeLyricProps> = ({ text, startTime, endTime, currentTime, isPlaying, style }) => {
  const duration = (endTime - startTime) * 1000;
  // Negative delay makes the animation jump to the correct progress if we start mid-lyric
  const delay = (startTime - currentTime) * 1000;

  const animationStyle: React.CSSProperties = {
    ...style,
    backgroundImage: `linear-gradient(to right, #FFFFFF 50%, #9ca3af 50%)`,
    backgroundSize: '200% 100%',
    backgroundPosition: '100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    animationName: 'karaoke-highlight',
    animationDuration: `${Math.max(0, duration)}ms`, // Ensure duration isn't negative
    animationDelay: `${delay}ms`,
    animationTimingFunction: 'linear',
    animationFillMode: 'forwards',
    animationPlayState: isPlaying ? 'running' : 'paused',
  };

  return (
    <>
      <style>
        {`
          @keyframes karaoke-highlight {
            from { background-position: 100%; }
            to { background-position: 0%; }
          }
        `}
      </style>
      <p style={animationStyle} className="text-center font-bold drop-shadow-lg tracking-wide">
        {text}
      </p>
    </>
  );
};

export default KaraokeLyric;
