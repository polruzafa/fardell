---
name: verify
description: Build, serve and drive For·Gear headlessly to verify changes at the real UI surface.
---

# Verificar For·Gear

App React + Vite (PWA, HashRouter, dades a localStorage). No hi ha tests: es verifica fent servir l'app de debò.

## Construir i servir

```bash
pnpm build                      # tsc --noEmit + vite build
pnpm exec vite preview --port 4173   # serveix dist/ (base: './', arrels a /)
```

Les rutes són de hash: `http://localhost:4173/#/kits`, `#/receptes`, `#/dades`…

## Conduir-la sense finestra

No hi ha Playwright, però sí un Chrome de puppeteer a la memòria cau:

```
~/.cache/puppeteer/chrome-headless-shell/<versió>/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

Instal·leu `puppeteer-core` en un directori temporal i lliureu-li aquest
`executablePath`. Detalls que estalvien temps:

- **Estat inicial**: visiteu la pàgina un cop, ompliu `localStorage`
  (`for-gear:data` i `for-gear:seed-base`) amb `page.evaluate`, i recarregueu.
  Per provar migracions, deseu-hi dades velles (p. ex. sense un camp nou).
- **Confirmacions**: l'app fa servir `window.confirm`; caleu
  `page.on('dialog', d => d.accept())` abans de tocar res.
- **Clics**: alguns botons es troben millor per text amb `page.evaluate` +
  `[...document.querySelectorAll('button')].find(b => b.textContent.includes(…))`.
- Vigileu `pageerror` i `console.error`: la sessió neta no n'emet cap.

## Fluxos que val la pena passar

- Migració: dades velles a localStorage → l'app arrenca i completa camps nous.
- Alta/edició/supressió des de la interfície (formularis, confirmacions).
- Persistència: recarregueu i comproveu `localStorage['for-gear:data']`.
- Referències creuades: suprimir un element/kit no ha de perdre res que hi apunti.
