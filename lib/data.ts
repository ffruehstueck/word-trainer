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
    const allFiles = JSON.parse(filesContent);
    
    // Filter out test.json if not in development mode
    if (process.env.NODE_ENV !== 'development') {
      return allFiles.filter((file: FileOption) => file.value !== 'test.json');
    }
    
    return allFiles;
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
    let words: Word[] = JSON.parse(fileContent);
    
    // Transform words: if source has 3 parts separated by " - ", split them
    words = words.map((word) => {
      const sourceParts = word.source.split(' - ').map(part => part.trim());
      if (sourceParts.length === 3) {
        // Keep first part as source, combine last two parts with target
        return {
          ...word,
          source: sourceParts[0],
          target: `${sourceParts[1]} - ${sourceParts[2]} / ${word.target}`
        };
      }
      return word;
    });
    
    return words;
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

