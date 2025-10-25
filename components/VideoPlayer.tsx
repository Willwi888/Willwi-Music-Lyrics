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
  songTitle: string;
  artistName: string;
  onBack: () => void;
}

const fetchFile = async (url: string | Blob): Promise<Uint8Array> => {
  const isBlob = url instanceof Blob;
  const buffer = isBlob ? await url.arrayBuffer() : await (await fetch(url)).arrayBuffer();
  return new Uint8Array(buffer);
};

const fontOptions = [
  { name: '現代無襯線', value: 'sans-serif' },
  { name: '經典襯線', value: 'serif' },
  { name: '手寫體', value: 'cursive' },
  { name: '打字機', value: 'monospace' },
];

const fontConfig = {
  'sans-serif': { 
    name: 'Noto Sans TC', 
    url: 'https://storage.googleapis.com/aistudio-hosting/fonts/NotoSansTC-Regular.otf' 
  },
  'serif': { 
    name: 'Noto Serif TC', 
    url: 'https://storage.googleapis.com/aistudio-hosting/fonts/NotoSerifTC-Regular.otf' 
  },
  'cursive': { 
    name: 'Ma Shan Zheng', 
    url: 'https://storage.googleapis.com/aistudio-hosting/fonts/MaShanZheng-Regular.ttf' 
  },
  'monospace': { 
    name: 'Noto Sans Mono', 
    url: 'https://storage.googleapis.com/aistudio-hosting/fonts/NotoSansMono-Regular.ttf'
  },
};


const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const ffmpegRef = useRef<any>(null);
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
    // We offset by 2 because of the dummy lyrics at the start
    return timedLyrics.findIndex(lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime) + 2;
  }, [currentTime, timedLyrics]);

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
        setExportProgress({ message: '正在初始化編碼器...', progress: 0 });
        const { createFFmpeg } = window.FFmpeg;
        const ffmpeg = createFFmpeg({
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.0/dist/ffmpeg-core.js',
        });
        ffmpegRef.current = ffmpeg;

        await ffmpeg.load();
        if (isExportCancelled.current) return;
        
        const selectedFont = fontConfig[fontFamily as keyof typeof fontConfig] || fontConfig['sans-serif'];
        const FONT_URL = selectedFont.url;
        const FONT_NAME = selectedFont.name;
        const FONT_FILENAME = FONT_URL.split('/').pop() || 'font.file';

        setExportProgress({ message: '正在準備資源...', progress: 10 });

        const [image, audio, font] = await Promise.all([
            fetchFile(imageUrl),
            fetchFile(audioUrl),
            fetchFile(FONT_URL)
        ]);

        ffmpeg.FS('writeFile', 'image.jpg', image);
        ffmpeg.FS('writeFile', 'audio.mp3', audio);
        ffmpeg.FS('writeFile', FONT_FILENAME, font);
        
        const srtContent = generateSrtContent();
        ffmpeg.FS('writeFile', 'lyrics.srt', srtContent);
        
        if (isExportCancelled.current) return;

        setExportProgress({ message: '正在生成影片指令...', progress: 20 });
        
        const scaledFontSize = Math.round(fontSize * 0.75); // Scale font size for video
        
        const subtitlesFilter = `subtitles=lyrics.srt:fontsdir=./:force_style='FontName=${FONT_NAME},FontSize=${scaledFontSize},PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=1,MarginV=50'`;
        const vf = `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black,${subtitlesFilter}`;
        
        ffmpeg.setProgress(({ ratio }) => {
            if (isExportCancelled.current) return;
            const progress = 20 + Math.round(ratio * 80);
            setExportProgress({ message: '正在編碼影片...', progress: Math.min(progress, 100) });
        });
        
        setExportProgress({ message: '正在編碼影片...', progress: 21 });

        await ffmpeg.run(
            '-loop', '1',
            '-i', 'image.jpg',
            '-i', 'audio.mp3',
            '-vf', vf,
            '-c:v', 'libx264',
            '-tune', 'stillimage',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-shortest',
            'output.mp4'
        );

        if (isExportCancelled.current) return;

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
        if (!isExportCancelled.current) {
            alert('影片匯出失敗！\n\n編碼過程中發生錯誤。這可能是由於影片時間過長、瀏覽器記憶體不足或音訊檔案格式問題所導致。\n\n建議操作：\n1. 嘗試匯出較短的片段。\n2. 關閉其他瀏覽器分頁後再試一次。\n3. 確認您的音訊檔案 (.mp3, .wav) 沒有損壞。');
        }
    } finally {
        ffmpegRef.current = null;
        setExportProgress(null);
    }
};
  
  const durationValue = audioRef.current?.duration || 0;

  const getLyricStyle = (index: number) => {
    const style: React.CSSProperties = {
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out, font-size 0.5s ease-out',
        fontFamily: fontFamily,
        fontWeight: 500,
        textShadow: '2px 2px 5px rgba(0,0,0,0.5)',
    };

    if (index === currentIndex) {
        style.opacity = 1;
        style.transform = 'scale(1)';
        style.fontSize = `${fontSize}px`;
        style.color = '#FFFFFF';
        style.fontWeight = 700;
    } else if (index === currentIndex - 1 || index === currentIndex + 1) {
        style.opacity = 0.6;
        style.transform = 'scale(0.9)';
        style.fontSize = `${fontSize * 0.7}px`;
        style.color = '#E5E7EB'; // text-gray-200
    } else {
        style.opacity = 0;
        style.transform = 'scale(0.8)';
        style.fontSize = `${fontSize * 0.6}px`;
        style.color = '#D1D5DB'; // text-gray-300
    }
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
                <button onClick={handleExportMp4} className="px-3 py-2 text-sm bg-[#a6a6a6] text-gray-900 font-semibold rounded-lg hover:bg-[#999999] border border-white/50 transition">
                    導出 MP4
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