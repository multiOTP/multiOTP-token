// Source : https://github.com/martinkasa/capacitor-secure-storage-plugin/blob/master/test-app/src/app/home/home.page.ts
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'

class SecurestorageService {
  setItem(key: string, value: string) {
    SecureStoragePlugin.set({ key, value })
  }

  async get(key: string) {
    const { value: keys } = await SecureStoragePlugin.keys()
    // To make sure the key exists
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === key) {
        return (await SecureStoragePlugin.get({ key })).value
      }
    }
  }

  async remove(key: string) {
    const { value: keys } = await SecureStoragePlugin.keys()
    // To make sure the key exists
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === key) {
        await SecureStoragePlugin.remove({ key })
      }
    }
  }
}

const securestorageService = new SecurestorageService()
export default securestorageService
