/// <reference types="vite/client" />

declare const process: {
  env: {
    BACKEND_URL?: string;
    [key: string]: string | undefined;
  };
};
