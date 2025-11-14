import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PayslipItem } from '@/types/payslip';
import { Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PayslipCardProps {
  item: PayslipItem;
  onEdit: (item: PayslipItem) => void;
}

const categoryColors: Record<string, string> = {
  salaire: 'bg-blue-500',
  cotisations: 'bg-purple-500',
  net: 'bg-green-500',
  employeur: 'bg-orange-500',
  autres: 'bg-gray-500',
};

// ============================================
// CONFIGURATION : Affichage du bouton d'édition
// ============================================
// Pour CACHER le bouton d'édition, changez cette valeur à false
// Pour AFFICHER le bouton d'édition, changez cette valeur à true
const SHOW_EDIT_BUTTON = true;
// ============================================

// ============================================
// CONFIGURATION : Limite de caractères pour "Voir plus"
// ============================================
// Nombre de caractères avant de tronquer la description
const DESCRIPTION_CHAR_LIMIT = 150;
// ============================================

export function PayslipCard({ item, onEdit }: PayslipCardProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = item.description.length > DESCRIPTION_CHAR_LIMIT;
  
  const displayedDescription = shouldTruncate && !isExpanded
    ? item.description.slice(0, DESCRIPTION_CHAR_LIMIT) + '...'
    : item.description;

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col">
      <div className="relative h-48 overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {SHOW_EDIT_BUTTON && (
          <div className="absolute top-3 right-3">
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onEdit(item)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="absolute bottom-3 left-3">
          <Badge className={`${categoryColors[item.category]} text-white`}>
            {t(`category.${item.category}`)}
          </Badge>
        </div>
      </div>
      <CardHeader>
        <CardTitle className="text-xl">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <CardDescription className="text-sm leading-relaxed flex-1">
          {displayedDescription}
        </CardDescription>
        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-primary hover:text-primary/80 hover:bg-primary/5"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                {t('card.seeLess')}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                {t('card.seeMore')}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
