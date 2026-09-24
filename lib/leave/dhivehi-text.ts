export function isDhivehiText(value: string, maxLength: number): boolean {
  const text = value.trim();
  const letters = Array.from(text).filter((character) => /\p{L}/u.test(character));
  return (
    text.length >= 2 &&
    text.length <= maxLength &&
    letters.length > 0 &&
    letters.every((character) => /\p{Script=Thaana}/u.test(character))
  );
}
