

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
  sunset: {
    name: '日落',
    active: '#FDBA74', // Orange 300
    inactive1: '#FED7AA', // Orange 200
    inactive2: '#FFEDD5', // Orange 100
    info: '#FDBA74',
    subInfo: '#FED7AA',
  },
  ocean: {
    name: '海洋',
    active: '#7DD3FC', // Sky 300
    inactive1: '#BAE6FD', // Sky 200
    inactive2: '#E0F2FE', // Sky 100
    info: '#7DD3FC',
    subInfo: '#BAE6FD',
  },
  neon: {
    name: '霓虹',
    active: '#EC4899', // Pink 500
    inactive1: '#F9A8D4', // Pink 300
    inactive2: '#FBCFE8', // Pink 200
    info: '#EC4899',
    subInfo: '#F9A8D4',
  },
  sakura: {
    name: '櫻花',
    active: '#F9A8D4', // Pink 300
    inactive1: '#FBCFE8', // Pink 200
    inactive2: '#FCE7F3', // Pink 100
    info: '#F9A8D4',
    subInfo: '#FBCFE8',
  },
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress?: number; details?: string } | null>(null);
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
  const [albumArtSize, setAlbumArtSize] = useState(38); // percent of height
  const [albumArtPosition, setAlbumArtPosition] = useState<'left' | 'right'>('right');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const animationFrameIdRef = useRef<number | null>(null);

  const lyricsToRender = useMemo(() => {
    if (!timedLyrics || timedLyrics.length === 0) return [];
    // Add dummy lyrics at the start and end to ensure a 5-line display is always possible
    return [
      { text: '', startTime: -1, endTime: 0 }, // Dummy for pos -2
      { text: '', startTime: -1, endTime: 0 }, // Dummy for pos -1
      ...timedLyrics,
      { text: '', startTime: 99999, endTime: 999999 }, // Dummy for pos +1
      { text: '', startTime: 99999, endTime: 999999 }, // Dummy for pos +2
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
        audioContextRef.current.close().catch(e => console.error(e));
      }
    };
  }, []);
  
  const currentIndex = useMemo(() => {
    const index = timedLyrics.findIndex(
      (lyric) => currentTime >= lyric.startTime && currentTime < lyric.endTime
    );

    if (index !== -1) {
      return index + 2; // +2 for the two dummy lyrics at the start
    }

    if (timedLyrics.length > 0 && currentTime >= timedLyrics[timedLyrics.length - 1].endTime) {
      return timedLyrics.length -1 + 2;
    }

    if (timedLyrics.length > 0 && currentTime < timedLyrics[0].startTime) {
      return 1; // Before the first lyric, so second dummy is "current"
    }

    let lastPassedIndex = -1;
    for (let i = 0; i < timedLyrics.length; i++) {
      if (currentTime >= timedLyrics[i].endTime) {
        lastPassedIndex = i;
      } else {
        break; // Optimization: lyrics are sorted
      }
    }
    if (lastPassedIndex !== -1) {
      return lastPassedIndex + 2;
    }

    return 1; // Default to before the first lyric
  }, [currentTime, timedLyrics]);


  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (!audioContextRef.current) {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = context.createMediaElementSource(audio);
            source.connect(context.destination);
            audioContextRef.current = context;
            mediaElementSourceRef.current = source;
        } catch (e) {
            console.error("Error creating AudioContext:", e);
        }
    }


    if (audio.paused) {
      if (isEnded) {
        audio.currentTime = 0;
        setCurrentTime(0);
        setIsEnded(false);
      }
      audio.play().catch(e => console.error("Error playing audio:", e));
      setIsPlaying(true);
      if (!hasPlaybackStarted) setHasPlaybackStarted(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [isEnded, hasPlaybackStarted]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if(isEnded) setIsEnded(false);
    }
  };

  const handleExport = useCallback(async () => {
    isExportCancelled.current = false;
    setExportProgress({ message: '正在初始化...', progress: undefined });

    const { createFFmpeg, fetchFile } = (window as any).FFmpeg;
    const ffmpeg = createFFmpeg({
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      log: true,
      progress: ({ ratio }) => {
        if (isExportCancelled.current) {
          try { ffmpeg.exit(); } catch(e) {}
          return;
        };
        const encodingProgress = 80 + ratio * 20; // Encoding is final 20%
        setExportProgress({ 
          message: '正在編碼影片...',
          progress: encodingProgress,
          details: `進度: ${(ratio * 100).toFixed(0)}%`
        });
      },
    });

    try {
      await ffmpeg.load();

      setExportProgress({ message: '正在讀取素材...', progress: 0, details: '音訊' });
      ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(audioUrl));
      
      setExportProgress({ message: '正在讀取素材...', progress: 2, details: '圖片' });
      ffmpeg.FS('writeFile', 'background.jpg', await fetchFile(imageUrl));
      
      const res = resolutions[resolution];
      const canvas = document.createElement('canvas');
      canvas.width = res.width;
      canvas.height = res.height;
      const ctx = canvas.getContext('2d')!;
      
      const totalDuration = audioRef.current?.duration || 0;
      const frameRate = 30;
      const totalFrames = Math.ceil(totalDuration * frameRate);

      const bgImage = new Image();
      bgImage.crossOrigin = "anonymous";
      bgImage.src = imageUrl;
      await new Promise((resolve, reject) => {
        bgImage.onload = resolve;
        bgImage.onerror = reject;
      });
      
      const albumImage = includeAlbumArt ? bgImage : null;
      
      const drawFrame = (time: number) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(0,0, canvas.width, canvas.height);
        
        if (albumImage) {
            const artSize = canvas.height * (albumArtSize / 100);
            const margin = artSize * 0.1;
            const x = albumArtPosition === 'right' ? canvas.width - artSize - margin : margin;
            const y = (canvas.height - artSize) / 2;
            ctx.drawImage(albumImage, x, y, artSize, artSize);
        }

        const currentLyricIndex = timedLyrics.findIndex(l => time >= l.startTime && time < l.endTime);
        const theme = colorThemes[colorTheme];
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for(let i = -2; i <= 2; i++) {
            const lyricIndex = currentLyricIndex + i;
            if (lyricIndex < 0 || lyricIndex >= timedLyrics.length) continue;
            
            const lyric = timedLyrics[lyricIndex];
            const yPos = canvas.height / 2 + (i * (fontSize * 1.5));
            
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            if (strokeWidth > 0) {
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth * 2;
                ctx.strokeText(lyric.text, canvas.width / 2, yPos);
            }
            
            if (i === 0) {
                const progress = (time - lyric.startTime) / (lyric.endTime - lyric.startTime);
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
                gradient.addColorStop(0.5 * (1-progress), theme.inactive1);
                gradient.addColorStop(0.5, theme.active);
                gradient.addColorStop(0.5 * (1+progress), theme.active);
                gradient.addColorStop(1, theme.inactive1);

                const textWidth = ctx.measureText(lyric.text).width;
                const gradient2 = ctx.createLinearGradient(
                  (canvas.width - textWidth) / 2, 0,
                  (canvas.width + textWidth) / 2, 0
                );
                gradient2.addColorStop(0, theme.active);
                gradient2.addColorStop(progress, theme.active);
                gradient2.addColorStop(progress + 0.001, theme.inactive1);
                gradient2.addColorStop(1, theme.inactive1);
                ctx.fillStyle = gradient2;

            } else if (i < 0) {
                ctx.fillStyle = theme.inactive2;
            } else {
                ctx.fillStyle = theme.inactive1;
            }
            
            ctx.fillText(lyric.text, canvas.width / 2, yPos);
        }

        ctx.font = `bold ${fontSize * 0.6}px ${fontFamily}`;
        ctx.fillStyle = theme.info;
        ctx.textAlign = 'left';
        ctx.fillText(songTitle, 40, 50);

        ctx.font = `normal ${fontSize * 0.45}px ${fontFamily}`;
        ctx.fillStyle = theme.subInfo;
        ctx.fillText(artistName, 40, 50 + (fontSize * 0.6) + 10);
      };

      setExportProgress({ message: '正在生成影格...', progress: 5, details: `0 / ${totalFrames}` });

      for (let i = 0; i < totalFrames; i++) {
        if (isExportCancelled.current) throw new Error("Export cancelled");
        const time = i / frameRate;
        drawFrame(time);
        const frameData = canvas.toDataURL('image/jpeg', 0.8);
        ffmpeg.FS('writeFile', `frame${i.toString().padStart(5, '0')}.jpg`, await fetchFile(frameData));
        
        // Progress: 5% for loading, 75% for frame generation
        const frameGenProgress = 5 + ((i + 1) / totalFrames) * 75;
        setExportProgress({
            message: '正在生成影格...',
            progress: frameGenProgress,
            details: `${i + 1} / ${totalFrames}`
        });
      }

      setExportProgress({ message: '正在編碼影片...', progress: 80, details: '這可能需要一些時間。' });
      
      await ffmpeg.run(
        '-framerate', `${frameRate}`,
        '-i', 'frame%05d.jpg',
        '-i', 'audio.mp3',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-t', `${totalDuration}`,
        '-y',
        'output.mp4'
      );
      
      setExportProgress({ message: '正在準備下載...', progress: 100 });

      const data = ffmpeg.FS('readFile', 'output.mp4');
      const videoBlobUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

      const link = document.createElement('a');
      link.href = videoBlobUrl;
      link.download = `${songTitle} - ${artistName} (Lyrics).mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(videoBlobUrl);

      setExportProgress({ message: '匯出完成！', progress: 100 });
      setTimeout(() => setExportProgress(null), 3000);

    } catch (error) {
      console.error(error);
      if ((error as Error)?.message !== "Export cancelled") {
        alert(`匯出時發生錯誤: ${error}`);
      }
      setExportProgress(null);
    } finally {
      try { ffmpeg.exit(); } catch(e) {}
    }
  }, [
    audioUrl, imageUrl, timedLyrics, fontSize, fontFamily, fontWeight, 
    strokeColor, strokeWidth, colorTheme, resolution, includeAlbumArt,
    albumArtSize, albumArtPosition, songTitle, artistName
  ]);

  const formatTime = (seconds: number) => {
    const totalDuration = audioRef.current?.duration || 0;
    if (isNaN(seconds) || totalDuration === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTheme = colorThemes[colorTheme];

  const renderLyricLine = (lyric: TimedLyric, position: -2 | -1 | 0 | 1 | 2) => {
    let opacity = 0;
    let color = '';
    let scale = 1;
    let yOffset = 0;
    let isCurrent = false;

    switch (position) {
      case -2:
        opacity = 0.2; color = currentTheme.inactive2; scale = 0.9; yOffset = -fontSize * 3;
        break;
      case -1:
        opacity = 0.5; color = currentTheme.inactive2; scale = 0.95; yOffset = -fontSize * 1.5;
        break;
      case 0:
        opacity = 1.0; color = currentTheme.active; scale = 1.0; yOffset = 0; isCurrent = true;
        break;
      case 1:
        opacity = 0.8; color = currentTheme.inactive1; scale = 0.95; yOffset = fontSize * 1.5;
        break;
      case 2:
        opacity = 0.4; color = currentTheme.inactive1; scale = 0.9; yOffset = fontSize * 3;
        break;
    }

    const duration = lyric.endTime - lyric.startTime;
    const progress = (duration > 0) ? Math.max(0, Math.min(1, (currentTime - lyric.startTime) / duration)) : 1;

    const textShadow = strokeWidth > 0 ? `${strokeColor} ${strokeWidth}px ${strokeWidth}px 0px, ${strokeColor} ${strokeWidth}px -${strokeWidth}px 0px, ${strokeColor} -${strokeWidth}px ${strokeWidth}px 0px, ${strokeColor} -${strokeWidth}px -${strokeWidth}px 0px, ${strokeColor} 0px ${strokeWidth}px 0px, ${strokeColor} 0px -${strokeWidth}px 0px, ${strokeColor} -${strokeWidth}px 0px 0px, ${strokeColor} ${strokeWidth}px 0px 0px` : 'none';

    return (
        <p
          key={`${lyric.startTime}-${position}`}
          className="text-center transition-all duration-500 ease-in-out whitespace-pre-wrap"
          style={{
            fontSize: `${fontSize * scale}px`,
            fontFamily: fontFamily,
            fontWeight: fontWeight,
            color: isCurrent ? 'transparent' : color,
            opacity: lyric.text ? opacity : 0,
            transform: `translateY(${yOffset}px)`,
            position: 'absolute',
            width: '100%',
            left: 0,
            textShadow: textShadow,
          }}
        >
          {isCurrent ? (
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r"
              style={{
                backgroundImage: `linear-gradient(to right, ${currentTheme.active}, ${currentTheme.active} ${progress * 100}%, ${currentTheme.inactive1} ${progress * 100}%)`,
              }}
            >
              {lyric.text}
            </span>
          ) : (
            lyric.text
          )}
        </p>
    );
  };
  

  const resolutionStyle = resolutions[resolution];
  const aspectRatio = resolutionStyle.width / resolutionStyle.height;

  return (
    <>
      {exportProgress && (
        <Loader 
          message={exportProgress.message} 
          progress={exportProgress.progress} 
          details={exportProgress.details} 
          onCancel={() => {
            isExportCancelled.current = true;
            setExportProgress(null);
          }}
        />
      )}
      <div className="w-full max-w-screen-2xl mx-auto h-[90vh] flex flex-col lg:flex-row gap-8 items-start p-4">
        <div className="flex-grow w-full h-full flex flex-col items-center justify-center">
            {/* Player Preview */}
            <div className="w-full relative shadow-2xl rounded-lg overflow-hidden border border-gray-700 bg-black" style={{ aspectRatio: aspectRatio }}>
              <img src={imageUrl} alt="Background" className="absolute inset-0 w-full h-full object-cover filter blur-sm brightness-75" />
              <div className="absolute inset-0 bg-black/30"></div>
              
              {includeAlbumArt && (
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 transition-all duration-300`} 
                  style={{ 
                    height: `${albumArtSize}%`, 
                    aspectRatio: 1, 
                    left: albumArtPosition === 'left' ? `${albumArtSize * 0.1}%` : undefined,
                    right: albumArtPosition === 'right' ? `${albumArtSize * 0.1}%` : undefined,
                  }}
                >
                  <img src={imageUrl} alt="Album Art" className="w-full h-full object-cover rounded-lg shadow-lg" />
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <div className="relative w-11/12 h-full flex items-center justify-center">
                      {[-2, -1, 0, 1, 2].map(pos => {
                          const lyric = lyricsToRender[currentIndex + pos];
                          return lyric ? renderLyricLine(lyric, pos as any) : null;
                      })}
                  </div>
              </div>

              <div className="absolute top-0 left-0 p-8 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                <h2 className="font-bold" style={{ fontSize: fontSize * 0.6, fontFamily, color: currentTheme.info }}>{songTitle}</h2>
                <h3 style={{ fontSize: fontSize * 0.45, fontFamily, color: currentTheme.subInfo, opacity: 0.9 }}>{artistName}</h3>
              </div>
              
              {!hasPlaybackStarted && (
                <div 
                  className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer group"
                  onClick={handlePlayPause}
                >
                  <div className="bg-white/20 group-hover:bg-white/30 p-6 rounded-full transition-colors">
                    <PlayIcon className="w-16 h-16 text-white" />
                  </div>
                </div>
              )}
            </div>

            <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />
            <div className="w-full mt-4 bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 font-mono w-12 text-center">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={audioRef.current?.duration || 0}
                  step="0.01"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]"
                />
                <span className="text-sm text-gray-400 font-mono w-12 text-center">{formatTime(audioRef.current?.duration || 0)}</span>
              </div>
              <div className="flex items-center justify-center">
                <button 
                  onClick={handlePlayPause} 
                  className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform"
                >
                  {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>
              </div>
            </div>
        </div>
        
        <div className="w-full lg:w-[400px] h-full flex-shrink-0 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">自訂樣式</h3>
             <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors">
              <PrevIcon className="w-5 h-5" />
              返回
            </button>
          </div>
          <div className="space-y-6">
            <details open className="space-y-4">
              <summary className="font-semibold cursor-pointer text-gray-300">字體設定</summary>
              <div>
                <label className="text-sm text-gray-400 block mb-2">字體</label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white focus:ring-gray-500 focus:border-gray-500">
                  {fontOptions.map(f => <option key={f.value} value={f.value} style={{fontFamily: f.value}}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">字重</label>
                <select value={fontWeight} onChange={e => setFontWeight(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white focus:ring-gray-500 focus:border-gray-500">
                  {fontWeights.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">字體大小: {fontSize}px</label>
                <input type="range" min="20" max="100" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" />
              </div>
            </details>
            
            <details className="space-y-4">
              <summary className="font-semibold cursor-pointer text-gray-300">顏色與描邊</summary>
              <div>
                <label className="text-sm text-gray-400 block mb-2">顏色主題</label>
                <div className="grid grid-cols-3 gap-2">
                    {Object.entries(colorThemes).map(([key, theme]) => (
                        <button key={key} onClick={() => setColorTheme(key)} className={`p-2 rounded border-2 transition-colors ${colorTheme === key ? 'border-white bg-gray-700' : 'border-transparent hover:bg-gray-700/50'}`}>
                           <div className="flex items-center justify-center gap-1.5">
                                <div className="w-4 h-4 rounded-full border border-white/20" style={{backgroundColor: theme.active}}></div>
                                <div className="w-4 h-4 rounded-full border border-white/20" style={{backgroundColor: theme.inactive1}}></div>
                           </div>
                           <span className="text-xs mt-1 block text-gray-300">{theme.name}</span>
                        </button>
                    ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">描邊寬度: {strokeWidth}px</label>
                <input type="range" min="0" max="10" step="0.5" value={strokeWidth} onChange={e => setStrokeWidth(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">描邊顏色</label>
                <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="w-full h-10 p-1 bg-gray-900 border border-gray-600 rounded cursor-pointer" />
              </div>
            </details>

            <details className="space-y-4">
                <summary className="font-semibold cursor-pointer text-gray-300">專輯封面</summary>
                <div className="flex items-center justify-between">
                    <label htmlFor="include-art" className="text-sm text-gray-400">顯示專輯封面</label>
                    <button onClick={() => setIncludeAlbumArt(p => !p)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeAlbumArt ? 'bg-[#a6a6a6]' : 'bg-gray-600'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeAlbumArt ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                 {includeAlbumArt && (
                    <>
                    <div>
                        <label className="text-sm text-gray-400 block mb-2">封面大小: {albumArtSize}%</label>
                        <input type="range" min="20" max="60" value={albumArtSize} onChange={e => setAlbumArtSize(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-2">封面位置</label>
                        <div className="flex gap-2">
                           <button onClick={() => setAlbumArtPosition('left')} className={`w-full p-2 rounded border transition-colors ${albumArtPosition === 'left' ? 'bg-gray-600 border-gray-500' : 'bg-gray-900 border-gray-600 hover:bg-gray-700/50'}`}>左側</button>
                           <button onClick={() => setAlbumArtPosition('right')} className={`w-full p-2 rounded border transition-colors ${albumArtPosition === 'right' ? 'bg-gray-600 border-gray-500' : 'bg-gray-900 border-gray-600 hover:bg-gray-700/50'}`}>右側</button>
                        </div>
                    </div>
                    </>
                )}
            </details>

            <details open className="space-y-4">
              <summary className="font-semibold cursor-pointer text-gray-300">匯出設定</summary>
               <div>
                <label className="text-sm text-gray-400 block mb-2">解析度</label>
                <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-white focus:ring-gray-500 focus:border-gray-500">
                  {Object.keys(resolutions).map(r => <option key={r} value={r}>{r} ({resolutions[r].width}x{resolutions[r].height})</option>)}
                </select>
              </div>
              <button
                onClick={handleExport}
                className="w-full flex justify-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                匯出影片
              </button>
              <p className="text-xs text-center text-gray-500">影片匯出在您的瀏覽器本機進行，可能需要較長時間。</p>
            </details>
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #a6a6a6; border-radius: 4px; }
      `}</style>
    </>
  );
};

export default VideoPlayer;