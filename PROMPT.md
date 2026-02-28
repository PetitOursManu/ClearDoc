**Ajoute la gestion complète des catégories pour l'admin dans ClearDoc :**

**Backend**



**Route POST pour créer une nouvelle catégorie (admin uniquement, token JWT requis)**

**Route DELETE pour supprimer une catégorie (admin uniquement, token JWT requis)**

**Route PATCH pour renommer une catégorie (admin uniquement, token JWT requis)**

**Avant toute suppression, vérifier dans SQLite si la catégorie est utilisée par au moins une description. Si c'est le cas, retourner une erreur 409 Conflict avec un message explicite indiquant le nombre de descriptions concernées**



**Interface (visible uniquement quand l'admin est connecté)**



**Dans la zone des catégories, ajouter un bouton "+" pour créer une nouvelle catégorie**

**Chaque catégorie existante doit avoir une icône de modification (crayon) et une icône de suppression (croix)**

**À la suppression, afficher une modale de confirmation "Êtes-vous sûr de vouloir supprimer la catégorie X ?"**

**Au clic sur le crayon, permettre de modifier le nom directement en ligne ou via une modale**

**Si le backend retourne une erreur 409, afficher un message d'erreur visible et clair dans l'interface du style : "Impossible de supprimer cette catégorie, elle est utilisée par X description(s)"**

**Tous les messages d'erreur doivent être affichés uniquement dans l'interface utilisateur, aucun message d'erreur ne doit apparaître dans la console du navigateur**

**Si la suppression ou le renommage réussit, la liste des catégories se met à jour immédiatement sans recharger la page**

**Le style des boutons, modales et messages d'erreur doit respecter le design visuel existant de ClearDoc**



**Important**



**Ne pas supposer la structure des dossiers du projet, analyser le code existant pour placer les nouvelles routes et composants aux bons endroits**

