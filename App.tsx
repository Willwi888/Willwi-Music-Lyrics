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
import { generateLyricsTiming } from './services/geminiService';


type AppState = 'CHOOSER' | 'FORM' | 'TIMING' | 'PREVIEW' | 'VIDEO_GENERATOR';
type InputMethod = 'upload' | 'link';

const DEFAULT_BG_IMAGE = 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg';

const feedbackMessages = [
  "阿嬤說：你這碗比隔壁孫子會考作文還香！",
  "阿嬤搖搖頭：本來想教你煮麵，結果你煮出人生。",
  "阿嬤聽完沉默三秒：你是不是偷放味精？",
  "阿嬤拍桌大喊：這碗可以拿去報金曲了啦！",
  "阿嬤邊聽邊哭：不是難過，是辣椒加太多了啦。",
  "經紀人狂敲桌：這碗有料！快上架！"
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
  const [finalFeedback, setFinalFeedback] = useState<string | null>(null);

  const [audioBlobUrl, setAudioBlobUrl] = useState('');
  const [imageBlobUrl, setImageBlobUrl] = useState('');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [audioFetchError, setAudioFetchError] = useState('');
  const [imageFetchError, setImageFetchError] = useState('');
  
  const [loadingState, setLoadingState] = useState<{ message: string; details?: string } | null>(null);


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
            // Create a file object for AI timing
            const file = new File([blob], "audio_from_link", { type: blob.type });
            setAudioFile(file);
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
  
  const handleAiTiming = async () => {
    if (!audioFile || !lyricsText || !songTitle || !artistName) {
      alert('AI 對時前，請確保已提供音訊檔、歌詞、歌曲名稱與歌手！');
      return;
    }
    setLoadingState({ message: '準備 AI 對時...' });
    try {
      setLoadingState({ message: 'AI 分析中...', details: '這可能需要一至兩分鐘，請稍候。' });
      const aiTimedLyrics = await generateLyricsTiming(audioFile, lyricsText);
      setTimedLyrics(aiTimedLyrics);
      setLoadingState(null);
      setAppState('PREVIEW');
    } catch (error) {
      setLoadingState(null);
      alert(error instanceof Error ? error.message : '發生未知錯誤');
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
          setFinalFeedback(null);
          setFeedbackMessage('SRT 匯入成功！直接為您上菜！');
        } else {
          const parsedLyrics = parseSrtTextOnly(srtContent);
          setLyricsText(parsedLyrics);
          setTimedLyrics([]);
           alert('SRT 檔案似乎沒有時間碼，已為您匯入純歌詞。');
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
    setFinalFeedback(null);
    if (timedLyrics.length > 0) {
      setTimedLyrics([]);
    }
  };
  
  const handleAudioFileChange = (file: File | null) => {
    setAudioFile(file);
    setFinalFeedback(null);
     if (timedLyrics.length > 0) {
      setTimedLyrics([]); // Reset timing if audio changes
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
      alert('AI 進階功能已解鎖！');
    } else if (password !== null) { // User didn't click cancel
      alert('密碼錯誤！');
    }
  };

  const isEncouragementMessage = useMemo(() => {
    if (!feedbackMessage) return false;
    return feedbackMessages.includes(feedbackMessage);
  }, [feedbackMessage]);


  const renderContent = () => {
    switch (appState) {
      case 'CHOOSER':
        return (
          <div className="w-full max-w-md p-8 space-y-8 flex flex-col items-center justify-center text-white relative h-screen">
            <div className="text-center space-y-8">
              <h1 className="text-5xl font-bold tracking-wider" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
                泡麵聲學院
              </h1>
      
              <div className="space-y-4">
                <button
                  onClick={() => setAppState('FORM')}
                  className="w-full px-8 py-4 bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 hover:border-gray-500 transition-all duration-300 text-3xl font-semibold"
                  style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
                >
                  阿嬤純手打歌詞器
                </button>
      
                {isAiGeneratorUnlocked && (
                  <button
                    onClick={() => setAppState('VIDEO_GENERATOR')}
                    className="w-full px-8 py-4 bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 hover:border-gray-500 transition-all duration-300 text-3xl font-semibold animate-fade-in"
                    style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
                  >
                    AI 未來拉麵
                  </button>
                )}
              </div>
            </div>
      
            <div className="absolute bottom-24 flex items-center space-x-2 text-sm text-gray-400">
              <span>溫馨小貼示</span>
              <span>煮太久會感動到哭</span>
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse-red"></span>
            </div>
      
            <div className="absolute bottom-4 right-4">
              <button
                onClick={handleUnlockAiGenerator}
                title={isAiGeneratorUnlocked ? "AI 功能已解鎖" : "解鎖 AI 功能 (密碼: 2580)"}
                className={`p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all duration-300 group ${isAiGeneratorUnlocked ? 'opacity-50 cursor-default text-green-400 hover:text-green-400' : ''}`}
                disabled={isAiGeneratorUnlocked}
              >
                <LockIcon className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" />
              </button>
            </div>
      
            <style>{`
              @keyframes pulse-red {
                50% { opacity: .5; }
              }
              .animate-pulse-red {
                animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
              @keyframes fade-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
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
            isAiGeneratorUnlocked={isAiGeneratorUnlocked}
            finalFeedback={finalFeedback}
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
                泡麵聲學院
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                在這裡，你的音樂和故事，三分鐘就能變成一道美味的影音料理！
              </p>
            </div>
            <form onSubmit={handleStartTiming} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="song-title" className="block text-sm font-medium text-gray-300 mb-2">
                    麵體（主歌）
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
                  <p className="text-xs text-gray-500 mt-1">一碗沒有麵的泡麵，就是空洞的旋律。</p>
                </div>
                <div>
                  <label htmlFor="artist-name" className="block text-sm font-medium text-gray-300 mb-2">
                    湯頭（歌手）
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
                  <p className="text-xs text-gray-500 mt-1">誰熬的湯，誰的味道最濃。</p>
                </div>
              </div>
              <div>
                 <div className="flex justify-between items-center mb-1">
                    <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300">
                        加蛋加菜區（歌詞）
                    </label>
                    <button
                      type="button"
                      onClick={handleImportSrtClick}
                      className="text-xs font-medium text-gray-400 hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
                    >
                      匯入 SRT
                    </button>
                 </div>
                 <p className="text-xs text-gray-500 mb-2">匯入 SRT 或直接貼上歌詞，讓湯頭更有層次、味道更溫柔。</p>
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

              {/* Audio Input */}
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">主湯音訊檔（選擇乾濕吃法）</label>
                  <div className="flex border-b border-gray-700 mb-2">
                      <TabButton active={audioInputMethod === 'upload'} onClick={() => setAudioInputMethod('upload')}>上傳檔案</TabButton>
                      <TabButton active={audioInputMethod === 'link'} onClick={() => setAudioInputMethod('link')}>使用連結</TabButton>
                  </div>
                  {audioInputMethod === 'upload' ? (
                      <div>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <MusicIcon className="mx-auto h-12 w-12 text-gray-500" />
                                <div className="flex text-sm text-gray-400">
                                    <label htmlFor="audio-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                                        <span>上傳檔案</span>
                                        <input id="audio-upload" name="audio-upload" type="file" className="sr-only" accept="audio/*" onChange={(e) => handleAudioFileChange(e.target.files?.[0] || null)} />
                                    </label>
                                    <p className="pl-1">或直接拖曳進來</p>
                                </div>
                                <p className="text-xs text-gray-500">{audioFile ? audioFile.name : '支援格式：MP3、WAV、FLAC 等等。'}</p>
                            </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-900/30 rounded-md"><strong className="font-bold text-gray-300">乾吃法：</strong>適合清唱版本或純伴奏。歌詞乾乾淨淨，節奏清晰入味。</div>
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
                           <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-900/30 rounded-md"><strong className="font-bold text-gray-300">濕吃法：</strong>適合完整版音軌（含人聲＋伴奏）。聽完要配衛生紙，情緒湯濃得化不開。</div>
                      </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2"><strong>小叮嚀：</strong>煮完記得「試喝湯」回放檢查音量與對時。</p>
              </div>
              
              {/* Image Input */}
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">配料加成（專輯／背景）</label>
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
                              <p className="text-xs text-gray-500">{backgroundImage ? backgroundImage.name : '支援格式：PNG、JPG、GIF'}</p>
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
                  <p className="text-xs text-gray-500 mt-1">選對配料，整碗更香。（也可用專輯封面或現場照片當背景）</p>
              </div>

              <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative w-full">
                      <button
                        type="button"
                        onClick={handleAiTiming}
                        disabled={!isFormValid || timedLyrics.length > 0 || !isAiGeneratorUnlocked}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-gray-900 bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        ✨ AI 自動對時
                      </button>
                      {!isAiGeneratorUnlocked && (
                        <div 
                            className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center rounded-md cursor-pointer group"
                            onClick={handleUnlockAiGenerator}
                            title="點擊解鎖 AI 功能 (密碼: 2580)"
                        >
                            <LockIcon className="w-6 h-6 text-gray-300 mr-2 group-hover:text-white transition-colors" />
                            <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">點擊解鎖</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={!isFormValid}
                      className="w-full flex justify-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {timedLyrics.length > 0 ? '完成並預覽' : '開始對時！開火'}
                    </button>
                 </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {timedLyrics.length > 0
                    ? '歌詞已對時，可直接預覽。若要重新對時，請修改歌詞。'
                    : !isAiGeneratorUnlocked
                    ? '慢工出真味，時間不是敵人，而是湯頭的朋友。'
                    : '（AI 神速煮麵，一分鐘上菜）'}
                </p>
              </div>
            </form>
            <div className="mt-6 pt-4 border-t border-gray-700 text-center text-xs text-gray-500">
              <h4 className="font-semibold text-gray-400 mb-1">阿嬤說：</h4>
              <p>煮麵要穩，別邊滑手機邊撈麵。建議用電腦操作，手機煮麵容易變燒焦。</p>
            </div>
          </div>
        );
    }
  };

  return (
    <main className={`min-h-screen bg-gray-900 text-white p-4 transition-opacity duration-500 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
       {loadingState && <Loader message={loadingState.message} details={loadingState.details} />}
       {feedbackMessage && (
         isEncouragementMessage ? (
          <FeedbackModal
            message={feedbackMessage}
            onKeep={(msg) => {
              setFinalFeedback(msg);
              setFeedbackMessage(null);
              setAppState('PREVIEW');
            }}
            onDiscard={() => {
              setFinalFeedback(null);
              setFeedbackMessage(null);
              setAppState('PREVIEW');
            }}
            onReroll={() => {
              let newMessage = feedbackMessage;
              while (newMessage === feedbackMessage) {
                const randomIndex = Math.floor(Math.random() * feedbackMessages.length);
                newMessage = feedbackMessages[randomIndex];
              }
              setFeedbackMessage(newMessage);
            }}
          />
         ) : (
          <FeedbackModal
            message={feedbackMessage}
            onClose={() => {
              setFeedbackMessage(null);
              setAppState('PREVIEW');
            }}
          />
         )
      )}
      <div className="container mx-auto flex items-center justify-center h-full">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;