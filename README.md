# SYD : Scraping

TD de scraping du cours de systèmes distribués.

L'objectif de ce TD est de manipuler des données comme "dans la vrai vie", en m'inspirant de situations réellement rencontrées dans mon travail. On va voir aussi l'architecture que l'on peut mettre en place pour cela.

Le ministère de l'enseignement supérieur et de la recherche a lancé *le chantier compétences* pour permettre une meilleure lecture de l'offre de formation et pour mieux qualifier les compétences des étudiants. Mais cela demande du temps aux enseignants, enseignant-chercheurs et l'administration des établissements d'enseignement supérieur.

Mais l'INSA possède une cellule secrète qui agit dans ce genre de cas et vous en faites parti ! Vous devez agir.

## Prérequis

Je pars du principe que vous savez coder en Javascript et utiliser git et github. Si ce n'est pas le cas, je vous invite pour le prochain TD à lire :

* Javascript :
  * https://eloquentjavascript.net/ (troisième édition en anglais)
  * https://fr.eloquentjavascript.net/ (première edition en français, anglais, allemand et polonais)
* Programmation événementielle en Javascript:
  * https://eloquentjavascript.net/11_async.html (Chapitre 11 de Eloquent JavaScript troisième édition)
  * http://www.fil.univ-lille1.fr/~routier/enseignement/licence/tw1/spoc/chap10-evenements-partie1.html (Vidéo / cours de Jean-Christophe Routier)
* Git : http://rogerdudler.github.io/git-guide/index.fr.html

## Installation de node

Vous pouvez télécharger Node.js ici : https://nodejs.org/en/download/current/.

### Dans le cas des salles machines de TC

Télécharger les binaires et les décompresser :

    wget https://nodejs.org/dist/v12.11.1/node-v12.11.1-linux-x64.tar.xz
    tar -xJvf node-v12.11.1-linux-x64.tar.xz

Mettre à jour votre PATH :

    echo "export PATH=$PATH:$(pwd)/node-v12.11.1-linux-x64/bin/" >> ~/.bashrc

Recharger vos variables d'environnement :

    . ~/.bashrc

Vérifier que node s'exécute bien :

    node --version

## Protocole

L'INSA a déjà un catalogue de formations que l'on peut trouver à l'adresse https://www.insa-lyon.fr/fr/formation/diplomes/ING. Cette page liste les formations de l'INSA puis via un lien pour chaque formation, on accède à la liste des UEs de celle-ci. Pour chaque UE, un *pdf* détaillant la formation.

L'objectif est d'extraire du site et des pdfs les informations de chaque cours et de constituer une base de données. Dans cette base, on aimerait :

* Le code. Exemple : TC-4-I-ASY.
* Le nombre d'ETCS.
* Le volume horaire de cours / TD / TP / Project / Travail personnel.
* Plus tard, le contact et son mail

## Implémentation

Cloner ce dépot :

    git clone https://github.com/dreimert/syd-scraping.git

Installation des dépendances :

    npm install

### Tika

Tika est une solution qui permet, entre autre, de convertir un pdf en texte.

## Test

Vos yeux. Regardez si les données stockées correspondent à ce qui est indiqué dans le pdf.

## Par où commencer ?

* Il y a des exemples de code dans `index.js`.
* Commencer par télécharger un pdf.
* Transformez ce pdf en texte via Tika.
* Analysez le texte pour en extraire les informations voulues. Les [RegExp](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/RegExp) sont votre amie.
    * `/CODE : ([^\n]*)/` : extrait le code du cours.
* Télécharger et analyser une page de formation.
* Extraire toutes les UEs d'une formation.
* Extraire toutes les UEs de l'INSA.

## Ce que je dois retenir

Le scraping permet d'extraire des données même sans accès à la base de données. Avec les bonnes technologies de traitement, il est possible de faire en quelques minutes ce qu'un humain mettrait des heures ou jours à faire.

## Pour aller plus loin

Extraire plus d'informations comme les pré-requis, les compétences listées... Quelques exemples : https://github.com/sfrenot/competence.
