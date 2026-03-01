import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, AlertCircle, Plus, LogOut, Shield, Image, Map } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { SearchBar } from '@/components/SearchBar';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PayslipCard } from '@/components/PayslipCard';
import { PayslipDetail } from '@/components/PayslipDetail';
import { EditDialog } from '@/components/EditDialog';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePayslipData } from '@/hooks/usePayslipData';
import { useCategories } from '@/hooks/useCategories';
import { PayslipItem } from '@/types/payslip';
import { createDocument, updateDocument, deleteDocument } from '@/config/apiConfig';

const EMPTY_ITEM: PayslipItem = {
  id: '',
  title: '',
  description: '',
  imageUrl: '',
  category: 'autres',
  keywords: [],
};

function App() {
  const { t } = useLanguage();
  const { isAdmin, username, logout } = useAuth();
  const navigate = useNavigate();
  const { data: initialPayslipItems, loading: dataLoading, error: dataError } = usePayslipData();
  const { error: categoriesError } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [payslipItems, setPayslipItems] = useState<PayslipItem[]>([]);
  const [editingItem, setEditingItem] = useState<PayslipItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const hasError = dataError || categoriesError;
  const errorMessage = () => {
    if (dataError && categoriesError) return 'Impossible de récupérer les données et les catégories - Utilisation des données de secours';
    if (dataError) return 'Impossible de récupérer les données - Utilisation des données de secours';
    if (categoriesError) return 'Impossible de récupérer les catégories - Utilisation des catégories par défaut';
    return '';
  };

  // Gestion du hash de l'URL pour la vue détaillée
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setSelectedItemId(hash || null);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Synchronisation des données chargées
  useEffect(() => {
    if (initialPayslipItems.length > 0) {
      setPayslipItems(initialPayslipItems);
    }
  }, [initialPayslipItems]);

  const selectedItem = useMemo(
    () => payslipItems.find(item => item.id === selectedItemId) ?? null,
    [selectedItemId, payslipItems]
  );

  const filteredItems = useMemo(() => {
    return payslipItems.filter(item => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === null || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [payslipItems, searchQuery, selectedCategory]);

  // ============ Handlers admin ============

  const handleEdit = (item: PayslipItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingItem({ ...EMPTY_ITEM });
    setDialogOpen(true);
  };

  const handleSave = async (updatedItem: PayslipItem) => {
    if (isAdmin) {
      try {
        if (!editingItem?.id) {
          // Création
          const newItem = { ...updatedItem, id: uuidv4() };
          await createDocument(newItem);
          setPayslipItems(items => [newItem, ...items]);
        } else {
          // Mise à jour
          await updateDocument(editingItem.id, updatedItem);
          setPayslipItems(items => items.map(i => i.id === updatedItem.id ? updatedItem : i));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        if (msg.includes('401') || msg.includes('authentifi') || msg.includes('expiré')) {
          navigate('/admin/login');
        }
      }
    } else {
      setPayslipItems(items => items.map(i => i.id === updatedItem.id ? updatedItem : i));
    }
  };

  const handleDelete = async (item: PayslipItem) => {
    if (!isAdmin) return;
    if (!window.confirm(`Supprimer "${item.title}" ? Cette action est irréversible.`)) return;

    try {
      await deleteDocument(item.id);
      setPayslipItems(items => items.filter(i => i.id !== item.id));
      if (selectedItemId === item.id) window.location.hash = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (msg.includes('401') || msg.includes('authentifi') || msg.includes('expiré')) {
        navigate('/admin/login');
      }
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleBack = () => {
    window.location.hash = '';
  };

  const resultsCount = filteredItems.length;
  const resultsText = resultsCount > 1 ? t('results.count_plural') : t('results.count');

  if (dataLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des données...</p>
        </div>
      </div>
    );
  }

  // ============ Header commun ============

  const headerContent = (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-800 sticky top-0 z-10 shadow-sm">
      <div className="px-4 py-6 w-full">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <img
                src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png"
                alt="ClearDoc Logo"
                className="h-6 w-6 object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('header.title')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('header.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/fiche-de-paie')}
              title="Fiche de paie interactive"
              className="text-muted-foreground hover:text-foreground gap-1"
            >
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Fiche interactive</span>
            </Button>
            <ThemeToggle />
            <LanguageToggle />
            {isAdmin ? (
              <>
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                  <Shield className="h-3 w-3" />
                  {username}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/admin/payslip-map')}
                  title="Gérer la fiche de paie interactive"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Map className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout} title="Déconnexion">
                  <LogOut className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/login')}
                title="Accès administrateur"
                className="text-muted-foreground hover:text-foreground"
              >
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <a
              href="https://github.com/PetitOursManu/ClearDoc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Github className="h-6 w-6" />
            </a>
          </div>
        </div>
      </div>

      {hasError && (
        <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="px-4 py-3 max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{errorMessage()}</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );

  // ============ Vue détaillée ============

  if (selectedItem) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex flex-col min-h-screen w-full max-w-[1400px] mx-auto">
          {headerContent}
          <main className="flex-1 w-full">
            <PayslipDetail item={selectedItem} onBack={handleBack} />
          </main>
          <footer className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 mt-20">
            <div className="px-4 py-8 max-w-7xl mx-auto text-center text-muted-foreground">
              <p className="text-sm">{t('footer.copyright')}</p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  // ============ Vue liste ============

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="flex flex-col min-h-screen w-full max-w-[1400px] mx-auto">
        {headerContent}

        <main className="flex-1 w-full">
          <div className="px-4 py-12 max-w-7xl mx-auto">
            <div className="mb-12 space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {t('search.title')}
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {t('search.description')}
                </p>
              </div>
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <CategoryFilter selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} isAdmin={isAdmin} />
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {resultsCount} {resultsText}
                </h3>
                {isAdmin && (
                  <Button onClick={handleAdd} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Ajouter une entrée
                  </Button>
                )}
              </div>

              {filteredItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-8 max-w-md mx-auto shadow-sm">
                    <img
                      src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png"
                      alt="ClearDoc Logo"
                      className="h-16 w-16 mx-auto mb-4 opacity-50 object-contain"
                    />
                    <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">{t('results.none.title')}</h3>
                    <p className="text-muted-foreground">{t('results.none.description')}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredItems.map(item => (
                    <PayslipCard
                      key={item.id}
                      item={item}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 mt-20">
          <div className="px-4 py-8 max-w-7xl mx-auto text-center text-muted-foreground">
            <p className="text-sm">{t('footer.copyright')}</p>
          </div>
        </footer>

        <EditDialog
          item={editingItem}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

export default App;
