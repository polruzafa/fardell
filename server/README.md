# Fardell API

Backend mínim per als comptes d'usuari i la sincronització de dades de Fardell:
un **Worker de Cloudflare** sense dependències amb una base de dades **D1** (SQLite).

Per què Cloudflare i no un altre servei gratuït:

- El pla gratuït (100.000 peticions/dia) sobra de llarg per a un ús personal.
- **No s'adorm ni es pausa**: a Render el servei gratuït triga ~1 min a despertar-se,
  i Supabase pausa els projectes al cap d'una setmana sense activitat.
- D1 és SQLite de veritat (5 GB gratuïts) i no cal gestionar cap servidor.

## Què fa

- Comptes amb adreça electrònica i contrasenya (PBKDF2-SHA256 amb sal per usuari).
- Sessions amb testimonis aleatoris; a la base de dades només se'n guarda el hash.
- Una còpia del JSON de dades per usuari, amb control de concurrència optimista
  (`baseUpdatedAt`): si dos dispositius desen alhora, el segon rep un 409 i l'app
  ho resol preguntant a l'usuari.

| Mètode | Ruta           | Cos                        | Resposta                 |
| ------ | -------------- | -------------------------- | ------------------------ |
| POST   | `/api/register`| `{ email, password }`      | `{ token, email }`       |
| POST   | `/api/login`   | `{ email, password }`      | `{ token, email }`       |
| POST   | `/api/logout`  | — (Bearer)                 | 204                      |
| GET    | `/api/data`    | — (Bearer)                 | `{ payload, updatedAt }` |
| PUT    | `/api/data`    | `{ payload, baseUpdatedAt }` (Bearer) | `{ updatedAt }` o 409 |
| DELETE | `/api/account` | `{ password }` (Bearer)    | 204                      |

## Desplegament (un sol cop)

Cal un compte gratuït de [Cloudflare](https://dash.cloudflare.com/sign-up).

```sh
cd server
pnpm install
npx wrangler login                 # obre el navegador per autoritzar
npx wrangler d1 create fardell       # crea la base de dades
```

Copieu el `database_id` que retorna l'última ordre dins de `wrangler.toml`, i després:

```sh
pnpm db:init                       # aplica schema.sql a la base remota
pnpm deploy                        # publica el Worker
```

El desplegament imprimeix l'URL pública, del tipus
`https://fardell-api.<el-vostre-subdomini>.workers.dev`. És l'URL que es posa
al camp «Servidor» dels Ajustos de l'app (o a la variable `VITE_API_URL` en
compilar el frontend perquè surti emplenada per defecte).

Per actualitzar l'API després d'un canvi: `pnpm deploy` i prou.

## Desenvolupament en local

```sh
pnpm db:init:local   # crea les taules a la D1 local (Miniflare)
pnpm dev             # serveix l'API a http://localhost:8787
```

## Límits coneguts (a posta, per simplicitat)

- No hi ha recuperació de contrasenya: si es perd, cal esborrar l'usuari amb
  `wrangler d1 execute` i tornar-se a registrar (les dades del dispositiu no es perden).
- No hi ha límit de peticions per IP; per a un ús personal n'hi ha prou amb
  el límit global del pla gratuït.
- Les sessions no caduquen; «Tanca la sessió» les esborra del servidor.
- Les fotografies no es sincronitzen: viuen a l'IndexedDB de cada dispositiu.
