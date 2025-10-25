import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';

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
];

const resolutions: { [key: string]: { width: number; height: number } } = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

const colorThemes: { [key: string]: { name: string; active: string; inactive1: string; inactive2: string; info: string; subInfo: string; } } = {
  light: {
    name: '明亮',
    active: '#FFFFFF',
    inactive1: '#E5E7EB',
    inactive2: '#D1D5DB',
    info: '#FFFFFF',
    subInfo: '#E5E7EB',
  },
  dark: {
    name: '深邃',
    active: '#1F2937',
    inactive1: '#4B5563',
    inactive2: '#6B7280',
    info: '#1F2937',
    subInfo: '#4B5563',
  },
  colorized: {
    name: '多彩',
    active: '#FBBF24', // Amber 400
    inactive1: '#FFFFFF',
    inactive2: '#E5E7EB',
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
  const [colorTheme, setColorTheme] = useState('light');
  const [resolution, setResolution] = useState('720p');
  const [includeAlbumArt, setIncludeAlbumArt] = useState(true);
  const [animationStyle, setAnimationStyle] = useState('disc'); // 'disc' or 'vertical'
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const isExportCancelled = useRef(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const lyricsToRender = useMemo(() => {
    if (!timedLyrics || timedLyrics.length === 0) return [];
    const firstStartTime = timedLyrics[0].startTime ?? 0;
    // Add dummy lyrics at the start and end to allow scrolling to the first and last real lyrics
    return [
      { text: '', startTime: -2, endTime: -1 }, 
      { text: '', startTime: -1, endTime: firstStartTime },
      ...timedLyrics,
      { text: '', startTime: 99999, endTime: 999999 },
      { text: '', startTime: 999999, endTime: 9999999 },
    ];
  }, [timedLyrics]);


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const timeUpdateHandler = () => setCurrentTime(audio.currentTime);
    const endedHandler = () => {
        setIsPlaying(false);
        setIsEnded(true);
    };

    audio.addEventListener('timeupdate', timeUpdateHandler);
    audio.addEventListener('ended', endedHandler);

    return () => {
      audio.removeEventListener('timeupdate', timeUpdateHandler);
      audio.removeEventListener('ended', endedHandler);
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
    if (isEnded) {
      return timedLyrics.length + 2;
    }
    
    // If playback hasn't started (paused at time 0), point to the dummy lyric before the first real one.
    if (currentTime === 0 && !isPlaying) {
      return 1;
    }
    
    const index = timedLyrics.findIndex(
      lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime
    );
  
    if (index !== -1) {
      return index + 2; // A lyric is active, point to it.
    }
  
    // If no lyric is active, check if we're past the end of the song.
    if (timedLyrics.length > 0 && currentTime >= timedLyrics[timedLyrics.length - 1].endTime) {
      return timedLyrics.length + 2; // Point to the dummy lyric *after* the last real one.
    }
  
    // Otherwise, we're before the first lyric.
    return 1;
  }, [currentTime, timedLyrics, isPlaying, isEnded]);


  useEffect(() => {
    if (currentIndex !== -1 && lyricsContainerRef.current && lyricRefs.current[currentIndex]) {
        const container = lyricsContainerRef.current;
        const activeLyricElement = lyricRefs.current[currentIndex]!;
        const newTransform = `translateY(${container.offsetHeight / 2 - activeLyricElement.offsetTop - activeLyricElement.offsetHeight / 2}px)`;
        container.style.transform = newTransform;
    }
  }, [currentIndex, fontSize, includeAlbumArt]);


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
    // The recording loop will see this flag and stop itself.
  };

  const getLyricStyle = (index: number, currentIdx?: number, baseFontSize: number = fontSize) => {
    const activeIndex = currentIdx !== undefined ? currentIdx : currentIndex;
    const distance = Math.abs(index - activeIndex);
    const rotation = animationStyle === 'disc' ? (activeIndex - index) * 10 : 0;
    const theme = colorThemes[colorTheme];

    const style: { 
        transition: string;
        fontFamily: string;
        fontWeight: number;
        textShadow: string;
        opacity: number;
        transform: string;
        transformOrigin: string;
        fontSize: string;
        color: string;
        font: string; // For canvas
    } = {
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out, font-size 0.5s ease-out, color 0.5s ease-out',
        fontFamily: fontFamily,
        fontWeight: 500,
        textShadow: '2px 2px 5px rgba(0,0,0,0.5)',
        transformOrigin: includeAlbumArt ? 'left center' : 'center center',
        opacity: 0,
        transform: 'scale(0.8)',
        fontSize: `${baseFontSize * 0.6}px`,
        color: theme.inactive2,
        font: ''
    };
    
    let calculatedFontSize: number;
    let scale: number;

    switch (distance) {
      case 0: // Active lyric
        calculatedFontSize = baseFontSize;
        scale = 1;
        style.opacity = 1;
        style.color = theme.active;
        style.fontWeight = 700;
        break;
      case 1: // Immediate neighbors
        calculatedFontSize = baseFontSize * 0.8;
        scale = 0.95;
        style.opacity = 0.7;
        style.color = theme.inactive1;
        break;
      case 2: // Further neighbors
        calculatedFontSize = baseFontSize * 0.7;
        scale = 0.9;
        style.opacity = 0.4;
        style.color = theme.inactive2;
        break;
      default: // Hidden lyrics
        calculatedFontSize = baseFontSize * 0.6;
        scale = 0.8;
        style.opacity = 0;
        style.color = theme.inactive2;
        break;
    }
    
    style.fontSize = `${calculatedFontSize}px`;
    style.transform = `scale(${scale}) rotate(${rotation}deg)`;
    style.font = `${style.fontWeight} ${calculatedFontSize}px ${style.fontFamily}`;

    return style;
  }

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
      const [bgImage, albumImage] = await Promise.all([loadImage(imageUrl), loadImage(imageUrl)]);
      setExportProgress({ message: '資源載入完畢', progress: 10 });
      
      const audio = audioRef.current;
      const wasPlaying = isPlaying;
      if (wasPlaying) handlePlayPause(); // Pause playback before starting

      // --- REFACTORED AUDIO CONTEXT HANDLING ---
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
      // --- END REFACTORED AUDIO CONTEXT HANDLING ---

      const audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      const audioStream = audioDestination.stream;

      const videoStream = canvas.captureStream(30);

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
        // Disconnect the temporary destination node, but keep the context alive
        try {
          audioSource.disconnect(audioDestination);
        } catch (e) {
          console.warn("Could not disconnect audio destination.", e);
        }
        setExportProgress(null);
        if(wasPlaying) audio.play();
      };
      
      let animationFrameId: number;
      audio.currentTime = 0;
      audio.play();
      recorder.start();
      const exportStartTime = Date.now();
      
      const scaleFactor = canvas.height / 720;
      const exportFontSize = fontSize * scaleFactor;
      const lyricLineHeight = exportFontSize * 2.5;
      
      const initialTranslateY = canvas.height / 2 - (2 * lyricLineHeight) - lyricLineHeight / 2;
      let currentCanvasTranslateY = initialTranslateY;

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
        ctx.drawImage(bgImage, -20, -20, canvas.width + 40, canvas.height + 40);
        ctx.restore();

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const lyricIdx = timedLyrics.findIndex(l => currentPlaybackTime >= l.startTime && currentPlaybackTime < l.endTime);
        
        let canvasCurrentIndex;
        if (lyricIdx !== -1) {
            canvasCurrentIndex = lyricIdx + 2;
        } else if (timedLyrics.length > 0 && currentPlaybackTime >= timedLyrics[timedLyrics.length - 1].endTime) {
            canvasCurrentIndex = timedLyrics.length + 2;
        } else {
            canvasCurrentIndex = 1;
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
            ctx.font = `700 ${24 * scaleFactor}px ${fontFamily}`;
            ctx.fillText(songTitle, leftColWidth + rightColWidth / 2, albumY + albumArtSize + (40 * scaleFactor), rightColWidth * 0.9);
            
            ctx.fillStyle = theme.subInfo;
            ctx.font = `500 ${20 * scaleFactor}px ${fontFamily}`;
            ctx.fillText(artistName, leftColWidth + rightColWidth / 2, albumY + albumArtSize + (70 * scaleFactor), rightColWidth * 0.9);

            // --- Lyrics Drawing (with album art) ---
            const targetTranslateY = canvas.height / 2 - (canvasCurrentIndex * lyricLineHeight) - lyricLineHeight / 2;
            currentCanvasTranslateY += (targetTranslateY - currentCanvasTranslateY) * 0.1;

            ctx.save();
            ctx.rect(0, 0, leftColWidth, canvas.height);
            ctx.clip();
            ctx.translate(0, currentCanvasTranslateY);
            ctx.textAlign = 'left';
            
            lyricsToRender.forEach((lyric, index) => {
                const style = getLyricStyle(index, canvasCurrentIndex, exportFontSize);
                ctx.font = style.font;
                ctx.fillStyle = style.color;
                ctx.globalAlpha = style.opacity;

                if (ctx.globalAlpha > 0) {
                    const x = 60 * scaleFactor;
                    const y = index * lyricLineHeight;
                    const transformMatch = style.transform.match(/rotate\(([^)]+)deg\)/);
                    const rotationDegrees = transformMatch ? parseFloat(transformMatch[1]) : 0;
                    const rotationRadians = rotationDegrees * Math.PI / 180;
                    
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(rotationRadians);
                    ctx.fillText(lyric.text, 0, 0);
                    ctx.restore();
                }
            });

            ctx.globalAlpha = 1;
            ctx.restore();
        } else {
             // --- Lyrics Drawing (without album art, centered) ---
            const targetTranslateY = canvas.height / 2 - (canvasCurrentIndex * lyricLineHeight) - lyricLineHeight / 2;
            currentCanvasTranslateY += (targetTranslateY - currentCanvasTranslateY) * 0.1;

            ctx.save();
            ctx.translate(0, currentCanvasTranslateY);
            ctx.textAlign = 'center';
            
            lyricsToRender.forEach((lyric, index) => {
                const style = getLyricStyle(index, canvasCurrentIndex, exportFontSize);
                ctx.font = style.font;
                ctx.fillStyle = style.color;
                ctx.globalAlpha = style.opacity;

                if (ctx.globalAlpha > 0) {
                   const x = canvas.width / 2;
                   const y = index * lyricLineHeight;
                   const transformMatch = style.transform.match(/rotate\(([^)]+)deg\)/);
                   const rotationDegrees = transformMatch ? parseFloat(transformMatch[1]) : 0;
                   const rotationRadians = rotationDegrees * Math.PI / 180;
                   
                   ctx.save();
                   ctx.translate(x, y);
                   ctx.rotate(rotationRadians);
                   ctx.fillText(lyric.text, 0, 0);
                   ctx.restore();
                }
            });

            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // --- Draw Watermark ---
        ctx.save();
        const watermarkPadding = 20 * scaleFactor;
        const watermarkFontSize = 24 * scaleFactor;
        ctx.font = `italic ${watermarkFontSize}px cursive`; // A generic cursive font
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // Semi-transparent white
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 4 * scaleFactor;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('浮水映', canvas.width - watermarkPadding, canvas.height - watermarkPadding);
        ctx.restore();

        // --- End Drawing ---
        animationFrameId = requestAnimationFrame(drawFrame);
      };
      animationFrameId = requestAnimationFrame(drawFrame);

    } catch (error) {
      console.error("Video export failed:", error);
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
          <div 
            className="absolute bottom-4 right-6 z-20 text-white text-opacity-50 font-[cursive] text-2xl select-none pointer-events-none" 
            style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}
          >
            浮水映
          </div>
          
           <div className="relative z-10 w-full h-full flex p-4 sm:p-8 items-center">
              {/* Lyrics Column */}
              <div className={`h-full flex flex-col justify-center overflow-hidden transition-all duration-500 ease-in-out ${includeAlbumArt ? 'w-3/5 items-start' : 'w-full items-center'}`}>
                <div 
                    ref={lyricsContainerRef} 
                    className={`transition-transform duration-500 ease-in-out ${includeAlbumArt ? 'w-full' : 'w-auto'} transition-opacity ${hasPlaybackStarted ? 'opacity-100' : 'opacity-0'}`}
                >
                    {lyricsToRender.map((lyric, index) => (
                        <p
                            key={index}
                            ref={el => { lyricRefs.current[index] = el; }}
                            className={`px-2 py-4 tracking-wide leading-relaxed whitespace-nowrap ${includeAlbumArt ? '' : 'text-center'}`}
                            style={getLyricStyle(index)}
                        >
                            {lyric.text || '\u00A0' /* Non-breaking space for empty/dummy lines */}
                        </p>
                    ))}
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
                  返回編輯
              </button>
              <button onClick={handlePlayPause} className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform">
                  {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="animation-style" className="text-xs">動畫</label>
                    <select
                        id="animation-style"
                        value={animationStyle}
                        onChange={(e) => setAnimationStyle(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                        <option value="disc">圓盤</option>
                        <option value="vertical">垂直</option>
                    </select>
                </div>
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-size" className="text-xs">大小</label>
                    <input
                        id="font-size"
                        type="range"
                        min="24"
                        max="80"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-20 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]"
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