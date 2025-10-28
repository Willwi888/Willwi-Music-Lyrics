import React, { useMemo } from 'react';

interface AnimatedLyricProps {
  text: string;
  startTime: number;
  endTime: number;
  currentTime: number;
  isPlaying: boolean;
  animationType: 'typewriter' | 'fade' | 'bounce';
  style?: React.CSSProperties;
}

const AnimatedLyric: React.FC<AnimatedLyricProps> = ({
  text,
  startTime,
  endTime,
  currentTime,
  isPlaying,
  animationType,
  style,
}) => {
  const duration = (endTime - startTime);
  // Negative delay starts the animation partway through if we scrub to the middle of a line
  const delay = (startTime - currentTime);

  const animationStyle = useMemo((): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      ...style,
      animationPlayState: isPlaying ? 'running' : 'paused',
    };

    switch (animationType) {
      case 'typewriter':
        return {
          ...baseStyle,
          animation: `typewriter-anim ${duration}s steps(${text.length || 1}, end) ${delay}s forwards, blink-caret .75s step-end infinite ${delay}s`,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          borderRight: `.15em solid ${style?.color || 'white'}`,
          width: 0,
          display: 'inline-block', // to make width work
        };
      case 'fade':
        // Fade in for first 20% of duration, fade out for last 20%
        const fadeInDuration = duration * 0.2;
        const fadeOutDelay = delay + (duration * 0.8);
        return {
          ...baseStyle,
          animation: `fade-in ${fadeInDuration}s ease-out ${delay}s forwards, fade-out ${fadeInDuration}s ease-in ${fadeOutDelay}s forwards`,
          opacity: 0,
        };
      case 'bounce':
         // Bounce in for first 0.5s
        return {
          ...baseStyle,
          animation: `bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) ${delay}s forwards`,
          opacity: 0,
        };
      default:
        return baseStyle;
    }
  }, [animationType, duration, delay, isPlaying, style, text.length]);

  return (
    <>
      <style>
        {`
          /* For Typewriter */
          @keyframes typewriter-anim {
            from { width: 0; }
            to { width: 100%; }
          }
          @keyframes blink-caret {
            from, to { border-color: transparent; }
            50% { border-color: ${style?.color || 'white'}; }
          }
          /* For Fade */
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fade-out {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
          }
          /* For Bounce */
          @keyframes bounce-in {
            0% {
              opacity: 0;
              transform: scale(.3);
            }
            50% {
              opacity: 1;
              transform: scale(1.05);
            }
            70% {
              transform: scale(.9);
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
      <div className="flex justify-center items-center">
        <p style={animationStyle} className="text-center font-bold tracking-wide">
          {text}
        </p>
      </div>
    </>
  );
};

export default AnimatedLyric;
