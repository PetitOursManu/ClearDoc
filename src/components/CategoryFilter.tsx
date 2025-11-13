import { Badge } from '@/components/ui/badge';

interface CategoryFilterProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

const categories = [
  { value: null, label: 'Tout', color: 'default' },
  { value: 'salaire', label: 'Salaire', color: 'default' },
  { value: 'cotisations', label: 'Cotisations', color: 'default' },
  { value: 'net', label: 'Net à payer', color: 'default' },
  { value: 'employeur', label: 'Employeur', color: 'default' },
  { value: 'autres', label: 'Autres', color: 'default' },
] as const;

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {categories.map((category) => (
        <Badge
          key={category.label}
          variant={selectedCategory === category.value ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
          onClick={() => onSelectCategory(category.value)}
        >
          {category.label}
        </Badge>
      ))}
    </div>
  );
}
