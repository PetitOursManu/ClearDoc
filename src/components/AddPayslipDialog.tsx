import { useState } from 'react';
import { Plus } from 'lucide-react';
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
  const [newItem, setNewItem] = useState<Omit<PayslipItem, 'id'>>({
    title: '',
    description: '',
    imageUrl: '',
    category: 'salaire',
    keywords: [],
  });

  const handleAdd = () => {
    if (newItem.title && newItem.description) {
      onAdd(newItem);
      setNewItem({
        title: '',
        description: '',
        imageUrl: '',
        category: 'salaire',
        keywords: [],
      });
      setOpen(false);
    }
  };

  if (!SHOW_ADD_BUTTON) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t('add.button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('edit.button.cancel')}
          </Button>
          <Button onClick={handleAdd}>{t('add.button.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
