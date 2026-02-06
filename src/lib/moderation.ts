const PROFANITY_LIST = [
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cock",
  "cunt",
  "damn",
  "dick",
  "dildo",
  "fuck",
  "motherfucker",
  "nigger",
  "nigga",
  "penis",
  "piss",
  "pussy",
  "rape",
  "retard",
  "shit",
  "slut",
  "twat",
  "vagina",
  "whore",
];

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalizeLeet(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
}

export function containsProfanity(text: string): boolean {
  const normalized = normalizeLeet(text);
  return PROFANITY_LIST.some((word) => {
    const re = new RegExp(`\\b${word}\\b`, "i");
    return re.test(normalized);
  });
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: "Name must be at least 2 characters" };
  }
  if (trimmed.length > 20) {
    return { valid: false, error: "Name must be 20 characters or fewer" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Only letters, numbers, _ and - allowed",
    };
  }
  if (containsProfanity(trimmed)) {
    return { valid: false, error: "That name isn't allowed" };
  }
  return { valid: true };
}

export function validateMessage(content: string): ValidationResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return { valid: false, error: "Message cannot be empty" };
  }
  if (trimmed.length > 500) {
    return { valid: false, error: "Message too long (max 500 characters)" };
  }
  if (containsProfanity(trimmed)) {
    return { valid: false, error: "Message contains inappropriate language" };
  }
  return { valid: true };
}
