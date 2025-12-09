import { useState, useEffect } from 'react';
import { PayslipList } from '@/components/PayslipList';
import { PayslipDetail } from '@/components/PayslipDetail';
import { Header } from '@/components/Header';
import { ErrorNotification } from '@/components/ErrorNotification';
import { usePayslipData } from '@/hooks/usePayslipData';
import { useCategories } from '@/hooks/useCategories';
import { Loader2 } from 'lucide-react';

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: payslipItems, loading: dataLoading, error: dataError, refetch: refetchData } = usePayslipData();
  const { categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories();

  // Gérer la navigation par hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setSelectedId(hash || null);
    };

    // Vérifier le hash initial
    handleHashChange();

    // Écouter les changements de hash
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelect = (id: string) => {
    window.location.hash = id;
    setSelectedId(id);
  };

  const handleBack = () => {
    window.location.hash = '';
    setSelectedId(null);
  };

  const handleRetry = async () => {
    await Promise.all([refetchData(), refetchCategories()]);
  };

  const selectedItem = selectedId ? payslipItems.find(item => item.id === selectedId) : null;
  const isLoading = dataLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ErrorNotification 
          dataError={dataError} 
          categoriesError={categoriesError}
          onRetry={handleRetry}
        />
        {selectedItem ? (
          <PayslipDetail item={selectedItem} onBack={handleBack} />
        ) : (
          <PayslipList 
            items={payslipItems} 
            categories={categories}
            onSelect={handleSelect} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
