<template>
  <ion-content color="light">
    <ion-list :inset="true">
      <ion-item-sliding
        v-for="item in tokenStore.tokensList"
        :key="item.id"
        @click="getOtp(item)"
      >
        <ion-item>
          <ion-label>
            <h1>{{ item.title }}</h1>
            <p>{{ item.description }}</p>
            <ion-input
              v-if="item.type == TokenType.motp && item.otp === '0'"
              v-model="motpPin"
              class="custom-input"
              inputmode="numeric"
              :maxlength="4"
              pattern="[0-9]{4}"
              placeholder=" Enter PIN"
              type="password"
              @ionInput="onMotpPinInput(item)"
            ></ion-input>
            <ion-progress-bar
              :value="item.progress"
              v-if="item.otp != '0'"
            ></ion-progress-bar>
          </ion-label>
          <ion-label slot="end" class="otp" v-if="item.otp != '0'">{{
            item.otp
          }}</ion-label>
        </ion-item>
        <ion-item-options>
          <ion-item-option
            color="danger"
            @click.stop="deleteToken(item.id)"
            class="ion-margin-end"
          >
            <ion-icon :icon="trashOutline" size="large"></ion-icon>
          </ion-item-option>
          <ion-item-option color="primary" @click.stop="editToken(item.id)">
            <ion-icon :icon="createOutline" size="large"></ion-icon>
          </ion-item-option>
        </ion-item-options>
      </ion-item-sliding>
    </ion-list>
  </ion-content>
</template>

<script lang="ts" setup>
import { TokenInterface, TokenType } from '@/interfaces'
import {
  IonList,
  IonLabel,
  IonItem,
  IonContent,
  IonIcon,
  IonProgressBar,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonInput,
  alertController,
} from '@ionic/vue'
import { trashOutline, createOutline } from 'ionicons/icons'
import tokenService from '@/services/tokenService'
import { ref } from 'vue'
import { useTokens } from '@/store/tokenStore'
import storageService from '@/services/storageService'

const tokenStore = useTokens()

const emit = defineEmits<{
  (e: 'backToHome'): void
}>()

const motpPin = ref('')

/** generate a new token */
async function getOtp(item: TokenInterface) {
  if (item.type == TokenType.motp && motpPin.value.length != 4) {
    return
  }
  item.otp = await tokenService.generateNewOtp(item, motpPin.value)
  if (!item.otp) {
    showErrorMessage("Couldn't generate otp")
    return
  }
  motpPin.value = ''

  // Clear running interval if it exists
  if (item.interval) {
    window.clearInterval(item.interval)
  }
  // Start progress bar at 0
  item.progress = 0
  item.interval = window.setInterval(
    () => {
      item.progress += 0.01
      // Reset the progress bar when it reaches 100%
      if (item.progress > 1) {
        window.clearInterval(item.interval!)
        // Set otp code to 0
        item.otp = '0'
      }
    },
    (item.period * 1000) / 100,
  )
}

/** When the motp pin code is typed */
function onMotpPinInput(item: TokenInterface) {
  /** Check if pin is a 4 digits number */
  const isValid = /^\d{4}$/.test(motpPin.value)
  if (isValid) {
    getOtp(item)
  }
}

/**
 * Delete a token from storage
 * @param id string token id
 */
function deleteToken(id: string) {
  // Remove dans Pinia (running memory)
  tokenStore.removeToken(id)
  // Remove from storage
  storageService.removeFromArray('tokens', id)
}

/**
 * Display the page to edit manually a token
 */
function editToken(id: string) {
  tokenStore.setTokenToEdit(id)
  emit('backToHome')
}

// Used to display message on screen
async function showErrorMessage(msg: string) {
  const alert = await alertController.create({
    header: 'Error',
    subHeader: '',
    message: msg,
    cssClass: 'errorMessageCss',
    buttons: [
      {
        text: 'Close',
        role: 'cancel',
      },
    ],
  })

  await alert.present()
}
</script>

<style scoped lang="scss">
.otp {
  font-size: 20px;
  font-weight: bold;
}

ion-input.custom-input {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 10px;
  --highlight-color-focused: transparent; /* retire la ligne bleue */
}

ion-input.custom-input:focus-within {
  border-color: #3880ff; /* couleur Ionic */
  box-shadow: 0 0 0 2px rgba(56, 128, 255, 0.2);
}
</style>
