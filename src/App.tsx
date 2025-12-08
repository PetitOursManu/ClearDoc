import { useState, useMemo, useEffect } from 'react';
import { Github, RefreshCw, AlertCircle } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { CategoryFilter } from '@/components/CategoryFilter';
import { PayslipCard } from '@/components/PayslipCard';
import { PayslipDetail } from '@/components/PayslipDetail';
import { EditDialog } from '@/components/EditDialog';
import { AddPayslipDialog } from '@/components/AddPayslipDialog';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePayslipData } from '@/hooks/usePayslipData';
import { PayslipItem } from '@/types/payslip';

function App() {
  const { t } = useLanguage();
  const { data: initialPayslipItems, loading, error, refetch } = usePayslipData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [payslipItems, setPayslipItems] = useState<PayslipItem[]>([]);
  const [editingItem, setEditingItem] = useState<PayslipItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Gérer le hash de l'URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Enlever le #
      if (hash) {
        setSelectedItemId(hash);
      } else {
        setSelectedItemId(null);
      }
    };

    // Vérifier le hash initial
    handleHashChange();

    // Écouter les changements de hash
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Synchroniser automatiquement les données chargées avec l'état local
  useEffect(() => {
    if (initialPayslipItems.length > 0) {
      setPayslipItems(initialPayslipItems);
      console.log('✅ Données mises à jour automatiquement:', initialPayslipItems.length, 'éléments');
    }
  }, [initialPayslipItems]);

  // Trouver l'élément sélectionné
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return payslipItems.find(item => item.id === selectedItemId);
  }, [selectedItemId, payslipItems]);

  const filteredItems = useMemo(() => {
    return payslipItems.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.keywords.some((keyword) =>
          keyword.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesCategory =
        selectedCategory === null || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [payslipItems, searchQuery, selectedCategory]);

  const handleEdit = (item: PayslipItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleSave = (updatedItem: PayslipItem) => {
    setPayslipItems((items) =>
      items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const handleAdd = (newItem: Omit<PayslipItem, 'id'>) => {
    const newId = (Math.max(...payslipItems.map(item => parseInt(item.id))) + 1).toString();
    const itemWithId: PayslipItem = {
      ...newItem,
      id: newId,
    };
    setPayslipItems((items) => [...items, itemWithId]);
    
    console.log('\n=== NOUVELLE DESCRIPTION À AJOUTER ===');
    console.log('Copiez cet objet dans votre fichier JSON :');
    console.log('\n{');
    console.log(`  "id": "${newId}",`);
    console.log(`  "title": "${newItem.title}",`);
    console.log(`  "description": "${newItem.description}",`);
    console.log(`  "imageUrl": "${newItem.imageUrl}",`);
    console.log(`  "category": "${newItem.category}",`);
    console.log(`  "keywords": ${JSON.stringify(newItem.keywords)}`);
    console.log('},');
    console.log('\n=====================================\n');
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleBack = () => {
    window.location.hash = '';
  };

  const resultsCount = filteredItems.length;
  const resultsText = resultsCount > 1 ? t('results.count_plural') : t('results.count');

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des données...</p>
        </div>
      </div>
    );
  }

  // Si un élément est sélectionné, afficher la vue détaillée
  if (selectedItem) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex flex-col min-h-screen w-full max-w-[1400px] mx-auto">
          {/* Header */}
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
                    <p className="text-sm text-muted-foreground">
                      {t('header.subtitle')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <LanguageToggle />
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
          </header>

          {/* Detail View */}
          <main className="flex-1 w-full">
            <PayslipDetail item={selectedItem} onBack={handleBack} />
          </main>

          {/* Footer */}
          <footer className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 mt-20">
            <div className="px-4 py-8 max-w-7xl mx-auto">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">
                  {t('footer.copyright')}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="flex flex-col min-h-screen w-full max-w-[1400px] mx-auto">
        {/* Header */}
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
                  <p className="text-sm text-muted-foreground">
                    {t('header.subtitle')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  title="Rafraîchir les données"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <ThemeToggle />
                <LanguageToggle />
                <AddPayslipDialog onAdd={handleAdd} />
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
        </header>

        {/* Error Banner */}
        {error && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
            <div className="flex items-center max-w-7xl mx-auto">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {error} - Utilisation des données en cache
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 w-full">
          <div className="px-4 py-12 max-w-7xl mx-auto">
            {/* Search Section */}
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
              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>

            {/* Results */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {resultsCount} {resultsText}
                </h3>
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
                    <p className="text-muted-foreground">
                      {t('results.none.description')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredItems.map((item) => (
                    <PayslipCard key={item.id} item={item} onEdit={handleEdit} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 mt-20">
          <div className="px-4 py-8 max-w-7xl mx-auto">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">
                {t('footer.copyright')}
              </p>
            </div>
          </div>
        </footer>

        {/* Edit Dialog */}
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
