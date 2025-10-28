import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';

// Fix: Declare FFmpeg as a global variable to resolve the "Cannot find name 'FFmpeg'" error. This assumes FFmpeg is loaded via an external script.
declare var FFmpeg: any;
const { createFFmpeg, fetchFile } = FFmpeg;
// @ts-ignore
declare var html2canvas: any;


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
  const [layoutStyle, setLayoutStyle] = useState<'left' | 'right'>('left');
  
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

  const activeLyricIndex = useMemo(() => {
    return timedLyrics.findIndex(
      lyric => delayedCurrentTime >= lyric.startTime && delayedCurrentTime < lyric.endTime
    );
  }, [delayedCurrentTime, timedLyrics]);

  const scrollPositionIndex = useMemo(() => {
    if (isEnded) return timedLyrics.length + 2;

    let lastPassedIndex = -1;
    for (let i = 0; i < timedLyrics.length; i++) {
      if (delayedCurrentTime >= timedLyrics[i].startTime) {
        lastPassedIndex = i;
      } else {
        break;
      }
    }
    
    if (lastPassedIndex === -1) { 
        return 1;
    }
    
    return lastPassedIndex + 2;

  }, [delayedCurrentTime, timedLyrics, isEnded]);


  useEffect(() => {
    if (scrollPositionIndex >= 0 && lyricsContainerRef.current && lyricRefs.current[scrollPositionIndex]) {
        const container = lyricsContainerRef.current;
        const activeLyricElement = lyricRefs.current[scrollPositionIndex]!;
        const parentScroller = container.parentElement;
        if (parentScroller) {
          const newTransform = `translateY(${parentScroller.offsetHeight / 2 - activeLyricElement.offsetTop - activeLyricElement.offsetHeight / 2}px)`;
          container.style.transform = newTransform;
        }
    }
  }, [scrollPositionIndex, fontSize]);


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
        // FFMPEG exit might throw, we can ignore.
        ffmpegRef.current.exit();
      } catch (e) {}
      ffmpegRef.current = null;
    }
    setExportProgress(null);
    setIsPlaying(false);
    setCurrentTime(0);
  };

 const handleStableExport = async () => {
    // Robust compatibility check for required libraries and features
    if (typeof WebAssembly === 'undefined' || typeof html2canvas === 'undefined' || typeof FFmpeg === 'undefined') {
        alert('您的瀏覽器不支援此匯出功能。請嘗試使用最新版本的 Chrome 或 Firefox。');
        return;
    }

    if (!previewRef.current) {
        alert('匯出功能初始化失敗。請刷新頁面再試一次。');
        return;
    }

    isExportCancelled.current = false;
    const originalTime = currentTime;
    const wasPlaying = isPlaying;
    if(wasPlaying) handlePlayPause();

    const FRAME_RATE = 30;
    const audio = audioRef.current!;
    const duration = audio.duration;
    const totalFrames = Math.ceil(duration * FRAME_RATE);

    try {
        setExportProgress({ message: '正在載入匯出引擎...' });
        const ffmpeg = createFFmpeg({
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        });
        ffmpegRef.current = ffmpeg;
        await ffmpeg.load();

        if (isExportCancelled.current) return;

        setExportProgress({ message: '正在準備音訊...' });
        const audioBlob = await fetch(audioUrl).then(r => r.blob());
        ffmpeg.FS('writeFile', 'audio.dat', await fetchFile(audioBlob));

        // Frame-by-frame rendering
        for (let i = 0; i < totalFrames; i++) {
            if (isExportCancelled.current) break;
            const time = i / FRAME_RATE;
            setCurrentTime(time);

            setExportProgress({
                message: '正在渲染影格...',
                progress: (i / totalFrames) * 100,
                details: `第 ${i + 1} / ${totalFrames} 幀`
            });

            // Wait for the next browser paint cycle to ensure the DOM is updated
            await new Promise(resolve => requestAnimationFrame(resolve));

            const canvas = await html2canvas(previewRef.current, { useCORS: true, logging: false });
            const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const frameFileName = `frame-${i.toString().padStart(5, '0')}.jpeg`;
            ffmpeg.FS('writeFile', frameFileName, await fetchFile(frameDataUrl));
        }
        
        if (isExportCancelled.current) return;

        setExportProgress({ message: '正在將影格編碼為影片...', progress: 0 });
        
        ffmpeg.setLogger(({ type, message }) => {
            if (type === 'info' && message.includes('frame=') && message.includes('fps=')) {
                const frameMatch = message.match(/frame=\s*(\d+)/);
                if (frameMatch) {
                    const currentFrame = parseInt(frameMatch[1], 10);
                    const progress = (currentFrame / totalFrames) * 100;
                    if (!isExportCancelled.current) {
                        setExportProgress(prev => ({ ...prev, progress: Math.min(100, progress), details: `已編碼 ${currentFrame} / ${totalFrames} 幀` }));
                    }
                }
            }
        });
        
        await ffmpeg.run(
            '-r', `${FRAME_RATE}`,
            '-i', 'frame-%05d.jpeg',
            '-i', 'audio.dat',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-shortest',
            'output.mp4'
        );
        
        if (isExportCancelled.current) return;

        setExportProgress({ message: '準備下載...', progress: 100 });
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${songTitle || 'lyric_video'}.mp4`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (error: any) {
        console.error('匯出失敗:', error);
        if (!isExportCancelled.current) {
            alert(`影片匯出失敗。請檢查主控台以獲取詳細資訊。\n錯誤: ${error.message || '未知錯誤'}`);
        }
    } finally {
        setExportProgress(null);
        ffmpegRef.current = null;
        setCurrentTime(originalTime);
        if (wasPlaying) handlePlayPause();
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
                crossOrigin="anonymous"
            />
            <div className={`absolute inset-0 bg-black transition-opacity duration-500 opacity-70`}></div>

            <div className={`w-full h-full flex items-center justify-center p-8 gap-12 ${layoutStyle === 'right' ? 'flex-row-reverse' : ''}`}>
                <div className="w-2/5 flex flex-col items-center justify-center flex-shrink-0">
                    <div className="relative w-full aspect-square max-w-sm">
                        <div className={`absolute inset-0 bg-center bg-no-repeat ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ backgroundImage: 'url(https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/vinyl.png)', backgroundSize: 'contain', animationPlayState: isPlaying ? 'running' : 'paused' }}></div>
                        <img src={imageUrl} alt="專輯封面" className="absolute w-[55%] h-[55%] object-cover rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" crossOrigin="anonymous" />
                    </div>
                    <div className="text-center mt-6">
                        <h2 className="text-3xl font-bold truncate" style={{ color: themeColors.info }}>{songTitle}</h2>
                        <p className="text-xl opacity-80" style={{ color: themeColors.subInfo }}>{artistName}</p>
                    </div>
                </div>

                <div className="w-3/5 h-[80%] relative overflow-hidden mask-gradient">
                    <div ref={lyricsContainerRef} className="absolute top-0 left-0 w-full transition-transform duration-500 ease-out">
                    {lyricsToRender.map((lyric, index) => {
                        const isActive = activeLyricIndex !== -1 && (activeLyricIndex + 2 === index);
                        const distance = Math.abs(scrollPositionIndex - index);
                        const isInInterlude = activeLyricIndex === -1;

                        let opacity = 0;
                        if (isInInterlude) {
                            opacity = Math.max(0, 0.15 - distance * 0.05);
                        } else if (isActive) {
                            opacity = 1;
                        } else if (distance < 3) {
                            opacity = Math.max(0, 0.7 - distance * 0.25);
                        }
                        
                        let scale = 1;
                        if (isActive) {
                            scale = 1.05;
                        } else {
                            scale = 1 - (distance * 0.05);
                        }

                        return (
                            <p
                            key={index}
                            ref={(el) => { lyricRefs.current[index] = el; }}
                            className="text-center font-bold py-2"
                            style={{
                                fontSize: `${fontSize}px`,
                                fontFamily,
                                color: isActive ? themeColors.active : themeColors.inactive2,
                                opacity,
                                transform: `scale(${scale})`,
                                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                                transition: 'opacity 0.4s ease, color 0.4s ease, transform 0.4s ease'
                            }}
                            >
                            {lyric.text}
                            </p>
                        );
                    })}
                    </div>
                </div>
            </div>
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

            <div className="space-y-4 border-t border-gray-700 pt-6">
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
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">專輯封面位置</label>
                  <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setLayoutStyle('left')}
                        className={`py-2 rounded-md text-center text-sm border-2 transition-colors ${layoutStyle === 'left' ? 'bg-gray-600 border-gray-500' : 'bg-gray-700 border-transparent hover:bg-gray-600/50'}`}
                      >
                        左側
                      </button>
                      <button
                        onClick={() => setLayoutStyle('right')}
                        className={`py-2 rounded-md text-center text-sm border-2 transition-colors ${layoutStyle === 'right' ? 'bg-gray-600 border-gray-500' : 'bg-gray-700 border-transparent hover:bg-gray-600/50'}`}
                      >
                        右側
                      </button>
                  </div>
              </div>
            </div>
            
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
                  onClick={handleStableExport}
                  disabled={!!exportProgress}
                  className="w-full text-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  穩定匯出 (較慢)
                </button>
                 <p className="text-xs text-gray-500 px-1">採用逐幀渲染技術，品質最高且最穩定，但匯出時間會較長。</p>
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