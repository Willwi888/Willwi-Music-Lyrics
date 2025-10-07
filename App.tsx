import React, { useState, useCallback, useEffect } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import { TimedLyric } from './types';
import Loader from './components/Loader';


type AppState = 'FORM' | 'TIMING' | 'PREVIEW';

const DEFAULT_BG_IMAGE = 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('FORM');
  const [lyricsText, setLyricsText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [timedLyrics, setTimedLyrics] = useState<TimedLyric[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const audioUrl = audioFile ? URL.createObjectURL(audioFile) : '';
  const backgroundImageUrl = backgroundImage ? URL.createObjectURL(backgroundImage) : DEFAULT_BG_IMAGE;

  const handleStartTiming = (e: React.FormEvent) => {
    e.preventDefault();
    if (lyricsText && audioFile) {
      setAppState('TIMING');
    } else {
      alert('請先貼上歌詞並上傳音訊檔案！');
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
            onBack={handleBackToTiming}
          />
        );
      case 'FORM':
      default:
        return (
          <div className="w-full max-w-lg p-8 space-y-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
            <div className="text-center">
              <MusicIcon className="w-12 h-12 mx-auto text-purple-400" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                歌詞影片創作工具
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                上傳您的音樂作品與歌詞，開始製作專屬的動態歌詞 MV。
              </p>
            </div>
            <form onSubmit={handleStartTiming} className="space-y-6">
              <div>
                <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300 mb-2">
                  歌詞
                </label>
                <textarea
                  id="lyrics"
                  rows={8}
                  className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white"
                  placeholder="請在此貼上您的歌詞，一行一句..."
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
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
                      <label htmlFor="audio-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-purple-400 hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-purple-500">
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
                  背景圖片 (可選)
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                    <div className="flex text-sm text-gray-400">
                      <label htmlFor="image-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-purple-400 hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-purple-500">
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
                  disabled={!lyricsText || !audioFile}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  開始對時
                </button>
              </div>
            </form>
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
