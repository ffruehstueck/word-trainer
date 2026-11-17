import type { Word } from "@/types";

export interface CardSides {
  displaySource: string;
  displayTarget: string;
  displaySourceLanguage: string;
  displayTargetLanguage: string;
}

export function effectiveReverse(
  wordId: number,
  reverseDirection: boolean,
  mixPrompts: boolean
): boolean {
  if (mixPrompts) return wordId % 2 === 1;
  return reverseDirection;
}

export function resolveDisplaySides(
  word: Word,
  reverse: boolean,
  options: { splitIrregularExam?: boolean } = {}
): CardSides {
  const sourceParts = word.source.split(" - ").map((part) => part.trim());
  const isIrregularTriple = sourceParts.length === 3;

  if (options.splitIrregularExam && isIrregularTriple) {
    if (reverse) {
      return {
        displaySource: word.target,
        displayTarget: word.source,
        displaySourceLanguage: word.targetLanguage,
        displayTargetLanguage: word.sourceLanguage,
      };
    }
    return {
      displaySource: sourceParts[0],
      displayTarget: `${sourceParts[1]} - ${sourceParts[2]} / ${word.target}`,
      displaySourceLanguage: word.sourceLanguage,
      displayTargetLanguage: word.targetLanguage,
    };
  }

  if (reverse) {
    return {
      displaySource: word.target,
      displayTarget: word.source,
      displaySourceLanguage: word.targetLanguage,
      displayTargetLanguage: word.sourceLanguage,
    };
  }

  return {
    displaySource: word.source,
    displayTarget: word.target,
    displaySourceLanguage: word.sourceLanguage,
    displayTargetLanguage: word.targetLanguage,
  };
}
