export type TokenAlgorithm = 'SHA1'
export enum TokenType {
  totp = 'totp',
  hotp = 'hotp',
  motp = 'motp',
}
export enum TokenSeedType {
  base32 = 'base32',
  hex = 'hex',
  bin = 'bin',
}
export type Page =
  | 'NewManualTokenPage'
  | 'TokensPage'
  | 'ExportTokensPage'
  | 'ImportTokensPage'
  | 'SetupPage'

export enum RegisterResult {
  notificationDisabled = 0,
  success = 1,
  noNeedToRegister = 2,
  noInternet = 10,
  error = 99,
}
