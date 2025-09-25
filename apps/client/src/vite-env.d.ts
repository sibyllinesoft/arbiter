/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module 'react-toastify/dist/ReactToastify.css';

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly [key: string]: string | undefined;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
