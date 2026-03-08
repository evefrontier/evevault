export interface CoinMetadataQueryResponse {
  coinMetadata: {
    decimals: number | null;
    name: string | null;
    symbol: string | null;
    description: string | null;
    iconUrl: string | null;
  } | null;
}

export interface CoinMetadataResult {
  decimals: number;
  symbol: string;
  name?: string | null;
  description?: string | null;
  iconUrl?: string | null;
}
