# Scadenziario

App moderna e responsive per la gestione delle scadenze con sincronizzazione automatica su GitHub via API, interfaccia ottimizzata per smartphone (vista compatta e schede) e gruppi utenti colorati.

---

## 🌿 Architettura dei Branch su GitHub (`kilua83.github.io`)

Il progetto è suddiviso in due branch con ruoli ben distinti:

### 1. Branch `source-scadenziario` (Sorgenti completi Web + Android)
Questo branch contiene **tutto il codice sorgente del progetto**:
- 🌐 **Web App React / Vite**: codice sorgente in `src/` (`App.jsx`, `index.css`, `groups.js`, ecc.).
- 📱 **App Mobile Android**: wrapper **Capacitor 7** (`capacitor.config.json`) e l'intero progetto nativo **Android Studio** in `android/`.
- 📦 **File APK pronto all'uso**: `Scadenziario.apk` generato tramite Gradle (`assembleDebug`).
- ⚙️ **Configurazioni e dipendenze**: `package.json`, `vite.config.js`, ecc.

> **Tutto lo sviluppo (nuove funzioni, modifiche grafiche, fix)** si effettua su questo branch.

---

### 2. Branch `main` (Hosting e Produzione GitHub Pages)
Questo branch corrisponde alla root del sito web pubblico [kilua83.github.io](https://kilua83.github.io):
- **NON contiene codice sorgente non compilato**.
- Contiene solo i file statici già minificati per il browser all'interno della cartella `scadenziario/`:
  - `scadenziario/index.html`
  - `scadenziario/assets/` (bundle `.js` e `.css` compilati)
  - `scadenziario/db.json` (💾 **DATABASE IN PRODUZIONE**)
- I dispositivi (browser e app Android) leggono e salvano i dati aggiornati direttamente su `scadenziario/db.json` tramite le API di GitHub.

---

## ⚠️ ATTENZIONE: DEPLOY SU GITHUB PAGES (Salvaguardia del Database)

Quando si fa il deploy di una nuova versione web su GitHub Pages:

> [!IMPORTANT]
> **NON sovrascrivere mai il file `scadenziario/db.json` sul repository remoto!**
> L'app usa quel file come database persistente per tutte le utenze. Se fai il deploy dell'intera cartella `dist/` sovrascrivendo `db.json`, perderai i dati inseriti dagli utenti.

### Procedura di Deploy Corretta:
1. Compila il bundle per il web:
   ```bash
   npm run build:web
   ```
2. Nella cartella di deploy (`gh-pages-clone/scadenziario` su branch `main`):
   - Fai prima un `git pull` per avere l'ultimo `db.json` aggiornato dalla produzione.
   - Copia **solo** `index.html` e la cartella `assets/` da `dist/`.
   - **Non toccare** `db.json`.
3. Esegui il commit e push su `main`:
   ```bash
   git add scadenziario/index.html scadenziario/assets/
   git commit -m "Deploy nuova versione"
   git push origin main
   ```

---

## 🛠️ Comandi Utili di Sviluppo

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia il server di sviluppo locale con Vite |
| `npm run build:web` | Compila per GitHub Pages (base path `/scadenziario/`) |
| `npm run build:native` | Compila per l'app mobile (base path `/`) |
| `npm run cap:sync` | Compila per native e sincronizza con la cartella `android/` |
| `npm run cap:open` | Apre il progetto in Android Studio |

### Come compilare l'APK da terminale:
```bash
$env:ANDROID_HOME = "C:\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
cmd /c "cd /d android && gradlew.bat assembleDebug"
```
L'APK generato si troverà in `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔒 Sicurezza e Credenziali
L'applicazione è protetta da schermata di login per evitare che il token personale GitHub venga esposto in chiaro. Il token viene conservato in modo protetto nel client e utilizzato unicamente per sincronizzare il database su GitHub.
