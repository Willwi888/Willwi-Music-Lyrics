import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import { TimedLyric } from './types';
import Loader from './components/Loader';
import VideoGenerator from './components/VideoGenerator';
import VideoIcon from './components/icons/VideoIcon';
import LockIcon from './components/icons/LockIcon';
import FeedbackModal from './components/FeedbackModal';


type AppState = 'CHOOSER' | 'FORM' | 'TIMING' | 'PREVIEW' | 'VIDEO_GENERATOR';
type InputMethod = 'upload' | 'link';

const DEFAULT_BG_IMAGE = 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg';

const feedbackMessages = [
  "太精準了，您是對時的藝術家！",
  "傳說中的高手出現！節奏感無人能敵！",
  "實力水準高於80%，非常出色！",
  "精準度一流！音樂在您的指尖跳動。",
  "完成度極高，可以出道了！",
  "不錯喔！繼續保持這個感覺。",
  "威威說下一次請加油～開玩笑的，您做得很棒！"
];

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

const convertGoogleDriveLink = (url: string): string | null => {
    const regex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return null;
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('CHOOSER');
  const [lyricsText, setLyricsText] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioInputMethod, setAudioInputMethod] = useState<InputMethod>('upload');
  const [audioUrlInput, setAudioUrlInput] = useState('');

  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [imageInputMethod, setImageInputMethod] = useState<InputMethod>('upload');
  const [imageUrlInput, setImageUrlInput] = useState('');

  const [timedLyrics, setTimedLyrics] = useState<TimedLyric[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const srtInputRef = useRef<HTMLInputElement>(null);

  const [isAiGeneratorUnlocked, setIsAiGeneratorUnlocked] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [audioBlobUrl, setAudioBlobUrl] = useState('');
  const [imageBlobUrl, setImageBlobUrl] = useState('');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [audioFetchError, setAudioFetchError] = useState('');
  const [imageFetchError, setImageFetchError] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (audioInputMethod === 'link' && audioUrlInput) {
      const convertedUrl = convertGoogleDriveLink(audioUrlInput);
      setAudioBlobUrl('');
      setAudioFetchError('');

      if (convertedUrl) {
        setIsAudioLoading(true);
        const controller = new AbortController();
        const signal = controller.signal;

        fetch(convertedUrl, { signal })
          .then(res => {
            if (!res.ok) throw new Error(`無法擷取檔案 (${res.status})`);
            return res.blob();
          })
          .then(blob => {
            setAudioBlobUrl(URL.createObjectURL(blob));
          })
          .catch(err => {
            if (err.name !== 'AbortError') {
              setAudioFetchError(err.message);
            }
          })
          .finally(() => {
            setIsAudioLoading(false);
          });
          
        return () => controller.abort();
      }
    } else {
      setAudioBlobUrl('');
      setAudioFetchError('');
    }
  }, [audioInputMethod, audioUrlInput]);

  useEffect(() => {
    if (imageInputMethod === 'link' && imageUrlInput) {
      const convertedUrl = convertGoogleDriveLink(imageUrlInput);
      setImageBlobUrl('');
      setImageFetchError('');

      if (convertedUrl) {
        setIsImageLoading(true);
         const controller = new AbortController();
        const signal = controller.signal;

        fetch(convertedUrl, { signal })
          .then(res => {
            if (!res.ok) throw new Error(`無法擷取檔案 (${res.status})`);
            return res.blob();
          })
          .then(blob => {
            setImageBlobUrl(URL.createObjectURL(blob));
          })
          .catch(err => {
            if (err.name !== 'AbortError') {
              setImageFetchError(err.message);
            }
          })
          .finally(() => {
            setIsImageLoading(false);
          });

        return () => controller.abort();
      }
    } else {
        setImageBlobUrl('');
        setImageFetchError('');
    }
  }, [imageInputMethod, imageUrlInput]);

  const audioUrl = useMemo(() => {
    if (audioInputMethod === 'upload' && audioFile) {
      return URL.createObjectURL(audioFile);
    }
    if (audioInputMethod === 'link') {
      return audioBlobUrl;
    }
    return '';
  }, [audioFile, audioInputMethod, audioBlobUrl]);

  const backgroundImageUrl = useMemo(() => {
    if (imageInputMethod === 'upload' && backgroundImage) {
      return URL.createObjectURL(backgroundImage);
    }
    if (imageInputMethod === 'link' && imageBlobUrl) {
      return imageBlobUrl;
    }
    return DEFAULT_BG_IMAGE;
  }, [backgroundImage, imageInputMethod, imageBlobUrl]);


  const handleStartTiming = (e: React.FormEvent) => {
    e.preventDefault();
    if (lyricsText && audioUrl && songTitle && artistName) {
      if (timedLyrics.length > 0) {
        setAppState('PREVIEW');
      } else {
        setAppState('TIMING');
      }
    } else {
      alert('請填寫所有必填欄位並提供有效的音訊來源！');
    }
  };

  const handleTimingComplete = useCallback((lyrics: TimedLyric[]) => {
    setTimedLyrics(lyrics);
    const randomIndex = Math.floor(Math.random() * feedbackMessages.length);
    setFeedbackMessage(feedbackMessages[randomIndex]);
  }, []);

  const handleBackToForm = useCallback(() => {
    setAppState('FORM');
  }, []);
  
  const handleBackToTiming = useCallback(() => {
    setAppState('TIMING');
  }, []);

  const handleBackToChooser = useCallback(() => {
    setAppState('CHOOSER');
  }, []);
  
  const handleImportSrtClick = () => {
    srtInputRef.current?.click();
  };

  const parseSrtTextOnly = (srtContent: string): string => {
    const lines = srtContent.replace(/\r/g, '').split('\n');
    const lyricLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed === '') return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (trimmed.includes('-->')) return false;
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
        if (parsedTimedLyrics.length > 0) {
          setTimedLyrics(parsedTimedLyrics);
          const plainLyrics = parsedTimedLyrics.map(l => l.text).join('\n');
          setLyricsText(plainLyrics);
          alert('SRT 檔案已成功匯入並對時！請點擊「開始對時」按鈕直接進入預覽。');
        } else {
          const parsedLyrics = parseSrtTextOnly(srtContent);
          setLyricsText(parsedLyrics);
          setTimedLyrics([]);
        }
      }
    };
    reader.onerror = () => {
      alert('讀取 SRT 檔案時發生錯誤。');
    };
    reader.readAsText(file);
    
    if(e.target) e.target.value = ''; 
  };
  
  const handleLyricsTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLyricsText(e.target.value);
    if (timedLyrics.length > 0) {
      setTimedLyrics([]);
    }
  };
  
  const isFormValid = useMemo(() => {
    const isAudioReady = audioInputMethod === 'upload' ? !!audioFile : !!audioBlobUrl;
    return !!(lyricsText && isAudioReady && songTitle && artistName);
  }, [lyricsText, audioInputMethod, audioFile, audioBlobUrl, songTitle, artistName]);

  const handleUnlockAiGenerator = () => {
    if (isAiGeneratorUnlocked) return;
    const password = prompt('請輸入密碼以解鎖 AI 功能：');
    if (password === '2580') {
      setIsAiGeneratorUnlocked(true);
      alert('AI 影片生成器已解鎖！');
    } else if (password !== null) { // User didn't click cancel
      alert('密碼錯誤！');
    }
  };


  const renderContent = () => {
    switch (appState) {
      case 'CHOOSER':
        return (
          <div className="w-full max-w-2xl p-8 space-y-8 relative">
            <div className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Creative Suite</h1>
                <p className="mt-3 text-lg text-gray-400">Choose a tool to start your creation.</p>
            </div>
            <div className={`grid grid-cols-1 ${isAiGeneratorUnlocked ? 'md:grid-cols-2' : ''} gap-6`}>
                <div 
                    onClick={() => setAppState('FORM')} 
                    className="group relative p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 hover:border-gray-500 transition-all duration-300 cursor-pointer flex flex-col items-center text-center"
                >
                    <MusicIcon className="w-16 h-16 text-gray-400 group-hover:text-white transition-colors"/>
                    <h3 className="mt-4 text-xl font-bold text-white">Lyric Video Maker</h3>
                    <p className="mt-2 text-sm text-gray-400">Create dynamic lyric videos synced with your music and background art.</p>
                </div>
                {isAiGeneratorUnlocked && (
                  <div 
                      onClick={() => setAppState('VIDEO_GENERATOR')}
                      className="group relative p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 hover:border-gray-500 transition-all duration-300 cursor-pointer flex flex-col items-center text-center animate-fade-in"
                  >
                      <VideoIcon className="w-16 h-16 text-gray-400 group-hover:text-white transition-colors"/>
                      <h3 className="mt-4 text-xl font-bold text-white">AI Video Generator</h3>
                      <p className="mt-2 text-sm text-gray-400">Generate a short video from an image and a text prompt using Veo.</p>
                  </div>
                )}
            </div>
             <div className="text-center text-xs text-gray-500">
              <p>Willwi143/MV</p>
            </div>
            {!isAiGeneratorUnlocked && (
              <div className="absolute bottom-0 right-0 p-2">
                <button 
                  onClick={handleUnlockAiGenerator} 
                  title="解鎖進階功能"
                  className="p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                >
                  <LockIcon className="w-6 h-6 text-gray-500 hover:text-white" />
                </button>
              </div>
            )}
            <style>{`
              @keyframes fade-in {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
              }
              .animate-fade-in {
                animation: fade-in 0.5s ease-out forwards;
              }
            `}</style>
          </div>
        );
      case 'VIDEO_GENERATOR':
        return <VideoGenerator onBack={handleBackToChooser} />;
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
        const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
          <button
              type="button"
              onClick={onClick}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                  active
                      ? 'text-white border-b-2 border-gray-400'
                      : 'text-gray-400 hover:text-white'
              }`}
          >
              {children}
          </button>
        );

        return (
          <div className="w-full max-w-lg p-8 space-y-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
            <div className="text-center">
              <MusicIcon className="w-12 h-12 mx-auto text-gray-400" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                三分鐘泡麵歌詞 MV
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                上傳你的「泡麵音樂」與歌詞，三分鐘煮出專屬動態歌詞 MV！
              </p>
            </div>
            <form onSubmit={handleStartTiming} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="song-title" className="block text-sm font-medium text-gray-300 mb-2">
                    歌曲口味名稱
                  </label>
                  <input
                    type="text"
                    id="song-title"
                    className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                    placeholder="請輸入這碗歌的名字"
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="artist-name" className="block text-sm font-medium text-gray-300 mb-2">
                    主廚名稱（歌手）
                  </label>
                  <input
                    type="text"
                    id="artist-name"
                    className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                    placeholder="請輸入主廚大名"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300">
                        歌詞配料區
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
                  placeholder="請在此貼上你的歌詞配方..."
                  value={lyricsText}
                  onChange={handleLyricsTextChange}
                  required
                />
              </div>

              {/* Audio Input */}
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">主湯音訊檔（必加）</label>
                  <div className="flex border-b border-gray-700 mb-2">
                      <TabButton active={audioInputMethod === 'upload'} onClick={() => setAudioInputMethod('upload')}>上傳檔案</TabButton>
                      <TabButton active={audioInputMethod === 'link'} onClick={() => setAudioInputMethod('link')}>使用連結</TabButton>
                  </div>
                  {audioInputMethod === 'upload' ? (
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                          <div className="space-y-1 text-center">
                              <MusicIcon className="mx-auto h-12 w-12 text-gray-500" />
                              <div className="flex text-sm text-gray-400">
                                  <label htmlFor="audio-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                                      <span>上傳檔案</span>
                                      <input id="audio-upload" name="audio-upload" type="file" className="sr-only" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                                  </label>
                                  <p className="pl-1">或直接拖曳進鍋裡</p>
                              </div>
                              <p className="text-xs text-gray-500">{audioFile ? audioFile.name : '未選擇任何主湯'}</p>
                              <p className="text-xs text-gray-600">MP3, WAV, FLAC, etc.</p>
                          </div>
                      </div>
                  ) : (
                      <div>
                          <input
                              type="url"
                              className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                              placeholder="貼上 Google 雲端硬碟分享連結..."
                              value={audioUrlInput}
                              onChange={(e) => setAudioUrlInput(e.target.value)}
                          />
                           <p className="text-xs text-gray-500 mt-1">請確保連結權限為「知道連結的任何人」。</p>
                           {isAudioLoading && <p className="text-xs text-blue-400 mt-1">正在載入音訊...</p>}
                           {audioFetchError && <p className="text-xs text-red-400 mt-1">載入失敗: {audioFetchError}</p>}
                           {audioBlobUrl && <p className="text-xs text-green-400 mt-1">音訊已成功載入！</p>}
                      </div>
                  )}
              </div>
              
              {/* Image Input */}
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">專輯／背景佐料（可選）</label>
                  <div className="flex border-b border-gray-700 mb-2">
                      <TabButton active={imageInputMethod === 'upload'} onClick={() => setImageInputMethod('upload')}>上傳檔案</TabButton>
                      <TabButton active={imageInputMethod === 'link'} onClick={() => setImageInputMethod('link')}>使用連結</TabButton>
                  </div>
                  {imageInputMethod === 'upload' ? (
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
                              <p className="text-xs text-gray-500">{backgroundImage ? backgroundImage.name : '未選擇任何佐料圖片'}</p>
                              <p className="text-xs text-gray-600">PNG, JPG, GIF</p>
                          </div>
                      </div>
                  ) : (
                      <div>
                          <input
                              type="url"
                              className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                              placeholder="貼上 Google 雲端硬碟分享連結..."
                              value={imageUrlInput}
                              onChange={(e) => setImageUrlInput(e.target.value)}
                          />
                          {isImageLoading && <p className="text-xs text-blue-400 mt-1">正在載入圖片...</p>}
                          {imageFetchError && <p className="text-xs text-red-400 mt-1">載入失敗: {imageFetchError}</p>}
                          {imageBlobUrl && <p className="text-xs text-green-400 mt-1">圖片已成功載入！</p>}
                      </div>
                  )}
              </div>


              <div>
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="w-full flex justify-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {timedLyrics.length > 0 ? '完成並預覽' : '開始對時！開火！'}
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">（對準每句歌詞的沸點）</p>
              </div>
            </form>
            <div className="mt-6 pt-4 border-t border-gray-700 text-center text-xs text-gray-500">
              <h4 className="font-semibold text-gray-400 mb-1">行動裝置操作建議</h4>
              <p>建議使用電腦煮麵，影片匯出更順滑。若使用手機，橫向操作比較不會翻鍋。</p>
            </div>
          </div>
        );
    }
  };

  return (
    <main className={`min-h-screen bg-gray-900 text-white p-4 transition-opacity duration-500 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
       {feedbackMessage && (
        <FeedbackModal
          message={feedbackMessage}
          onClose={() => {
            setFeedbackMessage(null);
            setAppState('PREVIEW');
          }}
        />
      )}
      <div className="container mx-auto flex items-center justify-center h-full">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;