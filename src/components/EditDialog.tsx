import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PayslipItem } from '@/types/payslip';
import { Category } from '@/types/category';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategories } from '@/config/apiConfig';

const fallbackCategories: Category[] = [
  { id: 'salaire', title: 'Salaire' },
  { id: 'cotisations', title: 'Cotisations' },
  { id: 'net', title: 'Net' },
  { id: 'employeur', title: 'Employeur' },
  { id: 'autres', title: 'Autres' },
];

interface EditDialogProps {
  item: PayslipItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: PayslipItem) => void;
}

export function EditDialog({ item, open, onOpenChange, onSave }: EditDialogProps) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [editedItem, setEditedItem] = useState<PayslipItem | null>(null);

  useEffect(() => {
    if (open) {
      getCategories()
        .then(data => {
          if (data?.categories && Array.isArray(data.categories)) {
            setCategories(data.categories);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (item) {
      setEditedItem({ ...item });
    }
  }, [item]);

  const handleSave = () => {
    if (editedItem) {
      onSave(editedItem);
      onOpenChange(false);
    }
  };

  if (!editedItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
          <DialogDescription>
            {t('edit.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('edit.field.title')}</Label>
            <Input
              id="title"
              value={editedItem.title}
              onChange={(e) =>
                setEditedItem({ ...editedItem, title: e.target.value })
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">{t('edit.field.category')}</Label>
            <Select
              value={editedItem.category}
              onValueChange={(value) =>
                setEditedItem({
                  ...editedItem,
                  category: value
                })
              }
            >
              <SelectTrigger id="category">
                <SelectValue placeholder={t('edit.field.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">{t('edit.field.imageUrl')}</Label>
            <Input
              id="imageUrl"
              value={editedItem.imageUrl}
              onChange={(e) =>
                setEditedItem({ ...editedItem, imageUrl: e.target.value })
              }
              placeholder={t('edit.field.imageUrlPlaceholder')}
            />
            {editedItem.imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border">
                <img
                  src={editedItem.imageUrl}
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
            <Label>{t('edit.field.description')}</Label>
            <RichTextEditor
              content={editedItem.description}
              onChange={(html) => setEditedItem({ ...editedItem, description: html })}
              placeholder={t('edit.field.description')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('edit.button.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('edit.button.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
