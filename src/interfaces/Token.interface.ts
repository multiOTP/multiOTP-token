import { TokenAlgorithm, TokenSeedType, TokenType } from './type'

export interface TokenInterface {
  id: string
  title: string
  description: string
  creation_date: Date | null
  secret: string
  type: TokenType
  algorithm: TokenAlgorithm
  digits: number
  period: number
  counter: number // For HOTP only
  otp: string
  progress: number
  interval: number | null
  mogw: string //gateway by default as in src/config.ts
  mouid: string | null // token unique id. If null there is not push notification
  mosid: string | null // server id to create url : mosid.mogw
  registered: boolean // is the token (phone) registered on the gateway
  seedType: TokenSeedType
  checked: boolean
}
