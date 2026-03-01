import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink, Loader2, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getCompanies, getPdfFiles } from '@/config/apiConfig';

interface Company {
  id: string;
  name: string;
}

interface PdfFile {
  id: string;
  name: string;
  filename: string;
}

export function CompanyDocuments() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCompanies()
      .then(data => { if (data?.companies) setCompanies(data.companies); })
      .catch(() => setError('Impossible de charger les entreprises.'))
      .finally(() => setLoadingCompanies(false));
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) { setPdfs([]); return; }
    setLoadingPdfs(true);
    setError(null);
    getPdfFiles(selectedCompanyId)
      .then(data => { if (data?.pdfs) setPdfs(data.pdfs); })
      .catch(() => setError('Impossible de charger les documents.'))
      .finally(() => setLoadingPdfs(false));
  }, [selectedCompanyId]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png" alt="ClearDoc Logo" className="h-6 w-6 object-contain" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ClearDoc</span>
            </button>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 py-8 max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Documents des structures</h1>
          <p className="text-muted-foreground">Sélectionnez votre structure pour accéder à vos documents</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loadingCompanies ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-8 max-w-md mx-auto shadow-sm">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">Aucune structure configurée</h3>
              <p className="text-muted-foreground">L'administrateur n'a pas encore configuré les structures.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 mb-8">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Votre structure
              </label>
              <select
                value={selectedCompanyId}
                onChange={e => setSelectedCompanyId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Sélectionnez votre structure --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedCompanyId && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Documents — {selectedCompany?.name}
                </h2>
                {loadingPdfs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pdfs.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-muted-foreground">Aucun document disponible pour cette structure.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pdfs.map(pdf => (
                      <a
                        key={pdf.id}
                        href={pdf.filename}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all flex items-start gap-4"
                      >
                        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                          <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{pdf.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Ouvrir le PDF
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
