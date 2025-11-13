import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

interface AddPayslipDialogProps {
  onAdd: (item: Omit<PayslipItem, 'id'>) => void;
}

const categoryLabels: Record<string, string> = {
  salaire: 'Salaire',
  cotisations: 'Cotisations',
  net: 'Net à payer',
  employeur: 'Employeur',
  autres: 'Autres',
};

// ============================================
// CONFIGURATION : Affichage du bouton d'ajout
// ============================================
// Pour CACHER le bouton d'ajout, changez cette valeur à false
// Pour AFFICHER le bouton d'ajout, changez cette valeur à true
export const SHOW_ADD_BUTTON = true;
// ============================================

export function AddPayslipDialog({ onAdd }: AddPayslipDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState<PayslipItem['category']>('autres');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim() || !imageUrl.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Générer des mots-clés basiques à partir du titre
    const keywords = title.toLowerCase().split(' ').filter(word => word.length > 2);

    onAdd({
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      category,
      keywords,
    });

    // Réinitialiser le formulaire
    setTitle('');
    setDescription('');
    setImageUrl('');
    setCategory('autres');
    setOpen(false);
  };

  if (!SHOW_ADD_BUTTON) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 shadow-lg">
          <Plus className="h-5 w-5" />
          Ajouter une description
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter une nouvelle description</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer une nouvelle description de ligne de paie.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">
                Titre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Indemnité de transport"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">
                Catégorie <span className="text-red-500">*</span>
              </Label>
              <Select value={category} onValueChange={(value: PayslipItem['category']) => setCategory(value)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imageUrl">
                URL de l'image <span className="text-red-500">*</span>
              </Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.pexels.com/photos/..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Utilisez une image de Pexels (800x600 recommandé)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez en détail cette ligne de paie..."
                rows={5}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Ajouter</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
