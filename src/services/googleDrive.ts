/** @file Service module for Google Drive API integration (backup, personal data sync).
 * Requires the Google Identity Services (GIS) and Google API Client (GAPI) libraries.
 */
import { type BackupData } from '../types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'dentalraktar_backup.json';

// Types for GAPI and GIS
declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gapi: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        google: any;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenClient: any;
let gapiInited = false;
let gisInited = false;

/** Represents a file entry returned by the Google Drive API. */
export interface DriveFile {
    id: string;
    name: string;
    modifiedTime: string;
}

/** Service object providing methods for Google Drive operations including
 * authentication, file listing, upload, and download.
 */
export const googleDriveService = {
    /** Return whether the Google API credentials have been set via environment variables. */
    isConfigured: () => !!CLIENT_ID && !!API_KEY,

    /**
     * Load the GAPI and GIS client libraries dynamically and initialise them.
     * Resolves once both libraries are ready, rejects on load error.
     * @returns A promise that resolves when scripts are loaded and initialised.
     */
    loadScripts: () => {
        return new Promise<void>((resolve, reject) => {
            if (gapiInited && gisInited) {
                resolve();
                return;
            }

            const script1 = document.createElement('script');
            script1.src = 'https://apis.google.com/js/api.js';
            script1.onload = () => {
                window.gapi.load('client', async () => {
                    await window.gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                    });
                    gapiInited = true;
                    if (gisInited) resolve();
                });
            };
            script1.onerror = reject;
            document.body.appendChild(script1);

            const script2 = document.createElement('script');
            script2.src = 'https://accounts.google.com/gsi/client';
            script2.onload = () => {
                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: '', // defined at request time
                });
                gisInited = true;
                if (gapiInited) resolve();
            };
            script2.onerror = reject;
            document.body.appendChild(script2);
        });
    },

    /**
     * Initiate Google OAuth 2.0 sign-in and request an access token for Drive.
     * @returns A promise that resolves with the access token string.
     */
    signIn: () => {
        return new Promise<string>((resolve, reject) => {
            if (!tokenClient) return reject('Google Identity Services not initialized');
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tokenClient.callback = async (resp: any) => {
                if (resp.error) {
                    reject(resp);
                }
                resolve(resp.access_token);
            };

            // Request permission to access Drive
            if (window.gapi.client.getToken() === null) {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                tokenClient.requestAccessToken({ prompt: '' });
            }
        });
    },

    /** Revoke the current OAuth access token and clear the gapi client token. */
    signOut: () => {
        const token = window.gapi.client.getToken();
        if (token !== null) {
            window.google.accounts.oauth2.revoke(token.access_token);
            window.gapi.client.setToken('');
        }
    },

    /**
     * Search for the backup file in the app-specific data folder or root (if using drive.file scope).
     * @returns A promise that resolves with the found DriveFile or null if not found.
     */
    findBackup: async (): Promise<DriveFile | null> => {
        return googleDriveService.findFileByName(BACKUP_FILENAME);
    },

    /**
     * Search for a file by its exact name in Google Drive.
     * @param fileName - The exact name of the file to search for.
     * @returns A promise that resolves with the DriveFile if found, or null.
     */
    findFileByName: async (fileName: string): Promise<DriveFile | null> => {
        try {
            const response = await window.gapi.client.drive.files.list({
                q: `name = '${fileName}' and trashed = false`,
                fields: 'files(id, name, modifiedTime)',
                spaces: 'drive',
            });
            const files = response.result.files;
            if (files && files.length > 0) {
                return files[0];
            }
            return null;
        } catch (err) {
            console.error(`Error finding file ${fileName}:`, err);
            throw err;
        }
    },

    /**
     * Upload (create or update) a personal details JSON file to Google Drive.
     * If a file with the same name already exists it is patched; otherwise a new file is created.
     * @param data - The personal details payload to upload.
     * @returns A promise that resolves with the Drive API response JSON.
     */
    uploadPersonalDetails: async (data: unknown) => {
        const fileName = 'personalDetails.json';
        const fileContent = JSON.stringify(data, null, 2);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
        };

        const accessToken = window.gapi.client.getToken().access_token;
        const existing = await googleDriveService.findFileByName(fileName);

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (existing) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`;
            method = 'PATCH';
        }

        const response = await fetch(url, {
            method: method,
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form,
        });

        if (!response.ok) throw new Error('Upload failed');
        return await response.json();
    },

    /**
     * Download the personal details JSON file from Google Drive by its file ID.
     * @param fileId - The Google Drive file ID of the personal details file.
     * @returns A promise that resolves with the downloaded data.
     */
    downloadPersonalDetails: async (fileId: string): Promise<unknown> => {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        return response.result;
    },

    /**
     * Upload (create or update) a full backup JSON file to Google Drive.
     * If a backup with the same filename already exists it is patched; otherwise a new file is created.
     * @param data - The BackupData object to serialise and upload.
     * @returns A promise that resolves with the Drive API response JSON.
     */
    uploadBackup: async (data: BackupData) => {
        const fileContent = JSON.stringify(data);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            name: BACKUP_FILENAME,
            mimeType: 'application/json',
        };

        const accessToken = window.gapi.client.getToken().access_token;
        const existing = await googleDriveService.findBackup();

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (existing) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`;
            method = 'PATCH';
        }

        const response = await fetch(url, {
            method: method,
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form,
        });

        if (!response.ok) throw new Error('Upload failed');
        return await response.json();
    },

    /**
     * Download a backup JSON file from Google Drive by its file ID.
     * @param fileId - The Google Drive file ID of the backup.
     * @returns A promise that resolves with the parsed BackupData object.
     */
    downloadBackup: async (fileId: string): Promise<BackupData> => {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        return response.result as BackupData; // This should be the JSON object
    }
};
