import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';

// Allows access to the FFmpeg library loaded from the script tag in index.html
declare global {
  interface Window {
    FFmpeg: any;
  }
}

interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrl: string;
  onBack: () => void;
}

const fetchFile = async (url: string | Blob): Promise<Uint8Array> => {
  const response = await fetch(url instanceof Blob ? URL.createObjectURL(url) : url);
  const data = await response.arrayBuffer();
  return new Uint8Array(data);
};

const fontOptions = [
  { name: '現代無襯線', value: 'sans-serif' },
  { name: '經典襯線', value: 'serif' },
  { name: '手寫體', value: 'cursive' },
  { name: '打字機', value: 'monospace' },
];

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const ffmpegRef = useRef<any>(null);
  const isExportCancelled = useRef(false);


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
  
  const currentLyric = useMemo(() => {
    return timedLyrics.find(lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime) || null;
  }, [currentTime, timedLyrics]);

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

  const handleExportSrt = () => {
    let srtContent = '';
    timedLyrics.forEach((lyric, index) => {
      const startTime = formatSrtTime(lyric.startTime);
      const endTime = formatSrtTime(lyric.endTime);
      srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${lyric.text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
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
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.exit();
      } catch (e) {
        console.warn('Could not terminate FFmpeg process.', e);
      }
    }
    ffmpegRef.current = null;
    setExportProgress(null);
  };

  const handleExportMp4 = async () => {
    if (!audioRef.current || !imageUrl) return;

    isExportCancelled.current = false;
    setExportProgress({ message: '正在初始化...', progress: 0 });

    try {
      const VIDEO_WIDTH = 1280;
      const VIDEO_HEIGHT = 720;
      const FRAME_RATE = 30;

      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext('2d')!;

      const mimeTypes = [
        'video/webm; codecs=vp9',
        'video/webm; codecs=vp8',
        'video/webm',
      ];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        alert('您的瀏覽器不支援影片錄製功能，無法匯出 MP4。請嘗試更新您的瀏覽器（建議使用 Chrome 或 Firefox）。');
        setExportProgress(null);
        return;
      }

      const stream = canvas.captureStream(FRAME_RATE);
      const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
      const videoChunks: Blob[] = [];
      recorder.ondataavailable = (e) => videoChunks.push(e.data);

      const recordingPromise = new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => {
          resolve(videoChunks.length > 0 ? new Blob(videoChunks, { type: 'video/webm' }) : null);
        };
      });

      const bgImage = new Image();
      bgImage.crossOrigin = 'anonymous';
      const bgImagePromise = new Promise((resolve, reject) => {
        bgImage.onload = resolve;
        bgImage.onerror = reject;
      });
      bgImage.src = imageUrl;
      await bgImagePromise;

      const duration = audioRef.current.duration;
      audioRef.current.currentTime = 0;
      recorder.start();

      for (let i = 0; i < duration * FRAME_RATE; i++) {
        if (isExportCancelled.current) {
          if (recorder.state === 'recording') recorder.stop();
          console.log('Export cancelled during frame rendering.');
          return;
        }

        const time = i / FRAME_RATE;

        ctx.drawImage(bgImage, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

        const artSize = VIDEO_HEIGHT * 0.6;
        const artX = VIDEO_WIDTH * 0.15;
        const artY = (VIDEO_HEIGHT - artSize) / 2;
        ctx.drawImage(bgImage, artX, artY, artSize, artSize);

        const lyric = timedLyrics.find((l) => time >= l.startTime && time < l.endTime);
        if (lyric) {
          const timeInLyric = time - lyric.startTime;
          const animationDuration = 0.5;
          const opacity = Math.min(1, timeInLyric / animationDuration);
          const translateY = 20 * (1 - opacity);

          ctx.save();
          ctx.font = `bold ${fontSize * (VIDEO_WIDTH / 1280)}px ${fontFamily}`;
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 10;
          const lyricX = artX + artSize + (VIDEO_WIDTH - (artX + artSize)) / 2;
          ctx.fillText(lyric.text, lyricX, VIDEO_HEIGHT / 2 + translateY);
          ctx.restore();
        }

        await new Promise(requestAnimationFrame);
        if (i % 10 === 0) {
          setExportProgress({ message: '正在渲染動畫...', progress: Math.round((time / duration) * 50) });
        }
      }

      if (recorder.state === 'recording') recorder.stop();
      const silentVideoBlob = await recordingPromise;

      if (isExportCancelled.current || !silentVideoBlob) {
        console.log('Export cancelled or failed before encoding.');
        return;
      }

      setExportProgress({ message: '正在初始化編碼器...', progress: 50 });
      const { createFFmpeg } = window.FFmpeg;
      const ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      ffmpegRef.current = ffmpeg;

      await ffmpeg.load();
      if (isExportCancelled.current) {
        return;
      }

      setExportProgress({ message: '正在準備檔案...', progress: 55 });
      ffmpeg.FS('writeFile', 'video.webm', await fetchFile(silentVideoBlob));
      ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(audioUrl));

      ffmpeg.setProgress(({ ratio }) => {
        if (isExportCancelled.current) return;
        setExportProgress({ message: '正在編碼影片...', progress: 55 + Math.round(ratio * 45) });
      });

      await ffmpeg.run('-i', 'video.webm', '-i', 'audio.mp3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'output.mp4');

      if (isExportCancelled.current) {
        return;
      }

      const data = ffmpeg.FS('readFile', 'output.mp4');
      const videoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'lyric-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(videoUrl);
    } catch (error) {
      console.error('MP4 導出失敗:', error);
      alert('影片匯出失敗！\n\n編碼過程中發生錯誤。這可能是由於影片時間過長、瀏覽器記憶體不足或音訊檔案格式問題所導致。\n\n建議操作：\n1. 嘗試匯出較短的片段。\n2. 關閉其他瀏覽器分頁後再試一次。\n3. 確認您的音訊檔案 (.mp3, .wav) 沒有損壞。');
    } finally {
      ffmpegRef.current = null;
      setExportProgress(null);
    }
  };
  
  const durationValue = audioRef.current?.duration || 0;

  return (
    <>
      {exportProgress && <Loader message={exportProgress.message} progress={exportProgress.progress} onCancel={handleCancelExport} />}
      <div className="w-full max-w-6xl mx-auto">
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setCurrentTime(0)} />
        
        <div className="flex flex-col md:flex-row gap-8 items-center py-8 px-4">
            {/* Left Column: Album Art */}
            <div className="w-full md:w-2/5 flex-shrink-0">
                <img src={imageUrl} alt="專輯封面" className="w-full aspect-square object-cover rounded-xl shadow-2xl ring-1 ring-white/10"/>
            </div>

            {/* Right Column: Lyrics */}
            <div className="w-full md:w-3/5 h-48 flex items-center justify-center">
                <div className="w-full text-center text-white">
                    <div className="h-24 flex items-center justify-center">
                      {currentLyric ? (
                          <p 
                            key={currentLyric.text} 
                            className="font-bold drop-shadow-lg animate-fade-in-up"
                            style={{
                              fontSize: `${fontSize}px`,
                              fontFamily: fontFamily,
                            }}
                          >
                              {currentLyric.text}
                          </p>
                      ) : (
                          <p className="text-gray-600" style={{ fontSize: `${fontSize}px`, fontFamily: fontFamily, }}>...</p>
                      )}
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
          <div className="w-full flex items-center gap-4">
            <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={durationValue}
              value={currentTime}
              onChange={handleTimelineChange}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
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
                        className="w-20 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-pink-500"
                    />
                </div>
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-family" className="text-xs">字體</label>
                    <select
                        id="font-family"
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                        {fontOptions.map(opt => (
                            <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.name}</option>
                        ))}
                    </select>
                </div>
                <button onClick={handleExportSrt} className="px-3 py-2 text-sm bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition">
                    導出 SRT
                </button>
                <button onClick={handleExportMp4} className="px-3 py-2 text-sm bg-pink-600 text-white font-semibold rounded-lg hover:bg-pink-700 transition">
                    導出 MP4
                </button>
              </div>
          </div>
        </div>

        <style>{`
          @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        `}</style>
      </div>
    </>
  );
};

export default VideoPlayer;