/** Shared by `pnpm phone` and `pnpm home`: this computer's address on the home Wi-Fi. */
import { networkInterfaces } from 'node:os';

export const APP_PORT = 8081;

const VIRTUAL = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|tailscale|zerotier/i;
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/** Real network adapters first, Wi-Fi before Ethernet. */
export function lanAddresses() {
  const found = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const a of addresses ?? []) {
      if (a.family === 'IPv4' && !a.internal && PRIVATE.test(a.address)) {
        found.push({ name, address: a.address });
      }
    }
  }
  const rank = (n) =>
    /wi-?fi|wlan|wireless|^en0$/i.test(n) ? 0 : /ethernet|^en\d|^eth/i.test(n) ? 1 : 2;
  return found.sort((x, y) => rank(x.name) - rank(y.name));
}

/** The box printed at startup with the address to open on her phone. */
export function phoneBanner() {
  const lan = lanAddresses();
  const line = '-'.repeat(60);
  const out = [`\n${line}`];
  if (lan.length === 0) {
    out.push(' No Wi-Fi address found. Is this computer on the home network?');
  } else {
    out.push(' On her phone (same Wi-Fi), open:', '', `   http://${lan[0].address}:${APP_PORT}`, '');
    for (const other of lan.slice(1)) {
      out.push(`   or http://${other.address}:${APP_PORT}  (${other.name})`);
    }
    out.push(' First time? Use Share > Add to Home Screen for the Rounds icon.');
    out.push(' Keep this window open while she uses it.');
  }
  out.push(`${line}\n`);
  return out.join('\n');
}
