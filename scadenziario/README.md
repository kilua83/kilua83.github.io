# Scadenziario - Hosting di Produzione (GitHub Pages)

Questa cartella contiene i file distribuiti in produzione per la web app **Scadenziario**:
[https://kilua83.github.io/scadenziario/](https://kilua83.github.io/scadenziario/)

---

## ⚠️ ATTENZIONE AL DATABASE (\db.json\)
- Il file \db.json\ in questa cartella costituisce il **database persistente live in produzione**.
- Durante il deploy di nuove versioni web, **NON sovrascrivere mai \db.json\**.
- Copiare unicamente i file \index.html\ e la cartella \ssets/\.

---

## 📂 Dove si trovano i sorgenti completi (Web + Android)?
Tutto il codice sorgente originale (React, Vite, stili CSS, configurazione Capacitor, progetto nativo Android Studio e file APK) si trova nel branch dedicato:
👉 **\source-scadenziario\**

Per sviluppare o ricompilare l'app (sia web che APK Android), lavorare sempre sul branch \source-scadenziario\.
