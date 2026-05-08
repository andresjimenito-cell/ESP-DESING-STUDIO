# ESP Design Studio — Sistema de Diseño Premium

Este documento detalla la arquitectura visual, los tokens de diseño y los efectos especiales utilizados en la aplicación ESP Design Studio.

## 1. Filosofía de Diseño
La aplicación utiliza un lenguaje visual **"High-Tech / Premium"** basado en:
- **Glassmorphism:** Superficies translúcidas con desenfoque de fondo.
- **Dynamic Backgrounds:** Fondos animados con "auroras" de luz.
- **Deep Hierarchies:** Uso intensivo de sombras con resplandor (glow) y bordes sutiles.
- **Themes:** Soporte nativo para temas dinámicos.

## 2. Paletas de Colores (Tokens Dinámicos)
Los colores se manejan mediante variables CSS en `index.css` y se mapean en `tailwind.config.js`.

### Temas Oscuros (Dark Mode)
- **Fusion (Carbon):** Gris Carbón (#0F172A) + Azul Pizarra Mate (#64748B). Minimalista y elegante.
- **Matrix (Cyber):** Negro Puro (#050505) + Verde Neón (#22C55E). Estilo futurista/hacker.

### Temas Claros (Light Mode)
- **Executive (Petroleum):** Azul Petróleo Profundo (#042166) + Vinotinto Seco. Serio y profesional.
- **Ivory (Heritage):** Teal Sofisticado + Ámbar Cálido. Lujo minimalista.

## 3. Tokens Visuales (Variables Globales)
- **Bordes:**
    - `xs`: 4px | `sm`: 6px | `md`: 10px | `lg`: 16px | `xl`: 24px
- **Tipografía:**
    - **Display/Headers:** `Inter`, font-weight 700-900.
    - **Body:** `Inter`, font-weight 400-600.
    - **Mono (Datos):** `JetBrains Mono`.

## 4. Efectos Especiales (Clases CSS)
### Fondo Aurora (`.aurora-bg`)
Efecto de fondo con manchas de luz animadas.
- `aurora-1`: Mancha primaria.
- `aurora-2`: Mancha secundaria.

## 5. Componentes UI Estándar
- `.btn-premium-primary`: Botón principal con gradiente y resplandor.
- `.card-identity`: Tarjetas con firma visual por tema.

## 6. Estructura de Archivos de Diseño
- `app_unified/src/index.css`: Definición core de todos los estilos.
- `app_unified/src/theme.tsx`: Lógica de intercambio de temas.
