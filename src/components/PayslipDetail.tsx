import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Info, Pencil } from 'lucide-react';
import { PayslipItem } from '@/types/payslip';
import { useLanguage } from '@/contexts/LanguageContext';

interface PayslipDetailProps {
  item: PayslipItem;
  onBack: () => void;
  isAdmin?: boolean;
  onEdit?: (item: PayslipItem) => void;
}

export function PayslipDetail({ item, onBack, isAdmin, onEdit }: PayslipDetailProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Button variant="ghost" onClick={onBack} className="-ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {language === 'fr' ? 'Retour à la liste' : 'Back to list'}
        </Button>
        {isAdmin && onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(item)} className="gap-2">
            <Pencil className="h-4 w-4" />
            {language === 'fr' ? 'Modifier' : 'Edit'}
          </Button>
        )}
      </div>

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
            {/* Mention légale affichée sur toutes les fiches, au-dessus de la vidéo */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                {language === 'fr' ? (
                  <>
                    Tous les chiffres présentés dans les vidéos et les descriptions sont donnés à
                    titre d'exemple, d'après la fiche de paie type disponible dans la section{' '}
                    <button
                      onClick={() => navigate('/fiche-de-paie')}
                      className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      Fiche de paie interactive
                    </button>.
                  </>
                ) : (
                  <>
                    All figures shown in the videos and descriptions are provided as examples, based
                    on the sample payslip available in the{' '}
                    <button
                      onClick={() => navigate('/fiche-de-paie')}
                      className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      Interactive payslip
                    </button>{' '}section.
                  </>
                )}
              </p>
            </div>

            {item.videoUrl && (
              <div className="rounded-xl overflow-hidden">
                <video controls width="100%" className="rounded-xl w-full">
                  <source src={item.videoUrl} type="video/mp4" />
                </video>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-3">Description</h3>
              <div
                className="rich-content text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: item.description }}
              />
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
