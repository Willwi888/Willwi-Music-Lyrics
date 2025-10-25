import React, { useState, useCallback, useEffect, useRef } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import { TimedLyric } from './types';
import Loader from './components/Loader';


type AppState = 'FORM' | 'TIMING' | 'PREVIEW';

const DEFAULT_BG_IMAGE = 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg';

// Helper function to convert SRT time format (HH:MM:SS,ms) to seconds
const srtTimeToSeconds = (time: string): number => {
  const parts = time.split(/[:,]/);
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  const milliseconds = parseInt(parts[3], 10);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

// New parser for SRT content that extracts timing information
const parseSrtWithTimestamps = (srtContent: string): TimedLyric[] => {
  const blocks = srtContent.trim().replace(/\r/g, '').split('\n\n');
  const timedLyrics: TimedLyric[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const timeLine = lines[1];
    if (timeLine && timeLine.includes('-->')) {
      try {
        const [startTimeStr, endTimeStr] = timeLine.split(' --> ');
        const text = lines.slice(2).join('\n');
        
        timedLyrics.push({
          text,
          startTime: srtTimeToSeconds(startTimeStr),
          endTime: srtTimeToSeconds(endTimeStr),
        });
      } catch (error) {
        console.error("Failed to parse SRT time block:", block, error);
        // Skip malformed blocks
      }
    }
  }
  return timedLyrics;
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('FORM');
  const [lyricsText, setLyricsText] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [timedLyrics, setTimedLyrics] = useState<TimedLyric[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const srtInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const audioUrl = audioFile ? URL.createObjectURL(audioFile) : '';
  const backgroundImageUrl = backgroundImage ? URL.createObjectURL(backgroundImage) : DEFAULT_BG_IMAGE;


  const handleStartTiming = (e: React.FormEvent) => {
    e.preventDefault();
    if (lyricsText && audioFile && songTitle && artistName) {
      // If timed lyrics are already populated (from SRT import), skip to preview
      if (timedLyrics.length > 0) {
        setAppState('PREVIEW');
      } else {
        setAppState('TIMING');
      }
    } else {
      alert('請填寫所有必填欄位！');
    }
  };

  const handleTimingComplete = useCallback((lyrics: TimedLyric[]) => {
    setTimedLyrics(lyrics);
    setAppState('PREVIEW');
  }, []);

  const handleBackToForm = useCallback(() => {
    setAppState('FORM');
  }, []);
  
  const handleBackToTiming = useCallback(() => {
    setAppState('TIMING');
  }, []);
  
  const handleImportSrtClick = () => {
    srtInputRef.current?.click();
  };

  // Legacy parser for text only, used as a fallback.
  const parseSrtTextOnly = (srtContent: string): string => {
    const lines = srtContent.replace(/\r/g, '').split('\n');
    const lyricLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed === '') return false;
      if (/^\d+$/.test(trimmed)) return false; // sequence number
      if (trimmed.includes('-->')) return false; // timestamp
      return true;
    });
    return lyricLines.join('\n');
  };

  const handleSrtFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const srtContent = event.target?.result as string;
      if (srtContent) {
        const parsedTimedLyrics = parseSrtWithTimestamps(srtContent);
        // Check if the parser successfully extracted timed lyrics
        if (parsedTimedLyrics.length > 0) {
          setTimedLyrics(parsedTimedLyrics);
          const plainLyrics = parsedTimedLyrics.map(l => l.text).join('\n');
          setLyricsText(plainLyrics);
          alert('SRT 檔案已成功匯入並對時！請點擊「開始對時」按鈕直接進入預覽。');
        } else {
           // Fallback to old behavior if SRT has no valid timing info
          const parsedLyrics = parseSrtTextOnly(srtContent);
          setLyricsText(parsedLyrics);
          setTimedLyrics([]); // Ensure timed lyrics are cleared
        }
      }
    };
    reader.onerror = () => {
      alert('讀取 SRT 檔案時發生錯誤。');
    };
    reader.readAsText(file);
    
    // Reset input value to allow re-uploading the same file
    if(e.target) e.target.value = ''; 
  };
  
  const handleLyricsTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLyricsText(e.target.value);
    // If the user manually edits the lyrics, the imported timings are no longer valid.
    // Clear them to ensure the user goes to the manual timing screen.
    if (timedLyrics.length > 0) {
      setTimedLyrics([]);
    }
  };


  const renderContent = () => {
    switch (appState) {
      case 'TIMING':
        return (
          <LyricsTiming
            lyricsText={lyricsText}
            audioUrl={audioUrl}
            backgroundImageUrl={backgroundImageUrl}
            onComplete={handleTimingComplete}
            onBack={handleBackToForm}
          />
        );
      case 'PREVIEW':
        return (
          <VideoPlayer
            timedLyrics={timedLyrics}
            audioUrl={audioUrl}
            imageUrl={backgroundImageUrl}
            onBack={timedLyrics.length > 0 ? handleBackToForm : handleBackToTiming}
            songTitle={songTitle}
            artistName={artistName}
          />
        );
      case 'FORM':
      default:
        return (
          <div className="w-full max-w-lg p-8 space-y-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
            <div className="text-center">
              <MusicIcon className="w-12 h-12 mx-auto text-gray-400" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                歌詞影片創作工具
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                上傳您的音樂作品與歌詞，開始製作專屬的動態歌詞 MV。
              </p>
            </div>
            <form onSubmit={handleStartTiming} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="song-title" className="block text-sm font-medium text-gray-300 mb-2">
                    歌曲名稱
                  </label>
                  <input
                    type="text"
                    id="song-title"
                    className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                    placeholder="請輸入歌曲名稱"
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="artist-name" className="block text-sm font-medium text-gray-300 mb-2">
                    歌手名稱
                  </label>
                  <input
                    type="text"
                    id="artist-name"
                    className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                    placeholder="請輸入歌手名稱"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300">
                        歌詞
                    </label>
                    <button
                      type="button"
                      onClick={handleImportSrtClick}
                      className="text-xs font-medium text-gray-400 hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
                    >
                      匯入 SRT
                    </button>
                 </div>
                <input
                  type="file"
                  ref={srtInputRef}
                  onChange={handleSrtFileChange}
                  accept=".srt"
                  className="sr-only"
                />
                <textarea
                  id="lyrics"
                  rows={8}
                  className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                  placeholder="請在此貼上您的歌詞..."
                  value={lyricsText}
                  onChange={handleLyricsTextChange}
                  required
                />
              </div>

              <div>
                <label htmlFor="audio-upload" className="block text-sm font-medium text-gray-300 mb-2">
                  音訊檔案
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <MusicIcon className="mx-auto h-12 w-12 text-gray-500" />
                    <div className="flex text-sm text-gray-400">
                      <label htmlFor="audio-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                        <span>上傳檔案</span>
                        <input id="audio-upload" name="audio-upload" type="file" className="sr-only" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} required />
                      </label>
                      <p className="pl-1">或拖曳至此</p>
                    </div>
                    <p className="text-xs text-gray-500">{audioFile ? audioFile.name : 'MP3, WAV, FLAC, etc.'}</p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-2">
                  專輯/背景圖片 (可選)
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                    <div className="flex text-sm text-gray-400">
                      <label htmlFor="image-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                        <span>選擇圖片</span>
                        <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/*" onChange={(e) => setBackgroundImage(e.target.files?.[0] || null)} />
                      </label>
                      <p className="pl-1">或拖曳至此</p>
                    </div>
                    <p className="text-xs text-gray-500">{backgroundImage ? backgroundImage.name : 'PNG, JPG, GIF'}</p>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!lyricsText || !audioFile || !songTitle || !artistName}
                  className="w-full flex justify-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {timedLyrics.length > 0 ? '完成並預覽' : '開始對時'}
                </button>
              </div>
            </form>
            <div className="mt-6 pt-4 border-t border-gray-700 text-center text-xs text-gray-500">
              <h4 className="font-semibold text-gray-400 mb-1">行動裝置使用建議</h4>
              <p>建議使用電腦以獲得最佳體驗，特別是影片匯出功能。若使用手機，建議橫向操作以便對時。</p>
            </div>
          </div>
        );
    }
  };

  return (
    <main className={`min-h-screen bg-gray-900 text-white p-4 transition-opacity duration-500 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
      <div className="container mx-auto flex items-center justify-center h-full">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;