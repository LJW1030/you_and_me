const { spawnSync } = require('node:child_process');
const path = require('node:path');
if (!process.env.MOBILE_TEST_URL) throw new Error('Set MOBILE_TEST_URL to the current HTTPS test origin first.');
const platform = process.argv[2];
if (platform && !['android', 'ios'].includes(platform)) throw new Error('Platform must be android or ios');
const cli = path.join(__dirname, '../node_modules/@capacitor/cli/bin/capacitor');
const result = spawnSync(process.execPath, [cli, 'sync', ...(platform ? [platform] : [])], { stdio: 'inherit' });
process.exit(result.status ?? 1);
