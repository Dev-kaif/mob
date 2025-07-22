import Dexie, { type EntityTable } from 'dexie';

export interface UploadedFile {
  id: string;
  name:string;
  location: string;
  // Content is no longer stored here
}

export interface FileContent {
    id?: number; // Optional auto-incrementing primary key
    fileId: string;
    fileName: string; // The name of the Excel file
    recordId: string; // The ID from the "Search from" column of the Excel file
    content: any; // The full row data as a JSON object
    status: 'pending' | 'processed' | 'synced'; // New field to track sync status
    uniqueId?: string; // Generated unique ID
    processedBy?: string; // User ID who processed it
    processedAt?: string; // ISO date string
    pdfName?: string;
    photo?: string; // base64 image data
    bundleNo?: number; // To associate the record with a specific bundle
}

class AppDatabase extends Dexie {
  uploadedFiles!: EntityTable<UploadedFile, 'id'>;
  fileContents!: EntityTable<FileContent, 'id'>;

  constructor() {
    super('AppDatabase');
    this.version(18).stores({ // Incremented version
      uploadedFiles: 'id, name, location',
      fileContents: '++id, [fileId+recordId], recordId, status, uniqueId, fileName', // Added fileName
    });
  }
}

export const db = new AppDatabase();

    