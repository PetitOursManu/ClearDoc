export interface PayslipItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: 'salaire' | 'cotisations' | 'net' | 'employeur' | 'autres';
  keywords: string[];
}
