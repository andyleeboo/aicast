"use client";

import { useState } from "react";
import { validateUsername } from "@/lib/moderation";

const ADJECTIVES = [
  "Swift","Brave","Calm","Dark","Epic","Fierce","Grand","Happy","Icy","Jolly",
  "Keen","Lucky","Mighty","Noble","Odd","Proud","Quick","Rare","Sly","Tiny",
  "Ultra","Vivid","Wild","Zany","Bold","Cool","Deft","Eager","Fair","Grim",
  "Hazy","Iron","Jazz","Kind","Loud","Mild","Neat","Open","Pink","Rad",
  "Sage","Tame","Vast","Warm","Zen","Aqua","Blue","Cozy","Dry","Ebon",
  "Foxy","Gold","Hot","Inky","Jade","Lazy","Mega","Neon","Opal","Pure",
  "Ruby","Slim","Tall","Uber","Void","Wavy","Ace","Big","Coy","Dim",
  "Edgy","Flat","Gray","Half","Iffy","Juicy","Lush","Mean","Nifty","Plush",
  "Rosy","Salt","Tidy","Ugly","Wry","Able","Deep","Fast","Glow","High",
  "Long","Mad","New","Old","Raw","Shy","Top","Wee","Yolo","Zest",
];

const NOUNS = [
  "Fox","Bear","Wolf","Hawk","Lynx","Crow","Deer","Frog","Goat","Hare",
  "Ibis","Jay","Koi","Lion","Moth","Newt","Owl","Puma","Ram","Swan",
  "Toad","Vole","Wasp","Yak","Orca","Dove","Crab","Seal","Mole","Slug",
  "Pike","Wren","Lark","Boar","Colt","Dusk","Echo","Flux","Gale","Hex",
  "Iris","Jinx","Knot","Lava","Mist","Nova","Onyx","Pixel","Quake","Reef",
  "Star","Tide","Volt","Wave","Apex","Bolt","Core","Dawn","Edge","Fury",
  "Grit","Haze","Ivy","Jet","Kelp","Lime","Mars","Nuke","Oak","Plum",
  "Quill","Rune","Sage","Thor","Ash","Blaze","Chip","Drop","Fang","Gloom",
  "Horn","Ice","Kite","Leaf","Moon","Nest","Orb","Paw","Rock","Sky",
  "Twig","Vine","Wind","Zinc","Bat","Elk","Gem","Hub","Log","Peg",
];

function generateRandomUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 10000);
  return `${adj}${noun}${num}`;
}

export function UsernameModal({
  onConfirm,
}: {
  onConfirm: (name: string) => void;
}) {
  const [placeholder] = useState(generateRandomUsername);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string) {
    setInput(value);
    if (value.trim().length > 0) {
      const check = validateUsername(value.trim());
      setError(check.valid ? null : check.error ?? null);
    } else {
      setError(null);
    }
  }

  function handleSubmit() {
    const name = input.trim() || placeholder;
    const check = validateUsername(name);
    if (!check.valid) {
      setError(check.error ?? "Invalid name");
      return;
    }
    onConfirm(name);
  }

  const isValid = input.trim().length === 0 || (input.trim().length >= 2 && !error);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl ring-1 ring-border">
        <h2 className="mb-1 text-center text-lg font-bold">
          Pick a name to join chat
        </h2>
        <p className="mb-5 text-center text-sm text-muted">
          Or just hit enter for a random one
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            maxLength={20}
            autoFocus
            className="mb-1 w-full rounded-lg bg-background px-4 py-3 text-center text-sm text-foreground placeholder:text-muted/60 outline-none ring-1 ring-border transition-shadow focus:ring-accent"
          />
          {error && (
            <p className="mb-2 text-center text-xs text-red-400">{error}</p>
          )}
          {!error && <div className="mb-2 h-4" />}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join Chat
          </button>
        </form>
      </div>
    </div>
  );
}
