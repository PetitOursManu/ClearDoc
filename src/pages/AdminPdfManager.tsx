import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Upload, FileText, Building2, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCompanies, createCompany, renameCompany, deleteCompany,
  getPdfFiles, uploadPdfFile, deletePdfFile,
  assignPdfToCompany, unassignPdfFromCompany, getAllCompanyPdfs
} from '@/config/apiConfig';

interface Company { id: string; name: string; }
interface PdfFile { id: string; name: string; filename: string; }

export function AdminPdfManager() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allPdfs, setAllPdfs] = useState<PdfFile[]>([]);
  // Map<pdf_id, Set<company_id>> — toutes les assignations chargées en une fois
  const [allAssignments, setAllAssignments] = useState<Map<string, Set<string>>>(new Map());

  const [expandedPdfId, setExpandedPdfId] = useState<string | null>(null);

  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState('');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildAssignmentMap = (assignments: { company_id: string; pdf_id: string }[]) => {
    const map = new Map<string, Set<string>>();
    for (const { company_id, pdf_id } of assignments) {
      if (!map.has(pdf_id)) map.set(pdf_id, new Set());
      map.get(pdf_id)!.add(company_id);
    }
    return map;
  };

  useEffect(() => {
    if (!isAdmin) { navigate('/admin/login'); return; }
    Promise.all([getCompanies(), getPdfFiles(), getAllCompanyPdfs()])
      .then(([companiesData, pdfsData, assignmentsData]) => {
        if (companiesData?.companies) setCompanies(companiesData.companies);
        if (pdfsData?.pdfs) setAllPdfs(pdfsData.pdfs);
        if (assignmentsData?.assignments) setAllAssignments(buildAssignmentMap(assignmentsData.assignments));
      })
      .catch(() => setError('Impossible de charger les données.'))
      .finally(() => setLoading(false));
  }, [isAdmin, navigate]);

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
    try {
      const data = await createCompany(newCompanyName.trim());
      setCompanies(prev => [...prev, data]);
      setNewCompanyName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleRenameCompany = async (id: string) => {
    if (!editingCompanyName.trim()) return;
    try {
      const data = await renameCompany(id, editingCompanyName.trim());
      setCompanies(prev => prev.map(c => c.id === id ? data : c));
      setEditingCompanyId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!window.confirm('Supprimer cette structure ? Les assignations de PDF seront supprimées.')) return;
    try {
      await deleteCompany(id);
      setCompanies(prev => prev.filter(c => c.id !== id));
      // Retirer cette structure de toutes les assignations locales
      setAllAssignments(prev => {
        const next = new Map(prev);
        for (const [pdfId, companyIds] of next) {
          if (companyIds.has(id)) {
            const updated = new Set(companyIds);
            updated.delete(id);
            next.set(pdfId, updated);
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadPdfFile(uploadFile, uploadName || uploadFile.name.replace(/\.pdf$/i, ''));
      setAllPdfs(prev => [...prev, data]);
      setUploadFile(null);
      setUploadName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePdf = async (id: string) => {
    if (!window.confirm('Supprimer ce fichier PDF ? Cette action est irréversible.')) return;
    try {
      await deletePdfFile(id);
      setAllPdfs(prev => prev.filter(p => p.id !== id));
      setAllAssignments(prev => { const next = new Map(prev); next.delete(id); return next; });
      if (expandedPdfId === id) setExpandedPdfId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleToggleAssignment = async (pdfId: string, companyId: string) => {
    const assigned = allAssignments.get(pdfId)?.has(companyId) ?? false;
    // Optimistic update
    setAllAssignments(prev => {
      const next = new Map(prev);
      const current = new Set(next.get(pdfId) ?? []);
      assigned ? current.delete(companyId) : current.add(companyId);
      next.set(pdfId, current);
      return next;
    });
    try {
      if (assigned) {
        await unassignPdfFromCompany(companyId, pdfId);
      } else {
        await assignPdfToCompany(companyId, pdfId);
      }
    } catch (err) {
      // Rollback
      setAllAssignments(prev => {
        const next = new Map(prev);
        const current = new Set(next.get(pdfId) ?? []);
        assigned ? current.add(companyId) : current.delete(companyId);
        next.set(pdfId, current);
        return next;
      });
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    }
  };

  const handleAssignAll = async (pdfId: string) => {
    const unassigned = companies.filter(c => !(allAssignments.get(pdfId)?.has(c.id) ?? false));
    for (const company of unassigned) {
      await handleToggleAssignment(pdfId, company.id);
    }
  };

  const handleUnassignAll = async (pdfId: string) => {
    const assigned = companies.filter(c => allAssignments.get(pdfId)?.has(c.id) ?? false);
    for (const company of assigned) {
      await handleToggleAssignment(pdfId, company.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      <main className="px-4 py-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Gestion des documents PDF</h1>
          <p className="text-muted-foreground">Gérez les structures, uploadez des PDFs et définissez les assignations.</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center justify-between gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
            <button onClick={() => setError(null)} className="shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: structures */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Structures
              </h2>

              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {companies.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune structure</p>
                )}
                {companies.map(company => (
                  <div key={company.id} className="group flex items-center gap-2 p-2.5 rounded-lg border border-transparent hover:bg-muted hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                    {editingCompanyId === company.id ? (
                      <>
                        <Input
                          value={editingCompanyName}
                          onChange={e => setEditingCompanyName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameCompany(company.id); if (e.key === 'Escape') setEditingCompanyId(null); }}
                          className="h-7 text-sm flex-1"
                          autoFocus
                        />
                        <button onClick={() => handleRenameCompany(company.id)} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditingCompanyId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium truncate">{company.name}</span>
                        <button
                          onClick={() => { setEditingCompanyId(company.id); setEditingCompanyName(company.name); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        ><Pencil className="h-3.5 w-3.5" /></button>
                        <button
                          onClick={() => handleDeleteCompany(company.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                        ><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Nouvelle structure..."
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCompany(); }}
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={handleAddCompany} disabled={!newCompanyName.trim()} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right panel: PDFs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload section */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5 text-muted-foreground" />
                Uploader un PDF
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setUploadFile(file);
                      if (file && !uploadName) setUploadName(file.name.replace(/\.pdf$/i, ''));
                    }}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
                  />
                  <Input
                    placeholder="Nom du document (optionnel)"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Button onClick={handleUpload} disabled={!uploadFile || uploading} className="shrink-0 gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Upload...' : 'Uploader'}
                </Button>
              </div>
            </div>

            {/* PDF list with per-PDF structure assignment */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Tous les PDFs
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Dépliez un PDF pour gérer ses assignations aux structures.
              </p>

              {allPdfs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun PDF uploadé.</p>
              ) : (
                <div className="space-y-2">
                  {allPdfs.map(pdf => {
                    const assignedCompanyIds = allAssignments.get(pdf.id) ?? new Set();
                    const assignedCount = assignedCompanyIds.size;
                    const isExpanded = expandedPdfId === pdf.id;

                    return (
                      <div key={pdf.id} className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                        {/* PDF row */}
                        <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors group">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{pdf.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <a href={pdf.filename} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-blue-500 transition-colors">
                                Ouvrir ↗
                              </a>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className={`text-xs font-medium ${assignedCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                                {assignedCount === 0 ? 'Aucune structure' : `${assignedCount} structure${assignedCount > 1 ? 's' : ''}`}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedPdfId(isExpanded ? null : pdf.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors shrink-0"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            Structures
                          </button>
                          <button
                            onClick={() => handleDeletePdf(pdf.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Expanded: structure assignment panel */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-3">
                            {companies.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">Aucune structure créée.</p>
                            ) : (
                              <>
                                <div className="flex gap-2 mb-3">
                                  <button
                                    onClick={() => handleAssignAll(pdf.id)}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    Tout cocher
                                  </button>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <button
                                    onClick={() => handleUnassignAll(pdf.id)}
                                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                  >
                                    Tout décocher
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {companies.map(company => (
                                    <label
                                      key={company.id}
                                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={assignedCompanyIds.has(company.id)}
                                        onChange={() => handleToggleAssignment(pdf.id, company.id)}
                                        className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer shrink-0"
                                      />
                                      <span className="text-sm truncate">{company.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
