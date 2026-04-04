import { TokenInterface } from '@/interfaces'
import { Storage } from '@ionic/storage'
import securestorageService from './securestorageService'

/** Class used to store and load the tokens */
class StorageService {
  private storage: Storage | null = null

  constructor() {
    this.storage = new Storage()
    this.init()
  }

  async init() {
    if (this.storage != null) {
      await this.storage.create()
    }
  }

  async setItem(key: string, value: unknown) {
    if (this.storage != null) {
      return await this.storage.set(key, value)
    }
  }

  async getItem(key: string) {
    if (this.storage != null) {
      return await this.storage.get(key)
    }
  }

  async removeItem(key: string) {
    if (this.storage != null) {
      return await this.storage.remove(key)
    }
  }

  async clear() {
    if (this.storage != null) {
      return await this.storage.clear()
    }
  }

  /**
   * used to add a token in the array stored in the storage
   * @param key string storage key
   * @param newItem TokenInterface
   */
  async addToArray(key: string, newItem: TokenInterface) {
    const existingArray = (await this.storage?.get(key)) || []
    newItem.creation_date = new Date()
    const secret = newItem.secret
    newItem.secret = '' // Clear secret
    // store secret in secureStorage
    securestorageService.setItem(newItem.id, secret)
    existingArray.push(newItem)
    await this.storage?.set(key, existingArray)
  }

  /**
   * used to get a token element from the array stored in the storage
   * @param key string storage key
   * @returns Promise
   */
  async getArray(key: string): Promise<TokenInterface[]> {
    const tokens = (await this.storage?.get(key)) || []
    for (let i = 0; i < tokens.length; i++) {
      if (!tokens[i].secret) {
        tokens[i].secret = await securestorageService.get(tokens[i].id)
      }
    }
    return tokens
  }

  /**
   * used to remove a token element from the array stored in the storage
   * @param key string storage key
   * @param itemId string token id
   */
  async removeFromArray(key: string, itemId: string) {
    let existingArray: TokenInterface[] = (await this.storage?.get(key)) || []
    existingArray = existingArray.filter((token) => token.id !== itemId)

    // Remove the secret from secure storage
    await securestorageService.remove(itemId)

    await this.storage?.set(key, existingArray)
  }

  async updateTokenRegistered(tokenId: string, newValue: boolean) {
    // 1. Get tokens list
    const tokens = (await this.storage?.get('tokens')) || []

    // 2. Search the token to edit
    const index = tokens.findIndex((t: { id: string }) => t.id === tokenId)

    if (index !== -1) {
      // 3. Change the value
      tokens[index].registered = newValue

      // 4. Save the new list
      await this.storage?.set('tokens', tokens)
    } else {
      console.warn(`Token ${tokenId} introuvable`)
    }
  }

  async updateTokenTitleDescription(
    tokenId: string,
    title: string,
    description: string,
  ) {
    // 1. Get tokens list
    const tokens = (await this.storage?.get('tokens')) || []

    // 2. Search the token to edit
    const index = tokens.findIndex((t: { id: string }) => t.id === tokenId)

    if (index !== -1) {
      // 3. Change the value
      tokens[index].title = title
      tokens[index].description = description

      // 4. Save the new list
      await this.storage?.set('tokens', tokens)
    } else {
      console.warn(`Token ${tokenId} introuvable`)
    }
  }
}

const storageService = new StorageService()
export default storageService
