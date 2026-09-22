# SYD : Scraping

TD de scraping du cours de systèmes distribués.

L'objectif de ce TD est de manipuler des données comme "dans la vraie vie", en m'inspirant de situations réellement rencontrées dans mon travail. On va voir aussi l'architecture que l'on peut mettre en place pour cela.

*< À lire avec la voix d'introduction du Comité des reprises (https://www.youtube.com/user/ComiteDesReprises) >*

Le ministère de l'enseignement supérieur et de la recherche a lancé *le chantier compétences* pour permettre une meilleure lecture de l'offre de formation et pour mieux qualifier les compétences des étudiants. Mais cela demande du temps aux enseignants, enseignant-chercheurs et l'administration des établissements d'enseignement supérieur.

Mais l'INSA possède une cellule secrète qui agit dans ce genre de cas et vous en faites partie ! Vous devez agir.

## Prérequis

Je pars du principe que vous savez coder en Javascript et utiliser git et github. Si ce n'est pas le cas, je vous invite pour le prochain TD à lire :

* Javascript :
  * https://eloquentjavascript.net/ (troisième édition en anglais)
  * https://fr.javascript.info/ (The Modern JavaScript Tutorial, en français)
* Programmation événementielle en Javascript:
  * https://eloquentjavascript.net/11_async.html (Chapitre 11 de Eloquent JavaScript troisième édition)
  * https://www.fil.univ-lille.fr/~routier/enseignement/licence/tw1/spoc/chap10-evenements-partie1.html (Vidéo / cours de Jean-Christophe Routier)
  * https://fr.javascript.info/async (Promesses et async/await, en français)
* Git : http://rogerdudler.github.io/git-guide/index.fr.html

## Installation de node

Ce dépôt contient un fichier `.node-version` : la version attendue est **Node 26**.

Sur votre machine personnelle, prenez l'installeur : https://nodejs.org/en/download/current/.

### Dans le cas des salles machines de TC

Attention ! Vous devez faire cette manipulation dans un répertoire non virtuel. Par exemple dans votre home. Si vous le faite dans HOME_INSA ou sur le bureau, ça ne fonctionnera pas.

#### Avec fnm (recommandé)

[fnm](https://github.com/Schniz/fnm) est un gestionnaire de versions de Node : un seul binaire, installé dans votre home, sans droits administrateur. Son intérêt ici est qu'il lit le `.node-version` du dépôt — vous n'aurez donc pas à recommencer quand la version changera, et vous pouvez avoir plusieurs versions de Node pour plusieurs cours sans qu'elles se marchent dessus.

Installer fnm :

    curl -fsSL https://fnm.vercel.app/install | bash

(Vous exécutez un script téléchargé sur internet. Si ça vous gêne — et c'est une réaction saine, on en reparlera —, lisez-le d'abord, ou passez à la méthode manuelle ci-dessous.)

Ajouter cette ligne à la fin de votre `~/.bashrc`. C'est l'option `--use-on-cd` qui déclenche la bascule automatique de version quand vous entrez dans un dossier :

    eval "$(fnm env --use-on-cd --shell bash)"

Recharger vos variables d'environnement :

    . ~/.bashrc

Installer Node 26 et en faire votre version par défaut :

    fnm install 26
    fnm default 26

Vérifier que node s'exécute bien :

    node --version

Une fois le dépôt cloné (cf. Implémentation), il vous suffira d'entrer dans le dossier pour être automatiquement sur la bonne version.

#### Sans fnm

Cette méthode marche aussi, mais elle fige la version *et* le chemin : si vous déplacez ou renommez le dossier ensuite, votre shell sera cassé au prochain démarrage. Et il faudra tout refaire à chaque changement de version.

Télécharger les binaires et les décompresser :

    wget https://nodejs.org/dist/v26.8.1/node-v26.8.1-linux-x64.tar.xz
    tar -xJvf node-v26.8.1-linux-x64.tar.xz

Mettre à jour votre PATH :

    echo "export PATH=$(pwd)/node-v26.8.1-linux-x64/bin/:$PATH" >> ~/.bashrc

Recharger vos variables d'environnement :

    . ~/.bashrc

Vérifier que node s'exécute bien :

    node --version

## Protocole

L'INSA a déjà un catalogue de formations que l'on peut trouver à l'adresse https://www.insa-lyon.fr/fr/formation/catalogue. Cette page liste les formations de l'INSA. Chaque formation a ensuite sa propre page, sur laquelle est publié un *pdf* : le catalogue du département, qui contient une fiche détaillée par cours.

L'objectif est d'extraire du site et des pdfs les informations de chaque cours et de constituer une base de données. Dans cette base, on aimerait :

* Le code. Exemple : TC-3-S1-EC-PBS.
* Le nombre d'ECTS.
* Le volume horaire de cours / TD / TP / Projet / Travail personnel.
* Plus tard, le contact et son mail

Ordre de grandeur pour vous situer : une quarantaine de formations, une trentaine de pdfs, environ 2800 fiches de cours.

## Ce sujet a cassé, et c'est le sujet

Jusqu'en 2025, le chemin n'était pas celui-là. On partait de https://www.insa-lyon.fr/fr/formation/diplomes/ING, on suivait un lien « parcours » par formation qui donnait la liste de ses UEs, et chaque UE renvoyait vers *son* pdf, hébergé sur `planete.insa-lyon.fr/scolpeda`. Un pdf par cours.

Ce chemin n'existe plus :

* Les pages `/fr/formation/parcours/…` renvoient toutes une 404.
* La page `diplomes/ING` fonctionne encore et affiche toujours les liens vers ces pages parcours. Ce sont des liens morts.
* Plus aucune page vivante du site de l'INSA ne mentionne `scolpeda`.
* Les pdfs par cours, eux, sont toujours en ligne — mais plus rien ne publie leurs identifiants, donc plus moyen de les trouver.

Personne n'a prévenu. Il n'y a pas eu de version 2 de l'API, pas de redirection, pas de dépréciation annoncée : quelqu'un a refait une partie du site, et le programme qui en dépendait s'est arrêté de fonctionner. Le sujet a donc été réécrit sur le nouveau chemin.

Retenez trois choses :

* **Un scraper n'est pas un programme qu'on écrit une fois.** C'est du code dont le comportement dépend des décisions de quelqu'un d'autre, qui ne vous connaît pas. C'est un coût de maintenance permanent, et c'est le principal argument contre le scraping quand une API ou un jeu de données ouvert existe.
* **La couche fragile est le HTML.** Les pdfs ont survécu, les pages qui y menaient non. Quand vous concevez ce genre de chaîne, demandez-vous quel maillon va lâcher en premier.
* **L'échec a été silencieux.** Le site répond 200 sur la page d'accueil, le scraper tourne, ne plante pas, et produit zéro résultat. Un scraper doit crier quand il ne trouve rien, pas retourner un tableau vide l'air de rien.

## Et si je demande à une IA ?

Autant vous le dire tout de suite : ce sujet a été remis en état en 2026 par Claude Opus 5. C'est lui qui a constaté que l'ancien chemin était mort, qui a fouillé le site pour trouver le nouveau, qui a vérifié que la chaîne complète fonctionnait, et qui a réécrit le code et une partie de ce README.

Donc oui, une IA sait faire ce TD. Si vous lui demandez, vous aurez une base de données qui marche en quelques minutes. Ce n'est pas la peine de faire semblant du contraire, et ce n'est pas la peine de me le cacher.

Mais ce n'est pas ce qu'on vous demande. **L'objectif n'est pas d'arriver au résultat, c'est de comprendre le chemin.** Personne n'a besoin de votre base de données : elle existe déjà, quelque part, dans le système d'information de l'école. Ce dont vous aurez besoin, vous, c'est de savoir :

* pourquoi un programme qui marchait ne marche plus, et comment retrouver où sont passées les données ;
* pourquoi une expression régulière tombe juste sur un pdf et à côté sur un autre ;
* ce que vous avez le droit de collecter, et ce que vous devriez refuser de collecter ;
* quel maillon de votre chaîne va casser en premier, et comment le saurez-vous.

Aucune de ces questions ne se répond en lisant la sortie d'un programme, même correct. Et ce sont exactement celles que je vous poserai à la prochaine séance : l'évaluation porte sur le chemin, pas sur le livrable.

Utilisez l'IA si elle vous aide — mais comme un collègue à qui vous demandez des comptes, pas comme un oracle. La règle est simple : **vous devez pouvoir expliquer chaque ligne que vous exécutez.** Si vous ne pouvez pas, vous n'avez pas fait le TD, vous avez regardé quelqu'un d'autre le faire.

## Implémentation

Cloner ce dépôt :

    git clone https://github.com/dreimert/syd-scraping.git

Se déplacer dans le dossier :

    cd syd-scraping

Installation des dépendances :

    npm install

Lancer le code :

    node index.js

### Convertir un pdf en texte

Un pdf n'est pas un fichier texte : c'est une description de mise en page, où « ce qui est écrit » n'existe qu'en tant que caractères positionnés sur la feuille. Il faut donc une bibliothèque pour reconstituer le texte, et le résultat dépend d'elle : deux outils ne placeront pas les espaces et les retours à la ligne au même endroit. C'est pour ça que vos expressions régulières doivent être écrites en regardant le texte réellement produit, pas le pdf affiché à l'écran.

Ce TD utilise [unpdf](https://github.com/unjs/unpdf). La fonction `pdfToText` de `index.js` fait le travail en trois lignes. Pour voir ce que votre regex doit affronter, affichez le texte avant d'écrire quoi que ce soit :

    console.log(await pdfToText(await getPdf(url)))

### Travailler hors ligne

Si vous n'avez pas de réseau, ou si l'INSA a de nouveau déplacé quelque chose, l'intervenant garde de côté une copie du site : les 41 pages html et les 31 pdfs de catalogue, tels qu'ils étaient en production. Demandez-lui l'archive.

Décompressez-la à la racine du dépôt, vous devez obtenir un dossier `backup/` :

    tar xzf backup-AAAA-MM-JJ.tar.gz

Servez cette copie dans un premier terminal :

    npm run serve

Puis, dans un second, lancez le scraper contre elle :

    BASE_URL=http://localhost:8000 node index.js

C'est tout : `index.js` lit `BASE_URL` dans l'environnement, et les liens de la copie ont été réécrits pour pointer vers le serveur local. Votre code n'a pas à savoir s'il parle à l'INSA ou à votre disque dur — c'est d'ailleurs une propriété qu'il faut chercher à préserver, elle rend le programme testable.

## Test

Vos yeux, pour commencer : ouvrez un pdf et regardez si les données stockées correspondent. Mais à 2800 fiches, l'œil ne suffit plus, et surtout il ne vous prévient pas quand une extraction qui marchait se met à renvoyer du vide.

Un harnais minimal est fourni, sans aucune dépendance :

    npm test

Il s'appuie sur `test/extrait-catalogue-telecoms.txt`, un extrait réel du catalogue déjà converti en texte, et sur des valeurs relevées à la main dans le pdf. Lisez `test/extraction.test.js` : les trois premiers tests comparent à une référence connue, le dernier vérifie une *propriété* (le total des horaires doit être égal à la somme du détail) qui, elle, doit rester vraie sur les 2800 fiches. Les deux approches sont utiles.

À vous d'ajouter vos cas, en particulier pour les formats qui vous ont posé problème.

## Par où commencer ?

* Il y a des exemples de code dans `index.js`.
* Commencez par identifier comment télécharger un pdf. "Où" est le pdf après le téléchargement ?
* Comment transformez ce pdf en texte. Cf. « Convertir un pdf en texte » plus haut.
* Analysez le texte pour en extraire les informations voulues (Cf. Protocole au dessus). Les [RegExp](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/RegExp) sont votre amie et [regex101](https://regex101.com/) aussi.
    * `/CODE : ([^\n]*)/` : extrait le code du **premier** cours du pdf. Un catalogue en contient une centaine : comment les récupérer tous ?
* Comment télécharger et analyser une page de formation pour y trouver son catalogue pdf.
* Comment extraire toutes les formations de l'INSA.
* Extraire et analyser tous les pdfs de l'INSA.

## Points d'attention

Si vous êtes trop agressif avec les serveurs de l'INSA, vous serez bannis temporairement. Vous avez la fonction `sleep` dans `index.js`.

Les données réelles ne sont jamais propres. Ce que vous allez rencontrer :

* **Le nommage des pdfs est incohérent.** `catalogue-…`, `catalog-…`, `doc-catalogue-…`, `doc-catalog-…`, avec ou sans suffixe `_fr` / `-fr`. Vous ne pouvez pas deviner les URLs : il faut lire les pages de formation.
* **Plusieurs millésimes cohabitent**, en français et en anglais. Le génie mécanique en publie quatre. Lequel garder ? C'est à vous de décider, et d'assumer votre choix.
* **Toutes les formations n'ont pas de catalogue.** Le département XXXXXXXXX ne publie qu'une plaquette commerciale, sans fiche de cours : à vous de trouver lequel. Votre extraction ne couvrira jamais 100 % du périmètre : sachez dire ce qu'il vous manque, et pourquoi.
* **Le format des fiches varie.** Certains pdfs, surtout les anglais, ne présentent pas les ECTS comme les autres. Si vous trouvez 119 codes mais seulement 103 ECTS, ce n'est pas un bug de votre regex : c'est une variante à traiter. Pour vous donner l'ordre de grandeur de l'enjeu : sur l'ensemble des catalogues, `/CODE : ([^\n]*)/` trouve 2561 fiches, et la même regex tolérante aux espaces, `/CODE\s*:\s*([A-Z0-9][A-Z0-9-]*)/`, en trouve 2781. Deux cents fiches se jouent sur un espace.
* **Un catalogue distingue les UE et les EC.** Une UE regroupe plusieurs EC et les ECTS de l'UE sont la somme de ceux de ses EC. Réfléchissez à comment représenter ça dans votre base.

## Cadre légal

Le scraping n'est pas illégal en soi, et il n'est pas non plus libre. Il se situe au croisement de plusieurs régimes, et la bonne question n'est jamais « est-ce que j'ai le droit de scraper ? » mais « qu'est-ce que je collecte, chez qui, et pour en faire quoi ? ». Quatre questions à se poser, dans cet ordre.

### 1. Le contenu est-il protégé par le droit d'auteur ?

Depuis la transposition de la directive européenne de 2019 sur le droit d'auteur, l'[article L122-5-3 du code de la propriété intellectuelle](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044363192) crée une exception de **fouille de textes et de données** (*text and data mining*). Il y a deux régimes :

* Pour la **recherche scientifique**, menée par un organisme de recherche : la fouille est permise sur tout contenu auquel on a accès de façon licite, sans que le titulaire des droits puisse s'y opposer.
* Pour **tout le monde et n'importe quel usage** : la fouille est permise aussi, **sauf si le titulaire des droits s'y est opposé**. L'opposition n'a pas à être motivée, et pour un contenu en ligne elle s'exprime notamment « par des procédés lisibles par machine », y compris via les conditions générales d'utilisation du site.

Question pour vous : vous êtes dans un établissement de recherche, mais ce TD est-il de la recherche scientifique ? Sous quel régime tombez-vous ?

### 2. La base de données est-elle protégée en tant que telle ?

Indépendamment du droit d'auteur sur chaque fiche, celui qui a investi pour constituer une base a un **droit sui generis** dessus ([articles L341-1 et suivants du CPI](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069414/LEGISCTA000006146357/)). Il peut interdire l'extraction d'une **partie substantielle** de la base, en quantité ou en qualité. L'article L342-2 va plus loin : il peut aussi interdire l'extraction **répétée et systématique** de parties non substantielles quand elle excède manifestement les conditions d'utilisation normales.

Question pour vous : vous vous apprêtez à extraire environ 2800 fiches, c'est-à-dire l'intégralité de l'offre de formation. C'est substantiel ?

### 3. Y a-t-il des données personnelles ?

Oui, et c'est le point que la plupart des gens ratent. Le seul catalogue des télécoms contient **116 adresses électroniques**. Un nom, un prénom et un mail professionnel sont des données personnelles : le RGPD s'applique, y compris à des données publiées sur un site public. **Publiquement accessible ne veut pas dire librement réutilisable.**

La CNIL a publié le 19 juin 2025 des [fiches pratiques sur la collecte par moissonnage](https://www.cnil.fr/fr/focus-interet-legitime-collecte-par-moissonnage). L'intérêt légitime peut servir de base légale, mais sous garanties : définir les critères de collecte à l'avance, exclure les catégories de données inutiles, supprimer immédiatement ce qui a été collecté hors sujet, respecter les mécanismes d'opposition techniques comme `robots.txt`, informer les personnes concernées, et ne pas traiter de données sensibles. La CNIL a aussi une position spécifique sur [la réutilisation de ces données à des fins de démarchage commercial](https://www.cnil.fr/fr/la-reutilisation-des-donnees-publiquement-accessibles-en-ligne-des-fins-de-demarchage-commercial).

Question pour vous : la quatrième ligne du protocole vous demande « le contact et son mail ». Est-elle nécessaire à l'objectif du chantier compétences ? Si non, le principe de minimisation dit de ne pas la collecter. Savoir refuser une ligne du cahier des charges fait partie du métier.

### 4. Le service l'autorise-t-il ?

`robots.txt` n'est pas un texte de loi, mais il exprime la volonté du service, et la CNIL en fait une garantie attendue. Allez voir : https://www.insa-lyon.fr/robots.txt renvoie une 404. **L'absence de `robots.txt` n'est pas une autorisation** — c'est juste une absence de signal, et il reste les CGU, qui peuvent porter l'opposition à la fouille.

### Et l'IA dans tout ça ?

C'est ce qui a le plus changé depuis que ce TD existe. Le scraping massif est devenu le carburant de l'entraînement des modèles, et le droit a suivi : l'[AI Act](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=OJ:L_202401689) (règlement (UE) 2024/1689) impose depuis le 2 août 2025 aux fournisseurs de modèles à usage général de se doter d'une politique de respect du droit d'auteur — y compris de l'opposition à la fouille du point 1 — et de publier un résumé des contenus utilisés pour l'entraînement. L'opt-out lisible par machine, qui était une curiosité en 2019, est devenu un enjeu économique majeur.

### Et pour ce TD, concrètement ?

Vous scrapez le site de votre propre école, dans un cadre pédagogique, les données restent sur votre machine, vous ne les republiez pas et vous n'en faites aucun usage commercial. C'est le scénario le plus confortable qui soit — profitez-en pour poser les questions ci-dessus à voix haute, parce que la prochaine fois vous serez peut-être en entreprise, et la réponse ne sera pas la même. Pensez à rappeler à l'intervenant d'en parler à la fin du TD s'il oublie. Lui, il n'oubliera pas de vous poser des questions dessus à la prochaine séance ;)

## Ce que je dois retenir

Le scraping permet d'extraire des données même sans accès à la base de données. Avec les bonnes technologies de traitement, il est possible de faire en quelques minutes ce qu'un humain mettrait des heures, des jours ou des semaines à faire.

Mais ce que vous pouvez techniquement faire et ce que vous avez le droit de faire sont deux questions différentes. Cf. le cadre légal ci-dessus.

## Évaluation

Toutes questions par rapport au scraping, son cadre légal ou les expressions régulières. Pour les expressions régulières incluant les groupes de captures, les quantificateurs et ce qui est utile à ce TD.

Quelques questions auxquelles vous devez savoir répondre à l'issue du TD :

* Quel département ne publie pas de catalogue de cours ? Comment l'avez-vous découvert ?
* Combien de fiches avez-vous extraites, et combien vous en manque-t-il ?
* Qu'est-ce que l'exception de fouille de textes et de données, et comment un site s'y oppose-t-il ?
* Vous avez collecté des adresses mail. Sur quelle base légale, et quelles garanties auriez-vous dû mettre en place ?
* Le site ne publie pas de `robots.txt`. Qu'est-ce que ça vous autorise ?

## Pour aller plus loin

Extraire plus d'informations comme les pré-requis, les compétences listées...

Statistiques : https://dreimert.github.io/syd-scraping/

Application en conditions réelles avec des millions d'utilisateurs pour le Covid : https://www.youtube.com/watch?v=_UND6IOeIrM.

Vidéo explicative de V2F : https://www.youtube.com/watch?v=O3cJUR2NimI

## Licence

Ce TD est mis à disposition sous licence [Creative Commons Attribution - Pas d'Utilisation Commerciale 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/deed.fr) (CC BY-NC 4.0). Vous pouvez le reprendre, le modifier et le rediffuser, y compris dans un autre établissement, à condition de citer l'auteur et de ne pas en faire un usage commercial.
