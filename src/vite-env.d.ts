/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;
declare const __APP_VERSION__: string;
declare const __GIT_BRANCH__: string;
declare const __GIT_COMMIT__: string;

interface Window {
    localFileHandles?: Record<string, FileSystemFileHandle | File | unknown>;
}
