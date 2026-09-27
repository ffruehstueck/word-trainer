import fs from 'fs';
import path from 'path';
import { Word } from '@/types';

export interface FileOption {
  value: string;
  label: string;
  grade?: number;
  unit?: number;
}

// Server-side function to load available files
export async function getAvailableFiles(): Promise<FileOption[]> {
  try {
    const filesPath = path.join(process.cwd(), 'public', 'data', 'files.json');
    const filesContent = fs.readFileSync(filesPath, 'utf-8');
    const allFiles: FileOption[] = JSON.parse(filesContent);
    allFiles.sort((a, b) =>
      (b.grade ?? 0) - (a.grade ?? 0) || (b.unit ?? 0) - (a.unit ?? 0)
    );
    
    // Filter out test.json if not in development mode
    if (process.env.NODE_ENV !== 'development') {
      return allFiles.filter((file: FileOption) => file.value !== 'test.json');
    }
    
    return allFiles;
  } catch (error) {
    console.error('Error loading files list:', error);
    // Return default if manifest doesn't exist
    return [];
  }
}

// Server-side function to load words from a single file
export async function loadWordsFromFile(fileName: string): Promise<Word[]> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', fileName);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading file ${fileName}:`, error);
    return [];
  }
}

// Server-side function to load all words from all files
export async function loadAllWords(): Promise<Word[]> {
  const files = await getAvailableFiles();
  const allWords: Word[] = [];
  
  for (const file of files) {
    const words = await loadWordsFromFile(file.value);
    allWords.push(...words);
  }
  
  return allWords;
}

export async function loadOlderWords(fileSelection: string): Promise<Word[]> {
  const files = await getAvailableFiles();
  const selected = files.find(file => file.value === fileSelection);
  if (selected?.grade === undefined || selected.unit === undefined) return [];
  const older = files.filter(file => file.grade !== undefined && file.unit !== undefined &&
    (file.grade < selected.grade! || (file.grade === selected.grade && file.unit < selected.unit!)));
  return (await Promise.all(older.map(file => loadWordsFromFile(file.value)))).flat();
}

// Server-side function to load words based on file selection
export async function getWordsForFile(fileSelection: string): Promise<Word[]> {
  if (fileSelection === 'all') {
    return loadAllWords();
  } else {
    return loadWordsFromFile(fileSelection);
  }
}
