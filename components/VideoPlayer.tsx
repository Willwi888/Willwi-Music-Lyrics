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

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const isExportCancelled = useRef(false);

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
    const endedHandler = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', timeUpdateHandler);
    audio.addEventListener('ended', endedHandler);

    return () => {
      audio.removeEventListener('timeupdate', timeUpdateHandler);
      audio.removeEventListener('ended', endedHandler);
    };
  }, []);
  
  const currentIndex = useMemo(() => {
    // If playback hasn't started (paused at time 0), no lyric should be active.
    // We'll point to the second dummy lyric, which effectively shows nothing.
    if (currentTime === 0 && !isPlaying) {
      return 1;
    }
    
    const index = timedLyrics.findIndex(
      lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime
    );

    // If a lyric is found, its index in lyricsToRender is index + 2.
    // If not found (index is -1), this will result in 1, pointing to the second dummy lyric.
    return index + 2;
  }, [currentTime, timedLyrics, isPlaying]);

  useEffect(() => {
    if (currentIndex !== -1 && lyricsContainerRef.current && lyricRefs.current[currentIndex]) {
        const container = lyricsContainerRef.current;
        const activeLyricElement = lyricRefs.current[currentIndex]!;
        const newTransform = `translateY(${container.offsetHeight / 2 - activeLyricElement.offsetTop - activeLyricElement.offsetHeight / 2}px)`;
        container.style.transform = newTransform;
    }
  }, [currentIndex, fontSize]);


  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
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

  const handleExportVideo = async () => {
    if (!audioRef.current || !imageUrl) return;
    isExportCancelled.current = false;
    setExportProgress({ message: '正在初始化...', progress: 0 });

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
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

      const audioContext = new AudioContext();
      const audioSource = audioContext.createMediaElementSource(audio);
      const audioDestination = audioContext.createMediaStreamDestination();
      audioSource.connect(audioDestination);
      audioSource.connect(audioContext.destination); // So we can hear it while recording
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
          a.download = `lyric-video.${fileExtension}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        
        // Cleanup
        combinedStream.getTracks().forEach(track => track.stop());
        audioContext.close();
        setExportProgress(null);
        if(wasPlaying) audio.play();
      };
      
      let animationFrameId: number;
      audio.currentTime = 0;
      audio.play();
      recorder.start();
      
      const lyricLineHeight = fontSize * 1.5;
      const initialTranslateY = canvas.height / 2 - (2 * lyricLineHeight) - lyricLineHeight / 2;
      let currentCanvasTranslateY = initialTranslateY;


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
        setExportProgress({ 
          message: `正在錄製影片... (${formatTime(currentPlaybackTime)} / ${formatTime(duration)})`, 
          progress 
        });

        // --- Start Drawing on Canvas ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.filter = 'blur(16px) brightness(0.7)';
        ctx.drawImage(bgImage, -20, -20, canvas.width + 40, canvas.height + 40);
        ctx.restore();

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const leftColWidth = canvas.width * (3 / 5);
        const rightColWidth = canvas.width * (2 / 5);

        const albumArtSize = Math.min(280, rightColWidth * 0.8);
        const albumX = leftColWidth + (rightColWidth - albumArtSize) / 2;
        const albumY = (canvas.height - albumArtSize) / 2 - 30;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(albumImage, albumX, albumY, albumArtSize, albumArtSize);
        ctx.restore();

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = `700 24px ${fontFamily}`;
        ctx.fillText(songTitle, leftColWidth + rightColWidth / 2, albumY + albumArtSize + 40, rightColWidth * 0.9);
        
        ctx.fillStyle = '#E5E7EB';
        ctx.font = `500 20px ${fontFamily}`;
        ctx.fillText(artistName, leftColWidth + rightColWidth / 2, albumY + albumArtSize + 70, rightColWidth * 0.9);

        // --- Lyrics Drawing ---
        const lyricIdx = timedLyrics.findIndex(l => currentPlaybackTime >= l.startTime && currentPlaybackTime < l.endTime);
        const canvasCurrentIndex = lyricIdx + 2;

        const targetTranslateY = canvas.height / 2 - (canvasCurrentIndex * lyricLineHeight) - lyricLineHeight / 2;
        // Apply easing to smoothly move the lyrics
        currentCanvasTranslateY += (targetTranslateY - currentCanvasTranslateY) * 0.1;

        ctx.save();
        ctx.rect(0, 0, leftColWidth, canvas.height);
        ctx.clip();
        ctx.translate(0, currentCanvasTranslateY);
        ctx.textAlign = 'left';
        
        lyricsToRender.forEach((lyric, index) => {
            const style = getLyricStyle(index, canvasCurrentIndex);
            ctx.font = style.font;
            ctx.fillStyle = style.color;
            ctx.fillText(lyric.text, 60, index * lyricLineHeight);
        });

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
  
  const getLyricStyle = (index: number, currentIdx?: number) => {
    const activeIndex = currentIdx !== undefined ? currentIdx : currentIndex;
    const style: { 
        transition?: string;
        fontFamily: string;
        fontWeight: number;
        textShadow?: string;
        opacity?: number;
        transform?: string;
        fontSize?: string;
        color: string;
        font?: string; // For canvas
    } = {
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out, font-size 0.5s ease-out',
        fontFamily: fontFamily,
        fontWeight: 500,
        textShadow: '2px 2px 5px rgba(0,0,0,0.5)',
        color: '#D1D5DB', // default gray
    };

    let calculatedFontSize: number;

    if (index === activeIndex) {
        calculatedFontSize = fontSize;
        style.opacity = 1;
        style.transform = 'scale(1)';
        style.color = '#FFFFFF';
        style.fontWeight = 700;
    } else if (index === activeIndex - 1 || index === activeIndex + 1) {
        calculatedFontSize = fontSize * 0.7;
        style.opacity = 0.6;
        style.transform = 'scale(0.9)';
        style.color = '#E5E7EB'; // text-gray-200
    } else {
        calculatedFontSize = fontSize * 0.6;
        style.opacity = 0;
        style.transform = 'scale(0.8)';
        style.color = '#D1D5DB'; // text-gray-300
    }
    
    style.fontSize = `${calculatedFontSize}px`;
    style.font = `${style.fontWeight} ${calculatedFontSize}px ${style.fontFamily}`;

    return style;
  }

  return (
    <>
      {exportProgress && <Loader message={exportProgress.message} progress={exportProgress.progress} onCancel={handleCancelExport} />}
      <div className="w-full max-w-5xl mx-auto">
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setCurrentTime(0)} />
        
        {/* Video Preview Area */}
        <div className="w-full aspect-video bg-gray-900 rounded-xl shadow-2xl ring-1 ring-white/10 relative overflow-hidden mb-4">
          <img src={imageUrl} alt="背景" className="absolute inset-0 w-full h-full object-cover z-0 filter blur-xl scale-110" />
          <div className="absolute inset-0 bg-black/40" />
          
           <div className="relative z-10 w-full h-full flex p-4 sm:p-8 items-center">
              {/* Left Column: Lyrics */}
              <div className="w-3/5 h-full flex flex-col justify-center items-start overflow-hidden">
                <div 
                    ref={lyricsContainerRef} 
                    className="w-full transition-transform duration-500 ease-in-out"
                >
                    {lyricsToRender.map((lyric, index) => (
                        <p
                            key={index}
                            ref={el => { lyricRefs.current[index] = el; }}
                            className={`w-full p-2 tracking-wide leading-tight`}
                            style={getLyricStyle(index)}
                        >
                            {lyric.text || '\u00A0' /* Non-breaking space for empty/dummy lines */}
                        </p>
                    ))}
                </div>
              </div>

              {/* Right Column: Album Art & Info */}
              <div className="w-2/5 h-full flex flex-col justify-center items-center pl-4">
                <img src={imageUrl} alt="專輯封面" className="w-full max-w-[280px] aspect-square object-cover rounded-xl shadow-2xl ring-1 ring-white/10" />
                <div className="text-center mt-4 p-2 text-white w-full max-w-[280px]">
                    <p className="font-bold text-lg truncate" title={songTitle}>{songTitle}</p>
                    <p className="text-gray-300 truncate" title={artistName}>{artistName}</p>
                </div>
              </div>
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