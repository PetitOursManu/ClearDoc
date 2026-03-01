import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getPayslipZones, getPayslipSettings } from '@/config/apiConfig';

interface Zone {
  id: string;
  document_id: string;
  document_title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function InteractivePayslip() {
  const navigate = useNavigate();
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsData, zonesData] = await Promise.all([
          getPayslipSettings(),
          getPayslipZones(),
        ]);
        if (settingsData?.model_image_path) setModelImage(settingsData.model_image_path);
        if (zonesData?.zones) setZones(zonesData.zones);
      } catch {
        // silent — empty state
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleZoneClick = (documentId: string) => {
    navigate(`/#${documentId}`);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img
                  src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png"
                  alt="ClearDoc Logo"
                  className="h-6 w-6 object-contain"
                />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ClearDoc</span>
            </button>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 py-8 max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Fiche de paie interactive
          </h1>
          <p className="text-muted-foreground">
            Cliquez sur une zone pour accéder à son explication
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !modelImage ? (
          <div className="text-center py-16">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-8 max-w-md mx-auto shadow-sm">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">
                Aucune fiche configurée
              </h3>
              <p className="text-muted-foreground">
                L'administrateur n'a pas encore configuré la fiche de paie interactive.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg overflow-hidden">
            <div
              className="relative"
              style={{ userSelect: 'none' }}
            >
              <img
                src={modelImage}
                alt="Fiche de paie"
                className="w-full h-auto block"
                draggable={false}
              />
              {zones.map(zone => (
                <div
                  key={zone.id}
                  style={{
                    position: 'absolute',
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                  }}
                  className={`cursor-pointer border-2 transition-all duration-150 ${
                    hoveredZoneId === zone.id
                      ? 'border-blue-500 bg-blue-400/30'
                      : 'border-blue-400/40 bg-blue-400/10'
                  }`}
                  onClick={() => handleZoneClick(zone.document_id)}
                  onMouseEnter={() => setHoveredZoneId(zone.id)}
                  onMouseLeave={() => setHoveredZoneId(null)}
                >
                  {hoveredZoneId === zone.id && (
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-md whitespace-nowrap z-20 pointer-events-none shadow-lg ${
                        zone.y < 15 ? 'top-full mt-2' : 'bottom-full mb-2'
                      }`}
                    >
                      {zone.document_title}
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                          zone.y < 15
                            ? 'bottom-full border-b-slate-900 dark:border-b-slate-700'
                            : 'top-full border-t-slate-900 dark:border-t-slate-700'
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {zones.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Aucune zone cliquable configurée pour le moment.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
