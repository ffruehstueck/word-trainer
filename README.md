# Word Trainer

A Next.js application for training words and phrases with batch-based learning and progress tracking.

## Features

- 📚 Load words/phrases from JSON files
- 🔢 Batch processing (default: 10 words per batch)
- 💡 Word display with translation reveal
- ✅ Track correct/incorrect answers
- 📊 Session statistics and review of unknown words
- 🎨 Modern, clean UI with Tailwind CSS

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Adding Words

Edit `public/data/words.json` to add your words and phrases. The format is:

```json
[
  {
    "id": 1,
    "source": "Hello",
    "target": "Hola",
    "sourceLanguage": "English",
    "targetLanguage": "Spanish"
  }
]
```

You can create additional JSON files and modify the code to load multiple files.

## How It Works

1. Words are loaded from JSON and split into batches (default: 10 words per batch)
2. One word is displayed at a time in the source language
3. User provides their translation
4. User clicks "Show Translation" (or scrolls up) to reveal the correct answer
5. User marks their answer as correct or incorrect
6. Correct answers are marked and won't appear again in the current batch
7. Incorrect answers remain in the batch and will be asked again
8. When all words in a batch are correct, the next batch starts
9. When all batches are complete, statistics are shown along with words that need review

## Configuration

You can adjust the batch size by modifying `BATCH_SIZE` in `app/page.tsx` (currently set to 10).

