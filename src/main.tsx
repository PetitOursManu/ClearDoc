import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { AdminLogin } from './pages/AdminLogin.tsx';
import { PayslipMap } from './pages/PayslipMap.tsx';
import { InteractivePayslip } from './pages/InteractivePayslip.tsx';
import { CompanyDocuments } from './pages/CompanyDocuments.tsx';
import { AdminPdfManager } from './pages/AdminPdfManager.tsx';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/payslip-map" element={<PayslipMap />} />
              <Route path="/fiche-de-paie" element={<InteractivePayslip />} />
              <Route path="/documents" element={<CompanyDocuments />} />
              <Route path="/admin/pdf-manager" element={<AdminPdfManager />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
