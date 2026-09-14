# Scadenziario

App per la gestione delle scadenze con sincronizzazione automatica su GitHub.

## ⚠️ ATTENZIONE: DEPLOY SU GITHUB PAGES

Quando si fa il deploy di una nuova versione dell'app su GitHub Pages, **NON sovrascrivere mai il file `scadenziario/db.json` sul repository remoto**. 

L'app usa quel file come database persistente per gli utenti. Se fai il deploy dell'intera cartella `dist/` e sovrascrivi `db.json`, perderai tutti i dati inseriti.

### Procedura di Deploy Corretta:
1. `npm run build`
2. Copiare solo `index.html` e la cartella `assets/`
3. Pushare su GitHub

### Sicurezza
L'applicazione è protetta da password per evitare che il token di GitHub venga esposto nel codice JavaScript pubblico. Il token è crittografato e viene decrittato a runtime solo se la password inserita è corretta.
