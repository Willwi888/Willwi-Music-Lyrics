import React, { useMemo } from 'react';

interface AnimatedLyricProps {
  text: string;
  startTime: number;
  endTime: number;
  currentTime: number;
  isPlaying: boolean;
  animationType: 'typewriter' | 'fade' | 'bounce';
  style?: React.CSSProperties;
  fadeOut: boolean;
}

const AnimatedLyric: React.FC<AnimatedLyricProps> = ({
  text,
  startTime,
  endTime,
  currentTime,
  isPlaying,
  animationType,
  style,
  fadeOut,
}) => {
  const duration = (endTime - startTime);
  // Negative delay starts the animation partway through if we scrub to the middle of a line
  const delay = (startTime - currentTime);

  const animationStyle = useMemo((): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      ...style,
      animationPlayState: isPlaying ? 'running' : 'paused',
      opacity: 0, // Set default to invisible. Animations will make it visible.
    };

    let animationList: string[] = [];
    let specificStyles: React.CSSProperties = {};

    switch (animationType) {
      case 'typewriter':
        animationList.push(`typewriter-anim ${duration}s steps(${text.length || 1}, end) ${delay}s forwards`);
        animationList.push(`blink-caret .75s step-end infinite ${delay}s`);
        specificStyles = {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          borderRight: `.15em solid ${style?.color || 'white'}`,
          width: 0,
          display: 'inline-block',
        };
        break;
      case 'fade':
        const fadeInDuration = duration * 0.2;
        const fadeOutDelay = delay + (duration * 0.8);
        animationList.push(`fade-in ${fadeInDuration}s ease-out ${delay}s forwards`);
        animationList.push(`fade-out ${fadeInDuration}s ease-in ${fadeOutDelay}s forwards`);
        break;
      case 'bounce':
        animationList.push(`bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) ${delay}s forwards`);
        break;
    }

    if (fadeOut && (animationType === 'typewriter' || animationType === 'bounce')) {
        const fadeOutDuration = Math.max(0.1, duration * 0.2); // Ensure minimum duration
        const fadeOutDelay = delay + (duration - fadeOutDuration);
        animationList.push(`fade-out ${fadeOutDuration}s ease-in ${fadeOutDelay}s forwards`);
    }

    // Only apply animations if the lyric is potentially in view, preventing all animations from starting at time 0
    if (currentTime < endTime + 2 && currentTime > startTime - 2) {
        return {
            ...baseStyle,
            ...specificStyles,
            animation: animationList.join(', '),
        };
    }
    
    return baseStyle; // Return base style (opacity 0) if not in view

  }, [animationType, duration, delay, isPlaying, style, text.length, fadeOut, currentTime, startTime, endTime]);

  // Don't render if it's far out of view, as a small performance optimization
  if (currentTime > endTime + 5 || currentTime < startTime - 5) {
      return null;
  }

  return (
    <>
      <style>
        {`
          /* For Typewriter */
          @keyframes typewriter-anim {
            from { width: 0; opacity: 1; }
            to { width: 100%; opacity: 1; }
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