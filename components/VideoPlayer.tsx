import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';
import DiscAnimatedLyric from './DiscAnimatedLyric';
import VerticalAnimatedLyric from './VerticalAnimatedLyric';
import KaraokeLyric from './KaraokeLyric';

interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrl: string;
  songTitle: string;
  artistName: string;
  onBack: () => void;
  isAiGeneratorUnlocked: boolean;
  finalFeedback: string | null;
}

const fontOptions = [
  { name: '現代無襯線', value: 'sans-serif' },
  { name: '經典襯線', value: 'serif' },
  { name: '手寫體', value: 'cursive' },
  { name: '打字機', value: 'monospace' },
  { name: '日文黑體', value: "'Noto Sans JP', sans-serif" },
  { name: '韓文黑體', value: "'Noto Sans KR', sans-serif" },
];

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, songTitle, artistName, onBack, isAiGeneratorUnlocked, finalFeedback }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress?: number; details?: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [activeLyricColor, setActiveLyricColor] = useState('#FFFFFF');
  const [nextLyricColor, setNextLyricColor] = useState('#D1D5DB');
  const [infoColor, setInfoColor] = useState('#FFFFFF');
  const [subInfoColor, setSubInfoColor] = useState('#E5E7EB');
  const [layoutStyle, setLayoutStyle] = useState<'left' | 'right'>('left');
  const [animationStyle, setAnimationStyle] = useState<'disc' | 'vertical' | 'karaoke'>('disc');

  const isExportCancelled = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const timeUpdateHandler = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const endedHandler = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', timeUpdateHandler);
    audio.addEventListener('ended', endedHandler);

    return () => {
      audio.removeEventListener('timeupdate', timeUpdateHandler);
      audio.removeEventListener('ended', endedHandler);
    };
  }, []);

  const activeLyricIndex = useMemo(() => {
    return timedLyrics.findIndex(
      lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime
    );
  }, [currentTime, timedLyrics]);
  
  const activeLyric = activeLyricIndex > -1 ? timedLyrics[activeLyricIndex] : null;
  const nextLyric = activeLyricIndex > -1 && (activeLyricIndex + 1) < timedLyrics.length ? timedLyrics[activeLyricIndex + 1] : null;

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
        audio.pause();
    } else {
        if (audio.ended) {
            audio.currentTime = 0;
            setCurrentTime(0);
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
    }
    setExportProgress(null);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleScreenRecordExport = async () => {
    // @ts-ignore
    if (!previewRef.current || !audioRef.current || typeof previewRef.current.captureStream !== 'function' || !window.MediaRecorder) {
        alert('您的瀏覽器不支援此匯出功能。請嘗試使用最新版本的 Google Chrome 或 Firefox。');
        return;
    }
    isExportCancelled.current = false;
    setExportProgress({ message: '正在準備匯出...' });

    const audio = audioRef.current;
    let recorder: MediaRecorder | null = null;
    let progressInterval: number | null = null;

    const cleanup = () => {
        if(progressInterval) clearInterval(progressInterval);
        if (recorder && recorder.state === 'recording') recorder.stop();
        handleCancelExport();
    }
    
    try {
      // 1. Get streams
      // @ts-ignore
      const videoStream = previewRef.current.captureStream(30);
      
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audio);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination); // Also play audio through speakers during recording
      const audioStream = dest.stream;

      // 2. Combine streams
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);

      // 3. Setup MediaRecorder
      recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Stop stream tracks
        combinedStream.getTracks().forEach(track => track.stop());
        audioCtx.close();

        if (isExportCancelled.current) {
          setExportProgress(null);
          return;
        }

        setExportProgress({ message: '正在完成影片檔案...' });
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${songTitle || 'lyric-video'}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        cleanup();
      };
      
      recorder.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          // @ts-ignore
          alert(`錄製時發生錯誤: ${event.error.message}`);
          cleanup();
      };
      
      // Countdown before starting
      for (let i = 3; i > 0; i--) {
        if (isExportCancelled.current) throw new Error("Cancelled");
        setExportProgress({ message: `錄製將於 ${i} 秒後開始...` });
        await new Promise(res => setTimeout(res, 1000));
      }
      
      // 4. Start recording and playback
      audio.currentTime = 0;
      setCurrentTime(0);
      await audio.play();
      setIsPlaying(true);
      recorder.start();
      setExportProgress({ message: '錄製中...', progress: 0 });

      // Update progress
      progressInterval = window.setInterval(() => {
        if (isExportCancelled.current) {
            cleanup();
            return;
        }
        setExportProgress({
          message: '錄製中...',
          progress: (audio.currentTime / audio.duration) * 100,
          details: `${formatTime(audio.currentTime)} / ${formatTime(duration)}`
        });
      }, 250);

      // 5. Stop when audio ends
      audio.addEventListener('ended', () => {
        cleanup();
      }, { once: true });
      
    } catch(error: any) {
        if(error.message !== "Cancelled") {
            alert(`匯出失敗: ${error.message}`);
        }
        cleanup();
    }
  };

  return (
    <>
      {exportProgress && (
        <Loader
          message={exportProgress.message}
          progress={exportProgress.progress}
          details={exportProgress.details}
          onCancel={handleCancelExport}
        />
      )}
      <div className="w-full h-full flex flex-col bg-gray-900 text-white font-sans absolute inset-0">
        {/* Top Bar */}
        <div className="flex-shrink-0 p-4 flex justify-between items-center bg-gray-800/50 border-b border-gray-700 z-10">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
            <PrevIcon className="w-6 h-6" />
            <span>返回設定</span>
          </button>
          <div className="text-center">
            <h1 className="font-bold text-lg truncate max-w-xs md:max-w-md">{songTitle}</h1>
            <p className="text-sm text-gray-400 truncate max-w-xs md:max-w-md">{artistName}</p>
          </div>
          <div className="w-24"></div> {/* Spacer */}
        </div>
        
        {/* Main Content: Preview & Controls */}
        <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
          {/* Controls Panel */}
          <div className="w-full lg:w-80 flex-shrink-0 p-4 space-y-4 overflow-y-auto custom-scrollbar bg-gray-800/30">
            <h3 className="text-lg font-bold border-b border-gray-700 pb-2">樣式設定</h3>
            
            <div>
              <label htmlFor="font-size" className="block text-sm font-medium text-gray-300 mb-1">字體大小: <span className="font-mono">{fontSize}px</span></label>
              <input type="range" id="font-size" min="16" max="128" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#a6a6a6]"/>
            </div>

            <div>
              <label htmlFor="font-family" className="block text-sm font-medium text-gray-300">字體</label>
              <select id="font-family" value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm rounded-md text-white">
                {fontOptions.map(font => <option key={font.value} value={font.value}>{font.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="active-color" className="block text-sm font-medium text-gray-300 text-center">目前歌詞</label>
                <input type="color" id="active-color" value={activeLyricColor} onChange={e => setActiveLyricColor(e.target.value)} className="mt-1 h-10 w-full block bg-gray-700 border border-gray-600 cursor-pointer rounded-md"/>
              </div>
              <div>
                <label htmlFor="next-color" className="block text-sm font-medium text-gray-300 text-center">下句歌詞</label>
                <input type="color" id="next-color" value={nextLyricColor} onChange={e => setNextLyricColor(e.target.value)} className="mt-1 h-10 w-full block bg-gray-700 border border-gray-600 cursor-pointer rounded-md"/>
              </div>
               <div>
                <label htmlFor="info-color" className="block text-sm font-medium text-gray-300 text-center">歌曲名稱</label>
                <input type="color" id="info-color" value={infoColor} onChange={e => setInfoColor(e.target.value)} className="mt-1 h-10 w-full block bg-gray-700 border border-gray-600 cursor-pointer rounded-md"/>
              </div>
              <div>
                <label htmlFor="subinfo-color" className="block text-sm font-medium text-gray-300 text-center">歌手名稱</label>
                <input type="color" id="subinfo-color" value={subInfoColor} onChange={e => setSubInfoColor(e.target.value)} className="mt-1 h-10 w-full block bg-gray-700 border border-gray-600 cursor-pointer rounded-md"/>
              </div>
            </div>
            
            <div>
              <span className="block text-sm font-medium text-gray-300">版面配置</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => setLayoutStyle('left')} className={`p-2 rounded-md border-2 text-sm ${layoutStyle === 'left' ? 'border-gray-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700/50'}`}>歌詞在左，圖片在右</button>
                <button onClick={() => setLayoutStyle('right')} className={`p-2 rounded-md border-2 text-sm ${layoutStyle === 'right' ? 'border-gray-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700/50'}`}>圖片在左，歌詞在右</button>
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-300">動畫風格</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => setAnimationStyle('disc')} className={`p-2 rounded-md border-2 text-sm ${animationStyle === 'disc' ? 'border-gray-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700/50'}`}>圓盤</button>
                <button onClick={() => setAnimationStyle('vertical')} className={`p-2 rounded-md border-2 text-sm ${animationStyle === 'vertical' ? 'border-gray-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700/50'}`}>垂直</button>
                {isAiGeneratorUnlocked && (
                  <button onClick={() => setAnimationStyle('karaoke')} className={`p-2 rounded-md border-2 text-sm ${animationStyle === 'karaoke' ? 'border-gray-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700/50'}`}>卡拉OK</button>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700 space-y-2">
                <button onClick={handleExportSrt} className="w-full py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600">匯出 SRT 字幕檔</button>
                <button onClick={handleScreenRecordExport} className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999]">匯出影片</button>
                <p className="text-xs text-center text-gray-500">影片將匯出為 WEBM 格式，適合網路使用。若需轉檔，可使用線上影片轉檔工具。</p>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-grow p-4 flex items-center justify-center bg-black">
            <div className="w-[1280px] h-[720px] transform scale-[0.45] sm:scale-[0.6] md:scale-[0.7] lg:scale-[0.6] xl:scale-[0.8] origin-center">
              <div ref={previewRef} className="relative w-full h-full bg-gray-700 shadow-lg overflow-hidden" style={{ background: `url(${imageUrl}) center/cover` }}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                
                <div className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center ${layoutStyle === 'left' ? 'left-0' : 'right-0'}`}>
                  {animationStyle === 'disc' ? (
                    <DiscAnimatedLyric 
                      timedLyrics={timedLyrics}
                      activeLyricIndex={activeLyricIndex}
                      fontSize={fontSize}
                      fontFamily={fontFamily}
                      activeColor={activeLyricColor}
                      nextColor={nextLyricColor}
                    />
                  ) : animationStyle === 'vertical' ? (
                    <VerticalAnimatedLyric 
                      activeLyric={activeLyric}
                      nextLyric={nextLyric}
                      fontSize={fontSize}
                      fontFamily={fontFamily}
                      activeColor={activeLyricColor}
                      nextColor={nextLyricColor}
                    />
                  ) : (
                    <KaraokeLyric
                      activeLyric={activeLyric}
                      currentTime={currentTime}
                      fontSize={fontSize}
                      fontFamily={fontFamily}
                      activeColor={activeLyricColor}
                      nextColor={nextLyricColor}
                    />
                  )}
                </div>

                <div className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center p-12 ${layoutStyle === 'left' ? 'right-0' : 'left-0'}`}>
                  <div className="relative">
                    <img src={imageUrl} alt="Album Art" className="w-80 h-80 object-cover rounded-lg shadow-2xl"/>
                  </div>
                </div>

                {finalFeedback && (
                  <div className={`absolute top-8 max-w-sm p-4 drop-shadow-lg ${layoutStyle === 'left' ? 'left-8 text-left' : 'right-8 text-right'}`}>
                      <p className="text-lg italic text-gray-200" style={{ color: nextLyricColor, fontFamily: fontFamily }}>
                          "{finalFeedback}"
                      </p>
                  </div>
                )}

                <div className={`absolute bottom-8 text-white p-4 drop-shadow-lg ${layoutStyle === 'left' ? 'right-8 text-right' : 'left-8 text-left'}`}>
                    <h2 className="text-3xl font-bold" style={{ color: infoColor }}>{songTitle}</h2>
                    <p className="text-xl" style={{ color: subInfoColor }}>{artistName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Timeline & Playback Controls */}
        <div className="flex-shrink-0 p-4 bg-gray-800/50 border-t border-gray-700 flex items-center gap-4 z-10">
          <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}></audio>
          <button onClick={handlePlayPause} className="p-2 bg-white text-gray-900 rounded-full transform hover:scale-110 transition-transform">
            {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
          </button>
          <span className="text-sm font-mono text-gray-400">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={currentTime}
            onChange={handleTimelineChange}
            className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]"
          />
          <span className="text-sm font-mono text-gray-400">{formatTime(duration || 0)}</span>
        </div>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #a6a6a6; border-radius: 4px; }
          input[type=color] { -webkit-appearance: none; border: none; padding: 0; }
          input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
          input[type="color"]::-webkit-color-swatch { border: none; border-radius: 0.3rem; }
        `}</style>
      </div>
    </>
  );
};

export default VideoPlayer;