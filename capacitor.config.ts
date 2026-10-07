import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.colouryourmap',
  appName: '여행 색칠공부',
  webDir: 'dist',
  backgroundColor: '#0b0b0d',
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false },
}

export default config
