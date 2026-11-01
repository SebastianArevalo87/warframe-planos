const TAGS = ["Kuva", "Tenet", "Coda", "Arca"];

export function gameName(value: string): string {
  return value.replace(new RegExp(`\\b(${TAGS.join("|")})\\s+(.+)$`, "i"), (_match, tag: string, rest: string) => {
    const word = TAGS.find((entry) => entry.toLowerCase() === tag.toLowerCase()) ?? tag;
    return `${rest} ${word}`;
  });
}
