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
            <div className="opacity-20 pointer-events-none grayscale transition-all duration-300">
                {children}
            </div>

            <div className="absolute inset-0 flex items-center justify-center z-10 cursor-not-allowed group">
                <div className="bg-black/60 p-1.5 rounded-full border border-white/10 backdrop-blur-sm shadow-xl transition-all group-hover:bg-danger/20 group-hover:border-danger/40">
                    <Lock className="w-4 h-4 text-txt-muted/70 group-hover:text-danger/80" />
                </div>
            </div>

            {showTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-black/95 border border-white/20 rounded-lg text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap z-50 animate-fadeIn shadow-2xl">
                    {tooltip}
                </div>
            )}
        </div>
    );
};
