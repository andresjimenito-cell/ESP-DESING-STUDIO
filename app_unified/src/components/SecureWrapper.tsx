import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

export const useAuth = () => {
    const [isAdmin, setIsAdmin] = useState(() => {
        return localStorage.getItem('eds_admin_mode') === 'true';
    });

    useEffect(() => {
        const handleStorageChange = () => {
            setIsAdmin(localStorage.getItem('eds_admin_mode') === 'true');
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('eds_admin_toggled', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('eds_admin_toggled', handleStorageChange);
        };
    }, []);

    const loginAdmin = (password: string) => {
        // Simple hardcoded password for now
        if (password === 'ajm') {
            localStorage.setItem('eds_admin_mode', 'true');
            window.dispatchEvent(new Event('eds_admin_toggled'));
            return true;
        }
        return false;
    };

    const logoutAdmin = () => {
        localStorage.setItem('eds_admin_mode', 'false');
        window.dispatchEvent(new Event('eds_admin_toggled'));
    };

    return { isAdmin, loginAdmin, logoutAdmin };
};

interface SecureWrapperProps {
    children: React.ReactNode;
    isLocked?: boolean;
    tooltip?: string;
    className?: string;
}

export const SecureWrapper: React.FC<SecureWrapperProps> = ({
    children,
    isLocked = true,
    tooltip = "Módulo Restringido (Solo Visualización)",
    className = ""
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const { isAdmin } = useAuth();

    // Si el usuario es admin o el componente no está bloqueado, mostrar el contenido normal
    if (!isLocked || isAdmin) return <>{children}</>;

    return (
        <div
            className={`relative inline-block ${className}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <div className="opacity-40 pointer-events-none transition-all duration-500 blur-[1px]">
                {children}
            </div>

            <div className="absolute inset-0 flex items-center justify-center z-10 cursor-not-allowed group">
                <div className="bg-black/60 p-2 rounded-2xl border border-white/20 backdrop-blur-md shadow-2xl transition-all group-hover:bg-danger/30 group-hover:border-danger/50 group-hover:scale-110">
                    <Lock className="w-5 h-5 text-white/90 group-hover:text-white group-hover:animate-bounce" />
                </div>
            </div>

            {showTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-4 py-2 bg-black/90 border border-danger/30 rounded-xl text-[10px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap z-50 animate-fadeIn shadow-[0_10px_30px_rgba(239,68,68,0.2)]">
                    <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                        {tooltip}
                    </span>
                </div>
            )}
        </div>
    );
};
