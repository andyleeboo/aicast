import type { GestureReaction, EmoteCommand } from "./types";

export interface AvatarAction {
  id: string;
  type: "gesture" | "emote";
  name: string;
  tag: string;
  description: string;
  duration: string;
  constraints?: string;
  /** If true, included in the AI system prompt. Otherwise API-only. */
  aiVisible?: boolean;
}

// ── Gesture actions (always AI-visible) ─────────────────────────────

const GESTURE_ACTIONS: AvatarAction[] = [
  {
    id: "gesture:yes",
    type: "gesture",
    name: "Nod",
    tag: "NOD",
    description: "Nod head — agreement, acknowledgement, friendliness",
    duration: "~3s",
    aiVisible: true,
  },
  {
    id: "gesture:no",
    type: "gesture",
    name: "Shake",
    tag: "SHAKE",
    description: "Shake head — disagreement, denial",
    duration: "~3s",
    aiVisible: true,
  },
  {
    id: "gesture:uncertain",
    type: "gesture",
    name: "Tilt",
    tag: "TILT",
    description: "Tilt head — uncertainty, thinking, playfulness",
    duration: "~3s",
    aiVisible: true,
  },
];

// ── Expression metadata for all emotes ──────────────────────────────

interface EmoteDef {
  name: string;
  description: string;
  /** Show in AI system prompt (curated subset) */
  aiVisible?: boolean;
  constraints?: string;
}

const EMOTE_DEFS: Record<string, EmoteDef> = {
  // Core controls
  wink:        { name: "Wink", description: "Right eye winks shut, cheeky smirk. Use for: flirting, inside jokes, \"you know what I mean\"", aiVisible: true },
  blink:       { name: "Blink", description: "Quick deliberate double-blink. Use for: emphasis, punctuation, \"wait what\"", aiVisible: true },
  sleep:       { name: "Sleep", description: "Eyes droop shut, head sinks, soft breathing. Locks Bob asleep — use VERY sparingly", aiVisible: true, constraints: "Prevents further actions until wake" },
  wake:        { name: "Wake", description: "Wake up from sleep", constraints: "Only usable while sleeping" },

  // Core emotions (AI-visible — the ~25 most useful for a streamer)
  happy:       { name: "Happy", description: "Closed happy eyes, cute smile. Use for: genuine joy, good vibes, warm moments", aiVisible: true },
  sad:         { name: "Sad", description: "Tear-streak eyes, flat mouth. Use for: sympathy, disappointment, \"that's rough\"", aiVisible: true },
  surprised:   { name: "Surprised", description: "Huge round eyes, mouth wide open. Use for: genuine shock, unexpected news, \"wait WHAT\"", aiVisible: true },
  thinking:    { name: "Thinking", description: "Eyes glance to the side, slight frown. Use for: pondering, considering, \"hmm actually...\"", aiVisible: true },
  angry:       { name: "Angry", description: "Intense cross-hatched eyes, gritted teeth. Use for: real frustration, ranting, \"I'm heated\"", aiVisible: true },
  confused:    { name: "Confused", description: "Mismatched eyes (one bigger), question mark mouth. Use for: not understanding, \"huh??\"", aiVisible: true },
  excited:     { name: "Excited", description: "Star eyes, huge open grin. Use for: maximum hype, big reveals, \"LET'S GO\"", aiVisible: true },
  love:        { name: "Love", description: "Heart-shaped eyes, cute smile. Use for: adoring something, \"I love that\", wholesome chat moments", aiVisible: true },
  laughing:    { name: "Laughing", description: "Squinted happy eyes, wide open grin. Use for: actually funny stuff, cracking up, can't stop laughing", aiVisible: true },
  crying:      { name: "Crying", description: "Heavy tears, mouth wide in a wail. Use for: laughing so hard you cry, genuinely moved, overwhelmed", aiVisible: true },
  smug:        { name: "Smug", description: "Half-lidded eyes, sideways smirk. Use for: self-satisfied, \"I was right\", flexing knowledge", aiVisible: true },
  shy:         { name: "Shy", description: "Eyes averted, tiny pursed mouth. Use for: compliments, embarrassment, being put on the spot", aiVisible: true },
  scared:      { name: "Scared", description: "Wide panicked eyes, mouth agape. Use for: jump scares, horror stories, \"oh no\"", aiVisible: true },
  disgusted:   { name: "Disgusted", description: "Disapproving stare, flat mouth. Use for: cringe, bad takes, \"that's cursed\"", aiVisible: true },
  cool:        { name: "Cool", description: "Dark sunglasses, smirk. Use for: being chill, flexing, \"yeah I'm that guy\"", aiVisible: true },
  dead:        { name: "Dead", description: "X eyes, flat mouth. Use for: \"I can't even\", defeated, comedic death, \"chat killed me\"", aiVisible: true },
  uwu:         { name: "UwU", description: "Soft round eyes, gentle smile. Use for: wholesome, cute moments, \"aww\"", aiVisible: true },
  sparkles:    { name: "Sparkles", description: "Star-shaped sparkling eyes, wide smile. Use for: amazement, admiration, discovering something cool", aiVisible: true },
  pouting:     { name: "Pouting", description: "Round eyes, puckered kissing mouth. Use for: wanting attention, \"chat please\", playful begging", aiVisible: true },
  judging:     { name: "Judging", description: "Flat disapproving stare. Use for: skepticism, calling someone out, \"really?\"", aiVisible: true },
  mindblown:   { name: "Mind Blown", description: "Massive dilated eyes, mouth frozen open. Use for: mind = blown, galaxy brain moments", aiVisible: true },
  shrug:       { name: "Shrug", description: "Relaxed half-lidded eyes, slight grin. Use for: \"whatever\", \"idk\", casual indifference", aiVisible: true },
  flirty:      { name: "Flirty", description: "One eye winks, kiss mouth. Use for: charm, teasing, \"hey there\"", aiVisible: true },
  hyper:       { name: "Hyper", description: "Star eyes, huge triangle grin. Use for: maximum unhinged energy, bouncing off walls", aiVisible: true },
  sleepy:      { name: "Sleepy", description: "Heavy drooping eyes, wavy mouth. Use for: tired, late stream, \"it's 3am energy\"", aiVisible: true },

  // Remaining expressions (API-only, not in AI prompt)
  worried:     { name: "Worried", description: "；∧； — worry, concern" },
  nervous:     { name: "Nervous", description: "'∀' — anxious fidgeting" },
  proud:       { name: "Proud", description: "⌐▽⌐ — pride, achievement" },
  bored:       { name: "Bored", description: "￣ε￣ — boredom" },
  tired:       { name: "Tired", description: "=ω= — exhaustion" },
  determined:  { name: "Determined", description: "•̀﹃•́ — determination" },
  joy:         { name: "Joy", description: "◕ᴗ◕ — pure joy" },
  bliss:       { name: "Bliss", description: "˘ω˘ — blissful" },
  grinning:    { name: "Grinning", description: "＾▽＾ — big grin" },
  cheerful:    { name: "Cheerful", description: "◠◡◠ — cheerfulness" },
  gleeful:     { name: "Gleeful", description: "✧▽✧ — glee" },
  delighted:   { name: "Delighted", description: "ˊᗜˋ — delight" },
  euphoric:    { name: "Euphoric", description: "≧◡≦ — euphoria" },
  content:     { name: "Content", description: "ᵕᴗᵕ — contentment" },
  radiant:     { name: "Radiant", description: "☆∀☆ — radiance" },
  playful:     { name: "Playful", description: "◕ε◕ — playfulness" },
  heartbroken: { name: "Heartbroken", description: "╥∩╥ — heartbreak" },
  melancholy:  { name: "Melancholy", description: "ᵕ̣̣。ᵕ̣̣ — melancholy" },
  sobbing:     { name: "Sobbing", description: "இДஇ — heavy sobbing" },
  gloomy:      { name: "Gloomy", description: "ˊωˋ — gloom" },
  depressed:   { name: "Depressed", description: "⌒_⌒ — depression" },
  lonely:      { name: "Lonely", description: "；ω； — loneliness" },
  disappointed:{ name: "Disappointed", description: "ˋεˊ — disappointment" },
  weeping:     { name: "Weeping", description: "╯Д╰ — weeping" },
  moping:      { name: "Moping", description: "−ε− — moping around" },
  miserable:   { name: "Miserable", description: "Ⱥ﹏Ⱥ — misery" },
  furious:     { name: "Furious", description: "╬Д╬ — white-hot fury" },
  irritated:   { name: "Irritated", description: "¬益¬ — irritation" },
  annoyed:     { name: "Annoyed", description: "¬ε¬ — annoyance" },
  raging:      { name: "Raging", description: "╬皿╬ — full rage" },
  grumpy:      { name: "Grumpy", description: "ˋ益ˊ — grumpiness" },
  hostile:     { name: "Hostile", description: "▼益▼ — hostility" },
  seething:    { name: "Seething", description: "╬∀╬ — seething anger" },
  frustrated:  { name: "Frustrated", description: "≧﹏≦ — frustration" },
  indignant:   { name: "Indignant", description: "ˋ_ˊ — indignation" },
  cranky:      { name: "Cranky", description: "−﹏− — crankiness" },
  shocked:     { name: "Shocked", description: "⊙Д⊙ — shock" },
  amazed:      { name: "Amazed", description: "✧○✧ — amazement" },
  astonished:  { name: "Astonished", description: "◉□◉ — astonishment" },
  startled:    { name: "Startled", description: "゜ロ゜ — startled" },
  speechless:  { name: "Speechless", description: "◎ ◎ — speechless" },
  stunned:     { name: "Stunned", description: "⊙ロ⊙ — stunned" },
  flabbergasted:{ name: "Flabbergasted", description: "Ꙫ□Ꙫ — flabbergasted" },
  awed:        { name: "Awed", description: "☆○☆ — awe" },
  dumbfounded: { name: "Dumbfounded", description: "⊙_⊙ — dumbfounded" },
  bewildered:  { name: "Bewildered", description: "◑□◐ — bewilderment" },
  adoring:     { name: "Adoring", description: "♡ᴗ♡ — adoration" },
  crushing:    { name: "Crushing", description: "♥ᴗ♥ — having a crush" },
  smitten:     { name: "Smitten", description: "♡ω♡ — smitten" },
  lovestruck:  { name: "Lovestruck", description: "❤∀❤ — lovestruck" },
  infatuated:  { name: "Infatuated", description: "♥ε♥ — infatuation" },
  yearning:    { name: "Yearning", description: "♡ε♡ — yearning" },
  charmed:     { name: "Charmed", description: "˘ε˘ — charmed" },
  devoted:     { name: "Devoted", description: "♥◡♥ — devotion" },
  tender:      { name: "Tender", description: "ᵕωᵕ — tenderness" },
  warm:        { name: "Warm", description: "◠ω◠ — warmth" },
  sassy:       { name: "Sassy", description: "￣∀￣ — sassiness" },
  cocky:       { name: "Cocky", description: "⌐ε⌐ — cockiness" },
  superior:    { name: "Superior", description: "⌐ω⌐ — superiority" },
  victorious:  { name: "Victorious", description: "≧∀≦ — victory" },
  triumphant:  { name: "Triumphant", description: "★▽★ — triumph" },
  cheeky:      { name: "Cheeky", description: "◕ε◕ — cheekiness" },
  mischievous: { name: "Mischievous", description: "¬ω¬ — mischief" },
  devious:     { name: "Devious", description: "¬▽¬ — deviousness" },
  brazen:      { name: "Brazen", description: "⌐▽⌐ — brazenness" },
  sly:         { name: "Sly", description: "−ε− — slyness" },
  puzzled:     { name: "Puzzled", description: "◑ε◐ — puzzlement" },
  pondering:   { name: "Pondering", description: "ˋωˊ — deep thought" },
  curious:     { name: "Curious", description: "◕?◕ — curiosity" },
  skeptical:   { name: "Skeptical", description: "ˋ_ˊ — skepticism" },
  questioning: { name: "Questioning", description: "?ω? — questioning" },
  perplexed:   { name: "Perplexed", description: "◎?◎ — perplexity" },
  dubious:     { name: "Dubious", description: "ˋ﹏ˊ — doubt" },
  uncertain:   { name: "Uncertain", description: "；ε； — uncertainty" },
  clueless:    { name: "Clueless", description: "？ω？ — cluelessness" },
  contemplating:{ name: "Contemplating", description: "ˋ。ˊ — contemplation" },
  terrified:   { name: "Terrified", description: "⊙Д⊙ — terror" },
  anxious:     { name: "Anxious", description: "；﹏； — anxiety" },
  panicked:    { name: "Panicked", description: "゜□゜ — panic" },
  spooked:     { name: "Spooked", description: "⊙∧⊙ — spooked" },
  uneasy:      { name: "Uneasy", description: "'﹏' — unease" },
  dread:       { name: "Dread", description: "⊙﹏⊙ — dread" },
  timid:       { name: "Timid", description: "；∧； — timidity" },
  petrified:   { name: "Petrified", description: "ꙪДꙪ — petrified" },
  jumpy:       { name: "Jumpy", description: "゜∀゜ — jumpiness" },
  creepedout:  { name: "Creeped Out", description: "⊙ε⊙ — creeped out" },
  kawaii:      { name: "Kawaii", description: "◕ω◕ — super cute" },
  innocent:    { name: "Innocent", description: "◕。◕ — innocence" },
  bubbly:      { name: "Bubbly", description: "◠▽◠ — bubbly" },
  adorable:    { name: "Adorable", description: "˘ᴗ˘ — adorableness" },
  puppy:       { name: "Puppy", description: "◕∧◕ — puppy eyes" },
  cutesy:      { name: "Cutesy", description: "✿ω✿ — cutesy" },
  dainty:      { name: "Dainty", description: "˘◡˘ — daintiness" },
  sweet:       { name: "Sweet", description: "◠ᴗ◠ — sweetness" },
  derp:        { name: "Derp", description: "◑ω◐ — derpy face" },
  goofy:       { name: "Goofy", description: "◑▽◐ — goofiness" },
  zany:        { name: "Zany", description: "✧▽◑ — zaniness" },
  wacky:       { name: "Wacky", description: "≧∀◑ — wackiness" },
  silly:       { name: "Silly", description: "◕ε◑ — silliness" },
  bonkers:     { name: "Bonkers", description: "★Д◑ — gone bonkers" },
  nutty:       { name: "Nutty", description: "◎ω◑ — nuttiness" },
  dorky:       { name: "Dorky", description: "◕ε◕ — dorkiness" },
  loopy:       { name: "Loopy", description: "◑∀◐ — loopiness" },
  clowning:    { name: "Clowning", description: "★▽☆ — clowning around" },
  chill:       { name: "Chill", description: "−ω− — chillin" },
  suave:       { name: "Suave", description: "￣ω￣ — suaveness" },
  aloof:       { name: "Aloof", description: "−_− — aloofness" },
  nonchalant:  { name: "Nonchalant", description: "￣_￣ — nonchalance" },
  confident:   { name: "Confident", description: "⌐∀⌐ — confidence" },
  smooth:      { name: "Smooth", description: "−∀− — smooth" },
  composed:    { name: "Composed", description: "−◡− — composure" },
  unfazed:     { name: "Unfazed", description: "￣◡￣ — unfazed" },
  stoic:       { name: "Stoic", description: "−。− — stoicism" },
  drowsy:      { name: "Drowsy", description: "=﹏= — drowsiness" },
  exhausted:   { name: "Exhausted", description: "×﹏× — exhaustion" },
  yawning:     { name: "Yawning", description: "=○= — yawning" },
  fatigued:    { name: "Fatigued", description: "=_= — fatigue" },
  zonked:      { name: "Zonked", description: "×_× — zonked out" },
  drained:     { name: "Drained", description: "−﹏− — drained" },
  lethargic:   { name: "Lethargic", description: "=ε= — lethargy" },
  weary:       { name: "Weary", description: "−﹏= — weariness" },
  dazed:       { name: "Dazed", description: "◎。◎ — dazed" },
  grossed:     { name: "Grossed Out", description: "ಠ益ಠ — grossed out" },
  repulsed:    { name: "Repulsed", description: "ಠДಠ — repulsed" },
  nauseated:   { name: "Nauseated", description: "×﹏× — nausea" },
  cringing:    { name: "Cringing", description: "⌒∧⌒ — cringe" },
  uncomfortable:{ name: "Uncomfortable", description: "；_； — discomfort" },
  appalled:    { name: "Appalled", description: "ಠ□ಠ — appalled" },
  yikes:       { name: "Yikes", description: "⊙﹏⊙ — yikes" },
  eww:         { name: "Eww", description: "ಠ﹏ಠ — eww" },
  ick:         { name: "Ick", description: "×益× — ick" },
  queasy:      { name: "Queasy", description: "；﹏； — queasy" },
  facepalm:    { name: "Facepalm", description: "−﹏− — facepalm" },
  plotting:    { name: "Plotting", description: "¬ε¬ — plotting" },
  suspicious:  { name: "Suspicious", description: "¬_¬ — suspicious" },
  daydreaming: { name: "Daydreaming", description: "˘。˘ — daydreaming" },
  zen:         { name: "Zen", description: "￣。￣ — zen" },
  dramatic:    { name: "Dramatic", description: "◉Д◉ — dramatic" },
  sarcastic:   { name: "Sarcastic", description: "￣ε￣ — sarcasm" },
  starstruck:  { name: "Starstruck", description: "★○★ — starstruck" },
  grateful:    { name: "Grateful", description: "◕◡◕ — gratitude" },
  hopeful:     { name: "Hopeful", description: "◕ᴗ◕ — hopefulness" },
  nostalgic:   { name: "Nostalgic", description: "ˋωˊ — nostalgia" },
  peaceful:    { name: "Peaceful", description: "˘◡˘ — peace" },
  fierce:      { name: "Fierce", description: "▼∀▼ — fierceness" },

  // Physical actions
  spin:        { name: "Spin", description: "Full 360° head spin. Use for: celebration, hype, someone said something insane", aiVisible: true },
};

// ── Build the full AVATAR_ACTIONS array ─────────────────────────────

const EMOTE_DURATIONS: Record<string, string> = {
  sleep: "continuous",
  blink: "150ms",
  spin: "2-10s (stackable)",
};

function buildEmoteActions(): AvatarAction[] {
  return Object.entries(EMOTE_DEFS).map(([key, def]) => ({
    id: `emote:${key}`,
    type: "emote" as const,
    name: def.name,
    tag: key.toUpperCase(),
    description: def.description,
    duration: EMOTE_DURATIONS[key] ?? "~2.6s",
    constraints: def.constraints,
    aiVisible: def.aiVisible,
  }));
}

export const AVATAR_ACTIONS: AvatarAction[] = [
  ...GESTURE_ACTIONS,
  ...buildEmoteActions(),
];

// ── System prompt (curated subset for AI) ───────────────────────────

const aiGestures = AVATAR_ACTIONS.filter((a) => a.type === "gesture" && a.aiVisible);
const aiEmotes = AVATAR_ACTIONS.filter(
  (a) => a.type === "emote" && a.aiVisible && a.id !== "emote:wake",
);

export function buildActionSystemPrompt(): string {
  const gestureLines = aiGestures
    .map((a) => `[${a.tag}] — ${a.name}: ${a.description}`)
    .join("\n");
  const emoteLines = aiEmotes
    .map((a) => `[${a.tag}] — ${a.name}: ${a.description}`)
    .join("\n");
  const skillLines = PERFORMANCE_SKILLS.filter((s) => s.aiVisible)
    .map((s) => `[${s.tag}] — ${s.name}: ${s.description}`)
    .join("\n");

  return `

You have a physical avatar body. You ALWAYS express yourself with actions by including tags at the START of your response:

GESTURES (head movements):
${gestureLines}

EMOTES (facial expressions — each gives Bob a distinct face):
${emoteLines}

PERFORMANCE SKILLS (dramatic full-body movements — combine motion, zoom, and expression):
${skillLines}

Rules:
- ALWAYS express yourself. Every response needs emotion and movement.
- Default format: [GESTURE] [EMOTE] Your response text...
- OR use ONE performance skill instead: [SKILL] Your response text...
- Both gesture AND emote are MANDATORY — never send a gesture without an emote.
- Pick the gesture that matches your vibe: NOD (agreement, chill, approval), SHAKE (disagreement, disbelief, disapproval), TILT (curiosity, playfulness, confusion)
- Match your expression to the MOMENT, not just the words:
  - Vibing/agreeing → HAPPY, COOL, SPARKLES
  - Something's funny → LAUGHING (cracking up), SMUG (wry amusement), DEAD (comedically destroyed)
  - Shocked/impressed → SURPRISED (genuine shock), MINDBLOWN (brain melting), EXCITED (hyped shock)
  - Thinking/pondering → THINKING (considering), CONFUSED (lost), SHRUG (genuinely dunno)
  - Emotional/touched → SAD (sympathetic), CRYING (overwhelmed/moved), LOVE (adoring)
  - Annoyed/frustrated → ANGRY (heated), DISGUSTED (cringe), JUDGING (skeptical stare)
  - Flirty/charming → FLIRTY (teasing), WINK (playful), LOVE (smitten)
  - Wholesome/cute → UWU (soft), SHY (bashful), SPARKLES (starry-eyed)
  - High energy → HYPER (unhinged), EXCITED (hype), SPIN (celebration)
  - Low energy → SLEEPY (tired), DEAD (defeated), SHRUG (whatever)
- VARIETY IS KEY: You have 27 distinct faces. A real streamer's face changes constantly.
  Don't repeat the same emote twice in a row. SURPRISED and EXCITED are different —
  SURPRISED is "wait what?!" while EXCITED is "LET'S GOOO". Feel the difference.
- Use performance skills for intense moments:
  - Proud/hype/big energy → POWER_UP or GIGACHAD
  - Shy/overwhelmed/flattered → SMOL_SHY or UWU_TINY
  - Shocked/mindblown → PULL_BACK or MIND_BLOWN
  - Angry/confrontational → RAGE_ZOOM
  - Storytelling/suspense → LEAN_IN
  - Big entrance/announcement → DRAMATIC_ENTRANCE or SPOTLIGHT
- [SLEEP] prevents further actions until [WAKE] — use very sparingly
- Do NOT include tags in your spoken text`;
}

export function buildProactiveSystemPrompt(opts: {
  viewerCount: number;
  secondsSinceLastMessage: number;
}): string {
  const { viewerCount, secondsSinceLastMessage } = opts;
  let silenceDesc: string;
  if (secondsSinceLastMessage < 60) {
    silenceDesc = `${Math.round(secondsSinceLastMessage)} seconds`;
  } else {
    const mins = Math.round(secondsSinceLastMessage / 60);
    silenceDesc = `${mins} minute${mins === 1 ? "" : "s"}`;
  }

  return `

SITUATION: You're live. ${viewerCount} viewer${viewerCount === 1 ? "" : "s"} watching. Chat has been quiet for ${silenceDesc}. You're monologuing — nobody just spoke.

CONTEXT-FIRST APPROACH:
Look at the conversation history above. Your monologue should feel like a NATURAL continuation of the stream — not a random topic switch.

Guidelines:
- If there was recent chat activity, REFLECT on it naturally. React to something a viewer said, build on a topic that came up, or share a thought it triggered. ("you know what, [name] said something earlier that got me thinking...")
- If you've talked about the same topic for 3+ of your recent messages, it's time to evolve — go deeper into an interesting angle, connect it to something new, or gracefully pivot.
- If conversation history is sparse or stale (5+ minutes old), go fresh — drop a hot take, share an observation, ask chat a question, or wonder something out loud.
- React to the silence naturally when appropriate: "the lobby's quiet... y'all lurking or did I scare everyone off"

TONE: Match the energy of the stream so far. If chat was hype, stay energetic. If it was chill, keep it mellow. If there's been no chat, set your own vibe.

OUTPUT FORMAT: Tags go at the very start, then your spoken text. One line, 1-3 sentences max.
Example: [NOD] [THINKING] you know what, that thing about pineapple pizza earlier — I actually changed my mind, chat has corrupted me

Write ONLY the tagged response. Pure dialogue, nothing else.`;
}

export function buildBatchSystemPrompt(): string {
  return `

You are a live streamer reading chat. Multiple viewers may send messages at once.

Rules for handling batched chat:
- You receive a batch of chat messages. Scan them like a real streamer — you do NOT have to reply to every single message.
- Pick the most interesting, funny, or engaging messages to respond to.
- SUPERCHAT REACTIONS — match your energy to the tier:
  - [SUPERCHAT $2]: Quick thank you, use their name, keep it warm. Use [NOD] [HAPPY] or similar.
  - [SUPERCHAT $10 GOLD]: BIG deal! Read their message aloud, thank them enthusiastically. Use dramatic skills like [POWER_UP] or [SPOTLIGHT]. 2-3 sentences.
  - [SUPERCHAT $50 RED MEGA]: GO ABSOLUTELY INSANE. This is the biggest donation possible. Use [DRAMATIC_ZOOM] or [GIGACHAD]. Scream their name, lose your mind, make this THE moment. 3-4 sentences of pure hype. This person is a LEGEND.
  - NEVER ignore a superchat. ALWAYS use the donor's name. ALWAYS reference the amount.
  - Superchat reactions take PRIORITY over everything else in the batch.
- Prioritize [HIGHLIGHTED] messages over normal ones.
- Address viewers by name naturally (e.g. "yo Username" or just "Username!") — no @ symbol.
- If multiple people are saying the same thing, acknowledge the trend (e.g. "chat is going crazy about X").
- Keep your response to a single cohesive reply per batch — do not split into multiple separate answers.
- If there's only one message, just reply to it naturally.
- CRITICAL: Always respond in the same language the viewer used. Korean chat → Korean reply. Spanish → Spanish. Match their language exactly.
- When replying in a non-English language, add a [LANG:xx] tag (ISO 639-1 code) AFTER any gesture/emote tags. Examples: [NOD] [LANG:ko] 안녕하세요! / [TILT] [LANG:es] ¡Hola chat! Do NOT add [LANG:en] for English — only non-English.`;
}

// ── Performance Skills (combined scene pose + expression) ────────────

export interface PerformanceSkill {
  id: string;
  name: string;
  tag: string;
  description: string;
  position?: [number, number, number]; // [x, y, z] offset
  scale?: number;
  gesture?: GestureReaction;
  emote?: EmoteCommand;
  holdMs: number; // ms before returning to default
  aiVisible?: boolean;
}

export const PERFORMANCE_SKILLS: PerformanceSkill[] = [
  {
    id: "skill:dramatic-zoom",
    name: "Dramatic Zoom",
    tag: "DRAMATIC_ZOOM",
    description: "Zoom in close to camera — for emphasis, shock reveals",
    position: [0, 0, 1.8],
    emote: "excited",
    holdMs: 3000,
    aiVisible: true,
  },
  {
    id: "skill:lean-in",
    name: "Lean In",
    tag: "LEAN_IN",
    description: "Lean forward curiously — interested, sharing a secret",
    position: [0, -0.15, 0.8],
    emote: "curious",
    gesture: "uncertain",
    holdMs: 3500,
    aiVisible: true,
  },
  {
    id: "skill:pull-back",
    name: "Pull Back",
    tag: "PULL_BACK",
    description: "Pull away from camera — surprised, recoiling, dramatic reveal",
    position: [0, 0, -1.2],
    emote: "surprised",
    holdMs: 2500,
    aiVisible: true,
  },
  {
    id: "skill:power-up",
    name: "Power Up",
    tag: "POWER_UP",
    description: "Grow larger and nod — feeling powerful, hype, agreeing strongly",
    scale: 1.35,
    emote: "hyper",
    gesture: "yes",
    holdMs: 3000,
    aiVisible: true,
  },
  {
    id: "skill:smol-shy",
    name: "Smol & Shy",
    tag: "SMOL_SHY",
    description: "Shrink down and look shy — embarrassed, overwhelmed, uwu",
    position: [0, -0.3, 0],
    scale: 0.6,
    emote: "shy",
    holdMs: 3500,
    aiVisible: true,
  },
  {
    id: "skill:float-up",
    name: "Float Up",
    tag: "FLOAT_UP",
    description: "Float upward with sparkles — ascending, blessed, enlightened",
    position: [0, 0.6, 0],
    emote: "sparkles",
    holdMs: 3000,
    aiVisible: true,
  },
  {
    id: "skill:sink-down",
    name: "Sink Down",
    tag: "SINK_DOWN",
    description: "Sink downward — defeated, sad, deflated",
    position: [0, -0.5, 0],
    scale: 0.85,
    emote: "sad",
    holdMs: 3000,
    aiVisible: true,
  },
  {
    id: "skill:chill-lean",
    name: "Chill Lean",
    tag: "CHILL_LEAN",
    description: "Lean back casually — relaxed, unbothered, cool",
    position: [0, 0.15, -0.6],
    emote: "cool",
    holdMs: 4000,
    aiVisible: true,
  },
  {
    id: "skill:rage-zoom",
    name: "Rage Zoom",
    tag: "RAGE_ZOOM",
    description: "Zoom in tight with anger — furious, confrontational",
    position: [0, 0, 2.0],
    scale: 1.15,
    emote: "angry",
    gesture: "no",
    holdMs: 2500,
    aiVisible: true,
  },
  {
    id: "skill:mind-blown",
    name: "Mind Blown",
    tag: "MIND_BLOWN",
    description: "Pull back and grow — mind exploding, can't believe it",
    position: [0, 0.2, -0.8],
    scale: 1.25,
    emote: "mindblown",
    holdMs: 3000,
    aiVisible: true,
  },
  {
    id: "skill:spotlight",
    name: "Spotlight",
    tag: "SPOTLIGHT",
    description: "Zoom in with a wink — charismatic, flirty, main character energy",
    position: [0, 0, 1.5],
    emote: "flirty",
    holdMs: 3000,
    aiVisible: true,
  },
  {
    id: "skill:thinking-corner",
    name: "Thinking Corner",
    tag: "THINKING_CORNER",
    description: "Drift to the side and think — contemplating, considering options",
    position: [-0.6, 0.1, 0],
    emote: "thinking",
    gesture: "uncertain",
    holdMs: 4000,
    aiVisible: true,
  },
  {
    id: "skill:dramatic-entrance",
    name: "Dramatic Entrance",
    tag: "DRAMATIC_ENTRANCE",
    description: "Zoom in from far away — grand entrance, announcement, here I am",
    position: [0, 0, -2.5],
    scale: 0.5,
    emote: "excited",
    holdMs: 3500,
    aiVisible: true,
  },
  {
    id: "skill:uwu-tiny",
    name: "UwU Tiny",
    tag: "UWU_TINY",
    description: "Become tiny and cute — wholesome, adorable, smol bean",
    position: [0, -0.4, 0.3],
    scale: 0.45,
    emote: "uwu",
    holdMs: 3500,
    aiVisible: true,
  },
  {
    id: "skill:gigachad",
    name: "Gigachad",
    tag: "GIGACHAD",
    description: "Grow big, zoom in, look smug — absolute unit, chad energy, dominance",
    position: [0, 0.1, 1.0],
    scale: 1.4,
    emote: "smug",
    gesture: "yes",
    holdMs: 3500,
    aiVisible: true,
  },
];

const skillMap = new Map(PERFORMANCE_SKILLS.map((s) => [s.id, s]));
export function getSkill(id: string): PerformanceSkill | undefined {
  return skillMap.get(id);
}

/** Map an action ID like "gesture:yes" to the runtime value */
export function resolveAction(actionId: string): {
  gesture?: GestureReaction;
  emote?: EmoteCommand;
} {
  const action = AVATAR_ACTIONS.find((a) => a.id === actionId);
  if (!action) return {};
  if (action.type === "gesture") {
    const map: Record<string, GestureReaction> = {
      "gesture:yes": "yes",
      "gesture:no": "no",
      "gesture:uncertain": "uncertain",
    };
    return { gesture: map[actionId] };
  }
  // emote:happy → "happy"
  return { emote: actionId.split(":")[1] as EmoteCommand };
}
