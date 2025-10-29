import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';

interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrls: string[];
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

const LOCAL_STORAGE_PREFIX = 'lyric-video-maker-';
const FONT_SIZE_KEY = `${LOCAL_STORAGE_PREFIX}fontSize`;
const FONT_FAMILY_KEY = `${LOCAL_STORAGE_PREFIX}fontFamily`;
const ASPECT_RATIO_KEY = `${LOCAL_STORAGE_PREFIX}aspectRatio`;
const RESOLUTION_KEY = `${LOCAL_STORAGE_PREFIX}resolution`;


const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrls, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return saved ? parseInt(saved, 10) : 48;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    const saved = localStorage.getItem(FONT_FAMILY_KEY);
    return saved || 'sans-serif';
  });
  const [aspectRatio, setAspectRatio] = useState(() => {
    const saved = localStorage.getItem(ASPECT_RATIO_KEY);
    return saved || '16:9';
  });
  const [resolution, setResolution] = useState(() => {
    const saved = localStorage.getItem(RESOLUTION_KEY);
    return saved || '720p';
  });

  const isExportCancelled = useRef(false);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // Effects to save settings to localStorage
  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(FONT_FAMILY_KEY, fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem(ASPECT_RATIO_KEY, aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    localStorage.setItem(RESOLUTION_KEY, resolution);
  }, [resolution]);

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

  // Background image handling
  const [bgIndex, setBgIndex] = useState(0);
  const durationValue = audioRef.current?.duration || 1;
  const imageSwitchInterval = durationValue / (imageUrls.length || 1);

  useEffect(() => {
      if (imageUrls.length > 1 && isPlaying) {
          const newIndex = Math.min(Math.floor(currentTime / imageSwitchInterval), imageUrls.length - 1);
          if (newIndex !== bgIndex) {
              setBgIndex(newIndex);
          }
      }
  }, [currentTime, isPlaying, imageSwitchInterval, imageUrls.length, bgIndex]);


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
  
  const continuousIndex = useMemo(() => {
    if (!timedLyrics || timedLyrics.length === 0) return 1;

    // Before playback starts
    if (currentTime === 0 && !isPlaying) {
      return 1;
    }

    // Before the first lyric starts
    const firstLyric = timedLyrics[0];
    if (currentTime < firstLyric.startTime) {
      // Transition in over 1 second before the first lyric starts
      const preFadeDuration = 1.0;
      const timeToStart = firstLyric.startTime;
      if (currentTime > timeToStart - preFadeDuration) {
        const progress = (currentTime - (timeToStart - preFadeDuration)) / preFadeDuration;
        return 1 + progress; // from 1 (dummy before first lyric) to 2 (first lyric)
      }
      return 1; // Stay on dummy if we are more than 1s away
    }
    
    // After the last lyric ends
    const lastLyric = timedLyrics[timedLyrics.length - 1];
    if (currentTime >= lastLyric.endTime) {
      // Settle on the index of the last lyric
      return timedLyrics.length - 1 + 2;
    }

    // Find current lyric or gap
    for (let i = 0; i < timedLyrics.length; i++) {
        const lyric = timedLyrics[i];
        
        // Case 1: Actively on a lyric line
        if (currentTime >= lyric.startTime && currentTime < lyric.endTime) {
            return i + 2; // The render index of this lyric
        }

        // Case 2: In a gap between this lyric and the next one
        const nextLyric = timedLyrics[i + 1];
        if (nextLyric && currentTime >= lyric.endTime && currentTime < nextLyric.startTime) {
            const gapDuration = nextLyric.startTime - lyric.endTime;
            // Use a fixed transition time to feel consistent, but not longer than the gap
            const transitionDuration = Math.min(0.5, gapDuration);
            const timeIntoGap = currentTime - lyric.endTime;
            
            if (timeIntoGap < transitionDuration) {
                const progress = timeIntoGap / transitionDuration;
                return (i + 2) + progress; // from index of past lyric towards index of next lyric
            } else {
                // If gap is long, stay focused on the upcoming lyric
                return i + 1 + 2;
            }
        }
    }

    // Fallback should not be reached if logic is correct, but as a safeguard:
    return 1;
  }, [currentTime, timedLyrics, isPlaying]);


  useEffect(() => {
    if (lyricsContainerRef.current && lyricRefs.current.length > 0) {
        const scrollingContainer = lyricsContainerRef.current;
        const viewport = scrollingContainer.parentElement;
        if (!viewport) return;

        const floorIndex = Math.floor(continuousIndex);
        const ceilIndex = Math.ceil(continuousIndex);

        // Ensure indices are within bounds and refs exist
        if (floorIndex < 0 || ceilIndex >= lyricRefs.current.length || !lyricRefs.current[floorIndex] || !lyricRefs.current[ceilIndex]) {
            // Can happen briefly during re-renders, safe to just return.
            return;
        }

        const floorEl = lyricRefs.current[floorIndex]!;
        const ceilEl = lyricRefs.current[ceilIndex]!;
        
        const progress = continuousIndex - floorIndex;

        // Interpolate position based on the center of each lyric element
        const floorTop = floorEl.offsetTop + floorEl.offsetHeight / 2;
        const ceilTop = ceilEl.offsetTop + ceilEl.offsetHeight / 2;
        
        const interpolatedTop = floorTop + (ceilTop - floorTop) * progress;

        const newTransform = `translateY(${viewport.offsetHeight / 2 - interpolatedTop}px)`;
        
        scrollingContainer.style.transform = newTransform;
    }
  }, [continuousIndex, fontSize, aspectRatio]); // Re-run when aspect ratio or font size changes


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
    a.download = `${songTitle} - ${artistName}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCancelExport = () => {
    isExportCancelled.current = true;
     if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  };

  const handleExportVideo = async () => {
    if (!audioRef.current) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('您的瀏覽器不支援螢幕錄影功能。請嘗試使用最新版本的 Chrome, Firefox, 或 Edge。');
        return;
    }

    isExportCancelled.current = false;
    setExportProgress({ message: '請選擇要錄製的分頁...', progress: 0 });

    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: true
        });

        const recorder = new MediaRecorder(displayStream, {
            mimeType: 'video/webm;codecs=vp8,opus'
        });

        const recordedChunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };

        const audio = audioRef.current;
        const duration = audio.duration;

        recorder.onstop = () => {
            if (!isExportCancelled.current) {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${songTitle} - ${artistName}.webm`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            displayStream.getTracks().forEach(track => track.stop());
            setExportProgress(null);
        };

        displayStream.getTracks().forEach(track => {
            track.onended = () => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            };
        });

        recorder.start();

        const wasPlaying = isPlaying;
        if (wasPlaying) {
          audio.pause();
        }
        audio.currentTime = 0;
        await audio.play();
        setIsPlaying(true);
        setExportProgress({ message: '錄影中...', progress: 0 });

        const updateInterval = setInterval(() => {
            if (audio.paused || audio.ended || isExportCancelled.current) {
                clearInterval(updateInterval);
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
                if (!wasPlaying) {
                  setIsPlaying(false);
                }
                return;
            }
            const progress = (audio.currentTime / duration) * 100;
            setExportProgress({
                message: `錄影中... (${formatTime(audio.currentTime)} / ${formatTime(duration)})`,
                progress
            });
        }, 250);

        audio.onended = () => {
            if (recorder.state === 'recording') {
                recorder.stop();
            }
            setIsPlaying(false);
            // Reset the onended handler to its default
            audio.onended = () => setIsPlaying(false);
        };

    } catch (error: any) {
        console.error("Screen recording failed:", error);
        if (error.name === 'NotAllowedError') {
             alert('您已取消螢幕錄影。');
        } else {
            alert('啟動螢幕錄影失敗。請確認您已授權，並使用支援的瀏覽器。');
        }
        setExportProgress(null);
    }
  };
    
  const getLyricStyle = (index: number) => {
    const focusIndex = continuousIndex;
    const distance = Math.abs(index - focusIndex);

    const style: React.CSSProperties & { font?: string } = {
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out, font-size 0.3s ease-out, color 0.3s ease-out',
        fontFamily: fontFamily,
        textShadow: '2px 2px 5px rgba(0,0,0,0.5)',
    };

    const opacity = Math.max(0, 1 - distance / 2);
    const scale = 1 - (Math.min(2, distance) * 0.1);
    const calculatedFontSize = fontSize * (1 - Math.min(1, distance) * 0.3);
    const fontWeight = 700 - Math.round(Math.min(1, distance) * 200);

    if (distance < 1) {
        const r = 255 - (255 - 229) * distance;
        const g = 255 - (255 - 231) * distance;
        const b = 255 - (255 - 235) * distance;
        style.color = `rgb(${r}, ${g}, ${b})`;
    } else {
        const progress = Math.min(1, distance - 1);
        const r = 229 - (229 - 209) * progress;
        const g = 231 - (231 - 213) * progress;
        const b = 235 - (235 - 219) * progress;
        style.color = `rgb(${r}, ${g}, ${b})`;
    }
    
    style.opacity = opacity > 0.05 ? opacity : 0;
    style.transform = `scale(${scale})`;
    style.fontSize = `${calculatedFontSize}px`;
    style.fontWeight = fontWeight;
    
    style.font = `${fontWeight} ${calculatedFontSize}px ${fontFamily}`;

    return style;
  }
  
  const aspectRatioClass = {
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16] max-h-[70vh] mx-auto',
    '1:1': 'aspect-square max-h-[70vh] mx-auto'
  }[aspectRatio];

  const previewLayoutClass = {
    '16:9': 'flex-row p-4 sm:p-8',
    '9:16': 'flex-col p-4 sm:p-6',
    '1:1': 'flex-col p-4 sm:p-6'
  }[aspectRatio];

  const lyricsContainerClass = {
     '16:9': 'w-3/5 h-full',
     '9:16': 'w-full h-1/2 order-2',
     '1:1': 'w-full h-1/2 order-2'
  }[aspectRatio];

  const albumContainerClass = {
    '16:9': 'w-2/5 h-full pl-4',
    '9:16': 'w-full h-1/2 order-1 items-center justify-end pb-4',
    '1:1': 'w-full h-1/2 order-1 items-center justify-end pb-4'
  }[aspectRatio];

  return (
    <>
      {exportProgress && <Loader message={exportProgress.message} progress={exportProgress.progress} onCancel={handleCancelExport} />}
      <div className="w-full max-w-5xl mx-auto">
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setCurrentTime(0)} />
        
        {/* Video Preview Area */}
        <div className={`w-full ${aspectRatioClass} bg-gray-900 rounded-xl shadow-2xl ring-1 ring-white/10 relative overflow-hidden mb-4 transition-all duration-300`}>
           {imageUrls.map((url, index) => (
             <div
                key={index}
                className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
                style={{
                  backgroundImage: `url(${url})`,
                  opacity: index === bgIndex ? 1 : 0,
                }}
              />
           ))}
          <div className="absolute inset-0 bg-black/40 filter blur-xl scale-110" style={{
              backgroundImage: `url(${imageUrls[bgIndex]})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
          }}/>
          <div className="absolute inset-0 bg-black/50" />

           <div className={`relative z-10 w-full h-full flex items-center ${previewLayoutClass}`}>
              {/* Lyrics Column */}
              <div className={`relative flex flex-col justify-center items-start overflow-hidden ${lyricsContainerClass}`}>
                <div 
                    ref={lyricsContainerRef} 
                    className="w-full transition-transform duration-500 ease-in-out"
                >
                    {lyricsToRender.map((lyric, index) => (
                        <p
                            key={index}
                            ref={el => { lyricRefs.current[index] = el; }}
                            className={`w-full p-2 tracking-wide leading-tight ${aspectRatio !== '16:9' ? 'text-center' : ''}`}
                            style={getLyricStyle(index)}
                        >
                            {lyric.text || '\u00A0' /* Non-breaking space */}
                        </p>
                    ))}
                </div>
              </div>

              {/* Album Art & Info Column */}
              <div className={`flex flex-col justify-center ${albumContainerClass}`}>
                <img src={imageUrls[0]} alt="專輯封面" className="w-full max-w-[250px] aspect-square object-cover rounded-xl shadow-xl ring-1 ring-white/10" />
                <div className="text-center mt-4 p-2 text-white w-full max-w-[250px]">
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
              type="range" min="0" max={durationValue} value={currentTime} onChange={handleTimelineChange}
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
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-size" className="text-xs">大小</label>
                    <input id="font-size" type="range" min="24" max="80" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-20 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" />
                </div>
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-family" className="text-xs">字體</label>
                    <select id="font-family" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500">
                        {fontOptions.map(opt => <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.name}</option>)}
                    </select>
                </div>
                 <div className="flex items-center gap-2 text-white">
                    <label htmlFor="aspect-ratio" className="text-xs">比例</label>
                    <select id="aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500">
                        <option value="16:9">16:9 (橫向)</option>
                        <option value="9:16">9:16 (直向)</option>
                        <option value="1:1">1:1 (方形)</option>
                    </select>
                </div>
                 <div className="flex items-center gap-2 text-white">
                    <label htmlFor="resolution" className="text-xs">畫質</label>
                    <select id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500" disabled>
                        <option value="720p">720p (HD)</option>
                        <option value="1080p">1080p (Full HD)</option>
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
            <p className="text-xs text-gray-500">注意：影片匯出將使用螢幕錄影功能，請選擇此分頁並授權音訊分享。錄影畫質取決於您的螢幕解析度。</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoPlayer;