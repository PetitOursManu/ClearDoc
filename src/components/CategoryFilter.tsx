import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { Loader2 } from 'lucide-react';

interface CategoryFilterProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  const { t } = useLanguage();
  const { categories, loading } = useCategories();
  
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {/* Bouton "Toutes" */}
      <Badge
        variant={selectedCategory === null ? 'default' : 'outline'}
        className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
        onClick={() => onSelectCategory(null)}
      >
        {t('categories.all')}
      </Badge>
      
      {/* Catégories dynamiques */}
      {categories.map((category) => (
        <Badge
          key={category.id}
          variant={selectedCategory === category.id ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
          onClick={() => onSelectCategory(category.id)}
        >
          {category.title}
        </Badge>
      ))}
    </div>
  );
}
