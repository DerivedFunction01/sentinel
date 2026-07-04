const MICRO_USD = 1_000_000;

export function formatTokens(tokens: number): string {
  return `$${(tokens / MICRO_USD).toFixed(2)}`;
}
