<template>
  <h1>Import tokens</h1>
  <ion-item lines="none">
    <ion-input
      ref="passwordInput"
      type="password"
      label="Password"
      v-model="state.cypherPassword"
      helper-text=""
      fill="outline"
      error-text="Password too weak"
      @ionInput="validatePassword"
    >
      <ion-input-password-toggle slot="end"></ion-input-password-toggle>
    </ion-input>
  </ion-item>
  <ion-label v-if="state.cypherPassword"><p>Recover from</p> </ion-label>
  <ion-item lines="none">
    <ion-button
      class="flex-btn"
      size="large"
      @click="scanQRCode"
      v-if="state.cypherPassword"
    >
      <ion-icon slot="start" :icon="qrCodeOutline"></ion-icon>Scan</ion-button
    >
  </ion-item>
  <ion-item v-if="state.cypherPassword">
    <input type="file" hidden @change="onFileSelected" ref="fileInput" />
    <ion-button class="flex-btn" size="large" @click="openFilePicker">
      <ion-icon slot="start" :icon="documentOutline"></ion-icon>File
    </ion-button>
  </ion-item>
  <ion-item lines="none">
    <ion-button
      @click="emit('backToHome')"
      class="flex-btn"
      color="danger"
      size="large"
      >Cancel</ion-button
    >
  </ion-item>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import {
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonIcon,
  IonLabel,
  alertController,
} from '@ionic/vue'
import securityService from '@/services/securityService'
import { documentOutline, qrCodeOutline } from 'ionicons/icons'
import { QRCodeInterface, TokenInterface } from '@/interfaces'
import qrcodeService from '@/services/qrcodeService'
import { useTokens } from '@/store/tokenStore'
import storageService from '@/services/storageService'
import tokenService from '@/services/tokenService'

const tokenStore = useTokens()

const fileInput = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  (e: 'backToHome'): void
}>()

const passwordInput = ref()

const state = reactive<{
  cypherText: string
  salt: string
  iv: string
  plain: string
  cypherPassword: string
}>({
  cypherText: '',
  salt: '',
  iv: '',
  plain: '',
  cypherPassword: '',
})

/**
 * When user types password, it checks if it's complex enough and it displays a message if not
 */
function validatePassword() {
  passwordInput.value.$el.classList.remove('ion-valid')
  passwordInput.value.$el.classList.remove('ion-invalid')

  if (passwordInput.value === '') {
    return
  }
  passwordInput.value.$el.classList.add('ion-touched')
  passwordInput.value.$el.classList.toggle(
    'ion-valid',
    securityService.isComplex(state.cypherPassword)
  )
  passwordInput.value.$el.classList.toggle(
    'ion-invalid',
    !securityService.isComplex(state.cypherPassword)
  )
}

/**
 * User scans old phone export qrcode
 */
async function scanQRCode() {
  try {
    const qr: QRCodeInterface = await qrcodeService.scanQRCode() //

    if (qr.error) {
      showErrorMessage(qr.error)
      return
    }

    // Recover data from server
    const qrCodeData = qr.value.split('#') // url#id#iv#salt
    const exportData = await tokenService.getExportFromGateway(
      qrCodeData[0],
      qrCodeData[1]
    )

    if (exportData.error) {
      showErrorMessage(exportData.error)
      return
    }

    try {
      const tokens: TokenInterface[] = JSON.parse(
        await securityService.decrypt(
          state.cypherPassword,
          exportData.value.tokens,
          qrCodeData[2],
          qrCodeData[3]
        )
      )
      for (const tokenText of tokens) {
        // check if id and secret already exists
        if (!tokenStore.tokenExists(tokenText.id, tokenText.secret)) {
          const token = tokenService.createFromImport(tokenText)
          // Import the token
          await storageService.addToArray('tokens', token)
          tokenStore.addToken(token)
        }
      }

      emit('backToHome')
    } catch {
      showErrorMessage('Invalid password')
    }
  } catch (error) {
    showErrorMessage('Error while scanning the QRCode: ' + error)
  }
}

/**
 * Display file picker on the hidden input html element
 */
function openFilePicker() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

/**
 * Event triggered when a backup file is selected
 * @param event
 */
async function onFileSelected(event: any) {
  if (!state.cypherPassword) {
    showErrorMessage('Please type the password you used during export')
  }

  const file = event.target.files[0]
  const reader = new FileReader()

  reader.readAsText(file)

  reader.onload = async () => {
    const text = reader.result
    if (text && typeof text == 'string') {
      try {
        const data = JSON.parse(text)
        try {
          const tokens: TokenInterface[] = JSON.parse(
            await securityService.decrypt(
              state.cypherPassword,
              data.tokens,
              data.header.iv,
              data.header.salt
            )
          )
          for (const tokenText of tokens) {
            // check if id and secret already exists
            if (!tokenStore.tokenExists(tokenText.id, tokenText.secret)) {
              const token = tokenService.createFromImport(tokenText)
              // Import the token
              await storageService.addToArray('tokens', token)
              tokenStore.addToken(token)
            }
          }
          emit('backToHome')
        } catch {
          showErrorMessage('Invalid password')
          state.cypherPassword = ''
          return
        }
      } catch {
        showErrorMessage('Invalid file')
        state.cypherPassword = ''
        return
      }
    }
  }
}

/**
 * Used to display message on screen
 * @param msg string
 */
async function showErrorMessage(msg: string) {
  const alert = await alertController.create({
    header: 'Error',
    subHeader: '',
    message: msg,
    buttons: [
      {
        text: 'Close',
      },
    ],
  })

  await alert.present()
}
</script>

<style scoped lang="scss">
.flex-btn {
  flex: 1; /* take equal space */
  margin: 0 4px 10px; /* optional spacing between buttons */
}
</style>
