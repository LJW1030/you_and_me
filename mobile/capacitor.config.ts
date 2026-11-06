import type { CapacitorConfig } from '@capacitor/cli';

// Remote loading is exclusively for device testing. Store release needs bundled assets.
const raw = process.env.MOBILE_TEST_URL;
const server = raw ? new URL(raw) : undefined;
if (server && (server.protocol !== 'https:' || server.username || server.password || server.pathname !== '/' || server.search || server.hash)) {
  throw new Error('MOBILE_TEST_URL must be an HTTPS origin without a path or credentials');
}
const config: CapacitorConfig = {
  appId: 'kr.nirangnae.chat',
  appName: '니랑내',
  webDir: 'www',
  loggingBehavior: 'none',
  android: { webContentsDebuggingEnabled: false },
  ...(server ? { server: { url: server.origin, cleartext: false } } : {}),
};
export default config;
