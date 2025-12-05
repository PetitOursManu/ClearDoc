import { PayslipItem } from '@/types/payslip';

// Données de secours en cas d'échec de la connexion au serveur
export const fallbackPayslipItems: PayslipItem[] = [
  {
    id: '1',
    title: 'Salaire de base',
    description: 'Le salaire de base correspond à la rémunération brute mensuelle convenue dans votre contrat de travail, avant toute déduction de cotisations sociales. Il est calculé sur la base de votre temps de travail contractuel.',
    imageUrl: 'https://images.pexels.com/photos/6863332/pexels-photo-6863332.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'salaire',
    keywords: ['salaire', 'base', 'brut', 'rémunération', 'mensuel']
  },
  {
    id: '2',
    title: 'Heures supplémentaires',
    description: 'Les heures supplémentaires sont les heures travaillées au-delà de la durée légale de travail (35h par semaine). Elles sont majorées de 25% pour les 8 premières heures, puis de 50% au-delà.',
    imageUrl: 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'salaire',
    keywords: ['heures', 'supplémentaires', 'majoration', 'overtime']
  },
  {
    id: '3',
    title: 'Primes et gratifications',
    description: 'Les primes peuvent être contractuelles, conventionnelles ou discrétionnaires. Elles incluent les primes d\'ancienneté, de performance, de 13ème mois, ou toute autre gratification prévue par votre contrat ou convention collective.',
    imageUrl: 'https://images.pexels.com/photos/3943716/pexels-photo-3943716.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'salaire',
    keywords: ['prime', 'bonus', 'gratification', '13ème mois', 'ancienneté']
  }
];
