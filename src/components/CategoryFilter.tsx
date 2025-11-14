import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface CategoryFilterProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

const categories = [
  { value: null, key: 'category.all' },
  { value: 'salaire', key: 'category.salaire' },
  { value: 'cotisations', key: 'category.cotisations' },
  { value: 'net', key: 'category.net' },
  { value: 'employeur', key: 'category.employeur' },
  { value: 'autres', key: 'category.autres' },
] as const;

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  const { t } = useLanguage();
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {categories.map((category) => (
        <Badge
          key={category.key}
          variant={selectedCategory === category.value ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
          onClick={() => onSelectCategory(category.value)}
        >
          {t(category.key)}
        </Badge>
      ))}
    </div>
  );
}
