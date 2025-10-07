import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates lyrics for a given song and artist using the Gemini API.
 * @param song The title of the song.
 * @param artist The name of the artist.
 * @returns A promise that resolves to the generated lyrics as a string.
 */
export const generateLyrics = async (song: string, artist: string): Promise<string> => {
  const prompt = `請為歌曲「${song}」，由「${artist}」演唱，生成完整的歌詞。請只回傳歌詞內文，不要包含任何標題、歌曲資訊或額外說明，直接以第一句歌詞開始。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    // Using the .text accessor is the most direct way to get the string output.
    const lyrics = response.text;
    
    if (!lyrics) {
        throw new Error("AI did not return any lyrics.");
    }
    
    return lyrics.trim();

  } catch (error) {
    console.error("Error generating lyrics with Gemini API:", error);
    throw new Error("無法生成歌詞，請稍後再試。");
  }
};
