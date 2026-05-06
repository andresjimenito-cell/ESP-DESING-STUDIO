import React from 'react';
import { Activity, Download, Database } from 'lucide-react';

interface FleetDashboardProps {
    importDesignRef: React.RefObject<HTMLInputElement>;
    importDbRef: React.RefObject<HTMLInputElement>;
}

export const FleetDashboard: React.FC<FleetDashboardProps> = ({
    importDesignRef,
    importDbRef
}) => {
    return (
        <div className="flex flex-col items-center justify-center p-20 glass-surface rounded-[3.5rem] border border-white/5 border-dashed min-h-[550px] animate-fadeIn mx-4 shadow-3xl">
            <div className="p-8 bg-primary/10 rounded-[2.5rem] mb-10 relative border border-primary/20 shadow-glow-primary/10">
                <Activity className="w-20 h-20 text-primary animate-pulse" />
                <div className="absolute -top-3 -right-3 w-10 h-10 bg-primary rounded-full animate-ping opacity-20"></div>
            </div>
            <h3 className="text-4xl font-black text-txt-main uppercase tracking-tighter mb-4 text-center">Centro de Control ALS</h3>
            <p className="text-txt-muted text-center max-w-xl font-medium leading-relaxed text-lg opacity-70">
                La flota se encuentra vacía o está inicializando. Utilice los controles en la parte superior derecha para cargar sus diseños técnicos y pruebas de producción.
            </p>
            <div className="flex items-center gap-4 mt-8">
                <button onClick={() => importDesignRef.current?.click()} className="h-12 px-8 bg-primary text-white rounded-xl flex items-center gap-3 hover:bg-primary/80 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">
                    <Download className="w-5 h-5" /> Cargar Diseños
                </button>
                <button onClick={() => importDbRef.current?.click()} className="h-12 px-8 bg-secondary text-white rounded-xl flex items-center gap-3 hover:bg-secondary/80 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-secondary/20">
                    <Database className="w-5 h-5" /> Cargar SCADA
                </button>
            </div>
        </div>
    );
};
