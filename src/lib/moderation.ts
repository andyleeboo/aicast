// --- Latin-script profanity (English + Spanish) ---
// Checked with word-boundary regex + leet-speak normalization
const PROFANITY_LATIN = [
  // English
  "ass", "asshole", "bastard", "bitch", "bullshit",
  "cock", "cunt", "damn", "dick", "dildo",
  "fuck", "motherfucker", "nigger", "nigga",
  "penis", "piss", "pussy", "rape", "retard",
  "shit", "slut", "twat", "vagina", "whore",
  "fag", "faggot",
  // Spanish
  "puta", "puto", "mierda", "pendejo", "pendeja",
  "cabron", "cabrón", "chinga", "chingar", "verga",
  "marica", "maricon", "maricón", "coño", "joder",
  "culo", "carajo", "hijueputa",
];

// --- CJK profanity (Korean, Japanese, Chinese) ---
// Checked as substring match after stripping whitespace
const PROFANITY_CJK = [
  // Korean
  "시발", "씨발", "씨팔", "시팔", "씨발놈", "씨발년",
  "개새끼", "새끼", "병신", "지랄", "좆",
  "미친놈", "미친년", "꺼져", "닥쳐", "엿먹어",
  "개같은", "느금마",
  // Korean jamo abbreviations
  "ㅅㅂ", "ㅂㅅ", "ㄱㅅㄲ", "ㅈㄹ", "ㄲㅈ", "ㅆㅂ",
  // Japanese
  "死ね", "しね", "シネ",
  "くたばれ", "クタバレ",
  "くそ", "クソ", "糞",
  "きもい", "キモい", "キモイ",
  "ファック",
  // Chinese
  "操", "肏", "傻逼", "煞笔",
  "他妈的", "他妈", "妈的",
  "草泥马", "狗屎", "混蛋", "王八蛋",
  "去死", "贱人", "废物",
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

/** Strip all whitespace — catches "시 발", "시  발", etc. */
function stripSpaces(text: string): string {
  return text.replace(/\s+/g, "");
}

export function containsProfanity(text: string): boolean {
  // Latin check: word-boundary regex with leet normalization
  const normalized = normalizeLeet(text);
  const hasLatin = PROFANITY_LATIN.some((word) => {
    const re = new RegExp(`\\b${word}\\b`, "i");
    return re.test(normalized);
  });
  if (hasLatin) return true;

  // CJK check: substring match on space-stripped text
  const stripped = stripSpaces(text);
  return PROFANITY_CJK.some((word) => stripped.includes(word));
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
