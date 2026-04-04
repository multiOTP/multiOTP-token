class SecurityService {
  constructor() {}

  uint8ToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
  }

  base64ToUint8(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  }

  // Derive a CryptoKey from a password string
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password), // password as Uint8Array
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: 100_000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    )
  }

  async encrypt(password: string, plaintext: string) {
    const encoder = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12)) // AES-GCM IV
    const salt = crypto.getRandomValues(new Uint8Array(16)) // PBKDF2 salt

    const key = await this.deriveKey(password, salt)

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext)
    )

    return {
      ciphertext: this.uint8ToBase64(new Uint8Array(encryptedBuffer)),
      iv: this.uint8ToBase64(iv),
      salt: this.uint8ToBase64(salt),
    }
  }

  async decrypt(
    password: string,
    ciphertextBase64: string,
    ivBase64: string,
    saltBase64: string
  ) {
    const iv = this.base64ToUint8(ivBase64) as Uint8Array
    const salt = this.base64ToUint8(saltBase64)
    const ciphertext = this.base64ToUint8(ciphertextBase64) as Uint8Array

    const key = await this.deriveKey(password, salt)

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    )

    return new TextDecoder().decode(decryptedBuffer)
  }

  /**
   *  Function to check password complexity
   */
  isComplex(password: string): boolean {
    // Example criteria: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/
    return regex.test(password)
  }
}

const securityService = new SecurityService()
export default securityService
