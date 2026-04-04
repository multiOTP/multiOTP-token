import { QRCodeInterface } from '@/interfaces'
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerOptions,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner'
import { getPlatforms } from '@ionic/vue'

class QRCodeService {
  constructor() {}
  /**
   * Scan a qrcode
   */
  async scanQRCode(): Promise<QRCodeInterface> {
    const platforms = getPlatforms()
    if (!platforms.includes('mobile') && !platforms.includes('ipad')) {
      return {
        value: '',
        error: 'The scanner works only on a mobile phone',
      }
    }

    try {
      // Scanner options
      const scannerOptions: CapacitorBarcodeScannerOptions = {
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      }

      // Start scan
      const result = await CapacitorBarcodeScanner.scanBarcode(scannerOptions)
      if (result.ScanResult) {
        return {
          value: result.ScanResult,
          error: '',
        }
      } else {
        return {
          value: '',
          error: 'Error while scanning the QRCode',
        }
      }
    } catch (error) {
      return {
        value: '',
        error: 'Error while scanning the QRCode: ' + error,
      }
    }
  }
}

const qrcodeService = new QRCodeService()
export default qrcodeService
