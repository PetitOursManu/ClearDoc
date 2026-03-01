**Nouvelle fonctionnalité : Fiche de paie interactive**

**Concept**

**Un modèle unique de fiche de paie (image) sur lequel l'admin peut dessiner des zones cliquables. Chaque zone est liée à une entrée existante dans ClearDoc. Les utilisateurs peuvent ensuite cliquer sur une zone pour être redirigés vers la description correspondante.**



**Interface admin (visible uniquement quand connecté)**



**Une nouvelle page dédiée /admin/payslip-map accessible depuis le header admin**

**L'admin peut uploader une image de fiche de paie qui servira de modèle unique**

**Sur cette image, l'admin peut dessiner des rectangles avec la souris pour définir des zones cliquables**

**Pour chaque zone dessinée, une liste déroulante permet de sélectionner l'entrée ClearDoc correspondante**

**Les zones existantes sont affichées sur l'image avec leur titre et peuvent être modifiées ou supprimées**

**Les zones et leurs coordonnées sont sauvegardées en base SQLite**

**L'interface doit fonctionner sur desktop et tablette**



**Interface utilisateur**



**Une nouvelle page /fiche-de-paie accessible depuis le menu principal**

**Elle affiche le modèle de fiche de paie avec les zones cliquables visibles (légèrement surlignées)**

**Au survol d'une zone (hover), celle-ci se met en évidence avec le titre de l'entrée liée affiché en tooltip**

**Au clic sur une zone, l'utilisateur est redirigé vers la page de la description correspondante**

**L'affichage doit être responsive : l'image et les zones s'adaptent à la taille de l'écran (desktop, tablette, smartphone) en recalculant les coordonnées proportionnellement**



**Base de données**



**Ajouter une table payslip\_zones avec les colonnes : id, document\_id (lié à la table documents), x, y, width, height, created\_at**

**Ajouter une table ou colonne pour stocker le chemin de l'image modèle**

**Les coordonnées sont stockées en pourcentage (0-100) plutôt qu'en pixels, pour garantir l'adaptation à toutes les tailles d'écran**



**Important**



**Ne pas supposer la structure des dossiers, analyser le code existant**

**Respecter le style visuel existant de ClearDoc**

**Aucune erreur ne doit apparaître dans la console du navigateur**

