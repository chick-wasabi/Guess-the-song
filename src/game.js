export const CLIPS = [0.1, 0.5, 1, 2, 5, 10];
export const POINTS = [1000, 800, 600, 400, 200, 100];
export function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}
export function matches(guess, song) {
  return [
    song.title,
    `${song.artist} ${song.title}`,
    `${song.title} ${song.artist}`,
    ...(song.aliases || []),
  ].some((value) => normalize(value) === normalize(guess));
}
export function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
