import { GoogleGenAI } from "@google/genai";
import { TimedLyric } from '../types';

// Helper to convert a File object to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

// Helper function to convert SRT time format (HH:MM:SS,ms) to seconds
const srtTimeToSeconds = (time: string): number => {
  const parts = time.split(/[:,]/);
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  const milliseconds = parseInt(parts[3], 10);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

// Parser for SRT content that extracts timing information
const parseSrtWithTimestamps = (srtContent: string): TimedLyric[] => {
  const blocks = srtContent.trim().replace(/\r/g, '').split('\n\n');
  const timedLyrics: TimedLyric[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue; // Changed to 2 to handle blocks without text

    const timeLine = lines.find(l => l.includes('-->'));
    if (timeLine) {
       try {
        const textLines = lines.filter(l => !/^\d+$/.test(l.trim()) && !l.includes('-->'));
        const text = textLines.join('\n');

        const [startTimeStr, endTimeStr] = timeLine.split(' --> ');
        
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


export const generateLyricsTiming = async (
  audioFile: File,
  lyricsText: string
): Promise<TimedLyric[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const audioData = await fileToBase64(audioFile);

    const audioPart = {
      inlineData: {
        mimeType: audioFile.type,
        data: audioData,
      },
    };

    const systemInstruction = "You are a precise audio-to-text synchronization tool. Your sole purpose is to generate SRT timestamps for given lyrics based on an audio file.";
    const prompt = `Please analyze the provided audio file and the following lyrics. Generate a timestamped SRT file that accurately synchronizes each line of the lyrics with the vocals in the audio.

RULES:
- The output must be ONLY the content of the SRT file, with no extra explanations, introductions, or pleasantries.
- Each line of the lyrics should correspond to a single SRT block.
- Ensure the start and end times are as accurate as possible, reflecting when the vocal for that line begins and ends.

LYRICS:
---
${lyricsText}
---
`;

    const textPart = {
        text: prompt
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [textPart, audioPart] },
        config: { systemInstruction }
    });

    const srtResponse = response.text;
    if (!srtResponse) {
        throw new Error('AI did not return a response.');
    }
    
    // Clean up potential markdown code block fences
    const cleanedSrt = srtResponse.replace(/```srt\n/g, '').replace(/```/g, '').trim();

    const timedLyrics = parseSrtWithTimestamps(cleanedSrt);

    if (timedLyrics.length === 0) {
        console.error("Parsed SRT resulted in empty array. Raw AI response:", srtResponse);
        throw new Error('AI failed to generate valid SRT timings.');
    }

    return timedLyrics;

  } catch (error) {
    console.error('Error during AI lyrics timing generation:', error);
    if (error instanceof Error) {
       throw new Error(`AI 對時失敗: ${error.message}`);
    }
    throw new Error('發生未知錯誤，AI 對時失敗。');
  }
};
