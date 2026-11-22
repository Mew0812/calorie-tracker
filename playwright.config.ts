import { defineConfig,devices } from '@playwright/test'
const browser=process.env.MYDIET_BROWSER||'msedge'
export default defineConfig({
  testDir:'./e2e',testMatch:'*.pw.ts',
  use:{...(browser==='webkit'?devices['iPhone SE (3rd gen)']:{...devices['Pixel 7'],channel:browser}),baseURL:'http://127.0.0.1:4280'},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4280 --strictPort',url:'http://127.0.0.1:4280',reuseExistingServer:false}
})
