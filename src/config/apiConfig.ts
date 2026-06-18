export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || '',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '10000'),

  get documentsUrl() { return `${this.baseUrl}/api/documents`; },
  get categoriesUrl() { return `${this.baseUrl}/api/categories`; },
  get descriptionsUrl() { return `${this.baseUrl}/api/descriptions`; },
  get uploadUrl() { return `${this.baseUrl}/api/upload`; },
  get payslipZonesUrl() { return `${this.baseUrl}/api/payslip-zones`; },
  get payslipSettingsUrl() { return `${this.baseUrl}/api/payslip-settings`; },
  get companiesUrl() { return `${this.baseUrl}/api/companies`; },
  get pdfFilesUrl() { return `${this.baseUrl}/api/pdf-files`; },
  get companyPdfsUrl() { return `${this.baseUrl}/api/company-pdfs`; },
  get adminSettingsUrl() { return `${this.baseUrl}/api/admin/settings`; },
  get remotionStatusUrl() { return `${this.baseUrl}/api/admin/remotion/status`; },
  get remotionInstallUrl() { return `${this.baseUrl}/api/admin/remotion/install`; },
  get remotionUninstallUrl() { return `${this.baseUrl}/api/admin/remotion/uninstall`; },
  get adminVideosUrl() { return `${this.baseUrl}/api/admin/videos`; },
  get watermarkUrl() { return `${this.baseUrl}/api/admin/video-watermark`; },
};

// ============================================
// FONCTION HTTP GÉNÉRIQUE
// ============================================

const requestCache = new Map<string, Promise<any>>();

async function fetchFromAPI(url: string, options: RequestInit = {}): Promise<any> {
  const cacheKey = `${url}-${JSON.stringify(options)}`;

  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('La requête a expiré. Veuillez réessayer.');
        }
        throw error;
      }
      throw new Error('Une erreur inconnue est survenue');
    } finally {
      setTimeout(() => requestCache.delete(cacheKey), 100);
    }
  })();

  requestCache.set(cacheKey, requestPromise);
  return requestPromise;
}

// ============================================
// FONCTIONS D'API
// ============================================

export async function getData(): Promise<any> {
  return fetchFromAPI(API_CONFIG.documentsUrl);
}

export async function getCategories(): Promise<any> {
  return fetchFromAPI(API_CONFIG.categoriesUrl);
}

export async function getDescriptions(): Promise<any> {
  return fetchFromAPI(API_CONFIG.descriptionsUrl);
}

export async function createDocument(doc: any): Promise<any> {
  return fetchFromAPI(API_CONFIG.documentsUrl, {
    method: 'POST',
    body: JSON.stringify(doc)
  });
}

export async function updateDocument(id: string, doc: any): Promise<any> {
  return fetchFromAPI(`${API_CONFIG.documentsUrl}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(doc)
  });
}

export async function deleteDocument(id: string, _rev?: string): Promise<any> {
  return fetchFromAPI(`${API_CONFIG.documentsUrl}/${id}`, {
    method: 'DELETE'
  });
}

// ============================================
// MUTATIONS CATÉGORIES (gestion erreurs serveur)
// ============================================

async function fetchForMutation(url: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error('Serveur inaccessible. Vérifiez que le serveur est démarré.');
    }

    if (!response.ok) {
      const err = new Error(data.error || `Erreur HTTP: ${response.status}`);
      (err as any).status = response.status;
      throw err;
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La requête a expiré. Veuillez réessayer.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createCategory(title: string): Promise<any> {
  return fetchForMutation(API_CONFIG.categoriesUrl, {
    method: 'POST',
    body: JSON.stringify({ title })
  });
}

export async function deleteCategory(id: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.categoriesUrl}/${id}`, {
    method: 'DELETE'
  });
}

export async function getPayslipZones(): Promise<any> {
  return fetchFromAPI(API_CONFIG.payslipZonesUrl);
}

export async function getPayslipSettings(): Promise<any> {
  return fetchFromAPI(API_CONFIG.payslipSettingsUrl);
}

export async function createPayslipZone(zone: {
  document_id: string; x: number; y: number; width: number; height: number;
}): Promise<any> {
  return fetchForMutation(API_CONFIG.payslipZonesUrl, {
    method: 'POST',
    body: JSON.stringify(zone),
  });
}

export async function updatePayslipZone(id: string, zone: {
  document_id?: string; x?: number; y?: number; width?: number; height?: number;
}): Promise<any> {
  return fetchForMutation(`${API_CONFIG.payslipZonesUrl}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(zone),
  });
}

export async function deletePayslipZone(id: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.payslipZonesUrl}/${id}`, {
    method: 'DELETE',
  });
}

export async function uploadPayslipImage(file: File): Promise<{ model_image_path: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
  try {
    const response = await fetch(`${API_CONFIG.payslipSettingsUrl}/image`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Erreur upload: ${response.status}`);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La requête a expiré. Veuillez réessayer.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function renameCategory(id: string, title: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.categoriesUrl}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title })
  });
}

export async function getDocument(id: string): Promise<any> {
  return fetchFromAPI(`${API_CONFIG.documentsUrl}/${id}`);
}

export async function uploadImage(file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  const response = await fetch(API_CONFIG.uploadUrl, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Erreur upload: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// ============================================
// FONCTIONS AVEC CACHE ET FALLBACK
// ============================================

export async function getDataWithFallback(fallbackData?: any): Promise<any> {
  try {
    const data = await getData();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('payslip_data_cache', JSON.stringify(data));
        localStorage.setItem('payslip_data_cache_time', Date.now().toString());
      } catch {
        // localStorage indisponible
      }
    }

    return data;
  } catch (error) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedData = localStorage.getItem('payslip_data_cache');
        if (cachedData) return JSON.parse(cachedData);
      } catch {
        // cache illisible
      }
    }

    if (fallbackData) return fallbackData;
    throw error;
  }
}

export async function getCategoriesWithFallback(fallbackCategories?: any): Promise<any> {
  try {
    const data = await getCategories();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('categories_cache', JSON.stringify(data));
        localStorage.setItem('categories_cache_time', Date.now().toString());
      } catch {
        // localStorage indisponible
      }
    }

    return data;
  } catch (error) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedData = localStorage.getItem('categories_cache');
        if (cachedData) return JSON.parse(cachedData);
      } catch {
        // cache illisible
      }
    }

    if (fallbackCategories) return fallbackCategories;
    throw error;
  }
}

export async function getDescriptionsWithFallback(fallbackDescriptions?: any): Promise<any> {
  try {
    const data = await getDescriptions();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('descriptions_cache', JSON.stringify(data));
        localStorage.setItem('descriptions_cache_time', Date.now().toString());
      } catch {
        // localStorage indisponible
      }
    }

    return data;
  } catch (error) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cachedData = localStorage.getItem('descriptions_cache');
        if (cachedData) return JSON.parse(cachedData);
      } catch {
        // cache illisible
      }
    }

    if (fallbackDescriptions) return fallbackDescriptions;
    throw error;
  }
}

export async function getCompanies(): Promise<any> {
  return fetchFromAPI(API_CONFIG.companiesUrl);
}

export async function getAllCompanyPdfs(): Promise<any> {
  return fetchForMutation(API_CONFIG.companyPdfsUrl, { method: 'GET' });
}

export async function createCompany(name: string): Promise<any> {
  return fetchForMutation(API_CONFIG.companiesUrl, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export async function renameCompany(id: string, name: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.companiesUrl}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name })
  });
}

export async function deleteCompany(id: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.companiesUrl}/${id}`, {
    method: 'DELETE'
  });
}

export async function getPdfFiles(companyId?: string): Promise<any> {
  const url = companyId
    ? `${API_CONFIG.pdfFilesUrl}?company_id=${encodeURIComponent(companyId)}`
    : API_CONFIG.pdfFilesUrl;
  return fetchFromAPI(url);
}

export async function uploadPdfFile(file: File, name: string): Promise<any> {
  const formData = new FormData();
  formData.append('pdf', file);
  formData.append('name', name);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${API_CONFIG.pdfFilesUrl}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Erreur upload: ${response.status}`);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('La requête a expiré.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function deletePdfFile(id: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.pdfFilesUrl}/${id}`, { method: 'DELETE' });
}

export async function assignPdfToCompany(companyId: string, pdfId: string): Promise<any> {
  return fetchForMutation(API_CONFIG.companyPdfsUrl, {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, pdf_id: pdfId })
  });
}

export async function unassignPdfFromCompany(companyId: string, pdfId: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.companyPdfsUrl}/${companyId}/${pdfId}`, { method: 'DELETE' });
}

// ============================================
// VIDEO GENERATOR (admin)
// ============================================

export interface RemotionStatus { installed: boolean; version: string | null; }
export interface GeneratedVideo { documentId: string; title: string; videoUrl: string; }

export async function getAdminSettings(): Promise<Record<string, string | boolean>> {
  return fetchForMutation(API_CONFIG.adminSettingsUrl, { method: 'GET' });
}

export async function saveAdminSettings(settings: Record<string, string>): Promise<any> {
  return fetchForMutation(API_CONFIG.adminSettingsUrl, {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export async function getRemotionStatus(): Promise<RemotionStatus> {
  return fetchForMutation(API_CONFIG.remotionStatusUrl, { method: 'GET' });
}

export async function uninstallRemotion(): Promise<any> {
  return fetchForMutation(API_CONFIG.remotionUninstallUrl, { method: 'POST' });
}

export async function getGeneratedVideos(): Promise<{ videos: GeneratedVideo[] }> {
  return fetchForMutation(API_CONFIG.adminVideosUrl, { method: 'GET' });
}

export interface PendingVideo { documentId: string; title: string; videoUrl: string; createdAt: number | null; }

export async function getPendingVideo(): Promise<{ pending: PendingVideo | null }> {
  return fetchForMutation(`${API_CONFIG.adminVideosUrl}/pending`, { method: 'GET' });
}

export async function deleteVideo(documentId: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.adminVideosUrl}/${documentId}`, { method: 'DELETE' });
}

export async function publishVideo(documentId: string, videoUrl: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.adminVideosUrl}/publish/${documentId}`, {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
  });
}

export async function discardVideo(videoUrl: string): Promise<any> {
  return fetchForMutation(`${API_CONFIG.adminVideosUrl}/discard`, {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
  });
}

export interface WatermarkStatus { exists: boolean; url: string | null; position: string; size: string; }

export async function getWatermarkStatus(): Promise<WatermarkStatus> {
  return fetchForMutation(API_CONFIG.watermarkUrl, { method: 'GET' });
}

export async function uploadWatermark(file: File): Promise<{ ok: boolean; url: string }> {
  const formData = new FormData();
  formData.append('watermark', file);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(API_CONFIG.watermarkUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Erreur upload: ${response.status}`);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('La requête a expiré.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function deleteWatermark(): Promise<any> {
  return fetchForMutation(API_CONFIG.watermarkUrl, { method: 'DELETE' });
}

/**
 * Consomme un flux SSE servi via une requête POST (EventSource ne supporte que GET).
 * `onMessage` est appelé pour chaque évènement `data:` reçu.
 */
export async function streamSSE(
  url: string,
  onMessage: (data: any) => void,
  options: RequestInit = {}
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const emit = (chunk: string) => {
    const line = chunk.split('\n').find(l => l.startsWith('data:'));
    if (!line) return;
    const json = line.slice(5).trim();
    if (!json) return;
    try { onMessage(JSON.parse(json)); } catch { /* évènement non-JSON ignoré */ }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) emit(part);
  }
  if (buffer.trim()) emit(buffer);
}
