import { atlasKnowledge } from './atlasKnowledge';
import { AtlasIntent } from './atlasTypes';

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function findAtlasAnswer(query: string): AtlasIntent | null {
  const normalised = normalise(query);
  if (!normalised) return null;

  const scored = atlasKnowledge.map((intent) => {
    // Check for exact title match
    if (normalise(intent.title) === normalised) {
      return { intent, score: 100 };
    }

    // Score based on keywords
    let score = 0;
    intent.keywords.forEach((keyword) => {
      const normalisedKeyword = normalise(keyword);
      if (normalised.includes(normalisedKeyword)) {
        // Longer keyword matches worth more
        score += normalisedKeyword.length * 2;
      }
    });

    return { intent, score };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];

  // Threshold to avoid very weak matches
  if (!best || best.score < 5) {
    return null;
  }

  return best.intent;
}

export const FALLBACK_ANSWER = "I do not have a confirmed answer for that yet. HourWise is still being shaped, so your input would be very useful. Would you like to leave this as a question or feature request for the team?";
