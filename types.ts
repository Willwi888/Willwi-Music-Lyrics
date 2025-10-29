export interface TimedLyric {
  text: string;
  startTime: number;
  endTime: number;
}

// Fix: Add a global declaration for window.aistudio using a named interface 'AIStudio'.
// This centralizes the type and resolves potential conflicts across the application.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Fix: Made the 'aistudio' property optional to resolve the "All declarations of 'aistudio' must have identical modifiers" error. This aligns with runtime checks for its existence in the application.
    aistudio?: AIStudio;
  }
}