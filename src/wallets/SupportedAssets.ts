export const supportedAssets = {
  SOL_TEST: [44, 1, 0, 0, 0],
  SOL: [44, 501, 0, 0, 0],
} as const;

export type SupportedAssets = keyof typeof supportedAssets;
export type DerivationPath = (typeof supportedAssets)[SupportedAssets];
