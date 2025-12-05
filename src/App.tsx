import { useState, useEffect } from 'react';
import { PayslipCard } from '@/components/PayslipCard';
import { EditDialog } from '@/components/EditDialog';
import { AddPayslipDialog } from '@/components/AddPayslipDialog';
import { Header } from '@/components/Header';
import { PayslipItem } from '@/types/payslip';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { usePayslipData } from '@/hooks/usePayslipData';
import { debugLog } from '@/config/debugConfig';

function AppContent() {
  const { data: payslipData, loading, error, refetch } = usePayslipData();
  const [data, setData] = useState<PayslipItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<PayslipItem | null>(null);

  // Synchroniser les données quand elles sont chargées
  useEffect(() => {
    if (payslipData && payslipData.length > 0) {
      setData(payslipData);
      debugLog(`✅ Données mises à jour automatiquement: ${payslipData.length} éléments`);
    }
  }, [payslipData]);

  const handleEdit = (item: PayslipItem) => {
    setEditingItem(item);
  };

  const handleSave = (updatedItem: PayslipItem) => {
    setData(data.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
    setEditingItem(null);
  };

  const handleAdd = (newItem: Omit<PayslipItem, 'id'>) => {
    const itemWithId: PayslipItem = {
      ...newItem,
      id: `item_${Date.now()}`,
    };
    setData([...data, itemWithId]);
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { value: 'all', label: 'Toutes les catégories' },
    { value: 'salaire', label: 'Salaire' },
    { value: 'cotisations', label: 'Cotisations' },
    { value: 'net', label: 'Net à payer' },
    { value: 'employeur', label: 'Charges patronales' },
    { value: 'autres', label: 'Autres' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-[1400px] mx-auto">
        <Header 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          onRefresh={refetch}
        />

        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <p className="text-gray-600">
                {filteredData.length} résultat{filteredData.length > 1 ? 's' : ''} trouvé{filteredData.length > 1 ? 's' : ''}
              </p>
              {error && (
                <p className="text-amber-600 text-sm mt-1">
                  ⚠️ Utilisation des données hors ligne
                </p>
              )}
            </div>
            <AddPayslipDialog onAdd={handleAdd} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredData.map((item) => (
              <PayslipCard
                key={item.id}
                item={item}
                onEdit={handleEdit}
              />
            ))}
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                Aucun résultat trouvé pour votre recherche.
              </p>
            </div>
          )}
        </main>

        {editingItem && (
          <EditDialog
            item={editingItem}
            open={!!editingItem}
            onOpenChange={(open) => !open && setEditingItem(null)}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
