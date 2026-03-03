import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { PayslipItem } from '@/types/payslip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';

const DESCRIPTION_CHAR_LIMIT = 150;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface PayslipCardProps {
  item: PayslipItem;
  onEdit: (item: PayslipItem) => void;
  onDelete?: (item: PayslipItem) => void;
  isAdmin?: boolean;
}

export function PayslipCard({ item, onEdit, onDelete, isAdmin = false }: PayslipCardProps) {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryTitle = categories.find(c => c.id === item.category)?.title ?? item.category;
  const plainDescription = stripHtml(item.description);
  const shouldTruncate = plainDescription.length > DESCRIPTION_CHAR_LIMIT;
  const displayDescription = shouldTruncate && !isExpanded
    ? plainDescription.slice(0, DESCRIPTION_CHAR_LIMIT) + '...'
    : plainDescription;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    window.location.hash = item.id;
  };

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all duration-200 dark:bg-slate-900 dark:border-slate-800 cursor-pointer hover:scale-[1.02]"
      onClick={handleCardClick}
    >
      <div className="aspect-video w-full overflow-hidden bg-muted relative group">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <ExternalLink className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" />
        </div>
      </div>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2 dark:text-gray-100 hover:text-primary transition-colors">
              {item.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="dark:bg-slate-800 dark:text-gray-300">
                {categoryTitle}
              </Badge>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                title="Modifier"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onDelete?.(item); }}
                title="Supprimer"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed dark:text-gray-400">
          {displayDescription}
        </CardDescription>
        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="mt-2 p-0 h-auto font-normal text-primary hover:text-primary/80 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isExpanded ? (
              <>{t('card.seeLess')} <ChevronUp className="ml-1 h-4 w-4" /></>
            ) : (
              <>{t('card.seeMore')} <ChevronDown className="ml-1 h-4 w-4" /></>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
