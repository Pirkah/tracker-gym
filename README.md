# 🏋️ IronPulse — Gym Tracker iOS (PWA)

Application de suivi de musculation conçue pour iOS (installable sur l'écran d'accueil, fonctionne 100 % hors-ligne à la salle).

## ✨ Fonctionnalités
- **Créateur de séances (Programmes) :** Configure tes séances types (*Push, Pull, Legs...*) avec ordre des exercices, nombre de séries, fourchette de répétitions cible et temps de repos par défaut.
- **Séance en cours ultra-ergonomique :**
  - Sélectionne ta séance du jour → tous tes exercices se chargent automatiquement.
  - **Historique direct par série :** Affiche le poids et les répétitions de ta dernière séance en face de chaque série (copie en 1 tap).
  - **Mode Unilatéral Gauche / Droite séparés :** Rentre le poids par côté et les répétitions **Gauche (`G`)** et **Droite (`D`)** séparément.
  - **Tags de séries :** Normal (`1, 2...`), Échauffement (`W`), Drop-set (`D`), Échec (`F`).
  - **RIR (Reps In Reserve) :** Sélecteur rapide `@0`, `@1`, `@2`, `@3+`.
  - **Notes épinglées par exercice :** Pour garder en mémoire tes réglages de machines (hauteur siège, cran de poulie...).
  - **Remplacement d'exo à la volée (`🔄`) :** Change d'exercice si une machine est prise sans modifier ton programme de base.
  - **Détection automatique des PR (`🏆`) :** Badge record personnel en temps réel.
- **⌚ Chronomètre de repos & Vibration Apple Watch :**
  - Lancement automatique dès qu'une série est cochée.
  - Compatible Notifications Web iOS (écran verrouillé) + Relais Minuteur Natif iOS/Apple Watch via Raccourcis (`shortcuts://`).
- **📈 Statistiques & Courbes par exercice :**
  - Poids Max, 1RM Estimé (Epley), Volume de séance, et courbe d'**Équilibre Gauche vs Droite** pour les exercices unilatéraux.
- **☁️ Double Sauvegarde Gratuite :**
  - Stockage local permanent (`LocalStorage` + `IndexedDB`) + Export/Import `.json` + Synchro Cloud Firebase Realtime Database.
