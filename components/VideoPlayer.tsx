import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';
import KaraokeLyric from './KaraokeLyric';
import EyeIcon from './icons/EyeIcon';
import EyeSlashIcon from './icons/EyeSlashIcon';
import AnimatedLyric from './AnimatedLyric';

// @ts-ignore
const { createFFmpeg, fetchFile } = FFmpeg;

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
    active: '#F3F4F6',
    inactive1: '#9CA3AF',
    inactive2: '#6B7280',
    info: '#FFFFFF',
    subInfo: '#E5E7EB',
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

type AnimationStyle = 'scroll' | 'karaoke' | 'typewriter' | 'fade' | 'bounce';
type ScrollLayoutStyle = 'left' | 'right';

// Added a delay to compensate for potential audio/visual sync discrepancies, preventing lyrics from appearing too early.
const VISUAL_DELAY = 0.08; // 80ms

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress?: number; details?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [colorTheme, setColorTheme] = useState('light');
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('scroll');
  const [scrollLayoutStyle, setScrollLayoutStyle] = useState<ScrollLayoutStyle>('left');
  const [fadeOutEnabled, setFadeOutEnabled] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  
  const isExportCancelled = useRef(false);
  const ffmpegRef = useRef<any>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  const delayedCurrentTime = Math.max(0, currentTime - VISUAL_DELAY);

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
      setCurrentTime(audio.currentTime);
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

  const scrollCurrentIndex = useMemo(() => {
    if (isEnded) return timedLyrics.length + 2;
    
    let activeIndex = timedLyrics.findIndex(
      lyric => delayedCurrentTime >= lyric.startTime && delayedCurrentTime < lyric.endTime
    );
  
    if (activeIndex === -1) {
      if (timedLyrics.length > 0 && delayedCurrentTime < timedLyrics[0].startTime) {
        activeIndex = -1; // Before the first lyric
      } else {
        activeIndex = timedLyrics.findIndex(l => l.startTime > delayedCurrentTime) - 1;
      }
    }
    return activeIndex + 2; // Offset for dummy lyrics
  }, [delayedCurrentTime, timedLyrics, isEnded]);

  const currentLyric = useMemo(() => {
    return timedLyrics.find(lyric => delayedCurrentTime >= lyric.startTime && delayedCurrentTime < lyric.endTime);
  }, [delayedCurrentTime, timedLyrics]);


  useEffect(() => {
    if (animationStyle === 'scroll' && scrollCurrentIndex >= 0 && lyricsContainerRef.current && lyricRefs.current[scrollCurrentIndex]) {
        const container = lyricsContainerRef.current;
        const activeLyricElement = lyricRefs.current[scrollCurrentIndex]!;
        const parentScroller = container.parentElement;
        if (parentScroller) {
          // Adjust the offset to center the lyrics in the parent container
          const newTransform = `translateY(${parentScroller.offsetHeight / 2 - activeLyricElement.offsetTop - activeLyricElement.offsetHeight / 2}px)`;
          container.style.transform = newTransform;
        }
    }
  }, [scrollCurrentIndex, fontSize, animationStyle]);


  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
        audio.pause();
    } else {
        if (audio.ended) {
            audio.currentTime = 0;
            setCurrentTime(0);
            setIsEnded(false);
        }
        audio.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      setIsEnded(false);
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
    a.download = `${songTitle || 'lyrics'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCancelExport = () => {
    isExportCancelled.current = true;
     if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.muted = false;
      audioRef.current.playbackRate = 1;
    }
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.exit();
      } catch (e) {
        console.warn("Could not exit ffmpeg", e);
      }
      ffmpegRef.current = null;
    }
    setExportProgress(null);
    setIsPlaying(false);
  };
  
  const handleRealtimeExport = async () => {
    if (!previewRef.current || !('captureStream' in previewRef.current)) {
      alert('您的瀏覽器不支援此匯出功能。請嘗試使用最新版本的 Chrome 或 Firefox。');
      return;
    }
    
    isExportCancelled.current = false;
    const recordedChunks: Blob[] = [];
    const audio = audioRef.current!;
    let audioContext: AudioContext | null = null;
    let videoStream: MediaStream | null = null;
    let recordProgressInterval: number | null = null;
    
    setExportProgress({ message: '正在準備即時錄製...' });

    try {
        videoStream = (previewRef.current as any).captureStream(30);

        audioContext = new AudioContext();
        const sourceNode = audioContext.createMediaElementSource(audio);
        const destNode = audioContext.createMediaStreamDestination();
        sourceNode.connect(destNode);
        const audioTrack = destNode.stream.getAudioTracks()[0];
        
        const combinedStream = new MediaStream([videoStream.getVideoTracks()[0], audioTrack]);
        const mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm; codecs=vp9,opus',
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };

        const recordingPromise = new Promise<void>((resolve, reject) => {
            // Fix: Wrap `resolve` in an arrow function to match the expected event handler signature for `onstop`.
            mediaRecorder.onstop = () => resolve();
            mediaRecorder.onerror = (event) => reject(new Error(`MediaRecorder error: ${(event as any).error?.message || 'Unknown error'}`));

            const onEnded = () => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
                 if(recordProgressInterval) clearInterval(recordProgressInterval);
                audio.removeEventListener('ended', onEnded);
            };
            audio.addEventListener('ended', onEnded);
        });
        
        mediaRecorder.start();
        audio.muted = true;
        audio.playbackRate = 1.0;
        audio.currentTime = 0;
        await audio.play();
        setIsPlaying(true);
        
        recordProgressInterval = window.setInterval(() => {
            if (audio.duration && !isExportCancelled.current) {
                const progress = (audio.currentTime / audio.duration) * 100;
                setExportProgress({ 
                    message: `即時錄製中...`, 
                    progress: progress,
                    details: '請勿離開此分頁' 
                });
            }
        }, 500);

        await recordingPromise;
        if (isExportCancelled.current) return;

        setExportProgress({ message: '錄製完成，正在轉檔為 MP4...', progress: 0, details: '這可能需要一些時間...' });
        
        const ffmpeg = createFFmpeg({
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.0/dist/ffmpeg-core.js',
        });
        ffmpegRef.current = ffmpeg;

        ffmpeg.setLogger(({ type, message }) => {
            if (type === 'info' && message.startsWith('frame=')) {
                try {
                    const timeMatch = message.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                    if (timeMatch && audioRef.current?.duration) {
                        const timeParts = timeMatch[1].split(/[:.]/);
                        const currentTime = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]) + parseInt(timeParts[3]) / 100;
                        const duration = audioRef.current.duration;
                        const progress = (currentTime / duration) * 100;
                        if (!isExportCancelled.current) {
                            setExportProgress(prev => ({
                                ...prev,
                                message: '正在轉檔為 MP4...',
                                progress: Math.min(100, progress),
                                details: message,
                            }));
                        }
                    }
                } catch(e) { console.error("Error parsing ffmpeg progress:", e); }
            }
        });
        
        await ffmpeg.load();
        if (isExportCancelled.current) return;

        setExportProgress(prev => ({ ...prev, message: '正在寫入檔案...' }));
        const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
        ffmpeg.FS('writeFile', 'input.webm', await fetchFile(recordedBlob));
        if (isExportCancelled.current) return;

        setExportProgress(prev => ({ ...prev, message: '轉換中，請稍候...' }));
        const videoFileName = `${songTitle || 'lyric_video'}.mp4`;
        
        await ffmpeg.run(
          '-i', 'input.webm', 
          '-c:v', 'libx264', 
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          videoFileName
        );
        
        if (isExportCancelled.current) return;

        setExportProgress(prev => ({ ...prev, message: '準備下載...', progress: 100 }));
        const data = ffmpeg.FS('readFile', videoFileName);
        
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = videoFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        ffmpeg.FS('unlink', 'input.webm');
        ffmpeg.FS('unlink', videoFileName);

    } catch (error: any) {
        console.error('匯出失敗:', error);
        if (error.name === 'SecurityError' || (error.message && error.message.toLowerCase().includes('cors'))) {
            alert('影片匯出失敗：無法處理音訊檔。如果使用連結，請確保它是公開的，或嘗試直接上傳檔案。');
        } else if (!isExportCancelled.current) {
            alert(`影片匯出失敗。請檢查主控台以獲取詳細資訊。\n錯誤: ${error.message}`);
        }
    } finally {
        if(recordProgressInterval) clearInterval(recordProgressInterval);
        setExportProgress(null);
        ffmpegRef.current = null;
         if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        audio.muted = false;
        audio.playbackRate = 1.0;
        if (!audio.paused) audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
    }
  };


  const themeColors = colorThemes[colorTheme];

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }
      `}</style>
      
      {exportProgress && <Loader 
        message={exportProgress.message} 
        progress={exportProgress.progress} 
        details={exportProgress.details}
        onCancel={handleCancelExport}
      />}
      
      <div className="flex-grow flex items-stretch">
        {/* Left: Preview */}
        <div className="w-2/3 h-full bg-black relative flex items-center justify-center overflow-hidden" ref={previewRef}>
            <img 
                src={imageUrl} 
                alt="背景" 
                className="absolute inset-0 w-full h-full object-cover transition-all duration-500 blur-md scale-105"
            />
            <div className={`absolute inset-0 bg-black transition-opacity duration-500 ${animationStyle === 'scroll' ? 'opacity-70' : 'opacity-50'}`}></div>

            {animationStyle === 'scroll' ? (
                <div className={`w-full h-full flex items-center justify-center p-8 gap-12 ${scrollLayoutStyle === 'right' ? 'flex-row-reverse' : ''}`}>
                    {/* Left/Right: Spinning Disc & Info */}
                    <div className="w-2/5 flex flex-col items-center justify-center flex-shrink-0">
                        <div className="relative w-full aspect-square max-w-sm">
                            <div className={`absolute inset-0 bg-center bg-no-repeat ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ backgroundImage: 'url(https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/vinyl.png)', backgroundSize: 'contain', animationPlayState: isPlaying ? 'running' : 'paused' }}></div>
                            <img src={imageUrl} alt="專輯封面" className="absolute w-[55%] h-[55%] object-cover rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="text-center mt-6">
                            <h2 className="text-3xl font-bold truncate" style={{ color: themeColors.info }}>{songTitle}</h2>
                            <p className="text-xl opacity-80" style={{ color: themeColors.subInfo }}>{artistName}</p>
                        </div>
                    </div>

                    {/* Right/Left: Lyrics Scroller */}
                    <div className="w-3/5 h-[80%] relative overflow-hidden mask-gradient">
                        <div ref={lyricsContainerRef} className="absolute top-0 left-0 w-full transition-transform duration-500 ease-out">
                        {lyricsToRender.map((lyric, index) => {
                            const distance = Math.abs(scrollCurrentIndex - index);
                            const isActive = scrollCurrentIndex === index;

                            let opacity = 0;
                            if (distance < 3) {
                                opacity = Math.max(0, 1 - distance * 0.4);
                            }
                            
                            let scale = 1;
                            if (isActive) {
                                scale = 1.1;
                            } else {
                                scale = 1 - (distance * 0.05);
                            }

                            return (
                                <p
                                key={index}
                                ref={(el) => { lyricRefs.current[index] = el; }}
                                className="text-center font-bold transition-all duration-500 ease-out py-2"
                                style={{
                                    fontSize: `${fontSize}px`,
                                    fontFamily,
                                    color: isActive ? themeColors.active : (distance === 1 ? themeColors.inactive1 : themeColors.inactive2),
                                    opacity,
                                    transform: `scale(${scale})`,
                                    textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                                }}
                                >
                                {lyric.text}
                                </p>
                            );
                        })}
                        </div>
                    </div>
                </div>
            ) : ( // Karaoke, Typewriter, Fade, Bounce styles
                <div className="w-full h-full flex flex-col items-center justify-center p-8 relative">
                   {showInfo && (
                     <div className="absolute top-8 left-8 flex items-center gap-4 bg-black/30 backdrop-blur-sm p-3 rounded-lg">
                        <img src={imageUrl} alt="專輯封面" className="w-16 h-16 object-cover rounded-md shadow-lg" />
                        <div>
                            <h2 className="text-xl font-bold truncate" style={{color: themeColors.info}}>{songTitle}</h2>
                            <p className="text-md opacity-80" style={{color: themeColors.subInfo}}>{artistName}</p>
                        </div>
                    </div>
                   )}
                    <div className="w-full max-w-4xl relative min-h-[150px]">
                        {animationStyle === 'karaoke' && currentLyric && (
                            <KaraokeLyric
                                key={currentLyric.startTime}
                                text={currentLyric.text}
                                startTime={currentLyric.startTime}
                                endTime={currentLyric.endTime}
                                currentTime={delayedCurrentTime}
                                isPlaying={isPlaying}
                                style={{ fontSize: `${fontSize}px`, fontFamily }}
                                activeColor={themeColors.active}
                                inactiveColor={themeColors.inactive2}
                            />
                        )}
                         {animationStyle !== 'karaoke' && timedLyrics.map(lyric => (
                            <div key={lyric.startTime} className="absolute inset-0 flex items-center justify-center">
                               <AnimatedLyric
                                    text={lyric.text}
                                    startTime={lyric.startTime}
                                    endTime={lyric.endTime}
                                    currentTime={delayedCurrentTime}
                                    isPlaying={isPlaying}
                                    animationType={animationStyle}
                                    fadeOut={animationStyle === 'fade' || (fadeOutEnabled && ['typewriter', 'bounce'].includes(animationStyle))}
                                    style={{ 
                                      fontSize: `${fontSize}px`, 
                                      fontFamily, 
                                      color: themeColors.active,
                                      textShadow: '0 2px 10px rgba(0,0,0,0.7)'
                                    }}
                                />
                            </div>
                         ))}
                    </div>
                </div>
            )}
            {!!exportProgress && exportProgress.message.includes('錄製中') && (
               <div className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/50 to-transparent p-4 flex items-center gap-4`}>
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-red-400">正在錄製...</span>
              </div>
            )}
        </div>

        {/* Right: Controls */}
        <div className="w-1/3 h-full bg-gray-800 p-6 overflow-y-auto flex flex-col">
          <div className="flex-grow space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">播放器設定</h3>
              <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
                <PrevIcon className="w-6 h-6" />
                返回
              </button>
            </div>
            
            {/* Playback Controls */}
            <div className="space-y-3 pt-2">
                <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />
                <input
                    type="range"
                    min={0}
                    max={audioRef.current?.duration || 0}
                    step="0.01"
                    value={currentTime}
                    onChange={handleTimelineChange}
                    className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]"
                    disabled={!!exportProgress}
                />
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 font-mono">{formatTime(currentTime)}</span>
                    <button onClick={handlePlayPause} className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform disabled:opacity-50" disabled={!!exportProgress}>
                        {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                    </button>
                    <span className="text-sm text-gray-400 font-mono">{formatTime(audioRef.current?.duration || 0)}</span>
                </div>
            </div>

             {/* Style Controls */}
            <div className="space-y-4 border-t border-gray-700 pt-6">
               <div>
                  <label htmlFor="animation-style" className="block text-sm font-medium text-gray-300 mb-2">動畫風格</label>
                  <select
                    id="animation-style"
                    value={animationStyle}
                    onChange={(e) => setAnimationStyle(e.target.value as AnimationStyle)}
                    className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                  >
                    <option value="scroll">垂直滾動</option>
                    <option value="karaoke">卡拉OK</option>
                    <option value="typewriter">打字機</option>
                    <option value="fade">淡入淡出</option>
                    <option value="bounce">彈跳</option>
                  </select>
              </div>

              {animationStyle === 'scroll' && (
                 <div className="space-y-2">
                    <label htmlFor="layout-style" className="block text-sm font-medium text-gray-300">版面樣式</label>
                    <select
                      id="layout-style"
                      value={scrollLayoutStyle}
                      onChange={(e) => setScrollLayoutStyle(e.target.value as ScrollLayoutStyle)}
                      className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                    >
                      <option value="left">封面在左</option>
                      <option value="right">封面在右</option>
                    </select>
                 </div>
              )}

              {animationStyle !== 'scroll' && (
                 <div className="space-y-3">
                    <div className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                        <label htmlFor="show-info" className="text-sm text-gray-300">顯示歌曲資訊</label>
                        <button onClick={() => setShowInfo(!showInfo)} className="p-1 rounded-full text-gray-300 hover:bg-gray-600">
                          {showInfo ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                        </button>
                    </div>
                     {['typewriter', 'bounce', 'fade'].includes(animationStyle) && (
                        <div className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                          <label htmlFor="fade-out" className="text-sm text-gray-300">淡出歌詞</label>
                          <button
                              onClick={() => setFadeOutEnabled(!fadeOutEnabled)}
                              disabled={animationStyle === 'fade'}
                              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                                  (animationStyle === 'fade' || fadeOutEnabled) ? 'bg-[#a6a6a6]' : 'bg-gray-600'
                              } ${animationStyle === 'fade' ? 'cursor-not-allowed opacity-70' : ''}`}
                            >
                              <span
                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                  (animationStyle === 'fade' || fadeOutEnabled) ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                          </button>
                        </div>
                     )}
                 </div>
              )}

               <div>
                  <label htmlFor="font-size" className="block text-sm font-medium text-gray-300 mb-2">字體大小 ({fontSize}px)</label>
                  <input
                    type="range"
                    id="font-size"
                    min="16"
                    max="128"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]"
                  />
              </div>
              <div>
                  <label htmlFor="font-family" className="block text-sm font-medium text-gray-300 mb-2">字體</label>
                  <select
                    id="font-family"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                  >
                    {fontOptions.map(font => <option key={font.value} value={font.value}>{font.name}</option>)}
                  </select>
              </div>
               <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">顏色主題</label>
                  <div className="grid grid-cols-3 gap-2">
                      {Object.entries(colorThemes).map(([key, theme]) => (
                          <button
                              key={key}
                              onClick={() => setColorTheme(key)}
                              className={`p-2 rounded-md text-center text-sm border-2 ${colorTheme === key ? 'border-white' : 'border-transparent'}`}
                          >
                              <div className="flex justify-center items-center gap-1 mb-1">
                                <div className="w-4 h-4 rounded-full" style={{backgroundColor: theme.active}}></div>
                                <div className="w-3 h-3 rounded-full opacity-75" style={{backgroundColor: theme.inactive1}}></div>
                                <div className="w-2 h-2 rounded-full opacity-50" style={{backgroundColor: theme.inactive2}}></div>
                              </div>
                              {theme.name}
                          </button>
                      ))}
                  </div>
              </div>
            </div>
            
            {/* Export Controls */}
            <div className="space-y-4 border-t border-gray-700 pt-6">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-400">匯出檔案</h4>
                <button
                    onClick={handleExportSrt}
                    className="w-full text-center py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                    匯出 SRT 歌詞檔
                </button>
              </div>
              <div className="space-y-2">
                 <button
                  onClick={handleRealtimeExport}
                  disabled={!!exportProgress}
                  className="w-full text-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  即時錄製影片 (MP4)
                </button>
                 <p className="text-xs text-gray-500 px-1">以即時速度錄製預覽畫面中的所有動畫效果並匯出為 MP4。錄製時長將與歌曲長度相同。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
       <style>{`
        .mask-gradient {
            mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;
