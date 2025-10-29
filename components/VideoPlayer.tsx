
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';
import MusicIcon from './icons/MusicIcon';

interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrl: string;
  songTitle: string;
  artistName: string;
  onBack: () => void;
}

const fontOptions = [
  { name: '現代無襯線', value: 'sans-serif' },
  { name: '經典襯線', value: 'serif' },
  { name: '手寫體', value: 'cursive' },
  { name: '打字機', value: 'monospace' },
  { name: '日文黑體', value: "'Noto Sans JP', sans-serif" },
  { name: '韓文黑體', value: "'Noto Sans KR', sans-serif" },
];

const fontWeights = [
  { name: '細體 (300)', value: '300' },
  { name: '正常 (400)', value: '400' },
  { name: '中等 (500)', value: '500' },
  { name: '半粗體 (600)', value: '600' },
  { name: '粗體 (700)', value: '700' },
  { name: '特粗體 (800)', value: '800' },
  { name: '極粗體 (900)', value: '900' },
];

const resolutions: { [key: string]: { width: number; height: number } } = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const colorThemes: { [key: string]: { name: string; active: string; inactive1: string; inactive2: string; info: string; subInfo: string; } } = {
  light: {
    name: '明亮',
    active: '#FFFFFF',
    inactive1: '#E5E7EB', // Not used with current lyric display
    inactive2: '#D1D5DB', // Not used with current lyric display
    info: '#FFFFFF',
    subInfo: '#E5E7EB',
  },
  dark: {
    name: '深邃',
    active: '#1F2937',
    inactive1: '#4B5563', // Not used with current lyric display
    inactive2: '#6B7280', // Not used with current lyric display
    info: '#1F2937',
    subInfo: '#4B5563',
  },
  colorized: {
    name: '多彩',
    active: '#FBBF24', // Amber 400
    inactive1: '#FFFFFF', // Not used with current lyric display
    inactive2: '#E5E7EB', // Not used with current lyric display
    info: '#FBBF24',
    subInfo: '#FFFFFF',
  },
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress: number; details?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontWeight, setFontWeight] = useState<string>('700'); // Default bold
  const [strokeColor, setStrokeColor] = useState<string>('#000000'); // Default black
  const [strokeWidth, setStrokeWidth] = useState<number>(0); // Default no stroke
  const [colorTheme, setColorTheme] = useState('light');
  const [resolution, setResolution] = useState('720p');
  const [includeAlbumArt, setIncludeAlbumArt] = useState(true);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const isExportCancelled = useRef(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // lyricsContainerRef and lyricRefs are not strictly needed for the new single-lyric display but kept for consistency
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]); 
  const animationFrameIdRef = useRef<number | null>(null);

  const lyricsToRender = useMemo(() => {
    if (!timedLyrics || timedLyrics.length === 0) return [];
    // Add dummy lyrics at the start and end to simplify currentIndex logic for bounding
    return [
      { text: '', startTime: -2, endTime: -1 }, 
      { text: '', startTime: -1, endTime: timedLyrics[0].startTime ?? 0 },
      ...timedLyrics,
      { text: '', startTime: 99999, endTime: 999999 }, // Dummy after last lyric
    ];
  }, [timedLyrics]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const animate = () => {
      setCurrentTime(audio.currentTime);
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      setCurrentTime(audio.currentTime); // Update time when pausing
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const endedHandler = () => {
      setIsPlaying(false);
      setIsEnded(true);
      setCurrentTime(audio.duration || 0); // Ensure currentTime is at the end
    };
    
    const handleScrubbing = () => {
      if (audio.paused) {
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener('ended', endedHandler);
    audio.addEventListener('timeupdate', handleScrubbing);

    return () => {
      audio.removeEventListener('ended', endedHandler);
      audio.removeEventListener('timeupdate', handleScrubbing);
    };
  }, []);

  // Effect to clean up the persistent AudioContext on component unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        mediaElementSourceRef.current?.disconnect();
        audioContextRef.current.close();
      }
    };
  }, []);
  
  const currentIndex = useMemo(() => {
    // If playback hasn't started or is at time 0 and paused, point to the dummy lyric before the first real one (index 1).
    if (currentTime === 0 && !isPlaying) {
      return 1;
    }
    
    // Find the active lyric index
    const index = timedLyrics.findIndex(
      lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime
    );
  
    if (index !== -1) {
      return index + 2; // Real lyrics start at index 2 in lyricsToRender
    }
  
    // If no lyric is active, check if we're past the end of the last real lyric
    if (timedLyrics.length > 0 && currentTime >= timedLyrics[timedLyrics.length - 1].endTime) {
      return timedLyrics.length + 2; // Dummy lyric after the last real one
    }
  
    // Otherwise, we're before the first lyric or in a gap, show the dummy before first real lyric.
    return 1;
  }, [currentTime, timedLyrics, isPlaying]);


  // Removed the useEffect for lyricsContainerRef transform, as lyrics are now absolutely positioned and centered.


  const handlePlayPause = () => {
    if (audioRef.current) {
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            if (audioRef.current.ended) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
                setIsEnded(false);
            }
            if (!hasPlaybackStarted) {
                setHasPlaybackStarted(true);
            }
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    }
  };
  
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      setIsEnded(false);
      if (!hasPlaybackStarted && time > 0) {
        setHasPlaybackStarted(true);
      }
    }
  };
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return isNaN(minutes) || isNaN(secs) ? '0:00' : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSrtTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = (seconds % 1).toFixed(3).substring(2);
    return `${h}:${m}:${s},${ms}`;
  };

  const generateSrtContent = () => {
    let srtContent = '';
    timedLyrics.forEach((lyric, index) => {
        const startTime = formatSrtTime(lyric.startTime);
        const endTime = formatSrtTime(lyric.endTime);
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${lyric.text}\n\n`;
    });
    return srtContent;
  }

  const handleExportSrt = () => {
    const srtContent = generateSrtContent();
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCancelExport = () => {
    isExportCancelled.current = true;
  };

  // Fix: Removed 'textStrokeWidth' and 'textStrokeColor' as they are not standard CSS properties directly
  // supported by `React.CSSProperties`. `WebkitTextStrokeWidth` and `WebkitTextStrokeColor`
  // are kept for browser compatibility. Canvas rendering handles stroke independently.
  const getLyricStyle = useCallback((index: number, currentIdx?: number, baseFontSize: number = fontSize, baseFontWeight: string = fontWeight, baseStrokeWidth: number = strokeWidth, baseStrokeColor: string = strokeColor) => {
    const activeIndex = currentIdx !== undefined ? currentIdx : currentIndex;
    const theme = colorThemes[colorTheme];

    const isCurrentLyric = index === activeIndex;

    const style: React.CSSProperties = {
        fontFamily: fontFamily,
        fontWeight: baseFontWeight,
        textShadow: '2px 2px 5px rgba(0,0,0,0.5)',
        opacity: isCurrentLyric ? 1 : 0, // Only active lyric is visible
        transform: isCurrentLyric ? 'scale(1)' : 'scale(0.9)', // Slight scale for hidden ones
        fontSize: `${baseFontSize}px`, // Always use baseFontSize for the active lyric
        color: theme.active,
        WebkitTextStrokeWidth: baseStrokeWidth > 0 ? `${baseStrokeWidth}px` : undefined,
        WebkitTextStrokeColor: baseStrokeWidth > 0 ? baseStrokeColor : undefined,
        
        // For canvas, this needs to be a single string for ctx.font
        font: `${baseFontWeight} ${baseFontSize}px ${fontFamily}`,
    };

    // Only apply transition for live preview for smoothness
    if (currentIdx === undefined) {
      style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out, font-size 0.3s ease-out, color 0.3s ease-out, -webkit-text-stroke 0.3s ease-out, text-stroke 0.3s ease-out';
    }

    return style;
  }, [currentIndex, fontSize, fontFamily, colorTheme, fontWeight, strokeWidth, strokeColor]);


  const handleExportVideo = async () => {
    if (!audioRef.current || !imageUrl) return;
    isExportCancelled.current = false;
    setExportProgress({ message: '正在初始化...', progress: 0 });

    const canvas = document.createElement('canvas');
    const selectedResolution = resolutions[resolution];
    canvas.width = selectedResolution.width;
    canvas.height = selectedResolution.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      alert('無法初始化 Canvas 進行匯出。');
      setExportProgress(null);
      return;
    }

    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });

    try {
      setExportProgress({ message: '正在載入資源...', progress: 5 });
      
      const [bgImage, albumImage] = await Promise.all([
        loadImage(imageUrl), 
        loadImage(imageUrl),
      ]);

      setExportProgress({ message: '資源載入完畢', progress: 10 });
      
      const audio = audioRef.current;
      const wasPlaying = isPlaying;
      if (wasPlaying) handlePlayPause(); // Pause playback before starting

      // Lazily create and reuse the AudioContext and MediaElementSourceNode
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        mediaElementSourceRef.current = null; // Force source recreation if context is new
      }
      const audioContext = audioContextRef.current;
      
      if (!mediaElementSourceRef.current) {
        mediaElementSourceRef.current = audioContext.createMediaElementSource(audio);
        mediaElementSourceRef.current.connect(audioContext.destination);
      }
      const audioSource = mediaElementSourceRef.current;

      // Mute audio output during export by disconnecting from main destination
      try {
          audioSource.disconnect(audioContext.destination);
      } catch(e) {
          console.warn("Audio source was not connected to destination, continuing.", e);
      }
      const audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      const audioStream = audioDestination.stream;


      const videoStream = canvas.captureStream(30); // 30 FPS

      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      const MimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      const fileExtension = MimeType.includes('mp4') ? 'mp4' : 'webm';

      const recorder = new MediaRecorder(combinedStream, { mimeType: MimeType });
      const recordedChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (!isExportCancelled.current) {
          const blob = new Blob(recordedChunks, { type: MimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${songTitle}-${artistName}-${resolution}.${fileExtension}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        
        // Cleanup
        combinedStream.getTracks().forEach(track => track.stop());
        
        // Disconnect from recording stream and reconnect to speakers
        try {
          audioSource.disconnect(audioDestination);
        } catch (e) {
          console.warn("Could not disconnect audio destination.", e);
        }
        try {
            audioSource.connect(audioContext.destination);
        } catch(e) {
            console.warn("Could not reconnect audio source to destination.", e);
        }
        setExportProgress(null);
        if(wasPlaying) audio.play();
      };
      
      let animationFrameId: number;
      audio.currentTime = 0;
      audio.play();
      recorder.start();
      const exportStartTime = Date.now();
      
      const scaleFactor = canvas.height / 720; // Base resolution is 720p for scaling
      const exportFontSize = fontSize * scaleFactor;
      const exportStrokeWidth = strokeWidth * scaleFactor; // Scale stroke width

      const theme = colorThemes[colorTheme];

      const drawFrame = () => {
        const currentPlaybackTime = audio.currentTime;
        const duration = audio.duration;

        if (currentPlaybackTime >= duration || recorder.state !== 'recording' || isExportCancelled.current) {
          if (recorder.state === 'recording') recorder.stop();
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
          }
          cancelAnimationFrame(animationFrameId);
          return;
        }

        const progress = (currentPlaybackTime / duration) * 100;
        
        const elapsedTime = (Date.now() - exportStartTime) / 1000; // in seconds
        let estimatedTimeRemainingDetails = '';
        if (progress > 1 && elapsedTime > 1) {
            const totalTime = elapsedTime / (progress / 100);
            const remainingTimeSeconds = Math.round(totalTime - elapsedTime);
            if (remainingTimeSeconds > 0 && isFinite(remainingTimeSeconds)) {
              const minutes = Math.floor(remainingTimeSeconds / 60);
              const seconds = remainingTimeSeconds % 60;
              estimatedTimeRemainingDetails = `預計剩餘 ${minutes}分 ${seconds.toString().padStart(2, '0')}秒`;
            }
        }

        setExportProgress({ 
          message: `經紀人趕工中...`, 
          progress,
          details: estimatedTimeRemainingDetails
        });

        // --- Start Drawing on Canvas ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.filter = 'blur(16px) brightness(0.7)';
        ctx.drawImage(bgImage, -20 * scaleFactor, -20 * scaleFactor, canvas.width + 40 * scaleFactor, canvas.height + 40 * scaleFactor);
        ctx.restore();

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const lyricIdx = timedLyrics.findIndex(l => currentPlaybackTime >= l.startTime && currentPlaybackTime < l.endTime);
        
        let canvasCurrentIndex = -1;
        if (lyricIdx !== -1) {
            canvasCurrentIndex = lyricIdx + 2; // Adjust for dummy lyrics at start of lyricsToRender
        }

        const currentLyricObj = lyricsToRender[canvasCurrentIndex];

        // Draw only the current active lyric, centered
        if (currentLyricObj && currentLyricObj.text !== '') { // Don't draw empty dummy lyrics
            const style = getLyricStyle(canvasCurrentIndex, canvasCurrentIndex, exportFontSize, fontWeight, exportStrokeWidth, strokeColor); 
            
            ctx.font = style.font;
            ctx.textAlign = includeAlbumArt ? 'left' : 'center';

            // Apply stroke first if width > 0
            if (exportStrokeWidth > 0) {
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = exportStrokeWidth;
                ctx.shadowColor = 'rgba(0,0,0,0)'; // Disable shadow for stroke
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                const x = includeAlbumArt ? 60 * scaleFactor : canvas.width / 2;
                const y = canvas.height / 2;

                ctx.strokeText(currentLyricObj.text, x, y);
            }

            // Apply fill (text color)
            ctx.fillStyle = style.color;
            ctx.globalAlpha = style.opacity as number;
            ctx.shadowColor = style.textShadow.split(' ')[2] || 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = parseFloat(style.textShadow.split(' ')[1]) || 5;
            ctx.shadowOffsetX = 2 * scaleFactor;
            ctx.shadowOffsetY = 2 * scaleFactor;
            
            const x = includeAlbumArt ? 60 * scaleFactor : canvas.width / 2;
            const y = canvas.height / 2;

            ctx.fillText(currentLyricObj.text, x, y);
            
            ctx.globalAlpha = 1; // Reset alpha
            ctx.shadowBlur = 0; // Reset shadow
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        if (includeAlbumArt) {
            const leftColWidth = canvas.width * (3 / 5);
            const rightColWidth = canvas.width * (2 / 5);
    
            const albumArtSize = canvas.height * 0.38;
            const albumX = leftColWidth + (rightColWidth - albumArtSize) / 2;
            const albumY = (canvas.height - albumArtSize) / 2 - (30 * scaleFactor);
    
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 20 * scaleFactor;
            ctx.shadowOffsetX = 5 * scaleFactor;
            ctx.shadowOffsetY = 10 * scaleFactor;
            ctx.drawImage(albumImage, albumX, albumY, albumArtSize, albumArtSize);
            ctx.restore();
    
            ctx.fillStyle = theme.info;
            ctx.textAlign = 'center';
            ctx.font = `${fontWeight} ${24 * scaleFactor}px ${fontFamily}`;
            ctx.fillText(songTitle, leftColWidth + rightColWidth / 2, albumY + albumArtSize + (40 * scaleFactor), rightColWidth * 0.9);
            
            ctx.fillStyle = theme.subInfo;
            ctx.font = `${fontWeight} ${20 * scaleFactor}px ${fontFamily}`; // Ensure font weight applies to info text
            ctx.fillText(artistName, leftColWidth + rightColWidth / 2, albumY + albumArtSize + (70 * scaleFactor), rightColWidth * 0.9);
        }

        // --- End Drawing ---
        animationFrameId = requestAnimationFrame(drawFrame);
      };
      animationFrameId = requestAnimationFrame(drawFrame);

    } catch (error) {
      console.error("影片匯出失敗:", error);
      alert('影片匯出失敗！可能因為無法載入圖片或您的瀏覽器不支援此功能。');
      setExportProgress(null);
    }
  };
  
  const durationValue = audioRef.current?.duration || 0;
  const currentTheme = colorThemes[colorTheme];

  return (
    <>
      {exportProgress && <Loader message={exportProgress.message} progress={exportProgress.progress} details={exportProgress.details} onCancel={handleCancelExport} />}
      <div className="w-full max-w-5xl mx-auto">
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setCurrentTime(0)} />
        
        {/* Video Preview Area */}
        <div className="w-full aspect-video bg-gray-900 rounded-xl shadow-2xl ring-1 ring-white/10 relative overflow-hidden mb-4">
          <img src={imageUrl} alt="背景" className="absolute inset-0 w-full h-full object-cover z-0 filter blur-xl scale-110" />
          <div className="absolute inset-0 bg-black/40" />
          
           <div className="relative z-10 w-full h-full flex p-4 sm:p-8 items-center">
              {/* Lyrics Column */}
              <div className={`h-full flex flex-col justify-center overflow-hidden transition-all duration-500 ease-in-out ${includeAlbumArt ? 'w-3/5 items-start' : 'w-full items-center'}`}>
                <div 
                    ref={lyricsContainerRef} 
                    className={`relative flex flex-col justify-center items-center h-full w-full transition-opacity duration-500 ${hasPlaybackStarted ? 'opacity-100' : 'opacity-0'}`}
                >
                    {lyricsToRender[currentIndex] && lyricsToRender[currentIndex].text !== '' && (
                        <p
                            key={currentIndex} // Key changes to force re-render for smooth transitions on text change
                            ref={el => { lyricRefs.current[currentIndex] = el; }}
                            className={`absolute px-2 py-6 tracking-wide leading-relaxed whitespace-nowrap text-center `}
                            style={getLyricStyle(currentIndex)}
                        >
                            {lyricsToRender[currentIndex].text || '\u00A0'}
                        </p>
                    )}
                </div>
              </div>

              {/* Album Art Column (Conditional) */}
               {includeAlbumArt && (
                  <div className="w-2/5 h-full flex flex-col justify-center items-center pl-4">
                    <img src={imageUrl} alt="專輯封面" className="w-full max-w-[280px] aspect-square object-cover bg-black/20 rounded-xl shadow-2xl ring-1 ring-white/10" />
                    <div className="text-center mt-4 p-2 w-full max-w-[280px]">
                        <p className="font-bold text-lg truncate" title={songTitle} style={{ color: currentTheme.info }}>{songTitle}</p>
                        <p className="truncate" title={artistName} style={{ color: currentTheme.subInfo }}>{artistName}</p>
                    </div>
                  </div>
               )}
            </div>
        </div>

        {/* Controls Area */}
        <div className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
          <div className="w-full flex items-center gap-4">
            <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={durationValue}
              value={currentTime}
              onChange={handleTimelineChange}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#a6a6a6]"
            />
            <span className="text-white text-sm font-mono">{formatTime(durationValue)}</span>
          </div>
          <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
              <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm sm:text-base">
                  <PrevIcon className="w-6 h-6" />
                  返回
              </button>
              <button onClick={handlePlayPause} className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform">
                  {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
                {/* Animation style dropdown removed as it's not applicable to the new single-lyric display */}
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-size" className="text-xs">大小</label>
                    <input 
                        id="font-size"
                        type="number"
                        min="16"
                        max="120"
                        step="1"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-20 px-2 py-1 bg-gray-900/50 border border-gray-600 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-gray-500 text-center"
                    />
                </div>
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-family" className="text-xs">字體</label>
                    <select
                        id="font-family"
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                        {fontOptions.map(opt => (
                            <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.name}</option>
                        ))}
                    </select>
                </div>
                {/* New: Font Weight */}
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-weight" className="text-xs">粗細</label>
                    <select
                        id="font-weight"
                        value={fontWeight}
                        onChange={(e) => setFontWeight(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                        {fontWeights.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.name}</option>
                        ))}
                    </select>
                </div>
                {/* New: Stroke Width */}
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="stroke-width" className="text-xs">描邊寬度</label>
                    <input
                        id="stroke-width"
                        type="number"
                        min="0"
                        max="10"
                        step="1"
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-gray-900/50 border border-gray-600 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-gray-500 text-center"
                    />
                </div>
                {/* New: Stroke Color */}
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="stroke-color" className="text-xs">描邊顏色</label>
                    <input
                        id="stroke-color"
                        type="color"
                        value={strokeColor}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        className="w-12 h-8 p-0 border-none rounded-md cursor-pointer overflow-hidden"
                    />
                </div>
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="color-theme" className="text-xs">主題</label>
                    <select
                        id="color-theme"
                        value={colorTheme}
                        onChange={(e) => setColorTheme(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                        {Object.entries(colorThemes).map(([key, theme]) => (
                            <option key={key} value={key}>{theme.name}</option>
                        ))}
                    </select>
                </div>
                 <div className="flex items-center gap-2 text-white">
                    <label htmlFor="resolution" className="text-xs">解析度</label>
                    <select
                        id="resolution"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                        <option value="720p">720p (1280x720)</option>
                        <option value="1080p">1080p (1920x1080)</option>
                    </select>
                </div>
                 <div className="flex items-center gap-2 text-white">
                    <input
                        id="include-album-art"
                        type="checkbox"
                        checked={includeAlbumArt}
                        onChange={(e) => setIncludeAlbumArt(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-900/50 border-gray-600 text-[#a6a6a6] focus:ring-[#a6a6a6] focus:ring-offset-gray-800"
                    />
                    <label htmlFor="include-album-art" className="text-xs cursor-pointer">包含封面</label>
                </div>
                <button onClick={handleExportSrt} className="px-3 py-2 text-sm bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition">
                    導出 SRT
                </button>
                <button onClick={handleExportVideo} className="px-3 py-2 text-sm bg-[#a6a6a6] text-gray-900 font-semibold rounded-lg hover:bg-[#999999] border border-white/50 transition">
                    導出影片
                </button>
              </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">注意：影片匯出在您的瀏覽器中進行，過程可能需要數分鐘且消耗大量資源。建議使用電腦操作，並避免匯出過長的影片。</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoPlayer;
