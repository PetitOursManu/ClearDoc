import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { requestCache } from '@/services/requestCache';
import { createCategory, deleteCategory, renameCategory } from '@/config/apiConfig';
import { Category } from '@/types/category';
import { Loader2, Plus, Pencil, X, Check, AlertCircle } from 'lucide-react';

interface CategoryFilterProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  isAdmin?: boolean;
}

export function CategoryFilter({ selectedCategory, onSelectCategory, isAdmin }: CategoryFilterProps) {
  const { t } = useLanguage();
  const { categories: hookCategories, loading } = useCategories();

  const [localCategories, setLocalCategories] = useState<Category[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync local state with hook data (respects global refresh)
  useEffect(() => {
    if (hookCategories.length > 0) {
      setLocalCategories(hookCategories);
    }
  }, [hookCategories]);

  const displayCategories = localCategories ?? hookCategories;
  const deletingCategory = displayCategories.find(c => c.id === deletingId);

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingTitle(category.title);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = await renameCategory(editingId, editingTitle.trim());
      setLocalCategories(displayCategories.map(c =>
        c.id === editingId ? { ...c, title: data.title } : c
      ));
      requestCache.invalidate('categories');
      setEditingId(null);
      setEditingTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du renommage');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingId) return;
    setSaving(true);
    setError(null);
    try {
      await deleteCategory(deletingId);
      setLocalCategories(displayCategories.filter(c => c.id !== deletingId));
      requestCache.invalidate('categories');
      if (selectedCategory === deletingId) onSelectCategory(null);
      setDeletingId(null);
    } catch (err) {
      setDeletingId(null);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = await createCategory(newTitle.trim());
      setLocalCategories([...displayCategories, { id: data.id, title: data.title }]);
      requestCache.invalidate('categories');
      setAddingNew(false);
      setNewTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 justify-center items-center">
        {/* Bouton "Toutes" */}
        <Badge
          variant={selectedCategory === null ? 'default' : 'outline'}
          className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
          onClick={() => onSelectCategory(null)}
        >
          {t('category.all')}
        </Badge>

        {/* Catégories dynamiques */}
        {displayCategories.map((category) => (
          <div key={category.id} className="flex items-center gap-1">
            {editingId === category.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  className="h-8 px-2 py-1 text-sm w-36"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  disabled={saving}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <Badge
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
                  onClick={() => onSelectCategory(category.id)}
                >
                  {category.title}
                </Badge>
                {isAdmin && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(category)}
                      title={`Renommer "${category.title}"`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => { setDeletingId(category.id); setError(null); }}
                      title={`Supprimer "${category.title}"`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        ))}

        {/* Ajouter une catégorie */}
        {isAdmin && !addingNew && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-3 text-sm"
            onClick={() => { setAddingNew(true); setError(null); }}
          >
            <Plus className="h-3 w-3" />
            Nouvelle
          </Button>
        )}
        {isAdmin && addingNew && (
          <div className="flex items-center gap-1">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Nom de la catégorie"
              className="h-8 px-2 py-1 text-sm w-44"
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateCategory();
                if (e.key === 'Escape') { setAddingNew(false); setNewTitle(''); }
              }}
              autoFocus
              disabled={saving}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleCreateCategory}
              disabled={saving || !newTitle.trim()}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => { setAddingNew(false); setNewTitle(''); }}
              disabled={saving}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:opacity-70">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Modale de confirmation de suppression */}
      <Dialog open={!!deletingId} onOpenChange={open => { if (!open) setDeletingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la catégorie</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la catégorie{' '}
              <span className="font-semibold text-foreground">«&nbsp;{deletingCategory?.title}&nbsp;»</span> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={saving}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
