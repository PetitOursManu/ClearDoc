import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { PayslipItem } from '@/types/payslip';
import { useLanguage } from '@/contexts/LanguageContext';

interface PayslipDetailProps {
  item: PayslipItem;
  onBack: () => void;
}

export function PayslipDetail({ item, onBack }: PayslipDetailProps) {
  const { t } = useLanguage();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-6 -ml-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('card.back') || 'Retour'}
      </Button>

      <Card className="overflow-hidden">
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
        
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-3xl mb-3">{item.title}</CardTitle>
              <Badge variant="secondary" className="text-sm">
                {item.category}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              <span className="text-sm">ID: {item.id}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Description</h3>
              <CardDescription className="text-base leading-relaxed whitespace-pre-wrap">
                {item.description}
              </CardDescription>
            </div>

            {item.keywords.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Mots-clés</h3>
                <div className="flex flex-wrap gap-2">
                  {item.keywords.map((keyword, index) => (
                    <Badge key={index} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Lien direct : 
                <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                  {window.location.origin}#{item.id}
                </code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
