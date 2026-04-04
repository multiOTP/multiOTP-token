<template>
  <ion-list>
    <ion-item>
      <ion-input
        label="Title"
        placeholder="joe@example.com"
        v-model="state.newToken.title"
      ></ion-input>
    </ion-item>
    <ion-item>
      <ion-input
        label="Description"
        placeholder="short description"
        v-model="state.newToken.description"
      ></ion-input>
    </ion-item>
    <ion-item v-if="!tokenStore.editTokenId">
      <ion-label>Type</ion-label>
      <ion-radio-group v-model="state.newToken.type" @ionChange="onChangeType">
        <ion-radio :value="TokenType.totp">TOTP</ion-radio><br />
        <ion-radio :value="TokenType.motp">MOTP</ion-radio><br />
      </ion-radio-group>
    </ion-item>
    <ion-item v-if="!tokenStore.editTokenId">
      <ion-label>Type</ion-label>
      <ion-radio-group v-model="state.newToken.seedType">
        <ion-radio :value="TokenSeedType.base32">Base32</ion-radio><br />
        <ion-radio :value="TokenSeedType.hex">Hex</ion-radio><br />
      </ion-radio-group>
    </ion-item>
    <ion-item v-if="!tokenStore.editTokenId">
      <ion-input
        label="Secret"
        :placeholder="
          state.newToken.seedType == TokenSeedType.base32
            ? '(Base32 format)'
            : '(Hex format)'
        "
        v-model="state.newToken.secret"
      ></ion-input>
    </ion-item>
    <ion-item v-if="!tokenStore.editTokenId">
      <ion-label>Digits</ion-label>
      <ion-radio-group value="6" v-model.number="state.newToken.digits">
        <ion-radio justify="start" :value="6">6</ion-radio><br />
        <ion-radio justify="start" :value="8">8</ion-radio><br />
      </ion-radio-group>
    </ion-item>
    <ion-item v-if="!tokenStore.editTokenId">
      <ion-select
        label="Period"
        placeholder="Please select a period"
        v-model.number="state.newToken.period"
      >
        <ion-select-option :value="10">10</ion-select-option>
        <ion-select-option :value="15">15</ion-select-option>
        <ion-select-option :value="30">30</ion-select-option>
        <ion-select-option :value="60">60</ion-select-option>
        <ion-select-option :value="120">120</ion-select-option>
      </ion-select>
    </ion-item>
    <ion-item>
      <ion-button @click="save()">Save</ion-button>
      <ion-button @click="cancel()" color="danger" slot="end"
        >Cancel</ion-button
      >
    </ion-item>
  </ion-list>
</template>

<script lang="ts" setup>
import {
  IonList,
  IonItem,
  IonInput,
  IonRadioGroup,
  IonRadio,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
} from '@ionic/vue'
import { TokenInterface, TokenSeedType, TokenType } from '@/interfaces'
import storageService from '@/services/storageService'
import { reactive, toRaw } from 'vue'
import tokenService from '@/services/tokenService'
import { useTokens } from '@/store/tokenStore'

const tokenStore = useTokens()

const state = reactive<{
  newToken: TokenInterface
}>({
  newToken: {
    id: 'id' + Math.random().toString(16).slice(2),
    title: '',
    description: '',
    type: TokenType.totp,
    digits: 6,
    creation_date: null,
    secret: '',
    algorithm: 'SHA1',
    period: 30,
    counter: 0,
    otp: '0',
    progress: 0,
    interval: null,
    mogw: '',
    mosid: '',
    mouid: '',
    registered: false,
    seedType: TokenSeedType.base32,
    checked: false,
  },
})

// emit used to go back on the home page
const emit = defineEmits<{
  (e: 'backToHome'): void
}>()

if (tokenStore.editTokenId) {
  const token = tokenStore.getTokenById(tokenStore.editTokenId)
  if (token) {
    state.newToken.title = token.title
    state.newToken.description = token.description
  }
}

/** Saves a manual token in the storage */
async function save() {
  if (tokenStore.editTokenId) {
    await storageService.updateTokenTitleDescription(
      tokenStore.editTokenId,
      state.newToken.title,
      state.newToken.description,
    ) // update existing token
  } else {
    /** If token is motp and seedtype is base32, then convert it to hex because genotp only support hex for motp*/
    if (
      state.newToken.type === TokenType.motp &&
      state.newToken.seedType === TokenSeedType.base32
    ) {
      state.newToken.seedType = TokenSeedType.hex
      state.newToken.secret = tokenService.base32ToHex(state.newToken.secret)
    }
    await storageService.addToArray('tokens', toRaw(state.newToken)) // create new token
  }

  // Go back to main Windows
  tokenStore.setTokenToEdit(null)
  emit('backToHome')
}

function cancel() {
  tokenStore.setTokenToEdit(null)
  emit('backToHome')
}

function onChangeType() {
  switch (state.newToken.type) {
    case TokenType.motp:
      state.newToken.period = 10
      state.newToken.seedType = TokenSeedType.hex
      break
    case TokenType.totp:
      state.newToken.period = 30
      state.newToken.seedType = TokenSeedType.base32
      break
  }
}
</script>

<style scoped lang="scss"></style>
