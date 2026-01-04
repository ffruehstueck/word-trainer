import fs from 'fs';
import path from 'path';
import { Word } from '@/types';

export interface FileOption {
  value: string;
  label: string;
}

// Server-side function to load available files
export async function getAvailableFiles(): Promise<FileOption[]> {
  try {
    const filesPath = path.join(process.cwd(), 'public', 'data', 'files.json');
    const filesContent = fs.readFileSync(filesPath, 'utf-8');
    return JSON.parse(filesContent);
  } catch (error) {
    console.error('Error loading files list:', error);
    // Return default if manifest doesn't exist
    return [{ value: 'unit-8.json', label: 'Unit-8' }];
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

// Server-side function to load words based on file selection
export async function getWordsForFile(fileSelection: string): Promise<Word[]> {
  if (fileSelection === 'all') {
    return loadAllWords();
  } else {
    return loadWordsFromFile(fileSelection);
  }
}

