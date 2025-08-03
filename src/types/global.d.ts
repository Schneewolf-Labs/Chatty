// Global type declarations to resolve interface conflicts

declare module 'tmi.js' {
  export = tmi;
  declare const tmi: any;
}

// Use declaration merging to make interfaces more compatible
declare global {
  interface DrawManager {
    extractPrompt?: any;
    draw?: any;
    caption?: any;
    settings?: any;
    on?: any;
  }
  
  interface VoiceService {
    isBlocking?: boolean;
  }
  
  interface Persona {
    name?: string;
  }
  
  interface Config {
    messages?: any;
  }
}

export {};