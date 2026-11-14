/**
 * `pnpm phone`: start the web app and print the address to open on a phone on
 * the same Wi-Fi. Needs the local database running (`pnpm db:start`).
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const PORT = 8081;
const VIRTUAL = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|tailscale|zerotier/i;
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/** Real network adapters first, Wi-Fi before Ethernet. */
function lanAddresses() {
  const found = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const a of addresses ?? []) {
      if (a.family === 'IPv4' && !a.internal && PRIVATE.test(a.address)) found.push({ name, address: a.address });
    }
  }
  const rank = (n) => (/wi-?fi|wlan|wireless|^en0$/i.test(n) ? 0 : /ethernet|^en\d|^eth/i.test(n) ? 1 : 2);
  return found.sort((x, y) => rank(x.name) - rank(y.name));
}

const lan = lanAddresses();
const line = '-'.repeat(56);
console.log(`\n${line}`);
if (lan.length === 0) {
  console.log('No Wi-Fi address found. Is this computer on the home network?');
} else {
  console.log(' On her phone (same Wi-Fi), open:\n');
  console.log(`   http://${lan[0].address}:${PORT}\n`);
  for (const other of lan.slice(1)) console.log(`   or http://${other.address}:${PORT}  (${other.name})`);
  console.log(' Keep this window open while she uses it.');
}
console.log(`${line}\n`);

// One fixed command string (no user input), so running it through the shell is safe.
const child = spawn(`pnpm --filter mobile exec expo start --web --port ${PORT}`, {
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
