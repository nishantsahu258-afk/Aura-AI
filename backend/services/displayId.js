import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateDisplayId() {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `AURA-${s}`;
}
