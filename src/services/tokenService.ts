import {
  AjaxInterface,
  RegisterResult,
  TokenInterface,
  TokenSeedType,
  TokenType,
} from '@/interfaces'
import { Network } from '@capacitor/network'
import storageService from './storageService'
import { Device } from '@capacitor/device'
import OTP from '@multiotp/genotp'
import config from '@/config'
import { isPlatform } from '@ionic/vue'
import * as base32 from 'hi-base32'
import { PushNotifications } from '@capacitor/push-notifications'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'
import securestorageService from '@/services/securestorageService'

class TokenService {
  constructor() {}

  fileNameExport = 'multiotpTokenBackup.txt'

  /**
   * Parse a string in url format (totp token)
   * https://docs.yubico.com/yesdk/users-manual/application-oath/uri-string-format.html
   *
   * @param urlString string url to parse
   * @returns TokenInterface | null
   */
  createFromUrlString(urlString: string): TokenInterface | null {
    const url = new URL(urlString)
    const params = new URLSearchParams(url.search)
    const type = this.toTokenType(url.host)
    const secret = params.get('secret')
    let digits = params.get('digits') ? params.get('digits') : '6'
    const period = params.get('period')
      ? params.get('period')
      : type == TokenType.totp
        ? '30'
        : '10'
    let mogw = params.get('mogw')
    const mouid = params.get('mouid')
    const mosid = params.get('mosid')

    // title:description
    let title = ''
    let description = ''
    const text = decodeURIComponent(url.pathname).trim().split(':', 2)
    if (text.length < 2) {
      title = this.removeLeadingSlash(text[0])
    } else {
      title = this.removeLeadingSlash(text[0])
      description = text[1]
    }

    // Check parameters validity
    if (!type || !secret) {
      return null
    }

    if (!digits) {
      digits = '6'
    }

    if (!mogw) {
      mogw = config.apiUrl
    }

    const token: TokenInterface = {
      id: 'id' + Math.random().toString(16).slice(2),
      title: title,
      description: description,
      type: type,
      digits: +digits,
      creation_date: null,
      secret: secret,
      algorithm: 'SHA1',
      period: +period!,
      counter: 0,
      otp: '0',
      progress: 0,
      interval: null,
      mogw: mogw,
      mouid: mouid,
      mosid: mosid,
      registered: false,
      seedType: TokenSeedType.base32,
      checked: false,
    }
    return token
  }

  /**
   * Convert string to token type totp, hotp, motp
   * @param value string
   * @returns TokenType | undefined
   */
  toTokenType(value: string): TokenType | undefined {
    return Object.values(TokenType).includes(value as TokenType)
      ? (value as TokenType)
      : undefined
  }

  /**
   * Remove leading / on a string
   * @param str input string
   * @returns string without leading /
   */
  removeLeadingSlash(str: string): string {
    return str.startsWith('/') ? str.slice(1) : str
  }

  /**
   * Register phone on gateway
   * @param token token object
   * @returns RegisterResult
   */
  async registerOnGateway(token: TokenInterface): Promise<RegisterResult> {
    // If token needs to be registered (token is push, not already registered and phone is online)
    if (token.mouid && !token.registered) {
      const connected = (await Network.getStatus()).connected
      if (!connected) {
        return RegisterResult.noInternet // No internet connection
      }

      // Get the push id from the storage. Empty if notification are disabled
      const id_push = await storageService.getItem('id_push')
      const notificationEnabled = await this.isNotificationActivated() // Do not register on gateway if notifications are disabled
      if (id_push && notificationEnabled) {
        const result = await (
          await fetch(this.createUrl(token) + `phone/register`, {
            method: 'POST',
            body: JSON.stringify({
              id_phone: (await Device.getId()).identifier,
              id_push: id_push,
              mouid: token.mouid,
              type: isPlatform('ios') ? 'ios' : 'android',
            }),
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
          })
        ).json()

        if (Object.hasOwn(result, 'status') && result.status) {
          return RegisterResult.success
        } else {
          return RegisterResult.error
        }
      } else {
        return RegisterResult.notificationDisabled
      }
    }
    return RegisterResult.noNeedToRegister // No need to register on the gateway
  }

  /**
   * Sends response to the gateway
   * @param approved boolean
   * @param token token object
   * @param id_transaction string
   * @param pin MOTP pin code
   */
  async respondOnGateway(
    approved: boolean,
    token: TokenInterface,
    id_transaction: string,
    pin: string,
  ) {
    const connected = (await Network.getStatus()).connected
    // If phone is online
    if (connected) {
      await fetch(
        this.createUrl(token) + `notification/respond/${id_transaction}`,
        {
          method: 'POST',
          body: JSON.stringify({
            approved: approved,
            value: approved ? await this.generateNewOtp(token, pin) : '0',
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      )
    }
  }

  /**
   * Generate new OTP code
   * @param token token
   * @param pinCode pin
   * @returns string
   */
  async generateNewOtp(
    token: TokenInterface,
    pinCode: string,
  ): Promise<string> {
    if (Capacitor.isNativePlatform() && (await NativeBiometric.isAvailable())) {
      if ((await securestorageService.get('setup-secure')) === '1') {
        try {
          await NativeBiometric.verifyIdentity({
            reason: 'Checking biometric authentication validity',
            title: 'Please authenticate',
          })
          return this.genOpt(token, pinCode)
        } catch {
          return ''
        }
      } else {
        return this.genOpt(token, pinCode)
      }
    } else {
      return this.genOpt(token, pinCode)
    }
  }

  genOpt(token: TokenInterface, pinCode: string): string {
    const otp = new OTP()
    try {
      const otpValue = otp.generate({
        algorithm: token.algorithm + '',
        digits: token.digits,
        period: token.period,
        seedtype: token.seedType,
        type: token.type,
        secret: token.secret,
        pincode: pinCode,
      })
      if (typeof otpValue === 'string') {
        return otpValue.padStart(token.digits, '0')
      } else {
        return otpValue[0].padStart(token.digits, '0')
      }
    } catch {
      return ''
    }
  }

  /**
   * Creates gateway url from token
   * @param token token
   * @returns string  https://mosid.mogw/api/
   */
  createUrl(token: TokenInterface): string {
    return (
      'https://' +
      (!token.mosid ? token.mosid + '.' : '') +
      token.mogw +
      '/api/'
    )
  }

  /**
   * Convert base32 input to Hex
   * @param s input
   * @returns string
   */
  base32ToHex(s: string): string {
    const bytes = base32.decode.asBytes(s)
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Check if notifcations are enabled
   * @returns boolean
   */
  async isNotificationActivated(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'web') {
      const permission = await PushNotifications.checkPermissions()
      return permission.receive == 'granted'
    }
    return false
  }

  /**
   * Transform a token to json in order to export it to a new application
   * @param token token to stringify to export
   * @returns string
   */
  exportToJSON(token: TokenInterface): string {
    return JSON.stringify(token, (key, value) => {
      if (key === 'registered') {
        return false
      } else if (key === 'creation_date') {
        return null
      }
      return value
    })
  }

  /**
   *
   * @param path Test if file exists
   * @returns boolean
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path,
        directory: Directory.Cache, // ou Directory.Documents, etc.
      })
      return true
    } catch {
      // File doesn't exists
      return false
    }
  }

  /**
   * Delete temp files
   */
  async deleteTempFiles() {
    if (await this.fileExists(this.fileNameExport)) {
      await Filesystem.deleteFile({
        path: this.fileNameExport,
        directory: Directory.Cache,
      })
    }
  }

  /**
   * Send exported tokens to multiOTP gateway
   * @param data Data to store in the database
   * @param url Gateway url
   * @returns db record id id success, '' otherwise
   */
  async sendExportToGateway(data: string, url: string): Promise<string> {
    try {
      const response = await fetch(
        'https://' + url + '/api/' + `phone/export`,
        {
          method: 'POST',
          body: JSON.stringify({
            id_phone: (await Device.getId()).identifier,
            data: data,
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      )
      const result = await response.json()
      if (Object.hasOwn(result, 'status') && result.status) {
        return result.data.random_id
      }
      return ''
    } catch {
      // TODO
      return ''
    }
  }

  async getExportFromGateway(url: string, id: string): Promise<AjaxInterface> {
    try {
      const response = await fetch(
        'https://' + url + '/api/' + `phone/import`,
        {
          method: 'POST',
          body: JSON.stringify({
            random_id: id,
          }),
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      )
      const result = await response.json()
      if (Object.hasOwn(result, 'status') && result.status) {
        return { value: JSON.parse(result.data.data), error: '' }
      }
      return { value: null, error: result.message }
    } catch {
      return { value: null, error: 'No internet access to server: ' + url } // +'' To force to string
    }
  }

  createFromImport(t: TokenInterface) {
    const token: TokenInterface = {
      id: t.id,
      title: t.title,
      description: t.description,
      type: t.type,
      digits: +t.digits,
      creation_date: null,
      secret: t.secret,
      algorithm: t.algorithm,
      period: +t.period!,
      counter: t.counter,
      otp: '0',
      progress: 0,
      interval: t.interval,
      mogw: t.mogw,
      mouid: t.mouid,
      mosid: t.mosid,
      registered: false,
      seedType: t.seedType,
      checked: false,
    }
    return token
  }
}

const tokenService = new TokenService()
export default tokenService
