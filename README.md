# Fardell

PWA per portar l'inventari de material de muntanya i preparar motxilles. Local primer: el web és estàtic i les dades viuen al dispositiu; opcionalment, un compte d'usuari les sincronitza entre dispositius a través d'una API pròpia (vegeu `server/`).

## Com funciona

- **Material**: llista de tot l'equip, amb cerca i filtre per categoria. Cada element té fitxa pròpia (categoria, pes, etiquetes, notes, característiques i foto local).
- **Kits**: grups de material amb nom («kit arròs», «kit mess tin»…) que es poden reutilitzar i imbricar: un kit pot contenir altres kits.
- **Motxilles**: tria una motxilla del material (categoria «Mochilas») i omple-la amb elements i kits sencers. Mostra el pes total, el percentatge de càrrega i una barra de pes per categories. Cada pertinença té **quantitat** (2 cantimplores) i pot marcar-se **«a sobre»** (roba posada, bastons): surt a la llista però no compta en el pes transportat. Si una mateixa peça arriba per dos camins val la quantitat més gran (és la mateixa peça física), i no s'hi poden crear cicles. Els elements de la categoria «Mochilas» no s'afegeixen mai com a contingut solt: una motxilla només entra en un grup com a contenidor o com a grup imbricat.
- **Dades**: exporta o importa el JSON sencer, torna a les dades d'exemple, o **afegeix elements enganxant JSON** (additiu, amb comprovació de format; accepta els camps de l'app i els del format original de l'inventari).
- **Dependències**: un element pot declarar `needs` (etiquetes que un altre element del grup ha de tenir, com ara `fuel` o `mechero`); si no es cobreixen, la motxilla o el kit mostren un avís de «possibles oblits» sense bloquejar res.
- **Temes**: cinc paletes de colors triables als *Ajustos* (`src/theme.tsx` i els blocs `[data-theme]` de `styles.css`), cadascuna amb variant clara i fosca: per defecte la tria el sistema, però es pot forçar. Un script d'`index.html` aplica el tema desat abans de la primera pintada. «Pedra» és l'original; la resta ve de l'app bitácora.

## Dades

- La llavor és a `src/data/gear.json` i s'empaqueta amb l'app.
- El primer cop, l'app copia la llavor a `localStorage`; a partir d'aleshores totes les edicions es desen al dispositiu.
- **Fusió automàtica de la llavor** (`src/seedMerge.ts`): l'app recorda amb quina llavor es va fusionar per última vegada (`fardell:seed-base`). Quan un desplegament porta una llavor nova, es fusiona a l'arrencada entitat per entitat: si l'usuari no ha tocat una entitat guanya la llavor; si l'ha modificada o creada guanya l'usuari; si l'ha suprimida continua suprimida. Mai no es perd res de l'usuari.
- Per actualitzar la llavor del repositori: *Dades → Exporta el JSON* i substituïu `src/data/gear.json` pel fitxer exportat.

### Compte i sincronització

- **Opcional**: sense compte, l'app funciona exactament igual que abans, només amb el dispositiu.
- Amb un compte (adreça electrònica i contrasenya, des dels *Ajustos*), les dades es guarden també al servidor i se sincronitzen entre dispositius: cada canvi s'envia al cap d'un moment, i en obrir l'app es recullen les novetats.
- La lògica és a `src/account.tsx`: el dispositiu recorda quina versió del servidor coneix (`lastSyncedAt`) i si té canvis pendents (`dirty`). Si hi ha canvis a totes dues bandes, l'app pregunta amb quina versió quedar-se; mai no fusiona a cegues.
- El backend és un Worker de Cloudflare amb D1, dins de `server/`; el desplegament (gratuït) està explicat a `server/README.md`. L'URL de l'API s'escriu al formulari dels *Ajustos*, o es deixa preconfigurada compilant amb `VITE_API_URL`.
- Les fotografies no es sincronitzen: viuen a l'IndexedDB de cada dispositiu.

### Migracions

Les dades de l'usuari viuen a `localStorage` i no s'han de perdre mai en una actualització:

1. **Camps opcionals nous**: no cal apujar `schemaVersion`; les dades velles són vàlides tal qual.
2. **Canvis incompatibles** (renoms, canvis d'unitats o de forma): apugeu `schemaVersion` a la llavor **i** afegiu un pas a `migrate()` de `src/store.tsx` que transformi les dades antigues sense descartar-les.
3. El reset a la llavor és només l'últim recurs, per a dades corruptes o de versions desconegudes.

## Desenvolupament

```sh
pnpm install
pnpm dev        # servidor de desenvolupament
pnpm build      # comprova tipus i genera dist/
pnpm preview    # serveix dist/ en local
pnpm icons      # regenera les icones PNG (scripts/make-icons.mjs)
```

## Desplegament

Es publica automàticament a **https://polruzafa.github.io/fardell/** amb el workflow `deploy.yml` a cada push a `main`. `base: './'` i el `HashRouter` fan que funcioni des de qualsevol subcarpeta.

El backend (comptes i sincronització) és a part: un Worker de Cloudflare que es desplega a mà amb `pnpm deploy` des de `server/` (vegeu `server/README.md`).

### Història del nom

- Fins al juliol del 2026 l'app vivia dins del repositori `fornets` i es servia a `/fornets/for-gear/`; la història d'aquells commits es va conservar amb `git subtree split`.
- L'app (i el repositori) es va dir **For·Gear** fins al juliol del 2026. Les claus antigues de `localStorage` (`for-gear:*`) i la base de fotografies es migren soles a l'arrencada (`src/migrateStorage.ts`), sense perdre res; quan tots els dispositius s'hagin actualitzat, la migració es podrà retirar.
- El canvi de nom del repositori va canviar l'URL de GitHub Pages: qui tingués la PWA instal·lada de `/for.gear/` ha de tornar-la a instal·lar des de l'URL nova (les dades no es perden: `localStorage` és del domini, no de la ruta).

## Instal·lació al mòbil

Obriu el web al mòbil i:

- **iOS (Safari)**: Compartir → «Afegeix a la pantalla d'inici».
- **Android (Chrome)**: menú ⋮ → «Instal·la l'aplicació».

El servei worker (generat per `vite-plugin-pwa`) deixa l'app disponible sense connexió i s'actualitza sol a cada desplegament.
