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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PayslipItem } from '@/types/payslip';

interface EditDialogProps {
  item: PayslipItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: PayslipItem) => void;
}

const categories = [
  { value: 'salaire', label: 'Salaire' },
  { value: 'cotisations', label: 'Cotisations' },
  { value: 'net', label: 'Net' },
  { value: 'employeur', label: 'Employeur' },
  { value: 'autres', label: 'Autres' },
];

export function EditDialog({ item, open, onOpenChange, onSave }: EditDialogProps) {
  const [editedItem, setEditedItem] = useState<PayslipItem | null>(null);

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
          <DialogTitle>Modifier l'élément</DialogTitle>
          <DialogDescription>
            Modifiez le titre, la catégorie, l'URL de l'image et la description de cet élément de fiche de paie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={editedItem.title}
              onChange={(e) =>
                setEditedItem({ ...editedItem, title: e.target.value })
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie</Label>
            <Select
              value={editedItem.category}
              onValueChange={(value) =>
                setEditedItem({ 
                  ...editedItem, 
                  category: value as PayslipItem['category']
                })
              }
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">URL de l'image</Label>
            <Input
              id="imageUrl"
              value={editedItem.imageUrl}
              onChange={(e) =>
                setEditedItem({ ...editedItem, imageUrl: e.target.value })
              }
              placeholder="https://example.com/image.jpg"
            />
            {editedItem.imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border">
                <img
                  src={editedItem.imageUrl}
                  alt="Aperçu"
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={editedItem.description}
              onChange={(e) =>
                setEditedItem({ ...editedItem, description: e.target.value })
              }
              rows={6}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
