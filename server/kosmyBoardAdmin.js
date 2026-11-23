/**
 * Admin dans Kosmy Board — protocole kosmy.board-admin.v1.
 *
 * Le serveur du Board appelle trois adresses de ClearDoc avec un jeton
 * (JWT RS256 signé avec la clé de ses ID tokens, 60 secondes, une seule requête) :
 *
 *   GET  /api/kosmy-board/admin            le sommaire (sections)
 *   GET  /api/kosmy-board/admin/{section}  le contenu d'une section
 *   POST /api/kosmy-board/admin/{section}  une action dans cette section
 *
 * Le jeton dit seulement qui est la personne (`sub`). ClearDoc retrouve le
 * compte relié par la connexion unique (même réglages, même cache de clés, même
 * lien par `sub`) et décide seul de ses droits. Chaque action passe par les
 * fonctions de l'admin de ClearDoc (server/adminActions.js).
 *
 * Cahier des charges : Kosmy Board, docs/admin-api.md.
 */
import express from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import {
  readSettings, discover, signingKey, findLinkedAdmin, appBaseUrl, redirectUri, initiateLoginUri,
} from './kosmyBoard.js';
import { AdminActionError, isSecretSetting } from './adminActions.js';
import { isActive, hasPassword } from './accounts.js';
import { VIDEO_THEME_IDS } from '../services/videoGenerator.js';

export const ADMIN_API_PATH = '/api/kosmy-board/admin';
export const PROTOCOL = 'kosmy.board-admin.v1';
export const TOKEN_TYPE = 'kb-admin+jwt';

const CLOCK_TOLERANCE_S = 30;
const MAX_TOKEN_AGE_S = 120;
const ACTION_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const ROUTE = /^\/api\/kosmy-board\/admin(?:\/.*)?$/;
const MAX_ROWS = 500;
const MAX_OPTIONS = 200;
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/* ============================================================
 * Textes (fr / en, selon Accept-Language)
 * ============================================================ */

const TEXTS = {
  fr: {
    'role.admin': 'Administrateur',
    'yes': 'Oui',
    'save': 'Enregistrer',
    'rename': 'Renommer',
    'delete': 'Supprimer',
    'truncated': 'Seules les {max} premières lignes sont affichées.',

    'err.token': 'Jeton Kosmy Board refusé.',
    'err.notConfigured': 'La connexion avec Kosmy Board n\'est pas configurée dans ClearDoc (Admin > Kosmy Board).',
    'err.unreachable': 'ClearDoc ne joint pas Kosmy Board pour vérifier le jeton.',
    'err.notLinked': 'Ce compte Kosmy Board n\'est relié à aucun compte ClearDoc. Connectez-vous à ClearDoc avec votre mot de passe, puis reliez-le dans Admin > Kosmy Board.',
    'err.forbidden': 'Votre compte ClearDoc n\'a pas les droits d\'administration.',
    'err.disabled': 'Votre compte ClearDoc est désactivé.',
    'err.section': 'Section inconnue.',
    'err.action': 'Action inconnue.',
    'err.method': 'Méthode non autorisée.',
    'err.body': 'Requête illisible.',
    'err.tooLarge': 'Requête trop volumineuse.',
    'err.server': 'Erreur interne de ClearDoc.',
    'err.required': '« {field} » est obligatoire.',
    'err.tooLong': '« {field} » : {max} caractères au plus.',
    'err.choice': '« {field} » : choix inconnu.',
    'err.color': '« {field} » : couleur attendue au format #rrggbb.',
    'err.angle': '« {field} » : un nombre entier entre 0 et 360.',
    'err.url': '« {field} » : adresse http(s) attendue.',
    'err.row': 'Cette ligne n\'existe plus.',
    'err.notPending': 'Cette vidéo n\'est plus en attente de validation.',
    'err.document_not_found': 'Cette ligne de paie n\'existe plus.',
    'err.category_title_required': 'Le titre de la catégorie est requis.',
    'err.category_not_found': 'Cette catégorie n\'existe plus.',
    'err.category_in_use': 'Impossible de supprimer cette catégorie : elle est utilisée par {count} ligne(s) de paie.',
    'err.company_name_required': 'Le nom est requis.',
    'err.company_not_found': 'Cette structure n\'existe plus.',
    'err.pdf_not_found': 'Ce fichier PDF n\'existe plus.',
    'err.assignment_required': 'Choisissez une structure et un PDF.',
    'err.zone_not_found': 'Cette zone n\'existe plus.',
    'err.zone_document_required': 'Choisissez une ligne de paie.',
    'err.video_url_required': 'Vidéo manquante.',
    'err.video_file_not_found': 'Le fichier de la vidéo est introuvable.',
    'err.video_published': 'Vidéo publiée : supprimez-la depuis la liste des vidéos publiées.',

    'overview.title': 'Vue d\'ensemble',
    'overview.pending.title': 'Vidéo à valider',
    'overview.pending.text': 'La vidéo de « {title} » attend votre validation (section Vidéos).',
    'overview.stats': 'En bref',
    'overview.documents': 'Lignes de paie',
    'overview.categories': 'Catégories',
    'overview.companies': 'Structures',
    'overview.pdfs': 'Fichiers PDF',
    'overview.zones': 'Zones de la fiche interactive',
    'overview.videos': 'Vidéos publiées',
    'overview.instance': 'Instance',
    'overview.address': 'Adresse',
    'overview.database': 'Base de données',
    'overview.remotion': 'Remotion (génération vidéo)',
    'overview.remotionOn': 'Installé ({version})',
    'overview.remotionOff': 'Non installé',
    'overview.issuer': 'Kosmy Board (émetteur)',

    'documents.title': 'Lignes de paie',
    'documents.description': 'Les explications des lignes de la fiche de paie, visibles par tous. La description (texte riche), l\'image et la vidéo se préparent dans ClearDoc.',
    'documents.table': 'Lignes de paie',
    'documents.col.title': 'Titre',
    'documents.col.category': 'Catégorie',
    'documents.col.keywords': 'Mots-clés',
    'documents.col.video': 'Vidéo',
    'documents.col.updated': 'Modifiée le',
    'documents.rename.field': 'Nouveau titre',
    'documents.setCategory': 'Changer de catégorie',
    'documents.delete.confirm': 'Supprimer cette ligne de paie ? Cette action est irréversible.',
    'documents.add': 'Ajouter une ligne',
    'documents.field.title': 'Titre',
    'documents.field.category': 'Catégorie',
    'documents.empty': 'Aucune ligne de paie.',
    'documents.added': 'Ligne de paie ajoutée. Rédigez sa description dans ClearDoc.',
    'documents.renamed': 'Titre modifié.',
    'documents.categoryChanged': 'Catégorie modifiée.',
    'documents.deleted': 'Ligne de paie supprimée.',

    'categories.title': 'Catégories',
    'categories.description': 'Les catégories qui rangent les lignes de paie. Une catégorie utilisée ne peut pas être supprimée.',
    'categories.col.title': 'Titre',
    'categories.col.id': 'Identifiant',
    'categories.col.usage': 'Lignes de paie',
    'categories.rename.field': 'Nouveau titre',
    'categories.delete.confirm': 'Supprimer cette catégorie ?',
    'categories.add': 'Ajouter une catégorie',
    'categories.field.title': 'Titre',
    'categories.empty': 'Aucune catégorie.',
    'categories.added': 'Catégorie ajoutée.',
    'categories.renamed': 'Catégorie renommée.',
    'categories.deleted': 'Catégorie supprimée.',

    'structures.title': 'Structures et PDF',
    'structures.description': 'Les structures et les documents PDF qui leur sont proposés (page « Documents des structures »).',
    'structures.upload': 'L\'envoi d\'un nouveau fichier PDF se fait dans ClearDoc (Gérer les documents PDF).',
    'structures.companies': 'Structures',
    'structures.col.name': 'Nom',
    'structures.col.pdfCount': 'PDF assignés',
    'structures.rename.field': 'Nouveau nom',
    'structures.delete.confirm': 'Supprimer cette structure ? Les assignations de PDF seront supprimées.',
    'structures.add': 'Ajouter une structure',
    'structures.field.name': 'Nom',
    'structures.empty': 'Aucune structure.',
    'structures.pdfs': 'Fichiers PDF',
    'structures.col.companyCount': 'Structures',
    'structures.pdfDelete.confirm': 'Supprimer ce fichier PDF ? Cette action est irréversible.',
    'structures.pdfEmpty': 'Aucun fichier PDF.',
    'structures.assignments': 'Assignations',
    'structures.col.company': 'Structure',
    'structures.col.pdf': 'PDF',
    'structures.unassign': 'Retirer',
    'structures.assign': 'Assigner un PDF',
    'structures.assignEmpty': 'Aucune assignation.',
    'structures.missing': '(supprimé)',
    'structures.added': 'Structure ajoutée.',
    'structures.renamed': 'Structure renommée.',
    'structures.deleted': 'Structure supprimée.',
    'structures.pdfDeleted': 'Fichier PDF supprimé.',
    'structures.assigned': 'PDF assigné à la structure.',
    'structures.unassigned': 'PDF retiré de la structure.',

    'map.title': 'Fiche de paie interactive',
    'map.description': 'Les zones cliquables de la fiche de paie interactive, chacune reliée à une ligne de paie.',
    'map.editor': 'Dessiner une zone ou changer l\'image du modèle se fait dans ClearDoc (Gérer la fiche de paie interactive).',
    'map.model': 'Modèle',
    'map.image': 'Image du modèle',
    'map.imageSet': 'Définie',
    'map.imageNone': 'Aucune',
    'map.zoneCount': 'Zones',
    'map.zones': 'Zones',
    'map.col.document': 'Ligne de paie',
    'map.col.position': 'Position',
    'map.col.size': 'Taille',
    'map.col.created': 'Créée le',
    'map.setDocument': 'Relier à une autre ligne',
    'map.field.document': 'Ligne de paie',
    'map.delete.confirm': 'Supprimer cette zone ?',
    'map.empty': 'Aucune zone.',
    'map.missing': '(ligne supprimée)',
    'map.updated': 'Zone modifiée.',
    'map.deleted': 'Zone supprimée.',

    'videos.title': 'Vidéos',
    'videos.description': 'Les vidéos explicatives des lignes de paie.',
    'videos.generate': 'Générer une vidéo (plusieurs minutes), installer Remotion ou envoyer un watermark se fait dans ClearDoc (Génération vidéo).',
    'videos.pending': 'En attente de validation',
    'videos.col.document': 'Ligne de paie',
    'videos.col.video': 'Vidéo',
    'videos.col.created': 'Générée le',
    'videos.watch': 'Voir',
    'videos.publish': 'Publier sur la ligne',
    'videos.discard': 'Rejeter',
    'videos.discard.confirm': 'Rejeter cette vidéo ? Le fichier sera supprimé.',
    'videos.published': 'Vidéos publiées',
    'videos.delete.confirm': 'Supprimer cette vidéo ? Cette action est irréversible.',
    'videos.empty': 'Aucune vidéo publiée.',
    'videos.generation': 'Génération',
    'videos.watermark': 'Watermark',
    'videos.watermarkOn': 'Présent',
    'videos.watermarkOff': 'Aucun',
    'videos.watermarkDelete': 'Supprimer le watermark',
    'videos.watermarkDelete.description': 'Les vidéos déjà générées ne sont pas modifiées.',
    'videos.watermarkDelete.confirm': 'Supprimer le watermark ? Les vidéos déjà générées ne sont pas modifiées.',
    'videos.publishedMsg': 'Vidéo publiée sur la ligne de paie.',
    'videos.discarded': 'Vidéo rejetée et supprimée.',
    'videos.deleted': 'Vidéo supprimée.',
    'videos.watermarkDeleted': 'Watermark supprimé.',

    'settings.title': 'Réglages',
    'settings.description': 'Les services utilisés pour générer les vidéos, et leur apparence par défaut.',
    'settings.ai': 'IA et voix',
    'settings.ai.description': 'Un champ laissé vide garde la valeur actuelle.',
    'settings.AI_API_KEY': 'Clé API IA',
    'settings.AI_API_BASE_URL': 'URL API IA',
    'settings.AI_MODEL': 'Modèle IA',
    'settings.ELEVENLABS_API_KEY': 'Clé API ElevenLabs',
    'settings.ELEVENLABS_VOICE_ID': 'ID voix ElevenLabs',
    'settings.secretSaved': 'Enregistrée — laisser vide pour la garder',
    'settings.secretEmpty': 'Non définie',
    'settings.secretHelp': 'Jamais réaffichée.',
    'settings.fromEnv': 'Défini par une variable d\'environnement.',
    'settings.video': 'Apparence des vidéos',
    'settings.VIDEO_THEME': 'Thème',
    'settings.VIDEO_ACCENT_COLOR': 'Couleur d\'accentuation',
    'settings.VIDEO_QUALITY': 'Qualité vidéo (poids du fichier)',
    'settings.VIDEO_BG_MODE': 'Fond',
    'settings.VIDEO_BG_COLOR1': 'Couleur de fond 1',
    'settings.VIDEO_BG_COLOR2': 'Couleur de fond 2',
    'settings.VIDEO_BG_ANGLE': 'Angle du dégradé (°)',
    'settings.VIDEO_WATERMARK_POSITION': 'Watermark : coin',
    'settings.VIDEO_WATERMARK_SIZE': 'Watermark : taille',
    'settings.colorHelp': 'Format #rrggbb.',
    'settings.bgHelp': 'Couleur 1 : fond uni ou début du dégradé. Couleur 2 : fin du dégradé.',
    'settings.quality.high': 'Haute (1080p, ~CRF 18)',
    'settings.quality.standard': 'Standard (1080p, plus léger)',
    'settings.quality.light': 'Légère (1080p, mini-poids)',
    'settings.bg.theme': 'Fond du thème',
    'settings.bg.solid': 'Couleur unie',
    'settings.bg.gradient': 'Dégradé',
    'settings.pos.top-left': 'Haut gauche',
    'settings.pos.top-right': 'Haut droite',
    'settings.pos.bottom-left': 'Bas gauche',
    'settings.pos.bottom-right': 'Bas droite',
    'settings.size.small': 'Petit',
    'settings.size.medium': 'Moyen',
    'settings.size.large': 'Grand',
    'settings.saved': 'Réglages enregistrés.',

    'access.title': 'Accès',
    'access.description': 'Qui peut administrer ClearDoc.',
    'access.notice': 'Le premier compte administrateur se crée sur le serveur (« npm run setup-admin ») ; les suivants se donnent depuis les utilisateurs de Kosmy Board. Les réglages de la connexion avec Kosmy Board et la liaison du compte se changent dans ClearDoc (Admin > Kosmy Board) : les changer d\'ici couperait cet accès.',
    'access.accounts': 'Comptes administrateur',
    'access.col.username': 'Identifiant',
    'access.col.created': 'Créé le',
    'access.col.kosmy': 'Kosmy Board',
    'access.linked': 'Relié',
    'access.notLinked': 'Non relié',
    'access.col.state': 'État',
    'access.active': 'Actif',
    'access.disabled': 'Désactivé',
    'access.col.password': 'Mot de passe',
    'access.passwordNone': 'Aucun (Kosmy Board seulement)',
    'access.you': '{name} (vous)',
    'access.sso': 'Connexion avec Kosmy Board',
    'access.issuer': 'Émetteur',
    'access.clientId': 'Identifiant client',
    'access.clientSecret': 'Secret client',
    'access.secretSet': 'Enregistré',
    'access.redirectUri': 'Adresse de retour',
    'access.initiateUri': 'Adresse de lancement',
    'access.logins': 'Dernières connexions',
    'access.col.date': 'Date',
    'access.col.account': 'Compte',
    'access.col.result': 'Résultat',
    'access.col.ip': 'Adresse IP',
    'access.ok': 'Réussie',
    'access.failed': 'Échouée',
    'access.loginsEmpty': 'Aucune connexion enregistrée.',
  },
  en: {
    'role.admin': 'Administrator',
    'yes': 'Yes',
    'save': 'Save',
    'rename': 'Rename',
    'delete': 'Delete',
    'truncated': 'Only the first {max} rows are shown.',

    'err.token': 'Kosmy Board token rejected.',
    'err.notConfigured': 'Sign-in with Kosmy Board is not configured in ClearDoc (Admin > Kosmy Board).',
    'err.unreachable': 'ClearDoc cannot reach Kosmy Board to check the token.',
    'err.notLinked': 'This Kosmy Board account is not linked to any ClearDoc account. Sign in to ClearDoc with your password, then link it in Admin > Kosmy Board.',
    'err.forbidden': 'Your ClearDoc account does not have administrator rights.',
    'err.disabled': 'Your ClearDoc account is disabled.',
    'err.section': 'Unknown section.',
    'err.action': 'Unknown action.',
    'err.method': 'Method not allowed.',
    'err.body': 'Unreadable request.',
    'err.tooLarge': 'Request too large.',
    'err.server': 'ClearDoc internal error.',
    'err.required': '"{field}" is required.',
    'err.tooLong': '"{field}": {max} characters at most.',
    'err.choice': '"{field}": unknown choice.',
    'err.color': '"{field}": expected a #rrggbb color.',
    'err.angle': '"{field}": a whole number between 0 and 360.',
    'err.url': '"{field}": expected an http(s) address.',
    'err.row': 'This row no longer exists.',
    'err.notPending': 'This video is no longer awaiting validation.',
    'err.document_not_found': 'This payslip line no longer exists.',
    'err.category_title_required': 'The category title is required.',
    'err.category_not_found': 'This category no longer exists.',
    'err.category_in_use': 'This category cannot be deleted: {count} payslip line(s) use it.',
    'err.company_name_required': 'The name is required.',
    'err.company_not_found': 'This structure no longer exists.',
    'err.pdf_not_found': 'This PDF file no longer exists.',
    'err.assignment_required': 'Choose a structure and a PDF.',
    'err.zone_not_found': 'This zone no longer exists.',
    'err.zone_document_required': 'Choose a payslip line.',
    'err.video_url_required': 'Missing video.',
    'err.video_file_not_found': 'The video file cannot be found.',
    'err.video_published': 'Published video: delete it from the list of published videos.',

    'overview.title': 'Overview',
    'overview.pending.title': 'Video to validate',
    'overview.pending.text': 'The video for "{title}" is awaiting your validation (Videos section).',
    'overview.stats': 'At a glance',
    'overview.documents': 'Payslip lines',
    'overview.categories': 'Categories',
    'overview.companies': 'Structures',
    'overview.pdfs': 'PDF files',
    'overview.zones': 'Interactive payslip zones',
    'overview.videos': 'Published videos',
    'overview.instance': 'Instance',
    'overview.address': 'Address',
    'overview.database': 'Database',
    'overview.remotion': 'Remotion (video generation)',
    'overview.remotionOn': 'Installed ({version})',
    'overview.remotionOff': 'Not installed',
    'overview.issuer': 'Kosmy Board (issuer)',

    'documents.title': 'Payslip lines',
    'documents.description': 'The explanations of the payslip lines, visible to everyone. The description (rich text), the image and the video are prepared in ClearDoc.',
    'documents.table': 'Payslip lines',
    'documents.col.title': 'Title',
    'documents.col.category': 'Category',
    'documents.col.keywords': 'Keywords',
    'documents.col.video': 'Video',
    'documents.col.updated': 'Updated',
    'documents.rename.field': 'New title',
    'documents.setCategory': 'Change category',
    'documents.delete.confirm': 'Delete this payslip line? This cannot be undone.',
    'documents.add': 'Add a line',
    'documents.field.title': 'Title',
    'documents.field.category': 'Category',
    'documents.empty': 'No payslip lines.',
    'documents.added': 'Payslip line added. Write its description in ClearDoc.',
    'documents.renamed': 'Title changed.',
    'documents.categoryChanged': 'Category changed.',
    'documents.deleted': 'Payslip line deleted.',

    'categories.title': 'Categories',
    'categories.description': 'The categories that group the payslip lines. A category in use cannot be deleted.',
    'categories.col.title': 'Title',
    'categories.col.id': 'Identifier',
    'categories.col.usage': 'Payslip lines',
    'categories.rename.field': 'New title',
    'categories.delete.confirm': 'Delete this category?',
    'categories.add': 'Add a category',
    'categories.field.title': 'Title',
    'categories.empty': 'No categories.',
    'categories.added': 'Category added.',
    'categories.renamed': 'Category renamed.',
    'categories.deleted': 'Category deleted.',

    'structures.title': 'Structures and PDFs',
    'structures.description': 'The structures and the PDF documents offered to them ("Structure documents" page).',
    'structures.upload': 'Uploading a new PDF file is done in ClearDoc (Manage PDF documents).',
    'structures.companies': 'Structures',
    'structures.col.name': 'Name',
    'structures.col.pdfCount': 'Assigned PDFs',
    'structures.rename.field': 'New name',
    'structures.delete.confirm': 'Delete this structure? Its PDF assignments will be removed.',
    'structures.add': 'Add a structure',
    'structures.field.name': 'Name',
    'structures.empty': 'No structures.',
    'structures.pdfs': 'PDF files',
    'structures.col.companyCount': 'Structures',
    'structures.pdfDelete.confirm': 'Delete this PDF file? This cannot be undone.',
    'structures.pdfEmpty': 'No PDF files.',
    'structures.assignments': 'Assignments',
    'structures.col.company': 'Structure',
    'structures.col.pdf': 'PDF',
    'structures.unassign': 'Remove',
    'structures.assign': 'Assign a PDF',
    'structures.assignEmpty': 'No assignments.',
    'structures.missing': '(deleted)',
    'structures.added': 'Structure added.',
    'structures.renamed': 'Structure renamed.',
    'structures.deleted': 'Structure deleted.',
    'structures.pdfDeleted': 'PDF file deleted.',
    'structures.assigned': 'PDF assigned to the structure.',
    'structures.unassigned': 'PDF removed from the structure.',

    'map.title': 'Interactive payslip',
    'map.description': 'The clickable zones of the interactive payslip, each linked to a payslip line.',
    'map.editor': 'Drawing a zone or changing the model image is done in ClearDoc (Manage the interactive payslip).',
    'map.model': 'Model',
    'map.image': 'Model image',
    'map.imageSet': 'Set',
    'map.imageNone': 'None',
    'map.zoneCount': 'Zones',
    'map.zones': 'Zones',
    'map.col.document': 'Payslip line',
    'map.col.position': 'Position',
    'map.col.size': 'Size',
    'map.col.created': 'Created',
    'map.setDocument': 'Link to another line',
    'map.field.document': 'Payslip line',
    'map.delete.confirm': 'Delete this zone?',
    'map.empty': 'No zones.',
    'map.missing': '(deleted line)',
    'map.updated': 'Zone updated.',
    'map.deleted': 'Zone deleted.',

    'videos.title': 'Videos',
    'videos.description': 'The explainer videos of the payslip lines.',
    'videos.generate': 'Generating a video (several minutes), installing Remotion or uploading a watermark is done in ClearDoc (Video generation).',
    'videos.pending': 'Awaiting validation',
    'videos.col.document': 'Payslip line',
    'videos.col.video': 'Video',
    'videos.col.created': 'Generated',
    'videos.watch': 'Watch',
    'videos.publish': 'Publish on the line',
    'videos.discard': 'Reject',
    'videos.discard.confirm': 'Reject this video? The file will be deleted.',
    'videos.published': 'Published videos',
    'videos.delete.confirm': 'Delete this video? This cannot be undone.',
    'videos.empty': 'No published videos.',
    'videos.generation': 'Generation',
    'videos.watermark': 'Watermark',
    'videos.watermarkOn': 'Present',
    'videos.watermarkOff': 'None',
    'videos.watermarkDelete': 'Delete the watermark',
    'videos.watermarkDelete.description': 'Videos already generated are not changed.',
    'videos.watermarkDelete.confirm': 'Delete the watermark? Videos already generated are not changed.',
    'videos.publishedMsg': 'Video published on the payslip line.',
    'videos.discarded': 'Video rejected and deleted.',
    'videos.deleted': 'Video deleted.',
    'videos.watermarkDeleted': 'Watermark deleted.',

    'settings.title': 'Settings',
    'settings.description': 'The services used to generate the videos, and their default appearance.',
    'settings.ai': 'AI and voice',
    'settings.ai.description': 'A field left empty keeps its current value.',
    'settings.AI_API_KEY': 'AI API key',
    'settings.AI_API_BASE_URL': 'AI API URL',
    'settings.AI_MODEL': 'AI model',
    'settings.ELEVENLABS_API_KEY': 'ElevenLabs API key',
    'settings.ELEVENLABS_VOICE_ID': 'ElevenLabs voice ID',
    'settings.secretSaved': 'Saved — leave empty to keep it',
    'settings.secretEmpty': 'Not set',
    'settings.secretHelp': 'Never shown again.',
    'settings.fromEnv': 'Set by an environment variable.',
    'settings.video': 'Video appearance',
    'settings.VIDEO_THEME': 'Theme',
    'settings.VIDEO_ACCENT_COLOR': 'Accent color',
    'settings.VIDEO_QUALITY': 'Video quality (file size)',
    'settings.VIDEO_BG_MODE': 'Background',
    'settings.VIDEO_BG_COLOR1': 'Background color 1',
    'settings.VIDEO_BG_COLOR2': 'Background color 2',
    'settings.VIDEO_BG_ANGLE': 'Gradient angle (°)',
    'settings.VIDEO_WATERMARK_POSITION': 'Watermark: corner',
    'settings.VIDEO_WATERMARK_SIZE': 'Watermark: size',
    'settings.colorHelp': '#rrggbb format.',
    'settings.bgHelp': 'Color 1: solid background or gradient start. Color 2: gradient end.',
    'settings.quality.high': 'High (1080p, ~CRF 18)',
    'settings.quality.standard': 'Standard (1080p, lighter)',
    'settings.quality.light': 'Light (1080p, smallest)',
    'settings.bg.theme': 'Theme background',
    'settings.bg.solid': 'Solid color',
    'settings.bg.gradient': 'Gradient',
    'settings.pos.top-left': 'Top left',
    'settings.pos.top-right': 'Top right',
    'settings.pos.bottom-left': 'Bottom left',
    'settings.pos.bottom-right': 'Bottom right',
    'settings.size.small': 'Small',
    'settings.size.medium': 'Medium',
    'settings.size.large': 'Large',
    'settings.saved': 'Settings saved.',

    'access.title': 'Access',
    'access.description': 'Who can administer ClearDoc.',
    'access.notice': 'The first administrator account is created on the server ("npm run setup-admin"); the next ones are given from the Kosmy Board users. The Kosmy Board sign-in settings and the account link are changed in ClearDoc (Admin > Kosmy Board): changing them from here would cut this access.',
    'access.accounts': 'Administrator accounts',
    'access.col.username': 'Username',
    'access.col.created': 'Created',
    'access.col.kosmy': 'Kosmy Board',
    'access.linked': 'Linked',
    'access.notLinked': 'Not linked',
    'access.col.state': 'Status',
    'access.active': 'Active',
    'access.disabled': 'Disabled',
    'access.col.password': 'Password',
    'access.passwordNone': 'None (Kosmy Board only)',
    'access.you': '{name} (you)',
    'access.sso': 'Sign-in with Kosmy Board',
    'access.issuer': 'Issuer',
    'access.clientId': 'Client ID',
    'access.clientSecret': 'Client secret',
    'access.secretSet': 'Saved',
    'access.redirectUri': 'Redirect URI',
    'access.initiateUri': 'Initiate login URI',
    'access.logins': 'Recent sign-ins',
    'access.col.date': 'Date',
    'access.col.account': 'Account',
    'access.col.result': 'Result',
    'access.col.ip': 'IP address',
    'access.ok': 'Succeeded',
    'access.failed': 'Failed',
    'access.loginsEmpty': 'No sign-ins recorded.',
  },
};

/** Noms des thèmes vidéo (src/lib/videoThemes.ts). */
const THEME_NAMES = {
  cleardoc: 'ClearDoc', moderne: 'Moderne', arctic: 'Arctic', noir: 'Noir', doux: 'Doux',
  foret: 'Forêt', cyber: 'Cyber', courbe: 'Courbe', sobre: 'Sobre',
};
const QUALITIES = ['high', 'standard', 'light'];
const BG_MODES = ['theme', 'solid', 'gradient'];
const WM_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const WM_SIZES = ['small', 'medium', 'large'];
const AI_KEYS = ['AI_API_KEY', 'AI_API_BASE_URL', 'AI_MODEL', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'];

/**
 * La langue la mieux notée parmi fr et en dans Accept-Language ; fr par défaut
 * (la langue de ClearDoc).
 */
export function pickLang(header) {
  const ranked = String(header || '')
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const q = params.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)).find(Boolean);
      return { lang: tag.split('-')[0].trim(), q: q ? Number(q[1]) : 1, i };
    })
    .filter((x) => (x.lang === 'fr' || x.lang === 'en') && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked[0]?.lang || 'fr';
}

/**
 * Les textes de cette langue ; `extra` ({ fr: {…}, en: {…} }) ajoute ceux d'un
 * autre module (les utilisateurs gérés par le Board reprennent ceux du jeton).
 */
export function translator(lang, extra = {}) {
  const fr = { ...TEXTS.fr, ...(extra.fr || {}) };
  const dict = { ...fr, ...(TEXTS[lang] || {}), ...(extra[lang] || {}) };
  const t = (key, params = {}) => String(dict[key] ?? fr[key] ?? key)
    .replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  t.has = (key) => key in dict;
  t.lang = lang;
  return t;
}

/* ============================================================
 * Erreurs et réponses
 * ============================================================ */

export class BoardAdminError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.userMessage = message;
  }
}

export function sendJson(res, status, body) {
  res.status(status).set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }).end(JSON.stringify(body));
}

/** Une erreur prévue de l'admin de ClearDoc, dans la langue de la personne. */
function fromActionError(e, t) {
  const code = e.status === 404 ? 'not_found' : e.status === 409 ? 'conflict' : 'invalid';
  const status = e.status === 404 || e.status === 409 ? e.status : 422;
  const key = `err.${e.code}`;
  return new BoardAdminError(status, code, t.has(key) ? t(key, e.params) : e.message);
}

/* ============================================================
 * Jeton du Board
 * ============================================================ */

/** `jti` déjà reçus, gardés jusqu'à l'expiration de leur jeton : un jeton ne sert qu'une fois. */
export function createJtiStore() {
  const seen = new Map();
  return {
    use(jti, payload) {
      const now = Date.now();
      for (const [k, until] of seen) if (until <= now) seen.delete(k);
      if (seen.has(jti)) return false;
      // Au-delà, le jeton est refusé de toute façon (exp ou âge maximal, tolérance comprise).
      const until = Math.min(payload.exp, payload.iat + MAX_TOKEN_AGE_S) * 1000 + CLOCK_TOLERANCE_S * 1000;
      seen.set(jti, until);
      return true;
    },
    get size() { return seen.size; },
  };
}

/** `typ` comparé comme le fait JOSE : sans casse, préfixe « application/ » facultatif. */
const normalizeTyp = (typ) => (typeof typ === 'string' ? typ.toLowerCase().replace(/^application\//, '') : '');

/**
 * Vérifie le jeton, dans l'ordre du protocole : signature RS256 (clés de la
 * connexion unique), typ, iss, aud, exp, puis htm et htu, puis jti à usage unique.
 * Renvoie ses revendications ; lance une erreur sinon.
 */
export async function verifyBoardToken(token, { entry, settings, method, path, jtis }) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded.payload !== 'object' || decoded.header?.alg !== 'RS256') {
    throw new Error('not an RS256 JWT');
  }
  // Un ID token (ou un autre JWT du Board) n'est jamais accepté ici.
  if (normalizeTyp(decoded.header.typ) !== TOKEN_TYPE) throw new Error('typ');

  const key = await signingKey(entry, decoded.header.kid);
  const payload = jwt.verify(token, key, {
    algorithms: ['RS256'],
    issuer: settings.issuer,
    audience: settings.clientId,
    clockTolerance: CLOCK_TOLERANCE_S,
    maxAge: MAX_TOKEN_AGE_S,
  });
  if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') throw new Error('exp/iat');

  // Le jeton n'est valable que pour cette requête.
  if (payload.htm !== method) throw new Error('htm');
  let htuPath = '';
  try { htuPath = new URL(payload.htu).pathname; } catch { /* refusé juste en dessous */ }
  if (!htuPath || !htuPath.endsWith(path)) throw new Error('htu');

  if (typeof payload.jti !== 'string' || !payload.jti || payload.jti.length > 200) throw new Error('jti');
  if (!jtis.use(payload.jti, payload)) throw new Error('jti replayed');

  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('sub');
  return payload;
}

/**
 * Authentifie une requête du Board : jeton (voir verifyBoardToken, pour la
 * méthode et le chemin de cette requête), puis `sub` du jeton → compte relié,
 * actif et administrateur. Le Board dit qui est la personne ; les droits, c'est
 * ClearDoc qui les donne. Lance une BoardAdminError (401 / 403) sinon.
 *
 * @param {import('express').Request} req
 * @param {(key: string) => string} t  textes err.token, err.notConfigured, err.unreachable,
 *   err.notLinked, err.disabled, err.forbidden
 * @param {object} o  { db, getSetting, fetchImpl, jtis, isAdmin }
 */
export async function authenticateBoardRequest(req, t, { db, getSetting, fetchImpl = fetch, jtis, isAdmin = Boolean }) {
  const m = /^Bearer[ \t]+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(req.get('authorization') || '');
  if (!m) throw new BoardAdminError(401, 'invalid_token', t('err.token'));
  const settings = readSettings(getSetting);
  if (!settings) throw new BoardAdminError(401, 'invalid_token', t('err.notConfigured'));
  let entry;
  try {
    entry = await discover(settings.issuer, fetchImpl);
  } catch {
    throw new BoardAdminError(401, 'invalid_token', t('err.unreachable'));
  }
  let payload;
  try {
    payload = await verifyBoardToken(m[1], { entry, settings, method: req.method, path: req.path, jtis });
  } catch {
    throw new BoardAdminError(401, 'invalid_token', t('err.token'));
  }
  const account = findLinkedAdmin(db, settings.issuer, payload.sub);
  if (!account) throw new BoardAdminError(403, 'not_linked', t('err.notLinked'));
  // Accès retiré par le Board (ou compte désactivé) : plus aucun droit.
  if (!isActive(account)) throw new BoardAdminError(403, 'forbidden', t('err.disabled'));
  if (!isAdmin(account)) throw new BoardAdminError(403, 'forbidden', t('err.forbidden'));
  return { account, settings, claims: payload };
}

/* ============================================================
 * Petits outils pour décrire les sections
 * ============================================================ */

function fmtDate(v, lang) {
  if (v === null || v === undefined || v === '') return '';
  let d;
  if (typeof v === 'number') d = new Date(v);
  else {
    const s = String(v);
    // SQLite CURRENT_TIMESTAMP : « AAAA-MM-JJ HH:MM:SS » en UTC.
    d = new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s) ? `${s.replace(' ', 'T')}Z` : s);
  }
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const pct = (n) => Math.round(Number(n) * 10) / 10;
const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr', { sensitivity: 'base' });

function fileSize(bytes, lang) {
  const nf = (n) => new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 }).format(n);
  if (bytes < 1024 * 1024) return `${nf(bytes / 1024)} ${lang === 'en' ? 'KB' : 'Ko'}`;
  return `${nf(bytes / (1024 * 1024))} ${lang === 'en' ? 'MB' : 'Mo'}`;
}

/** Les lignes d'un tableau, et une note si elles dépassent la limite du protocole. */
function capRows(rows, t) {
  if (rows.length <= MAX_ROWS) return { rows, notice: [] };
  return {
    rows: rows.slice(0, MAX_ROWS),
    notice: [{ type: 'notice', tone: 'warning', text: t('truncated', { max: MAX_ROWS }) }],
  };
}

const options = (values, label) => values.slice(0, MAX_OPTIONS).map((value) => ({ value, label: label(value) }));

/* ---------- Saisies (le Board ne fait que transmettre : tout est revérifié) ---------- */

function textValue(values, name, label, t, { required = false, max = 200 } = {}) {
  const raw = values?.[name];
  const v = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
  if (required && !v) throw new BoardAdminError(422, 'invalid', t('err.required', { field: label }));
  if (v.length > max) throw new BoardAdminError(422, 'invalid', t('err.tooLong', { field: label, max }));
  return v;
}

function choiceValue(values, name, allowed, label, t) {
  const v = values?.[name];
  if (typeof v !== 'string' || !allowed.includes(v)) {
    throw new BoardAdminError(422, 'invalid', t('err.choice', { field: label }));
  }
  return v;
}

function rowId(body, t) {
  if (typeof body.row !== 'string' || !body.row) throw new BoardAdminError(404, 'not_found', t('err.row'));
  return body.row;
}

/* ============================================================
 * Routeur
 * ============================================================ */

/**
 * @param {object} o
 * @param {import('better-sqlite3').Database} o.db
 * @param {(key: string) => string | null} o.getSetting  priorité env > base
 * @param {ReturnType<import('./adminActions.js').createAdminActions>} o.actions  fonctions de l'admin de ClearDoc
 * @param {(account: object) => boolean} [o.isAdmin]  droits d'admin du compte relié ; dans ClearDoc, tout
 *   compte actif (table admin_users) est administrateur
 * @param {ReturnType<typeof createJtiStore>} [o.jtis]  `jti` déjà reçus (partagés avec les utilisateurs gérés par le Board)
 * @param {typeof fetch} [o.fetchImpl]
 */
export function createKosmyBoardAdminRouter(o) {
  const { db, getSetting, actions } = o;
  const fetchImpl = o.fetchImpl || fetch;
  const isAdmin = o.isAdmin || ((account) => Boolean(account));
  const jtis = o.jtis || createJtiStore();
  const parseJson = express.json({ limit: '256kb', type: () => true });
  const router = express.Router();

  /* ---------- Authentification ---------- */

  const authenticate = (req, t) => authenticateBoardRequest(req, t, { db, getSetting, fetchImpl, jtis, isAdmin });

  /* ---------- Sections ---------- */

  const categoryOptions = () => {
    const titles = new Map(actions.listCategories().map((c) => [c.id, c.title]));
    return options([...titles.keys()], (id) => titles.get(id) || id);
  };

  const SECTIONS = {
    overview: {
      build(ctx) {
        const { t } = ctx;
        const pending = actions.getPendingVideo();
        const remotion = actions.remotionStatus();
        const count = (sql) => db.prepare(sql).get().n;
        let dbSize = null;
        try {
          if (db.name && db.name !== ':memory:') dbSize = fileSize(fs.statSync(db.name).size, t.lang);
        } catch { /* taille inconnue */ }
        return {
          blocks: [
            ...(pending ? [{
              type: 'notice', tone: 'warning', title: t('overview.pending.title'),
              text: t('overview.pending.text', { title: pending.title || '' }),
            }] : []),
            {
              type: 'stats', title: t('overview.stats'), items: [
                { label: t('overview.documents'), value: count('SELECT COUNT(*) AS n FROM documents') },
                { label: t('overview.categories'), value: count('SELECT COUNT(*) AS n FROM categories') },
                { label: t('overview.companies'), value: count('SELECT COUNT(*) AS n FROM companies') },
                { label: t('overview.pdfs'), value: count('SELECT COUNT(*) AS n FROM pdf_files') },
                { label: t('overview.zones'), value: count('SELECT COUNT(*) AS n FROM payslip_zones') },
                { label: t('overview.videos'), value: actions.listVideos().length },
              ],
            },
            {
              type: 'fields', title: t('overview.instance'), items: [
                { label: t('overview.address'), value: ctx.base },
                { label: 'Node.js', value: process.version },
                { label: t('overview.database'), value: dbSize ? `SQLite · ${dbSize}` : 'SQLite' },
                {
                  label: t('overview.remotion'),
                  value: remotion.installed ? t('overview.remotionOn', { version: remotion.version || '?' }) : t('overview.remotionOff'),
                },
                { label: t('overview.issuer'), value: ctx.settings.issuer },
              ],
            },
          ],
        };
      },
    },

    documents: {
      build(ctx) {
        const { t } = ctx;
        const categories = new Map(actions.listCategories().map((c) => [c.id, c.title]));
        const docs = actions.listDocuments().sort(byTitle);
        const { rows, notice } = capRows(docs, t);
        const catOptions = categoryOptions();
        const defaultCategory = categories.has('autres') ? 'autres' : catOptions[0]?.value;
        return {
          description: t('documents.description'),
          blocks: [
            ...notice,
            {
              type: 'table', id: 'documents', title: t('documents.table'),
              columns: [
                { key: 'title', label: t('documents.col.title') },
                { key: 'category', label: t('documents.col.category') },
                { key: 'keywords', label: t('documents.col.keywords') },
                { key: 'video', label: t('documents.col.video') },
                { key: 'updated', label: t('documents.col.updated') },
              ],
              rows: rows.map((d) => ({
                id: d.id,
                cells: {
                  title: { text: d.title || '—', href: `/#${encodeURIComponent(d.id)}` },
                  category: categories.get(d.category) || d.category,
                  keywords: d.keywords.join(', ').slice(0, 300),
                  video: d.videoUrl ? { text: t('yes'), tone: 'success' } : '',
                  updated: fmtDate(d.updated_at, t.lang),
                },
                actions: ['rename', ...(catOptions.length ? ['set-category'] : []), 'delete'],
              })),
              rowActions: [
                { id: 'rename', label: t('rename'), fields: [
                  { name: 'title', label: t('documents.rename.field'), type: 'text', required: true, maxLength: 200 },
                ] },
                ...(catOptions.length ? [{ id: 'set-category', label: t('documents.setCategory'), fields: [
                  { name: 'category', label: t('documents.field.category'), type: 'select', value: defaultCategory, options: catOptions },
                ] }] : []),
                { id: 'delete', label: t('delete'), danger: true, confirm: t('documents.delete.confirm') },
              ],
              actions: [{ id: 'add', label: t('documents.add'), fields: [
                { name: 'title', label: t('documents.field.title'), type: 'text', required: true, maxLength: 200 },
                ...(catOptions.length ? [{ name: 'category', label: t('documents.field.category'), type: 'select', value: defaultCategory, options: catOptions }] : []),
              ] }],
              empty: t('documents.empty'),
            },
          ],
        };
      },
      actions: {
        add(ctx, body) {
          const { t } = ctx;
          const title = textValue(body.values, 'title', t('documents.field.title'), t, { required: true });
          const ids = actions.listCategories().map((c) => c.id);
          const category = ids.length
            ? choiceValue(body.values, 'category', ids, t('documents.field.category'), t)
            : undefined;
          actions.createDocument({ title, category });
          return { message: t('documents.added') };
        },
        rename(ctx, body) {
          const { t } = ctx;
          const title = textValue(body.values, 'title', t('documents.rename.field'), t, { required: true });
          actions.updateDocument(rowId(body, t), { title });
          return { message: t('documents.renamed') };
        },
        'set-category'(ctx, body) {
          const { t } = ctx;
          const id = rowId(body, t);
          const category = choiceValue(body.values, 'category', actions.listCategories().map((c) => c.id), t('documents.field.category'), t);
          actions.updateDocument(id, { category });
          return { message: t('documents.categoryChanged') };
        },
        delete(ctx, body) {
          actions.deleteDocument(rowId(body, ctx.t));
          return { message: ctx.t('documents.deleted') };
        },
      },
    },

    categories: {
      build(ctx) {
        const { t } = ctx;
        const usage = actions.categoryUsage();
        const cats = actions.listCategories().sort(byTitle);
        const { rows, notice } = capRows(cats, t);
        return {
          description: t('categories.description'),
          blocks: [
            ...notice,
            {
              type: 'table', id: 'categories',
              columns: [
                { key: 'title', label: t('categories.col.title') },
                { key: 'id', label: t('categories.col.id') },
                { key: 'usage', label: t('categories.col.usage') },
              ],
              rows: rows.map((c) => {
                const n = usage.get(c.id) || 0;
                return {
                  id: c.id,
                  cells: { title: c.title, id: c.id, usage: n },
                  // Une catégorie utilisée ne se supprime pas (revérifié à l'action).
                  actions: n === 0 ? ['rename', 'delete'] : ['rename'],
                };
              }),
              rowActions: [
                { id: 'rename', label: t('rename'), fields: [
                  { name: 'title', label: t('categories.rename.field'), type: 'text', required: true, maxLength: 100 },
                ] },
                { id: 'delete', label: t('delete'), danger: true, confirm: t('categories.delete.confirm') },
              ],
              actions: [{ id: 'add', label: t('categories.add'), fields: [
                { name: 'title', label: t('categories.field.title'), type: 'text', required: true, maxLength: 100 },
              ] }],
              empty: t('categories.empty'),
            },
          ],
        };
      },
      actions: {
        add(ctx, body) {
          const { t } = ctx;
          actions.createCategory(textValue(body.values, 'title', t('categories.field.title'), t, { required: true, max: 100 }));
          return { message: t('categories.added') };
        },
        rename(ctx, body) {
          const { t } = ctx;
          const title = textValue(body.values, 'title', t('categories.rename.field'), t, { required: true, max: 100 });
          actions.renameCategory(rowId(body, t), title);
          return { message: t('categories.renamed') };
        },
        delete(ctx, body) {
          actions.deleteCategory(rowId(body, ctx.t));
          return { message: ctx.t('categories.deleted') };
        },
      },
    },

    structures: {
      build(ctx) {
        const { t } = ctx;
        const companies = actions.listCompanies();
        const pdfs = actions.listPdfFiles();
        const assignments = actions.listAssignments();
        const companyName = new Map(companies.map((c) => [c.id, c.name]));
        const pdfName = new Map(pdfs.map((p) => [p.id, p.name]));
        const perCompany = new Map();
        const perPdf = new Map();
        for (const a of assignments) {
          perCompany.set(a.company_id, (perCompany.get(a.company_id) || 0) + 1);
          perPdf.set(a.pdf_id, (perPdf.get(a.pdf_id) || 0) + 1);
        }
        const assignRows = assignments
          .map((a) => ({ ...a, company: companyName.get(a.company_id), pdf: pdfName.get(a.pdf_id) }))
          .sort((a, b) => String(a.company ?? '').localeCompare(String(b.company ?? ''), 'fr')
            || String(a.pdf ?? '').localeCompare(String(b.pdf ?? ''), 'fr'));
        const c = capRows(companies, t);
        const p = capRows(pdfs, t);
        const r = capRows(assignRows, t);
        const companyOptions = options(companies.map((x) => x.id), (id) => companyName.get(id));
        const pdfOptions = options(pdfs.map((x) => x.id), (id) => pdfName.get(id));
        return {
          description: t('structures.description'),
          blocks: [
            { type: 'notice', tone: 'info', text: t('structures.upload') },
            ...c.notice,
            {
              type: 'table', id: 'companies', title: t('structures.companies'),
              columns: [
                { key: 'name', label: t('structures.col.name') },
                { key: 'pdfs', label: t('structures.col.pdfCount') },
              ],
              rows: c.rows.map((x) => ({
                id: x.id,
                cells: { name: x.name, pdfs: perCompany.get(x.id) || 0 },
                actions: ['rename-company', 'delete-company'],
              })),
              rowActions: [
                { id: 'rename-company', label: t('rename'), fields: [
                  { name: 'name', label: t('structures.rename.field'), type: 'text', required: true, maxLength: 200 },
                ] },
                { id: 'delete-company', label: t('delete'), danger: true, confirm: t('structures.delete.confirm') },
              ],
              actions: [{ id: 'add-company', label: t('structures.add'), fields: [
                { name: 'name', label: t('structures.field.name'), type: 'text', required: true, maxLength: 200 },
              ] }],
              empty: t('structures.empty'),
            },
            ...p.notice,
            {
              type: 'table', id: 'pdfs', title: t('structures.pdfs'),
              columns: [
                { key: 'name', label: t('structures.col.name') },
                { key: 'companies', label: t('structures.col.companyCount') },
              ],
              rows: p.rows.map((x) => ({
                id: x.id,
                cells: { name: { text: x.name, href: x.filename }, companies: perPdf.get(x.id) || 0 },
                actions: ['delete-pdf'],
              })),
              rowActions: [
                { id: 'delete-pdf', label: t('delete'), danger: true, confirm: t('structures.pdfDelete.confirm') },
              ],
              empty: t('structures.pdfEmpty'),
            },
            ...r.notice,
            {
              type: 'table', id: 'assignments', title: t('structures.assignments'),
              columns: [
                { key: 'company', label: t('structures.col.company') },
                { key: 'pdf', label: t('structures.col.pdf') },
              ],
              rows: r.rows.map((x) => ({
                id: `${x.company_id}|${x.pdf_id}`,
                cells: { company: x.company ?? t('structures.missing'), pdf: x.pdf ?? t('structures.missing') },
                actions: ['unassign-pdf'],
              })),
              rowActions: [{ id: 'unassign-pdf', label: t('structures.unassign') }],
              ...(companyOptions.length && pdfOptions.length ? {
                actions: [{ id: 'assign-pdf', label: t('structures.assign'), fields: [
                  { name: 'company', label: t('structures.col.company'), type: 'select', value: companyOptions[0].value, options: companyOptions },
                  { name: 'pdf', label: t('structures.col.pdf'), type: 'select', value: pdfOptions[0].value, options: pdfOptions },
                ] }],
              } : {}),
              empty: t('structures.assignEmpty'),
            },
          ],
        };
      },
      actions: {
        'add-company'(ctx, body) {
          const { t } = ctx;
          actions.createCompany(textValue(body.values, 'name', t('structures.field.name'), t, { required: true }));
          return { message: t('structures.added') };
        },
        'rename-company'(ctx, body) {
          const { t } = ctx;
          const name = textValue(body.values, 'name', t('structures.rename.field'), t, { required: true });
          actions.renameCompany(rowId(body, t), name);
          return { message: t('structures.renamed') };
        },
        'delete-company'(ctx, body) {
          actions.deleteCompany(rowId(body, ctx.t));
          return { message: ctx.t('structures.deleted') };
        },
        'delete-pdf'(ctx, body) {
          actions.deletePdfFile(rowId(body, ctx.t));
          return { message: ctx.t('structures.pdfDeleted') };
        },
        'assign-pdf'(ctx, body) {
          const { t } = ctx;
          const companyId = choiceValue(body.values, 'company', actions.listCompanies().map((x) => x.id), t('structures.col.company'), t);
          const pdfId = choiceValue(body.values, 'pdf', actions.listPdfFiles().map((x) => x.id), t('structures.col.pdf'), t);
          actions.assignPdf(companyId, pdfId);
          return { message: t('structures.assigned') };
        },
        'unassign-pdf'(ctx, body) {
          const { t } = ctx;
          const [companyId, pdfId] = rowId(body, t).split('|');
          const exists = actions.listAssignments().some((a) => a.company_id === companyId && a.pdf_id === pdfId);
          if (!exists) throw new BoardAdminError(404, 'not_found', t('err.row'));
          actions.unassignPdf(companyId, pdfId);
          return { message: t('structures.unassigned') };
        },
      },
    },

    'payslip-map': {
      build(ctx) {
        const { t } = ctx;
        const zones = actions.listZones();
        const docs = actions.listDocuments().sort(byTitle);
        const docTitles = new Map(docs.map((d) => [d.id, d.title]));
        const docOptions = options([...docTitles.keys()], (id) => docTitles.get(id) || id);
        const { rows, notice } = capRows(zones, t);
        return {
          description: t('map.description'),
          blocks: [
            { type: 'notice', tone: 'info', text: t('map.editor') },
            {
              type: 'fields', title: t('map.model'), items: [
                { label: t('map.image'), value: actions.payslipModelImage() ? t('map.imageSet') : t('map.imageNone') },
                { label: t('map.zoneCount'), value: String(zones.length) },
              ],
            },
            ...notice,
            {
              type: 'table', id: 'zones', title: t('map.zones'),
              columns: [
                { key: 'document', label: t('map.col.document') },
                { key: 'position', label: t('map.col.position') },
                { key: 'size', label: t('map.col.size') },
                { key: 'created', label: t('map.col.created') },
              ],
              rows: rows.map((z) => ({
                id: z.id,
                cells: {
                  document: z.document_title != null
                    ? { text: z.document_title || '—', href: `/#${encodeURIComponent(z.document_id)}` }
                    : { text: t('map.missing'), tone: 'warning' },
                  position: `${pct(z.x)} %, ${pct(z.y)} %`,
                  size: `${pct(z.width)} × ${pct(z.height)} %`,
                  created: fmtDate(z.created_at, t.lang),
                },
                actions: [...(docOptions.length ? ['set-document'] : []), 'delete-zone'],
              })),
              rowActions: [
                ...(docOptions.length ? [{ id: 'set-document', label: t('map.setDocument'), fields: [
                  { name: 'document', label: t('map.field.document'), type: 'select', value: docOptions[0].value, options: docOptions },
                ] }] : []),
                { id: 'delete-zone', label: t('delete'), danger: true, confirm: t('map.delete.confirm') },
              ],
              empty: t('map.empty'),
            },
          ],
        };
      },
      actions: {
        'set-document'(ctx, body) {
          const { t } = ctx;
          const id = rowId(body, t);
          const documentId = choiceValue(body.values, 'document', actions.listDocuments().map((d) => d.id), t('map.field.document'), t);
          actions.updateZone(id, { document_id: documentId });
          return { message: t('map.updated') };
        },
        'delete-zone'(ctx, body) {
          actions.deleteZone(rowId(body, ctx.t));
          return { message: ctx.t('map.deleted') };
        },
      },
    },

    videos: {
      build(ctx) {
        const { t } = ctx;
        const pending = actions.getPendingVideo();
        const videos = actions.listVideos();
        const remotion = actions.remotionStatus();
        const watermark = actions.watermarkStatus();
        const { rows, notice } = capRows(videos, t);
        return {
          description: t('videos.description'),
          blocks: [
            { type: 'notice', tone: 'info', text: t('videos.generate') },
            ...(pending ? [{
              type: 'table', id: 'pending', title: t('videos.pending'),
              columns: [
                { key: 'document', label: t('videos.col.document') },
                { key: 'video', label: t('videos.col.video') },
                { key: 'created', label: t('videos.col.created') },
              ],
              rows: [{
                id: pending.documentId,
                cells: {
                  document: { text: pending.title || '—', href: `/#${encodeURIComponent(pending.documentId)}` },
                  video: { text: t('videos.watch'), href: pending.videoUrl },
                  created: fmtDate(pending.createdAt, t.lang),
                },
                actions: ['publish-pending', 'discard-pending'],
              }],
              rowActions: [
                { id: 'publish-pending', label: t('videos.publish') },
                { id: 'discard-pending', label: t('videos.discard'), danger: true, confirm: t('videos.discard.confirm') },
              ],
            }] : []),
            ...notice,
            {
              type: 'table', id: 'published', title: t('videos.published'),
              columns: [
                { key: 'document', label: t('videos.col.document') },
                { key: 'video', label: t('videos.col.video') },
              ],
              rows: rows.map((v) => ({
                id: v.documentId,
                cells: {
                  document: { text: v.title || '—', href: `/#${encodeURIComponent(v.documentId)}` },
                  video: { text: t('videos.watch'), href: v.videoUrl },
                },
                actions: ['delete-video'],
              })),
              rowActions: [
                { id: 'delete-video', label: t('delete'), danger: true, confirm: t('videos.delete.confirm') },
              ],
              empty: t('videos.empty'),
            },
            {
              type: 'fields', title: t('videos.generation'), items: [
                {
                  label: t('overview.remotion'),
                  value: remotion.installed ? t('overview.remotionOn', { version: remotion.version || '?' }) : t('overview.remotionOff'),
                },
                { label: t('videos.watermark'), value: watermark.exists ? t('videos.watermarkOn') : t('videos.watermarkOff') },
              ],
            },
            ...(watermark.exists ? [{
              type: 'actions', title: t('videos.watermark'), items: [{
                id: 'delete-watermark', label: t('videos.watermarkDelete'),
                description: t('videos.watermarkDelete.description'),
                danger: true, confirm: t('videos.watermarkDelete.confirm'),
              }],
            }] : []),
          ],
        };
      },
      actions: {
        'publish-pending'(ctx, body) {
          const { t } = ctx;
          const pending = actions.getPendingVideo();
          if (!pending || pending.documentId !== rowId(body, t)) throw new BoardAdminError(404, 'not_found', t('err.notPending'));
          actions.publishVideo(pending.documentId, pending.videoUrl);
          return { message: t('videos.publishedMsg') };
        },
        'discard-pending'(ctx, body) {
          const { t } = ctx;
          const pending = actions.getPendingVideo();
          if (!pending || pending.documentId !== rowId(body, t)) throw new BoardAdminError(404, 'not_found', t('err.notPending'));
          actions.discardVideo(pending.videoUrl);
          return { message: t('videos.discarded') };
        },
        'delete-video'(ctx, body) {
          const { t } = ctx;
          const id = rowId(body, t);
          // Seulement une ligne qui a une vidéo publiée.
          if (!actions.listVideos().some((v) => v.documentId === id)) throw new BoardAdminError(404, 'not_found', t('err.row'));
          actions.deleteVideo(id);
          return { message: t('videos.deleted') };
        },
        'delete-watermark'(ctx) {
          actions.deleteWatermark();
          return { message: ctx.t('videos.watermarkDeleted') };
        },
      },
    },

    settings: {
      build(ctx) {
        const { t } = ctx;
        const s = actions.readMaskedSettings();
        const env = (key) => s[`${key}__fromEnv`] === true;
        const common = (key) => ({ name: key, label: t(`settings.${key}`), ...(env(key) ? { readOnly: true, help: t('settings.fromEnv') } : {}) });
        const aiField = (key) => {
          if (isSecretSetting(key)) {
            // Une clé d'API n'est jamais renvoyée, même masquée : seulement « enregistrée » ou non.
            return {
              ...common(key), type: 'password', maxLength: 500,
              placeholder: s[key] ? t('settings.secretSaved') : t('settings.secretEmpty'),
              ...(env(key) ? {} : { help: t('settings.secretHelp') }),
            };
          }
          return { ...common(key), type: key === 'AI_API_BASE_URL' ? 'url' : 'text', value: s[key], maxLength: 500 };
        };
        const select = (key, values, label) => ({
          ...common(key), type: 'select', value: s[key] || undefined, options: options(values, label),
        });
        const color = (key, help) => ({
          ...common(key), type: 'text', value: s[key], maxLength: 7, placeholder: '#rrggbb',
          ...(env(key) ? {} : { help }),
        });
        const angle = Number(s.VIDEO_BG_ANGLE);
        return {
          description: t('settings.description'),
          blocks: [
            {
              type: 'form', id: 'ai', action: 'save-ai', title: t('settings.ai'),
              description: t('settings.ai.description'), submit: t('save'),
              fields: AI_KEYS.map(aiField),
            },
            {
              type: 'form', id: 'video', action: 'save-video', title: t('settings.video'), submit: t('save'),
              fields: [
                select('VIDEO_THEME', VIDEO_THEME_IDS, (v) => THEME_NAMES[v] || v),
                color('VIDEO_ACCENT_COLOR', t('settings.colorHelp')),
                select('VIDEO_QUALITY', QUALITIES, (v) => t(`settings.quality.${v}`)),
                select('VIDEO_BG_MODE', BG_MODES, (v) => t(`settings.bg.${v}`)),
                color('VIDEO_BG_COLOR1', t('settings.bgHelp')),
                color('VIDEO_BG_COLOR2', t('settings.colorHelp')),
                {
                  ...common('VIDEO_BG_ANGLE'), type: 'number', min: 0, max: 360, step: 1,
                  ...(Number.isFinite(angle) ? { value: angle } : {}),
                },
                select('VIDEO_WATERMARK_POSITION', WM_POSITIONS, (v) => t(`settings.pos.${v}`)),
                select('VIDEO_WATERMARK_SIZE', WM_SIZES, (v) => t(`settings.size.${v}`)),
              ],
            },
          ],
        };
      },
      actions: {
        'save-ai'(ctx, body) {
          const { t } = ctx;
          const values = {};
          for (const key of AI_KEYS) {
            if (process.env[key]) continue; // défini par l'environnement : non modifiable ici
            const label = t(`settings.${key}`);
            const v = textValue(body.values, key, label, t, { max: 500 });
            if (v && key === 'AI_API_BASE_URL' && !/^https?:\/\/[^\s]+$/i.test(v)) {
              throw new BoardAdminError(422, 'invalid', t('err.url', { field: label }));
            }
            values[key] = v;
          }
          actions.saveSettings(values);
          return { message: t('settings.saved') };
        },
        'save-video'(ctx, body) {
          const { t } = ctx;
          const v = body.values || {};
          const label = (key) => t(`settings.${key}`);
          const checks = {
            VIDEO_THEME: () => choiceValue(v, 'VIDEO_THEME', VIDEO_THEME_IDS, label('VIDEO_THEME'), t),
            VIDEO_QUALITY: () => choiceValue(v, 'VIDEO_QUALITY', QUALITIES, label('VIDEO_QUALITY'), t),
            VIDEO_BG_MODE: () => choiceValue(v, 'VIDEO_BG_MODE', BG_MODES, label('VIDEO_BG_MODE'), t),
            VIDEO_WATERMARK_POSITION: () => choiceValue(v, 'VIDEO_WATERMARK_POSITION', WM_POSITIONS, label('VIDEO_WATERMARK_POSITION'), t),
            VIDEO_WATERMARK_SIZE: () => choiceValue(v, 'VIDEO_WATERMARK_SIZE', WM_SIZES, label('VIDEO_WATERMARK_SIZE'), t),
            VIDEO_BG_ANGLE: () => {
              const n = typeof v.VIDEO_BG_ANGLE === 'string' && v.VIDEO_BG_ANGLE.trim() !== '' ? Number(v.VIDEO_BG_ANGLE) : v.VIDEO_BG_ANGLE;
              if (!Number.isInteger(n) || n < 0 || n > 360) throw new BoardAdminError(422, 'invalid', t('err.angle', { field: label('VIDEO_BG_ANGLE') }));
              return String(n);
            },
          };
          for (const key of ['VIDEO_ACCENT_COLOR', 'VIDEO_BG_COLOR1', 'VIDEO_BG_COLOR2']) {
            checks[key] = () => {
              const c = typeof v[key] === 'string' ? v[key].trim() : '';
              if (!HEX6.test(c)) throw new BoardAdminError(422, 'invalid', t('err.color', { field: label(key) }));
              return c.toLowerCase();
            };
          }
          const values = {};
          for (const [key, check] of Object.entries(checks)) {
            if (process.env[key]) continue; // défini par l'environnement : non modifiable ici
            values[key] = check();
          }
          actions.saveSettings(values);
          return { message: t('settings.saved') };
        },
      },
    },

    access: {
      build(ctx) {
        const { t, account, settings, base } = ctx;
        const admins = db.prepare('SELECT * FROM admin_users ORDER BY username').all();
        const logins = db.prepare('SELECT * FROM login_logs ORDER BY rowid DESC LIMIT 50').all();
        return {
          description: t('access.description'),
          blocks: [
            { type: 'notice', tone: 'info', text: t('access.notice') },
            {
              type: 'table', id: 'accounts', title: t('access.accounts'),
              columns: [
                { key: 'username', label: t('access.col.username') },
                { key: 'created', label: t('access.col.created') },
                { key: 'kosmy', label: t('access.col.kosmy') },
                { key: 'password', label: t('access.col.password') },
                { key: 'state', label: t('access.col.state') },
              ],
              rows: admins.map((a) => ({
                id: a.id,
                cells: {
                  username: a.id === account.id ? t('access.you', { name: a.username }) : a.username,
                  created: fmtDate(a.created_at, t.lang),
                  kosmy: a.kosmy_board_sub && a.kosmy_board_issuer === settings.issuer
                    ? { text: t('access.linked'), tone: 'success' }
                    : { text: t('access.notLinked'), tone: 'muted' },
                  password: hasPassword(a) ? t('yes') : { text: t('access.passwordNone'), tone: 'muted' },
                  state: isActive(a)
                    ? { text: t('access.active'), tone: 'success' }
                    : { text: t('access.disabled'), tone: 'danger' },
                },
              })),
            },
            {
              type: 'fields', title: t('access.sso'), items: [
                { label: t('access.issuer'), value: settings.issuer },
                { label: t('access.clientId'), value: settings.clientId },
                // Le secret client n'est jamais renvoyé : seulement le fait qu'il est enregistré.
                { label: t('access.clientSecret'), value: t('access.secretSet') },
                { label: t('access.redirectUri'), value: redirectUri(base) },
                { label: t('access.initiateUri'), value: initiateLoginUri(base) },
              ],
            },
            {
              type: 'table', id: 'logins', title: t('access.logins'),
              columns: [
                { key: 'date', label: t('access.col.date') },
                { key: 'account', label: t('access.col.account') },
                { key: 'result', label: t('access.col.result') },
                { key: 'ip', label: t('access.col.ip') },
              ],
              rows: logins.map((l, i) => ({
                id: String(l.id ?? i),
                cells: {
                  date: fmtDate(l.logged_at, t.lang),
                  account: l.username,
                  result: l.success ? { text: t('access.ok'), tone: 'success' } : { text: t('access.failed'), tone: 'danger' },
                  ip: l.ip || '',
                },
              })),
              empty: t('access.loginsEmpty'),
            },
          ],
        };
      },
    },
  };

  const SECTION_IDS = Object.keys(SECTIONS);
  const TITLE_KEYS = {
    overview: 'overview.title', documents: 'documents.title', categories: 'categories.title',
    structures: 'structures.title', 'payslip-map': 'map.title', videos: 'videos.title',
    settings: 'settings.title', access: 'access.title',
  };

  function buildSection(id, ctx) {
    return { id, title: ctx.t(TITLE_KEYS[id]), ...SECTIONS[id].build(ctx) };
  }

  function readBody(req, res) {
    return new Promise((resolve, reject) => {
      parseJson(req, res, (err) => (err ? reject(err) : resolve(req.body)));
    });
  }

  /* ---------- Les trois adresses ---------- */

  // Toutes les méthodes et tous les chemins sous /api/kosmy-board/admin : rien
  // d'autre (session, CORS, page de l'interface) ne doit y répondre.
  router.all(ROUTE, async (req, res) => {
    const t = translator(pickLang(req.get('accept-language')));
    try {
      const { account, settings, claims } = await authenticate(req, t);
      const ctx = { t, account, settings, base: appBaseUrl(req) };
      const m = /^\/api\/kosmy-board\/admin(?:\/([^/]+))?$/.exec(req.path);
      if (!m) throw new BoardAdminError(404, 'not_found', t('err.section'));
      const id = m[1];

      if (!id) {
        if (req.method !== 'GET') {
          res.set('Allow', 'GET');
          throw new BoardAdminError(405, 'method_not_allowed', t('err.method'));
        }
        return sendJson(res, 200, {
          protocol: PROTOCOL,
          app: { name: 'ClearDoc' },
          user: { name: account.username, role: t('role.admin') },
          sections: SECTION_IDS.map((s) => ({ id: s, title: t(TITLE_KEYS[s]) })),
        });
      }

      if (!Object.hasOwn(SECTIONS, id)) throw new BoardAdminError(404, 'not_found', t('err.section'));
      if (req.method === 'GET') return sendJson(res, 200, buildSection(id, ctx));
      if (req.method !== 'POST') {
        res.set('Allow', 'GET, POST');
        throw new BoardAdminError(405, 'method_not_allowed', t('err.method'));
      }

      let body;
      try {
        body = await readBody(req, res);
      } catch (e) {
        if (e?.type === 'entity.too.large') throw new BoardAdminError(413, 'too_large', t('err.tooLarge'));
        throw new BoardAdminError(400, 'invalid_request', t('err.body'));
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || typeof body.action !== 'string' || !ACTION_ID.test(body.action)
        || (body.row !== undefined && body.row !== null && typeof body.row !== 'string')
        || (body.values !== undefined && (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)))) {
        throw new BoardAdminError(400, 'invalid_request', t('err.body'));
      }

      const handlers = SECTIONS[id].actions || {};
      if (!Object.hasOwn(handlers, body.action)) throw new BoardAdminError(404, 'not_found', t('err.action'));
      let result;
      try {
        result = handlers[body.action](ctx, body);
      } catch (e) {
        if (e instanceof AdminActionError) throw fromActionError(e, t);
        throw e;
      }
      // Journal : le compte ClearDoc, et qui est la personne côté Board (affichage seulement).
      console.log(`[kosmy-board admin] ${account.username} (${claims.email || claims.name || claims.sub}) : ${id}/${body.action}${typeof body.row === 'string' ? ` ${body.row}` : ''}`);
      return sendJson(res, 200, { ok: true, ...result, section: buildSection(id, ctx) });
    } catch (e) {
      if (e instanceof BoardAdminError) {
        return sendJson(res, e.status, { error: e.code, ...(e.userMessage ? { message: e.userMessage } : {}) });
      }
      console.error('[kosmy-board admin]', e);
      return sendJson(res, 500, { error: 'server_error', message: t('err.server') });
    }
  });

  return router;
}
