import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { PayslipItem } from '@/types/payslip';
import { useLanguage } from '@/contexts/LanguageContext';

const SHOW_EDIT_BUTTON = false;
const DESCRIPTION_CHAR_LIMIT = 150;

interface PayslipCardProps {
  item: PayslipItem;
  onEdit: (item: PayslipItem) => void;
}

export function PayslipCard({ item, onEdit }: PayslipCardProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = item.description.length > DESCRIPTION_CHAR_LIMIT;
  const displayDescription = shouldTruncate && !isExpanded
    ? item.description.slice(0, DESCRIPTION_CHAR_LIMIT) + '...'
    : item.description;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow dark:bg-slate-900 dark:border-slate-800">
      <div className="aspect-video w-full overflow-hidden bg-muted">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2 dark:text-gray-100">{item.title}</CardTitle>
            <Badge variant="secondary" className="dark:bg-slate-800 dark:text-gray-300">
              {item.category}
            </Badge>
          </div>
          {SHOW_EDIT_BUTTON && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(item)}
              className="shrink-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
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
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 p-0 h-auto font-normal text-primary hover:text-primary/80 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isExpanded ? (
              <>
                {t('card.seeLess')} <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                {t('card.seeMore')} <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
