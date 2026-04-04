<template>
  <ion-content>
    <h1>Export selected tokens</h1>
    <ion-list>
      <ion-item @click="toggleAll" v-show="tokenStore.tokensList.length > 1">
        <ion-label class="ion-text-right">Un/Select all</ion-label>
        <ion-checkbox slot="end" checked />
      </ion-item>
      <ion-item
        v-for="item in tokenStore.tokensList"
        :key="item.id"
        lines="none"
      >
        <ion-label>{{ item.title }}</ion-label>
        <ion-checkbox slot="end" v-model="item.checked" />
      </ion-item>
    </ion-list>

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
    <ion-item v-show="!state.displayGateways">
      <ion-button v-if="displayExportButton" @click="exportSelectedTokensToFile"
        >Export to file</ion-button
      >
      <ion-button
        v-if="displayExportButton && state.gateways.length > 0"
        @click="displayGatewaySelection"
        >Export to QR</ion-button
      >
      <ion-button @click="emit('backToHome')" color="danger" slot="end"
        >Cancel</ion-button
      >
    </ion-item>
    <ion-item
      lines="none"
      v-show="state.gateways.length > 1 && state.displayGateways"
    >
      <ion-select
        label="Gateway"
        placeholder="Select a gateway"
        v-model="state.selectedGatewayUrl"
      >
        <ion-select-option
          v-for="item in state.gateways"
          :key="item.id"
          :value="item.value"
          lines="none"
          >{{ item.label }}</ion-select-option
        >
      </ion-select>
    </ion-item>
    <ion-item
      v-show="
        state.gateways.length > 1 &&
        state.displayGateways &&
        state.selectedGatewayUrl
      "
    >
      <ion-button @click="exportToGateway">OK</ion-button>
      <ion-button @click="emit('backToHome')" color="danger" slot="end"
        >Cancel</ion-button
      >
    </ion-item>
    <ion-item lines="none">
      <div class="qr-container">
        <img
          v-if="state.qrCodeDataUrl"
          :src="state.qrCodeDataUrl"
          alt="QR Code"
        />
        <ion-label v-if="state.qrCodeDataUrl"
          ><p>Scan in multiOTP token App, import menu, on your new cellphone</p>
        </ion-label>
      </div>
    </ion-item>
  </ion-content>
</template>

<script lang="ts" setup>
import {
  IonList,
  IonLabel,
  IonItem,
  IonContent,
  IonButton,
  IonCheckbox,
  IonInput,
  IonInputPasswordToggle,
  IonSelect,
  IonSelectOption,
  alertController,
} from '@ionic/vue'
import { useTokens } from '@/store/tokenStore'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { computed, onMounted, reactive, ref } from 'vue'
import tokenService from '@/services/tokenService'
import { version } from '../../package.json'
import QRCode from 'qrcode'
import securityService from '@/services/securityService'
import config from '@/config'
import { GatewayInterface } from '@/interfaces'

const emit = defineEmits<{
  (e: 'backToHome'): void
}>()

const tokenStore = useTokens()
const passwordInput = ref()

const state = reactive<{
  allChecked: boolean
  qrCodeDataUrl: string
  cypherPassword: string
  gateways: GatewayInterface[]
  selectedGatewayUrl: string
  displayGateways: boolean
}>({
  allChecked: false,
  qrCodeDataUrl: '',
  cypherPassword: '',
  gateways: [],
  selectedGatewayUrl: '',
  displayGateways: false,
})

onMounted(() => {
  toggleAll()
  extractGatewayUrl()
})

/**
 * Check or uncheck all tokens
 */
const toggleAll = () => {
  state.allChecked = !state.allChecked
  for (const item of tokenStore.tokensList) {
    item.checked = state.allChecked
  }
}

/**
 *
 */
function extractGatewayUrl() {
  // Add each gateway once in the array
  for (const element of tokenStore.tokensList) {
    // If it's a push token
    if (element.mogw) {
      const label = element.mogw == config.apiUrl ? 'Default' : element.mogw

      if (!state.gateways.find((item) => item.label === label)) {
        state.gateways.push({
          id: 'id' + Math.random().toString(16).slice(2),
          label: label,
          value: element.mogw,
        })

        if (label === 'Default') {
          state.selectedGatewayUrl = element.mogw
        }
      }
    }
  }

  // By default select first element
  if (state.gateways.length == 1 && !state.selectedGatewayUrl) {
    state.selectedGatewayUrl = state.gateways[0].value
  }
}

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
    displayExportButton.value,
  )
  passwordInput.value.$el.classList.toggle(
    'ion-invalid',
    !displayExportButton.value,
  )
}

/**
 * Computed property to display export buttons only if password is strong enough
 */
const displayExportButton = computed(() => {
  return securityService.isComplex(state.cypherPassword)
})

/**
 * Generate JSON for tokens selected to be exported
 */
function getTokensAsTextForExport(): string {
  let fileContent = ''
  // TODO insérer un hash pour vérifier l'intégrité du fichier

  // TOKENS
  const checkedTokens = tokenStore.tokensList.filter((item) => item.checked)

  for (const element of checkedTokens) {
    fileContent += tokenService.exportToJSON(element) + ',\n'
  }
  fileContent = fileContent.trim().replace(/,+$/g, '')
  return '[' + fileContent + ']'
}

/**
 *  Generate the file header
 * @param salt salt for file export version only
 * @param iv  iv for file export version only
 */
function getExportHeader(
  salt: string | null,
  iv: string | null,
): { [k: string]: any } {
  const header = {
    operation: 'EXPORT',
    date: new Date().toISOString(),
    version: version,
    iv: iv,
    salt: salt,
  }
  return Object.fromEntries(
    Object.entries(header).filter(([, value]) => value !== null),
  )
}

/**
 * Function to export selected tokens to new smartphone through file sharing
 */
async function exportSelectedTokensToFile() {
  // Get JSON of selected tokens
  const jsonTokens = getTokensAsTextForExport()

  // Encrypt JSON tokens to transfer them on gateway
  const cypheredData = await securityService.encrypt(
    state.cypherPassword,
    jsonTokens,
  )

  // Prepare data for file
  const dataToTransfer = JSON.stringify({
    header: getExportHeader(cypheredData.salt, cypheredData.iv),
    tokens: cypheredData.ciphertext,
  })

  const savedFile = await Filesystem.writeFile({
    path: tokenService.fileNameExport,
    data: dataToTransfer,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true, // To create automatically the folders path
  })

  await Share.share({
    title: 'Export Configuration',
    url: savedFile.uri,
    dialogTitle: 'Share the config file',
  })

  tokenService.deleteTempFiles()
}

function displayGatewaySelection() {
  if (state.gateways.length == 1) {
    exportToGateway()
  } else {
    // Display gateway selection
    state.displayGateways = true
  }
}

/**
 * Function to export token list to gateway. Then user can scan QRCode from new cellphone
 */
async function exportToGateway() {
  // Get JSON of selected tokens
  const jsonTokens = getTokensAsTextForExport()

  // Encrypt JSON tokens to transfer them on gateway
  const cypheredData = await securityService.encrypt(
    state.cypherPassword,
    jsonTokens,
  )

  // Prepare data to send to gateway
  const dataToTransfer = JSON.stringify({
    header: getExportHeader(null, null),
    tokens: cypheredData.ciphertext,
  })

  // Send encrypted tokens to gateway using POST API
  const id = await tokenService.sendExportToGateway(
    dataToTransfer,
    state.selectedGatewayUrl,
  )
  if (id === '') {
    // display error message because server refused the request
    showErrorMessage(`Token couldn't be exported`)
  } else {
    // Generate QRCode including id received from gateway, IV and salt
    state.qrCodeDataUrl = await QRCode.toDataURL(
      state.selectedGatewayUrl +
        '#' +
        id +
        '#' +
        cypheredData.iv +
        '#' +
        cypheredData.salt,
    )
  }
}

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
</script>

<style scoped lang="scss">
.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center; /* centers horizontally */
  width: 100%;
}

.qr-container img {
  max-width: 80%; /* scales down on smaller screens */
  height: auto; /* keeps aspect ratio */
  margin-bottom: 8px; /* space between image and label */
}

.qr-container ion-label {
  text-align: center;
}
</style>
