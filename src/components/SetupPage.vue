<template>
  <ion-list>
    <ion-item>
      <ion-checkbox
        @ionChange="secureAction"
        v-model="state.secure"
        :disabled="state.secureReadOnly"
        >Secure Tokens with biometric</ion-checkbox
      >
    </ion-item>
    <ion-item>
      <ion-button @click="emit('backToHome')" color="danger" slot="end"
        >Close</ion-button
      >
    </ion-item>
  </ion-list>
</template>

<script lang="ts" setup>
import securestorageService from '@/services/securestorageService'
import { IonList, IonCheckbox, IonItem, IonButton } from '@ionic/vue'
import { onMounted, reactive } from 'vue'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'
import { Capacitor } from '@capacitor/core'

const emit = defineEmits<{
  (e: 'backToHome'): void
}>()

const state = reactive<{
  secure: boolean
  secureReadOnly: boolean
}>({
  secure: false,
  secureReadOnly: false,
})

onMounted(async () => {
  // Check if it's a mobile device and if biometric is available
  const biometricAvailable =
    Capacitor.isNativePlatform() && (await NativeBiometric.isAvailable())
  if (!biometricAvailable) {
    state.secureReadOnly = true
  } else {
    const secure = await securestorageService.get('setup-secure')
    if (secure === '1') {
      state.secure = true
    }
  }
})

async function secureAction() {
  // User wants to activate biometric
  if (state.secure) {
    // Check if user has biometric access
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Checking biometric authentication validity',
        title: 'Please authenticate',
      })
    } catch {
      state.secure = false
    }
  }

  securestorageService.setItem('setup-secure', state.secure ? '1' : '0')
}
</script>

<style scoped lang="scss"></style>
