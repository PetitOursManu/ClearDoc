import { useState } from 'react';
import { Plus, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PayslipItem } from '@/types/payslip';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddPayslipDialogProps {
  onAdd: (item: Omit<PayslipItem, 'id'>) => void;
}

const categories = [
  { value: 'salaire', key: 'category.salaire' },
  { value: 'cotisations', key: 'category.cotisations' },
  { value: 'net', key: 'category.net' },
  { value: 'employeur', key: 'category.employeur' },
  { value: 'autres', key: 'category.autres' },
];

// ============================================
// CONFIGURATION : Affichage du bouton d'ajout
// ============================================
// Pour CACHER le bouton d'ajout, changez cette valeur à false
// Pour AFFICHER le bouton d'ajout, changez cette valeur à true
export const SHOW_ADD_BUTTON = true;
// ============================================

export function AddPayslipDialog({ onAdd }: AddPayslipDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copiedJS, setCopiedJS] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [generatedObject, setGeneratedObject] = useState<string>('');
  const [generatedJSON, setGeneratedJSON] = useState<string>('');
  const [newItem, setNewItem] = useState<Omit<PayslipItem, 'id'>>({
    title: '',
    description: '',
    imageUrl: '',
    category: 'salaire',
    keywords: [],
  });

  const generateObjectString = (item: Omit<PayslipItem, 'id'>) => {
    const id = `item_${Date.now()}`;
    const objectWithId = {
      id,
      ...item,
      keywords: item.title.toLowerCase().split(' ')
    };
    
    const objectString = `{
  id: '${objectWithId.id}',
  title: '${objectWithId.title}',
  description: \`${objectWithId.description}\`,
  imageUrl: '${objectWithId.imageUrl}',
  category: '${objectWithId.category}',
  keywords: [${objectWithId.keywords.map(k => `'${k}'`).join(', ')}],
}`;
    
    return objectString;
  };

  const generateJSONString = (item: Omit<PayslipItem, 'id'>) => {
    const id = `item_${Date.now()}`;
    const objectWithId = {
      id,
      ...item,
      keywords: item.title.toLowerCase().split(' ')
    };
    
    return JSON.stringify(objectWithId, null, 2);
  };

  const handleCopyJSToClipboard = () => {
    navigator.clipboard.writeText(generatedObject);
    setCopiedJS(true);
    setTimeout(() => setCopiedJS(false), 2000);
  };

  const handleCopyJSONToClipboard = () => {
    navigator.clipboard.writeText(generatedJSON);
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  const handleAdd = () => {
    if (newItem.title && newItem.description) {
      // Generate both object strings
      const objectString = generateObjectString(newItem);
      const jsonString = generateJSONString(newItem);
      setGeneratedObject(objectString);
      setGeneratedJSON(jsonString);
      
      // Log to console (keeping existing functionality)
      console.log('=== NOUVEL ÉLÉMENT AJOUTÉ ===');
      console.log('Copiez cet objet dans votre tableau payslipData :');
      console.log(objectString);
      console.log('Format JSON :');
      console.log(jsonString);
      console.log('=============================');
      
      // Add the item
      onAdd({
        ...newItem,
        keywords: newItem.title.toLowerCase().split(' ')
      });
      
      // Don't reset or close - keep dialog open to show generated code
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset when closing
    setNewItem({
      title: '',
      description: '',
      imageUrl: '',
      category: 'salaire',
      keywords: [],
    });
    setGeneratedObject('');
    setGeneratedJSON('');
    setCopiedJS(false);
    setCopiedJSON(false);
  };

  if (!SHOW_ADD_BUTTON) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t('add.button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
          <DialogDescription>
            {t('add.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-title">{t('edit.field.title')}</Label>
            <Input
              id="new-title"
              value={newItem.title}
              onChange={(e) =>
                setNewItem({ ...newItem, title: e.target.value })
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-category">{t('edit.field.category')}</Label>
            <Select
              value={newItem.category}
              onValueChange={(value) =>
                setNewItem({ 
                  ...newItem, 
                  category: value as PayslipItem['category']
                })
              }
            >
              <SelectTrigger id="new-category">
                <SelectValue placeholder={t('edit.field.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {t(cat.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-imageUrl">{t('edit.field.imageUrl')}</Label>
            <Input
              id="new-imageUrl"
              value={newItem.imageUrl}
              onChange={(e) =>
                setNewItem({ ...newItem, imageUrl: e.target.value })
              }
              placeholder={t('edit.field.imageUrlPlaceholder')}
            />
            {newItem.imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border">
                <img
                  src={newItem.imageUrl}
                  alt={t('edit.field.imagePreview')}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.pexels.com/photos/6863332/pexels-photo-6863332.jpeg?auto=compress&cs=tinysrgb&w=800';
                  }}
                />
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-description">{t('edit.field.description')}</Label>
            <Textarea
              id="new-description"
              value={newItem.description}
              onChange={(e) =>
                setNewItem({ ...newItem, description: e.target.value })
              }
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Generated JavaScript Object Display */}
          {generatedObject && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('add.generatedCode')} - JavaScript</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJSToClipboard}
                  className="gap-2"
                >
                  {copiedJS ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t('add.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {t('add.copyCode')}
                    </>
                  )}
                </Button>
              </div>
              <div className="relative">
                <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{generatedObject}</code>
                </pre>
                <div className="absolute top-2 right-2 text-xs text-slate-400">
                  JavaScript
                </div>
              </div>
            </div>
          )}

          {/* Generated JSON Display */}
          {generatedJSON && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('add.generatedCode')} - JSON</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJSONToClipboard}
                  className="gap-2"
                >
                  {copiedJSON ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t('add.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {t('add.copyCode')}
                    </>
                  )}
                </Button>
              </div>
              <div className="relative">
                <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{generatedJSON}</code>
                </pre>
                <div className="absolute top-2 right-2 text-xs text-slate-400">
                  JSON
                </div>
              </div>
            </div>
          )}

          {(generatedObject || generatedJSON) && (
            <p className="text-sm text-muted-foreground">
              {t('add.codeInstruction')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {generatedObject ? t('add.close') : t('edit.button.cancel')}
          </Button>
          {!generatedObject && (
            <Button onClick={handleAdd}>{t('add.button.add')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
