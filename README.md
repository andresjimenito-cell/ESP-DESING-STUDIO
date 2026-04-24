# ESP DESIGN PRO - Analysis Suite 🛢️🚀

Bienvenido a **ESP DESIGN STUDIO - Professional Edition**. Este sistema ha sido diseñado para la optimización y diseño de sistemas de Levantamiento Artificial por Bombeo Electrosumergible (ESP).

## 📂 Estructura del Proyecto

### 🏢 Raíz de Proyecto
- `🛢️_INICIAR_ESP_STUDIO.bat`: **Lanzador principal**. Sincroniza datos en la nube e inicia la suite completa.
- `services/`: Motores de sincronización (PowerShell/Python) y utilidades de soporte.
- `app_unified/`: Directorio principal de la aplicación web (React + Vite + Tailwind).
- `scratch/`: Espacio para archivos temporales y notas de diseño.

### 🌐 Aplicación Principal (`app_unified/`)
- `src/`: Todo el código fuente de la aplicación (Componentes ALS, Modelos de IPR, Gráficos).
- `public/`: Bases de datos (Excel), Catálogos de Bombas y Motores, Modelos 3D.
- `tools/`: Scripts de pre-procesamiento de datos y optimización de carga.

---

## 🛠️ Cómo Iniciar

1. Asegúrate de tener **Node.js** y **Python** instalados en tu sistema.
2. Abre la carpeta del proyecto.
3. Haz doble clic en **`🛢️_INICIAR_ESP_STUDIO.bat`**.

> [!TIP]
> El sistema verificará automáticamente si hay actualizaciones en GitHub y sincronizará los datos más recientes desde OneDrive (ETag Sync) antes de iniciar. La carga de la App es instantánea gracias al motor de pre-cálculo JSON.

---

**Desarrollado por:** Andrés Jiménez Mieles - Ingeniero de Petróleos
**Versión:** Professional Edition 2026
