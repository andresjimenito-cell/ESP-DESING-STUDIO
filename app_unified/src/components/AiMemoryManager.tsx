import React, { useState, useEffect } from 'react';
import { Search, Trash2, Edit2, Plus, X, Check, ChevronDown, ChevronUp, Brain, Tag, Calendar, Database } from 'lucide-react';
import { AiMemoryService, AiCase } from '../services/AiMemoryService';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AiMemoryManagerProps {
    language: string;
    onClose?: () => void;
}

export const AiMemoryManager: React.FC<AiMemoryManagerProps> = ({ language, onClose }) => {
    const [memory, setMemory] = useState<AiCase[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'diagnosis' | 'design' | 'optimization' | 'alarm' | 'summary'>('all');
    const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
    
    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');

    // Add manual entry state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newWellName, setNewWellName] = useState('');
    const [newCategory, setNewCategory] = useState<'diagnosis' | 'design' | 'optimization' | 'alarm'>('diagnosis');
    const [newSignature, setNewSignature] = useState('custom|Q:1500|PIP:600|F:60');
    const [newRecommendation, setNewRecommendation] = useState('');

    // Load memory on mount
    const reloadMemory = () => {
        setMemory(AiMemoryService.getMemory());
    };

    useEffect(() => {
        reloadMemory();
    }, []);

    // Filter memory
    const filteredMemory = memory.filter(c => {
        const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
        const matchesSearch = 
            (c.wellName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.recommendation.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.technicalSignature.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleSaveEdit = async (c: AiCase) => {
        if (!editingText.trim()) return;
        await AiMemoryService.updateCase({
            ...c,
            recommendation: editingText
        });
        setEditingId(null);
        setEditingText('');
        reloadMemory();
    };

    const handleDelete = async (id: string) => {
        const msg = language === 'es' 
            ? '¿Estás seguro de que deseas eliminar este registro de la memoria?' 
            : 'Are you sure you want to delete this memory record?';
        if (window.confirm(msg)) {
            await AiMemoryService.deleteCase(id);
            reloadMemory();
            if (expandedCaseId === id) setExpandedCaseId(null);
        }
    };

    const handleAddManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRecommendation.trim()) return;

        await AiMemoryService.saveCase({
            category: newCategory,
            wellName: newWellName.trim() || undefined,
            technicalSignature: newSignature.trim(),
            context: { manualEntry: true },
            recommendation: newRecommendation
        });

        // Reset form
        setNewWellName('');
        setNewCategory('diagnosis');
        setNewSignature('custom|Q:1500|PIP:600|F:60');
        setNewRecommendation('');
        setShowAddForm(false);
        reloadMemory();
    };

    const t = (es: string, en: string) => (language === 'es' ? es : en);

    return (
        <div className="flex flex-col h-full overflow-hidden text-txt-main animate-fadeIn">
            {/* MANAGER HEADER */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-txt-main">
                        {t('Base de Conocimiento IA', 'AI Technical Knowledge Base')}
                    </h3>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-all">
                        <X className="w-3.5 h-3.5 text-txt-muted hover:text-txt-main" />
                    </button>
                )}
            </div>

            {/* CONTROLS */}
            <div className="space-y-3 shrink-0">
                {/* Search Bar */}
                <div className="relative flex items-center bg-canvas/60 border border-surface-light rounded-xl px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-txt-muted mr-2" />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('Buscar pozo, firma o recomendación...', 'Search well, signature or technical notes...')}
                        className="bg-transparent w-full text-[11px] font-bold text-txt-main outline-none placeholder:text-txt-muted/40"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-txt-muted hover:text-txt-main">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Categories Filter */}
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar text-[9px] font-black uppercase tracking-wider">
                    {(['all', 'diagnosis', 'design', 'optimization', 'alarm', 'summary'] as const).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-2.5 py-1.5 rounded-lg border transition-all ${
                                categoryFilter === cat
                                    ? 'bg-primary text-white border-primary shadow-glow-primary/20'
                                    : 'bg-surface-light/40 border-surface-light text-txt-muted hover:text-txt-main hover:bg-surface-light/80'
                            }`}
                        >
                            {cat === 'all' ? t('Todos', 'All') : cat === 'summary' ? t('Resúmenes', 'Summaries') : cat}
                        </button>
                    ))}
                </div>

                {/* Add Manual Case Toggle */}
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-primary/40 hover:border-primary text-primary hover:text-primary-light bg-primary/5 hover:bg-primary/10 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                >
                    {showAddForm ? (
                        <>
                            <X className="w-3.5 h-3.5" />
                            {t('Cancelar Registro', 'Cancel Registration')}
                        </>
                    ) : (
                        <>
                            <Plus className="w-3.5 h-3.5" />
                            {t('Agregar Aprendizaje Manual', 'Add Manual Knowledge')}
                        </>
                    )}
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3 custom-scrollbar">
                {/* MANUAL FORM */}
                {showAddForm && (
                    <form onSubmit={handleAddManual} className="p-4 border border-primary/20 bg-primary/5 rounded-2xl space-y-3 animate-slideIn">
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                            <div className="space-y-1">
                                <label className="block text-txt-muted uppercase tracking-wider">{t('Nombre del Pozo', 'Well Name')}</label>
                                <input 
                                    type="text" 
                                    value={newWellName}
                                    onChange={(e) => setNewWellName(e.target.value)}
                                    placeholder="e.g. AMATISTA-19H"
                                    className="w-full bg-canvas border border-surface-light px-2.5 py-1.5 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-semibold rounded-lg"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-txt-muted uppercase tracking-wider">{t('Categoría', 'Category')}</label>
                                <select 
                                    value={newCategory}
                                    onChange={(e: any) => setNewCategory(e.target.value)}
                                    className="w-full bg-canvas border border-surface-light px-2.5 py-1.5 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-black rounded-lg uppercase"
                                >
                                    <option value="diagnosis">{t('Diagnóstico', 'Diagnosis')}</option>
                                    <option value="design">{t('Diseño', 'Design')}</option>
                                    <option value="optimization">{t('Optimización', 'Optimization')}</option>
                                    <option value="alarm">{t('Alerta', 'Alarm')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1 text-[10px] font-bold">
                            <label className="block text-txt-muted uppercase tracking-wider">{t('Firma Técnica (Parámetros)', 'Technical Signature')}</label>
                            <input 
                                type="text" 
                                value={newSignature}
                                onChange={(e) => setNewSignature(e.target.value)}
                                placeholder="bomba|Q:caudal|PIP:pip|F:hz"
                                className="w-full bg-canvas border border-surface-light px-2.5 py-1.5 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-mono rounded-lg"
                            />
                        </div>

                        <div className="space-y-1 text-[10px] font-bold">
                            <label className="block text-txt-muted uppercase tracking-wider">{t('Recomendación Técnica (Markdown)', 'Technical Recommendation')}</label>
                            <textarea 
                                value={newRecommendation}
                                onChange={(e) => setNewRecommendation(e.target.value)}
                                placeholder={t('Escribe la recomendación o análisis técnico en Markdown...', 'Write the recommendation or technical analysis in Markdown...')}
                                rows={4}
                                required
                                className="w-full bg-canvas border border-surface-light px-2.5 py-1.5 text-[11px] text-txt-main outline-none focus:border-primary/50 transition-all font-semibold rounded-lg resize-none custom-scrollbar"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary hover:bg-primary/95 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg shadow-primary/20"
                        >
                            <Check className="w-3.5 h-3.5" />
                            {t('Guardar en Memoria', 'Save to Memory')}
                        </button>
                    </form>
                )}

                {/* MEMORY ITEMS */}
                {filteredMemory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 py-12 text-center">
                        <Brain className="w-8 h-8 text-txt-muted/50 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-txt-muted">
                            {t('No se encontraron registros', 'No records found')}
                        </p>
                    </div>
                ) : (
                    filteredMemory.map(c => {
                        const isExpanded = expandedCaseId === c.id;
                        const isEditing = editingId === c.id;
                        const dateStr = new Date(c.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                        return (
                            <div 
                                key={c.id} 
                                className={`glass-surface border border-white/5 hover:border-white/10 rounded-2xl transition-all overflow-hidden ${
                                    isExpanded ? 'ring-1 ring-primary/20 shadow-md' : 'shadow-sm'
                                }`}
                            >
                                {/* CARD HEADER */}
                                <div 
                                    onClick={() => {
                                        if (isEditing) return;
                                        setExpandedCaseId(isExpanded ? null : c.id);
                                    }}
                                    className="p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/5 transition-all"
                                >
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-black text-txt-main truncate">
                                                {c.wellName || t('Caso General', 'General Case')}
                                            </span>
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                                c.category === 'diagnosis' ? 'bg-info/10 border-info/20 text-info' :
                                                c.category === 'alarm' ? 'bg-danger/10 border-danger/20 text-danger' :
                                                c.category === 'optimization' ? 'bg-secondary/10 border-secondary/20 text-secondary' :
                                                'bg-primary/10 border-primary/20 text-primary'
                                            }`}>
                                                {c.category}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[9px] font-black uppercase text-txt-muted opacity-80">
                                            <span className="font-mono text-glow-primary">{c.technicalSignature}</span>
                                            <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {dateStr}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 p-1">
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-txt-muted" /> : <ChevronDown className="w-4 h-4 text-txt-muted" />}
                                    </div>
                                </div>

                                {/* CARD EXPANDED CONTENT */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-white/5 bg-canvas/30 animate-fadeIn space-y-3">
                                        {isEditing ? (
                                            <div className="space-y-2 pt-3">
                                                <textarea
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    rows={6}
                                                    className="w-full bg-canvas border border-primary/40 px-3 py-2 text-[11px] text-txt-main outline-none focus:border-primary/75 transition-all font-semibold rounded-xl resize-none custom-scrollbar"
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => { setEditingId(null); setEditingText(''); }}
                                                        className="px-3 py-1.5 border border-surface-light/80 hover:bg-white/5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                    >
                                                        {t('Cancelar', 'Cancel')}
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveEdit(c)}
                                                        className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                        {t('Guardar', 'Save')}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="pt-3.5 text-[11px] leading-relaxed markdown-content max-w-full overflow-x-auto text-txt-muted">
                                                    <MarkdownRenderer content={c.recommendation} />
                                                </div>
                                                
                                                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                                                    <div className="text-[8px] font-black uppercase text-txt-muted/50">
                                                        ID: {c.id.substring(0, 8)}...
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(c.id);
                                                                setEditingText(c.recommendation);
                                                            }}
                                                            className="p-2 hover:bg-primary/10 text-txt-muted hover:text-primary rounded-xl transition-all"
                                                            title={t('Editar recomendación', 'Edit recommendation')}
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-2 hover:bg-danger/10 text-txt-muted hover:text-danger rounded-xl transition-all"
                                                            title={t('Eliminar registro', 'Delete record')}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
