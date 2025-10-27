import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';
import KaraokeLyric from './KaraokeLyric';
import EyeIcon from './icons/EyeIcon';
import EyeSlashIcon from './icons/EyeSlashIcon';

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

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress?: number; details?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [colorTheme, setColorTheme] = useState('light');
  const [resolution, setResolution] = useState('720p');
  const [animationStyle, setAnimationStyle] = useState<'scroll' | 'karaoke'>('scroll');
  const [showInfo, setShowInfo] = useState(true);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const isExportCancelled = useRef(false);
  const ffmpegRef = useRef<any>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

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
      if (isRecording) {
        handleStopRecording();
      }
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
  }, [isRecording]);

  const scrollCurrentIndex = useMemo(() => {
    if (isEnded) return timedLyrics.length + 2;
    
    let activeIndex = timedLyrics.findIndex(
      lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime
    );
  
    if (activeIndex === -1) {
      if (timedLyrics.length > 0 && currentTime < timedLyrics[0].startTime) {
        activeIndex = -1; // Before the first lyric
      } else {
        activeIndex = timedLyrics.findIndex(l => l.startTime > currentTime) - 1;
      }
    }
    return activeIndex + 2; // Offset for dummy lyrics
  }, [currentTime, timedLyrics, isEnded]);

  const currentKaraokeLyric = useMemo(() => {
    return timedLyrics.find(lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime);
  }, [currentTime, timedLyrics]);


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

  const handleStartRecording = async () => {
    if (!previewRef.current) return;
    if (!('captureStream' in previewRef.current)) {
      alert('您的瀏覽器不支援直接元素錄製。請嘗試使用 Chrome 或 Firefox。');
      return;
    }
    isExportCancelled.current = false;
    recordedChunksRef.current = [];
    const videoStream = (previewRef.current as any).captureStream(30);
    const audio = audioRef.current;
    if (!audio) return;
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
    }
    
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const sourceNode = audioContext.createMediaElementSource(audio);
    const destNode = audioContext.createMediaStreamDestination();
    sourceNode.connect(destNode);
    sourceNode.connect(audioContext.destination);
    const audioTrack = destNode.stream.getAudioTracks()[0];
    
    const combinedStream = new MediaStream([videoStream.getVideoTracks()[0], audioTrack]);
    mediaStreamRef.current = combinedStream;

    mediaRecorderRef.current = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm; codecs=vp9,opus',
    });

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();

      setExportProgress({ message: '錄製完成，正在轉換為 MP4...', progress: 0, details: '這個過程通常很快。' });
      
      try {
        const recordedBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const ffmpeg = createFFmpeg({
            log: false,
            corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.0/dist/ffmpeg-core.js',
        });
        ffmpegRef.current = ffmpeg;
        
        await ffmpeg.load();
        if (isExportCancelled.current) return;

        setExportProgress(prev => ({ ...prev, message: '正在寫入檔案...' }));
        ffmpeg.FS('writeFile', 'input.webm', await fetchFile(recordedBlob));
        if (isExportCancelled.current) return;

        setExportProgress(prev => ({ ...prev, message: '正在快速轉換...', progress: 50 }));
        await ffmpeg.run('-i', 'input.webm', '-c', 'copy', 'output.mp4');
        if (isExportCancelled.current) return;

        setExportProgress(prev => ({ ...prev, message: '正在準備下載...', progress: 100 }));
        const data = ffmpeg.FS('readFile', 'output.mp4');
        
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${songTitle || 'lyric_video_record'}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        ffmpeg.FS('unlink', 'input.webm');
        ffmpeg.FS('unlink', 'output.mp4');

      } catch (error) {
        console.error('MP4 轉換失敗:', error);
        if (!isExportCancelled.current) {
            alert('影片轉換為 MP4 失敗。請檢查主控台以獲取詳細資訊。');
        }
      } finally {
        setExportProgress(null);
        ffmpegRef.current = null;
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsEnded(false);
    audio.play();
    setIsPlaying(true);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if(audioRef.current) {
      audioRef.current.pause();
    }
    setIsRecording(false);
    setIsPlaying(false);
  };
  
  const handleCancelExport = () => {
    isExportCancelled.current = true;
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.exit();
      } catch (e) {
        console.warn("Could not exit ffmpeg", e);
      }
      ffmpegRef.current = null;
    }
    setExportProgress(null);
  };
  
  const handleExportVideo = async () => {
    isExportCancelled.current = false;
    setExportProgress({ message: '正在初始化 FFmpeg...', progress: 0, details: '這可能需要一些時間。' });

    try {
        const ffmpeg = createFFmpeg({
            log: true,
            corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.0/dist/ffmpeg-core.js',
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
                                progress: Math.min(100, progress),
                                details: message,
                            }));
                        }
                    }
                } catch(e) {
                    console.error("Error parsing ffmpeg progress:", e);
                }
            }
        });

        await ffmpeg.load();
        if (isExportCancelled.current) return;

        setExportProgress({ message: '正在下載媒體檔案...', progress: 0 });

        const srtContent = generateSrtContent();
        ffmpeg.FS('writeFile', 'lyrics.srt', srtContent);
        
        const imageBlob = await fetch(imageUrl).then(r => r.blob());
        const imageExtension = imageBlob.type.split('/')[1] || 'jpg';
        const imageName = `background.${imageExtension}`;
        ffmpeg.FS('writeFile', imageName, await fetchFile(imageBlob));

        const audioBlob = await fetch(audioUrl).then(r => r.blob());
        const audioExtension = audioBlob.type.split('/')[1] || 'mp3';
        const audioName = `audio.${audioExtension}`;
        ffmpeg.FS('writeFile', audioName, await fetchFile(audioBlob));

        if (isExportCancelled.current) return;
        setExportProgress({ message: '正在合成影片...', progress: 0, details: '這個過程將會持續幾分鐘。' });

        const { width, height } = resolutions[resolution];
        const videoFileName = `${songTitle || 'lyric_video'}.mp4`;
        
        const filterComplex = `
        [0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[bg];
        [bg]drawtext=
        fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:
        textfile=lyrics.srt:
        fontsize=${fontSize}:
        fontcolor=${colorThemes[colorTheme].active}:
        box=1:
        boxcolor=black@0.5:
        boxborderw=10:
        x=(w-text_w)/2:
        y=(h-text_h)/2
        `.replace(/\s+/g, ' '); // remove newlines and extra spaces

        await ffmpeg.run(
            '-i', imageName,
            '-i', audioName,
            '-vf', filterComplex,
            '-c:a', 'aac',
            '-b:a', '192k',
            '-c:v', 'libx242',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-t', audioRef.current?.duration.toString() || '0',
            videoFileName
        );
        
        if (isExportCancelled.current) return;
        
        setExportProgress({ message: '正在完成匯出...', progress: 100 });

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
        
        ffmpeg.FS('unlink', 'lyrics.srt');
        ffmpeg.FS('unlink', imageName);
        ffmpeg.FS('unlink', audioName);
        ffmpeg.FS('unlink', videoFileName);

    } catch (error) {
        console.error('匯出失敗:', error);
        if (!isExportCancelled.current) {
          alert('影片匯出失敗。請檢查主控台以獲取詳細資訊。');
        }
    } finally {
        setExportProgress(null);
        ffmpegRef.current = null;
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
            <div className={`absolute inset-0 bg-black transition-opacity duration-500 ${animationStyle === 'karaoke' && !showInfo ? 'opacity-50' : 'opacity-70'}`}></div>

            {animationStyle === 'scroll' ? (
                <div className="w-full h-full flex items-center justify-center p-8 gap-12">
                    {/* Left: Spinning Disc & Info */}
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

                    {/* Right: Lyrics Scroller */}
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
                                {lyric.text || '...'}
                                </p>
                            );
                        })}
                        </div>
                    </div>
                </div>
            ) : ( // Karaoke style
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
                    <div className="w-full max-w-4xl">
                        {currentKaraokeLyric && (
                            <KaraokeLyric
                                key={currentKaraokeLyric.startTime}
                                text={currentKaraokeLyric.text}
                                startTime={currentKaraokeLyric.startTime}
                                endTime={currentKaraokeLyric.endTime}
                                currentTime={currentTime}
                                isPlaying={isPlaying}
                                style={{ fontSize: `${fontSize}px`, fontFamily }}
                                activeColor={themeColors.active}
                                inactiveColor={themeColors.inactive2}
                            />
                        )}
                    </div>
                </div>
            )}
            <div className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/50 to-transparent p-4 flex items-center gap-4 transition-opacity duration-300 ${isRecording ? 'opacity-100' : ''}`}>
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-red-400">正在錄製...</span>
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
                />
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 font-mono">{formatTime(currentTime)}</span>
                    <button onClick={handlePlayPause} className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform disabled:opacity-50" disabled={isRecording}>
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
                    onChange={(e) => setAnimationStyle(e.target.value as 'scroll' | 'karaoke')}
                    className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                  >
                    <option value="scroll">垂直滾動</option>
                    <option value="karaoke">卡拉OK</option>
                  </select>
              </div>
              {animationStyle === 'karaoke' && (
                 <div className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                    <label htmlFor="show-info" className="text-sm text-gray-300">顯示歌曲資訊</label>
                    <button onClick={() => setShowInfo(!showInfo)} className="p-1 rounded-full text-gray-300 hover:bg-gray-600">
                      {showInfo ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                    </button>
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
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={!!exportProgress}
                  className={`w-full text-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium transition-colors ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600 disabled:opacity-50'
                  }`}
                >
                  {isRecording ? '停止錄製' : '即時錄製 (MP4)'}
                </button>
                <p className="text-xs text-gray-500 px-1">即時錄製預覽畫面中的動畫，快速生成通用的 MP4 影片。</p>
              </div>
               <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-400 pt-2">高品質匯出</h4>
                <select
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                >
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (Full HD)</option>
                </select>
                 <button
                  onClick={handleExportVideo}
                  disabled={!!exportProgress || isRecording}
                  className="w-full text-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  高品質匯出 (MP4)
                </button>
                 <p className="text-xs text-gray-500 px-1">離線合成高畫質 MP4，不受播放效能影響，但速度較慢。</p>
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