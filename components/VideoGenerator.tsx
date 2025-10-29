import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import Loader from './Loader';
import ImageIcon from './icons/ImageIcon';
import PrevIcon from './icons/PrevIcon';
import VideoIcon from './icons/VideoIcon';

const VideoGenerator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [loadingState, setLoadingState] = useState<{ message: string; progress?: number; details?: string } | null>(null);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isKeyCheckComplete, setIsKeyCheckComplete] = useState(false);

    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                try {
                    const hasKey = await window.aistudio.hasSelectedApiKey();
                    setHasApiKey(hasKey);
                } catch (e) {
                    console.error("Error checking for API key:", e);
                }
            }
            setIsKeyCheckComplete(true);
        };
        checkApiKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
        }
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                resolve(base64String.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleGenerate = async () => {
        if (!imageFile || !prompt.trim()) {
            alert('請上傳圖片並輸入提示文字。');
            return;
        }

        setLoadingState({ message: '正在初始化...' });
        setGeneratedVideoUrl(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            setLoadingState({ message: '正在準備圖片...' });
            const base64Data = await blobToBase64(imageFile);

            setLoadingState({ message: '正在向 AI 發送請求...' });
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                image: {
                    imageBytes: base64Data,
                    mimeType: imageFile.type,
                },
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio,
                }
            });

            setLoadingState({ message: '影片生成中... 這可能需要幾分鐘的時間。', details: '請勿關閉此分頁。' });
            
            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                setLoadingState(prev => ({ ...prev, message: '正在檢查生成狀態...' }));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }
            
            if (operation.error) {
                throw new Error(operation.error.message || 'Unknown error during generation.');
            }

            setLoadingState({ message: '正在擷取生成的影片...' });
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) {
                throw new Error('在回應中找不到影片 URI。');
            }

            const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!videoResponse.ok) {
                const errorText = await videoResponse.text();
                throw new Error(`擷取影片失敗: ${videoResponse.statusText} - ${errorText}`);
            }

            const videoBlob = await videoResponse.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            setGeneratedVideoUrl(videoUrl);

        } catch (error: any) {
            console.error('影片生成失敗:', error);
            alert(`影片生成失敗: ${error.message}`);
            if (error.message && error.message.includes('Requested entity was not found.')) {
                setHasApiKey(false);
                alert('API 金鑰錯誤。請重新選擇您的 API 金鑰。');
            }
        } finally {
            setLoadingState(null);
        }
    };

    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : '';

    if (!isKeyCheckComplete) {
        return <Loader message="正在檢查 API 金鑰設定..." />;
    }

    if (!hasApiKey) {
        return (
            <div className="w-full max-w-lg p-8 space-y-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 text-white text-center">
                <VideoIcon className="w-12 h-12 mx-auto text-gray-400" />
                <h2 className="text-2xl font-bold">需要 API 金鑰</h2>
                <p className="text-gray-300">
                    若要使用 AI 影片生成器，您需要選擇一個 Gemini API 金鑰。
                    影片生成是一項計費功能。
                </p>
                <p className="text-sm text-gray-400">
                    更多詳情，請參閱{' '}
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                        計費文件
                    </a>。
                </p>
                <div className="flex items-center justify-center gap-4 pt-4">
                    <button onClick={onBack} className="px-6 py-2 text-gray-300 font-semibold bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                        返回
                    </button>
                    <button
                        onClick={handleSelectKey}
                        className="px-6 py-2 bg-[#a6a6a6] text-gray-900 font-bold rounded-lg border border-white/50 hover:bg-[#999999] transition-all"
                    >
                        選擇 API 金鑰
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {loadingState && <Loader message={loadingState.message} details={loadingState.details} />}
            <div className="w-full max-w-4xl p-8 space-y-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
                 <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <VideoIcon className="w-10 h-10 text-gray-400 flex-shrink-0" />
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">
                          AI 影片生成器
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                          上傳一張圖片，輸入您的想法，讓 AI 為您創造影片。
                        </p>
                      </div>
                    </div>
                    <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm flex-shrink-0 ml-4">
                      <PrevIcon className="w-6 h-6" />
                      返回
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {/* Left Column: Inputs */}
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-2">
                        起始圖片
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                          <div className="flex text-sm text-gray-400">
                            <label htmlFor="veo-image-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                              <span>上傳檔案</span>
                              <input id="veo-image-upload" name="veo-image-upload" type="file" className="sr-only" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} required />
                            </label>
                            <p className="pl-1">或拖曳至此</p>
                          </div>
                          <p className="text-xs text-gray-500">{imageFile ? imageFile.name : 'PNG, JPG, GIF'}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                       <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
                          提示文字
                       </label>
                      <textarea
                        id="prompt"
                        rows={4}
                        className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                        placeholder="例如：一隻貓在霓虹燈城市中開著跑車..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        required
                      />
                    </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-300 mb-2">
                          長寬比
                       </label>
                       <div className="flex gap-4">
                          <label className={`flex-1 p-3 border rounded-md cursor-pointer text-center transition-colors ${aspectRatio === '16:9' ? 'border-gray-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700/50'}`}>
                              <input type="radio" name="aspectRatio" value="16:9" checked={aspectRatio === '16:9'} onChange={() => setAspectRatio('16:9')} className="sr-only" />
                              <span className="font-semibold">16:9</span>
                              <span className="block text-xs text-gray-400">橫向</span>
                          </label>
                           <label className={`flex-1 p-3 border rounded-md cursor-pointer text-center transition-colors ${aspectRatio === '9:16' ? 'border-gray-400 bg-gray-700' : 'border-gray-600 hover:bg-gray-700/50'}`}>
                              <input type="radio" name="aspectRatio" value="9:16" checked={aspectRatio === '9:16'} onChange={() => setAspectRatio('9:16')} className="sr-only" />
                              <span className="font-semibold">9:16</span>
                              <span className="block text-xs text-gray-400">縱向</span>
                          </label>
                       </div>
                    </div>
                     <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={!imageFile || !prompt.trim() || !!loadingState}
                        className="w-full flex justify-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {loadingState ? '生成中...' : '生成影片'}
                      </button>
                  </div>
                  {/* Right Column: Preview */}
                  <div className="flex flex-col items-center justify-center bg-gray-900/50 border border-gray-600 rounded-md p-4 min-h-[300px] md:min-h-full">
                      {generatedVideoUrl ? (
                          <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-full object-contain rounded-md" />
                      ) : imageUrl ? (
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-contain rounded-md" />
                      ) : (
                          <div className="text-center text-gray-500">
                            <p>圖片和影片預覽</p>
                          </div>
                      )}
                  </div>
                </div>
            </div>
        </>
    );
};

export default VideoGenerator;