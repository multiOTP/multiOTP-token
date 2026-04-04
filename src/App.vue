<template>
  <ion-app>
    <ion-menu content-id="main-content" menu-id="main-menu">
      <ion-header>
        <ion-toolbar>
          <ion-title>Menu</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-menu-toggle :auto-hide="false">
            <ion-item @click="newManualToken()">
              <ion-icon :icon="pencil" slot="start"></ion-icon>
              <ion-label>Add a new token</ion-label>
            </ion-item>
          </ion-menu-toggle>
          <ion-menu-toggle :auto-hide="false">
            <ion-item @click="scanQRCode()">
              <ion-icon :icon="qrCodeOutline" slot="start"></ion-icon>
              <ion-label>Add a new token</ion-label>
            </ion-item>
          </ion-menu-toggle>
          <ion-menu-toggle :auto-hide="false">
            <ion-item @click="state.page = 'ExportTokensPage'">
              <ion-icon :icon="shareOutline" slot="start"></ion-icon>
              <ion-label>Export</ion-label>
            </ion-item>
          </ion-menu-toggle>
          <ion-menu-toggle :auto-hide="false">
            <ion-item @click="state.page = 'ImportTokensPage'">
              <ion-icon :icon="pushOutline" slot="start"></ion-icon>
              <ion-label>Import</ion-label>
            </ion-item>
          </ion-menu-toggle>
          <ion-menu-toggle :auto-hide="false">
            <ion-item @click="state.page = 'SetupPage'">
              <ion-icon :icon="settingsOutline" slot="start"></ion-icon>
              <ion-label>Setup</ion-label>
            </ion-item>
          </ion-menu-toggle>
          <ion-menu-toggle :auto-hide="false">
            <ion-note
              ><div class="ion-text-center ion-margin">
                Version: {{ version }}
              </div></ion-note
            >
          </ion-menu-toggle>
        </ion-list>
      </ion-content>
    </ion-menu>
    <ion-page id="main-content">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-menu-button></ion-menu-button>
          </ion-buttons>
          <ion-title>multiOTP token</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <Component :is="pages[state.page]" @back-to-home="backHome"></Component>
      </ion-content>
    </ion-page>
  </ion-app>
</template>

<script setup lang="ts">
import {
  IonApp,
  IonMenu,
  IonToolbar,
  IonHeader,
  IonContent,
  IonPage,
  IonButtons,
  IonMenuButton,
  IonTitle,
  menuController,
  IonIcon,
  IonList,
  IonLabel,
  IonItem,
  IonMenuToggle,
  IonNote,
  alertController,
} from '@ionic/vue'
import {
  pencil,
  qrCodeOutline,
  shareOutline,
  pushOutline,
  settingsOutline,
} from 'ionicons/icons'
import { onMounted, reactive, type Component as C } from 'vue'
import { PushNotifications } from '@capacitor/push-notifications'
import {
  QRCodeInterface,
  RegisterResult,
  TokenSeedType,
  TokenType,
  type Page,
  type TokenInterface,
} from './interfaces'
import NewManualTokenPage from './components/NewManualTokenPage.vue'
import TokensPage from './components/TokensPage.vue'
import storageService from './services/storageService'
import tokenService from './services/tokenService'
import { Network } from '@capacitor/network'
import { isPlatform } from '@ionic/vue'
import ExportTokensPage from './components/ExportTokensPage.vue'
import ImportTokensPage from './components/ImportTokensPage.vue'
import { useTokens } from './store/tokenStore'
import qrcodeService from './services/qrcodeService'
import { Capacitor } from '@capacitor/core'
import { version } from '../package.json'
import SetupPage from './components/SetupPage.vue'

// Pinia store
const tokenStore = useTokens()

// Used to display message on screen
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

// Used to display notification
async function showNotification(
  token: TokenInterface,
  id_transaction: string,
  header: string,
  subheader: string,
) {
  const alert = await alertController.create({
    header: header,
    subHeader: subheader,
    inputs:
      token.type == TokenType.motp
        ? [
            {
              type: 'number',
              name: 'pin',
              placeholder: 'Personal PIN',
              value: '', // optional : default value
            },
          ]
        : [],
    message: token.title + ': ' + token.description,
    buttons: [
      {
        text: 'Approve',
        handler: (data) => {
          if (data && data.pin == '') {
            return false
          }
          tokenService.respondOnGateway(
            true,
            token,
            id_transaction,
            data && data.pin ? data.pin : '',
          )
        },
      },
      {
        text: 'Deny',
        handler: () => {
          tokenService.respondOnGateway(false, token, id_transaction, '')
        },
      },
    ],
  })

  await alert.present()
}

// Data used in the application
const state = reactive<{
  page: Page
  appVersion: string
  tokenToEdit: string | null
}>({
  page: 'TokensPage',
  appVersion: '',
  tokenToEdit: null,
})

// Pages management (displayed component)
const pages: { [s: string]: C } = {
  TokensPage,
  NewManualTokenPage,
  ExportTokensPage,
  ImportTokensPage,
  SetupPage,
}

/**
 * Function to display home page (tokens page) when coming back from other component
 */
function backHome() {
  // User coming back from token page and wants to edit a token
  if (tokenStore.editTokenId) {
    state.page = 'NewManualTokenPage'
  } else {
    state.tokenToEdit = null
    state.page = 'TokensPage'
    loadTokens()
  }
}

/**
 * Display the page to create manually a token
 */
async function newManualToken() {
  await menuController.close('end')
  // Open new token Dialog
  state.page = 'NewManualTokenPage'
}

/**
 * Scan a qrcode to import the token
 */
async function scanQRCode() {
  try {
    const qr: QRCodeInterface = await qrcodeService.scanQRCode()

    if (qr.error) {
      showErrorMessage(qr.error)
      return
    }
    const token: TokenInterface | null = tokenService.createFromUrlString(
      qr.value,
    )

    if (token) {
      if (
        token.type === TokenType.motp &&
        token.seedType === TokenSeedType.base32
      ) {
        token.seedType = TokenSeedType.hex
        token.secret = tokenService.base32ToHex(token.secret)
      }
      const secret = token.secret
      await storageService.addToArray('tokens', token)
      token.secret = secret // Set secret after saving it because the process of saving the token emtpies the secret in order to use secure storage.

      const registrationResult = await tokenService.registerOnGateway(token)
      if (
        registrationResult == RegisterResult.success ||
        registrationResult == RegisterResult.noNeedToRegister
      ) {
        token.registered = true
      } else if (registrationResult != RegisterResult.notificationDisabled) {
        // message d'erreur
        showErrorMessage(
          `Error while registring the push token ${token.description} on the gateway please check your internet connexion`,
        )
      }
      tokenStore.addToken(token)
    } else {
      // message d'erreur
      showErrorMessage('Error while reading token string')
    }
  } catch (error) {
    showErrorMessage('Error while scanning the QRCode: ' + error)
  }
}

/**
 * Register application for push notification
 */
const registerPush = () => {
  // Ask for permission
  PushNotifications.requestPermissions().then((permission) => {
    if (permission.receive === 'granted') {
      // Register cellphone for notification
      PushNotifications.register()
    }
  })

  // Listen to notification
  PushNotifications.addListener('registration', (token) => {
    storageService.setItem('id_push', token.value)
  })

  // Error on registration
  PushNotifications.addListener('registrationError', (err) => {
    showErrorMessage('Error on notification registration. Error 258. ' + err)
  })

  // Application foreground notification
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    let data = ''
    let title = ''
    let subtitle = ''

    if (isPlatform('ios')) {
      data = notification.data.data.data.split('##')
      title = notification.data.data.title
      subtitle = notification.data.data.subtitle
    } else {
      data = notification.data.data.split('##')
      title = notification.data.title
      subtitle = notification.data.subtitle
    }

    const token = tokenStore.getTokenByMouid(data[0])
    if (token) {
      showNotification(token, data[1], title, subtitle)
    }
  })

  // Application background notification
  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    async (notification) => {
      let data = ''
      let title = ''
      let subtitle = ''
      if (isPlatform('ios')) {
        data = notification.notification.data.data.data.split('##')
        title = notification.notification.data.data.title
        subtitle = notification.notification.data.data.subtitle
      } else {
        data = notification.notification.data.data.split('##')
        title = notification.notification.data.title
        subtitle = notification.notification.data.subtitle
      }

      if (tokenStore.tokensList.length === 0) {
        // List not loaded in Pinia
        const token = (await storageService.getArray('tokens')).find(
          (token) => token.mouid === data[0],
        )
        if (token !== undefined) {
          showNotification(token as TokenInterface, data[1], title, subtitle)
        }
      } else {
        const token = tokenStore.getTokenByMouid(data[0])
        if (token) {
          showNotification(token, data[1], title, subtitle)
        }
      }
    },
  )
}

onMounted(() => {
  if (Capacitor.getPlatform() !== 'web') {
    // Register tokens for push notification if necessary (no internet on qr scan)
    registerPush()
  }
  // Load tokens from storage
  loadTokens()
  // Delete temporary files (export file)
  tokenService.deleteTempFiles()
})

/**
 * Read storage and load tokens
 */
async function loadTokens() {
  tokenStore.loadTokens(await storageService.getArray('tokens'))

  // If some tokens are not registered (no internet access when scanning qrcode) on the gateway then try to register when loading the app
  const connected = (await Network.getStatus()).connected
  if (connected) {
    for (const token of tokenStore.tokensList) {
      if (token.mouid && !token.registered && connected) {
        const registrationResult = await tokenService.registerOnGateway(token)
        if (
          registrationResult == RegisterResult.success ||
          registrationResult == RegisterResult.noNeedToRegister
        ) {
          token.registered = true
          storageService.updateTokenRegistered(token.id, true)
        } else if (registrationResult != RegisterResult.notificationDisabled) {
          // display error message
          showErrorMessage(
            `Error while registring the push token ${token.description} on the gateway please create a new QRCode`,
          )
        }
      }
    }
  }
  openMainMenu()
}

/**
 * Open main menu if no token available in the app
 */
const openMainMenu = async () => {
  if (tokenStore.tokensList.length == 0) {
    await menuController.open('main-menu')
  }
}
</script>

<style lang="scss">
ion-content {
  // TODO check if necessary
  --padding-top: var(--ion-safe-area-top, 0);
}
</style>
