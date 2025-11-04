import React, { useState, useCallback, useEffect } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import { TimedLyric } from './types';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lyricsText && audioFile) {
      setAppState('TIMING');
    } else {
      alert('請貼上歌詞並上傳音訊檔案！');
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
          <div className="w-full max-w-lg p-8 space-y-8 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
            <div className="text-center">
              <MusicIcon className="w-12 h-12 mx-auto text-purple-400" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                歌詞影片創作工具
              </h2>
              <p className="mt-2 text-md text-gray-400">
                上傳您的音訊與歌詞，開始創作。
              </p>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300 mb-2">
                  貼上完整歌詞 (一行一句)
                </label>
                <textarea
                  id="lyrics"
                  rows={8}
                  className="w-full px-3 py-2 text-gray-200 bg-gray-900/50 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 transition"
                  placeholder="在這裡貼上您的歌詞..."
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="w-full">
                    <label htmlFor="audio-upload" className="block text-sm font-medium text-gray-300 mb-2">
                      上傳音訊檔案
                    </label>
                    <input 
                      id="audio-upload" 
                      type="file" 
                      accept="audio/*"
                      onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden" 
                      required
                    />
                    <label htmlFor="audio-upload" className="w-full cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                      <MusicIcon className="w-5 h-5 mr-2" />
                      <span>{audioFile ? audioFile.name : '選擇檔案'}</span>
                    </label>
                  </div>
                  
                  <div className="w-full">
                    <label htmlFor="bg-upload" className="block text-sm font-medium text-gray-300 mb-2">
                      更換背景圖片 (選填)
                    </label>
                    <input 
                      id="bg-upload" 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setBackgroundImage(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                    />
                    <label htmlFor="bg-upload" className="w-full cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                      <ImageIcon className="w-5 h-5 mr-2" />
                      <span>{backgroundImage ? backgroundImage.name : '選擇圖片'}</span>
                    </label>
                  </div>
              </div>
              
              <button
                type="submit"
                className="w-full px-4 py-3 font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-300"
              >
                開始計時
              </button>
            </form>
          </div>
        );
    }
  };

  return (
    <main className="relative w-full h-screen flex items-center justify-center p-4 overflow-auto">
      <div 
        className={`app-bg absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${isMounted ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: `url(${backgroundImageUrl})` }}
      />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full flex items-center justify-center">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;