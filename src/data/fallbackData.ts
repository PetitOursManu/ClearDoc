import { PayslipItem } from '@/types/payslip';

export const fallbackPayslipItems: PayslipItem[] = [
  {
    id: 'salaire-base',
    title: 'Salaire de base',
    description: 'Le salaire de base est la rémunération fixe convenue entre l\'employeur et le salarié. Il est défini dans le contrat de travail et correspond au temps de travail effectué. Ce montant est calculé sur une base mensuelle pour un temps plein (généralement 35h/semaine ou 151,67h/mois). Il ne comprend pas les primes, heures supplémentaires ou autres avantages.',
    imageUrl: 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'salaire',
    keywords: ['rémunération', 'fixe', 'mensuel', 'contrat', 'brut']
  },
  {
    id: 'cotisation-retraite',
    title: 'Cotisation retraite',
    description: 'Les cotisations retraite financent le système de retraite par répartition. Elles se divisent en deux parts : la retraite de base (Sécurité sociale) et la retraite complémentaire (AGIRC-ARRCO). Le taux varie selon le statut et le salaire. Ces cotisations ouvrent des droits à la retraite future et sont obligatoires pour tous les salariés du secteur privé.',
    imageUrl: 'https://images.pexels.com/photos/3823488/pexels-photo-3823488.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'cotisations',
    keywords: ['retraite', 'AGIRC-ARRCO', 'vieillesse', 'pension', 'trimestres']
  },
  {
    id: 'net-payer',
    title: 'Net à payer',
    description: 'Le net à payer est le montant final versé sur votre compte bancaire. Il correspond au salaire brut moins toutes les cotisations sociales salariales et l\'impôt sur le revenu prélevé à la source. C\'est le montant réellement perçu par le salarié chaque mois. Il peut inclure les remboursements de frais professionnels non imposables.',
    imageUrl: 'https://images.pexels.com/photos/4386370/pexels-photo-4386370.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'net',
    keywords: ['virement', 'salaire net', 'revenus', 'paye', 'compte bancaire']
  },
  {
    id: 'cotisation-chomage',
    title: 'Cotisation chômage',
    description: 'La cotisation chômage finance l\'assurance chômage gérée par Pôle Emploi. Elle permet d\'indemniser les salariés en cas de perte involontaire d\'emploi. Depuis 2019, seule la part patronale subsiste (4,05% du salaire brut). Cette cotisation ouvre des droits à l\'allocation chômage (ARE) en cas de licenciement ou fin de contrat.',
    imageUrl: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'employeur',
    keywords: ['assurance chômage', 'Pôle Emploi', 'ARE', 'indemnisation', 'patronal']
  },
  {
    id: 'prime-anciennete',
    title: 'Prime d\'ancienneté',
    description: 'La prime d\'ancienneté récompense la fidélité du salarié à l\'entreprise. Son montant augmente généralement avec les années de service (souvent 3% après 3 ans, jusqu\'à 15% après 15 ans). Elle peut être prévue par la convention collective ou le contrat de travail. Cette prime est soumise aux cotisations sociales et à l\'impôt sur le revenu.',
    imageUrl: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'salaire',
    keywords: ['ancienneté', 'fidélité', 'années service', 'convention collective', 'prime']
  },
  {
    id: 'mutuelle-entreprise',
    title: 'Mutuelle entreprise',
    description: 'La mutuelle d\'entreprise est une complémentaire santé obligatoire depuis 2016. L\'employeur prend en charge au minimum 50% de la cotisation. Elle complète les remboursements de la Sécurité sociale pour les frais de santé (consultations, médicaments, hospitalisation, optique, dentaire). Le montant varie selon les garanties choisies.',
    imageUrl: 'https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'cotisations',
    keywords: ['santé', 'complémentaire', 'remboursement', 'prévoyance', 'garanties']
  },
  {
    id: 'heures-supplementaires',
    title: 'Heures supplémentaires',
    description: 'Les heures supplémentaires sont les heures travaillées au-delà de 35h/semaine. Elles sont majorées : +25% pour les 8 premières heures (36e à 43e), +50% au-delà. Depuis 2019, elles bénéficient d\'une exonération d\'impôt sur le revenu (dans la limite de 5000€/an) et d\'une réduction de cotisations salariales.',
    imageUrl: 'https://images.pexels.com/photos/4458554/pexels-photo-4458554.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'salaire',
    keywords: ['heures sup', 'majoration', 'défiscalisation', '35 heures', 'temps de travail']
  },
  {
    id: 'csg-crds',
    title: 'CSG et CRDS',
    description: 'La CSG (Contribution Sociale Généralisée) et la CRDS (Contribution au Remboursement de la Dette Sociale) sont des prélèvements sociaux. La CSG finance la protection sociale (9,2% sur 98,25% du salaire brut). La CRDS contribue au remboursement de la dette sociale (0,5%). Une partie de la CSG (6,8%) est déductible de l\'impôt sur le revenu.',
    imageUrl: 'https://images.pexels.com/photos/4386339/pexels-photo-4386339.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'cotisations',
    keywords: ['CSG', 'CRDS', 'prélèvements sociaux', 'déductible', 'protection sociale']
  },
  {
    id: 'net-imposable',
    title: 'Net imposable',
    description: 'Le net imposable est la base de calcul de l\'impôt sur le revenu. Il comprend le salaire net plus la CSG/CRDS non déductibles et la part patronale de la mutuelle. C\'est ce montant qui apparaît sur votre déclaration de revenus pré-remplie. Il est généralement supérieur au net à payer d\'environ 2 à 3%.',
    imageUrl: 'https://images.pexels.com/photos/4386476/pexels-photo-4386476.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'net',
    keywords: ['impôt', 'déclaration', 'fiscal', 'revenus', 'prélèvement source']
  },
  {
    id: 'cotisations-patronales',
    title: 'Cotisations patronales',
    description: 'Les cotisations patronales sont payées par l\'employeur en plus du salaire brut. Elles représentent environ 42% du salaire brut et financent la protection sociale. Elles incluent : assurance maladie, allocations familiales, accidents du travail, retraite complémentaire, chômage, formation professionnelle. Elles constituent le coût réel du travail pour l\'entreprise.',
    imageUrl: 'https://images.pexels.com/photos/3760089/pexels-photo-3760089.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'employeur',
    keywords: ['charges patronales', 'employeur', 'coût du travail', 'protection sociale', 'entreprise']
  },
  {
    id: 'tickets-restaurant',
    title: 'Tickets restaurant',
    description: 'Les tickets restaurant sont un avantage social pour financer les repas. L\'employeur prend en charge 50 à 60% de leur valeur (exonéré de charges dans la limite de 6,50€/ticket en 2024). La part salariale est déduite du net à payer. Ils sont utilisables dans les restaurants et commerces alimentaires, avec une limite de 25€/jour.',
    imageUrl: 'https://images.pexels.com/photos/4393665/pexels-photo-4393665.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'autres',
    keywords: ['titre restaurant', 'avantage', 'repas', 'carte déjeuner', 'restauration']
  },
  {
    id: 'conges-payes',
    title: 'Congés payés',
    description: 'Les congés payés sont acquis à raison de 2,5 jours ouvrables par mois travaillé, soit 30 jours (5 semaines) par an. Ils apparaissent sur la fiche de paie lors de leur prise. L\'indemnité de congés payés maintient la rémunération habituelle. Le solde de congés restants est indiqué sur le bulletin.',
    imageUrl: 'https://images.pexels.com/photos/4427622/pexels-photo-4427622.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'autres',
    keywords: ['vacances', 'CP', 'jours de repos', 'indemnité', 'solde congés']
  }
];
