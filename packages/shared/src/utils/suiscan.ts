/**
 * Generates a Suiscan URL for a transaction
 */
export function getSuiscanUrl(chain: string, txDigest: string): string {
  const network = chain.replace("sui:", "");
  return `https://suiscan.xyz/${network}/tx/${txDigest}`;
}
