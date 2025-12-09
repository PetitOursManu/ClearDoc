import { AlertCircle, WifiOff, Shield, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorNotificationProps {
  dataError: string | null;
  categoriesError: string | null;
  onRetry?: () => void;
}

export function ErrorNotification({ dataError, categoriesError, onRetry }: ErrorNotificationProps) {
  if (!dataError && !categoriesError) return null;

  // Déterminer le type d'erreur
  const isCORSError = (dataError?.includes('CORS') || categoriesError?.includes('CORS'));
  const isNetworkError = (dataError?.includes('fetch') || categoriesError?.includes('fetch'));
  
  // Choisir l'icône appropriée
  const Icon = isCORSError ? Shield : isNetworkError ? WifiOff : AlertCircle;

  // Construire le message d'erreur
  let errorTitle = 'Erreur de connexion';
  let errorMessage = '';
  
  if (isCORSError) {
    errorTitle = 'Erreur CORS - Problème de configuration serveur';
    errorMessage = 'Le serveur n\'autorise pas les requêtes depuis cette application. Les données de secours sont utilisées.';
  } else if (isNetworkError) {
    errorTitle = 'Connexion au serveur impossible';
    errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
  } else if (dataError && categoriesError) {
    errorMessage = 'Impossible de charger les données et les catégories depuis le serveur. Les données de secours sont utilisées.';
  } else if (dataError) {
    errorMessage = `Impossible de charger les données depuis le serveur. ${dataError}`;
  } else if (categoriesError) {
    errorMessage = `Impossible de charger les catégories depuis le serveur. ${categoriesError}`;
  }

  return (
    <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50">
      <Icon className="h-4 w-4" />
      <AlertTitle className="font-semibold">{errorTitle}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>{errorMessage}</p>
        
        {isCORSError && (
          <div className="mt-3 p-3 bg-white rounded-md border border-red-200">
            <p className="font-medium text-sm mb-2">Solutions possibles :</p>
            <ul className="text-sm space-y-1 list-disc list-inside text-gray-600">
              <li>Configurez CORS sur votre serveur CouchDB</li>
              <li>Ajoutez l'en-tête <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Access-Control-Allow-Origin</code></li>
              <li>Utilisez un proxy pour contourner CORS</li>
              <li>Hébergez l'application sur le même domaine</li>
            </ul>
          </div>
        )}
        
        {onRetry && (
          <Button 
            onClick={onRetry} 
            variant="outline" 
            size="sm" 
            className="mt-2"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Réessayer
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
