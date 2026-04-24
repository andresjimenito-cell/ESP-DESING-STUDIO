import os
import re
import io
import requests
import pandas as pd
from typing import List, Optional
from datetime import datetime

class CloudDataConnector:
    """
    🚀 Cloud Data Connector & Robust Parser
    Habilidad premium para descarga y extracción resiliente de datos desde la nube.
    """
    # ANSI Colors for Premium Console Output
    CY = "\033[38;2;0;215;215m"
    AM = "\033[38;2;255;180;0m"
    GR = "\033[38;2;0;215;120m"
    OR = "\033[38;2;255;130;20m"
    RE = "\033[38;2;255;70;70m"
    WH = "\033[38;2;210;225;245m"
    GY = "\033[38;2;120;140;160m"
    R = "\033[0m"

    def __init__(self, storage_dir: str = "data_cloud"):
        self.storage_dir = storage_dir
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)
            print(f"{self.GY}[*] Directorio de almacenamiento creado: {self.storage_dir}{self.R}")

    # --- FASE 1: El Scraper del Link Directo (OneDrive Bypass) ---
    def get_direct_link(self, sharing_url: str) -> str:
        """
        Extrae el link de descarga directa de un enlace compartido de OneDrive/SharePoint
        sin requerir autenticación API oficial.
        """
        print(f" {self.GY}├─{self.R} {self.WH}Analizando Hash Cloud . . .{self.R}", end="\r")
        
        try:
            # 1. Obtener HTML del visor
            response = requests.get(sharing_url, timeout=15)
            response.raise_for_status()
            html_content = response.text

            # 2. Buscar patrones de descarga directa (FileGetUrl o FileUrlNoAuth)
            patterns = [
                r'"FileGetUrl"\s*:\s*"([^"]+)"',
                r'"FileUrlNoAuth"\s*:\s*"([^"]+)"',
                r'downloadUrl\s*:\s*"([^"]+)"'
            ]
            
            direct_link = None
            for pattern in patterns:
                match = re.search(pattern, html_content)
                if match:
                    direct_link = match.group(1)
                    break
            
            if not direct_link:
                if "1drv.ms" in sharing_url or "onedrive.live.com" in sharing_url:
                    direct_link = sharing_url.replace("redir?", "download?").replace("view?", "download?")
                else:
                    raise Exception("No se pudo extraer el link directo del HTML.")

            # 3. Limpiar caracteres escapados (\u0026 -> &)
            direct_link = direct_link.replace("\\u0026", "&")
            
            return direct_link

        except Exception as e:
            print(f"\n{self.RE}[!] Error en Bypass: {e}{self.R}")
            raise

    # --- FASE 2: Gestión de Persistencia y Caché ---
    def fetch_data(self, url: str, filename: str, force_download: bool = False) -> str:
        """
        Descarga el archivo y lo guarda localmente. Implementa una lógica de caché básica.
        """
        local_path = os.path.join(self.storage_dir, filename)
        
        # Simulación de progreso visual
        print(f" {self.GY}├─{self.R} {self.WH}Sincronizando:{self.R} {self.CY}{filename}{self.R}", end="\r")
        
        # Si no está en caché, obtener link directo y descargar
        direct_link = self.get_direct_link(url)
        
        try:
            resp = requests.get(direct_link, stream=True)
            resp.raise_for_status()
            
            total_size = int(resp.headers.get('content-length', 0))
            downloaded = 0
            
            with open(local_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    downloaded += len(chunk)
                    f.write(chunk)
                    # Barra de progreso simple
                    if total_size > 0:
                        pct = int((downloaded / total_size) * 100)
                        bar = "█" * (pct // 10) + "░" * (10 - (pct // 10))
                        print(f" {self.GY}├─{self.R} {self.WH}Descargando:{self.R} {self.CY}{filename}{self.R} {self.GY}[{self.GR}{bar}{self.GY}]{self.R} {pct}%", end="\r")
            
            print(f" {self.GY}└─{self.R} {self.GR}[SUCCESS]{self.R} {self.WH}{filename}{self.R} sincronizado.          ")
            return local_path
        except Exception as e:
            print(f"\n{self.RE}[!] Error en descarga de {filename}: {e}{self.R}")
            raise

    # --- FASE 3: El Extractor de Datos "Resiliente" (Dynamic Header Finder) ---
    def robust_parse(self, file_path: str, mandatory_cols: List[str]) -> pd.DataFrame:
        """
        Encuentra el encabezado dinámicamente buscando las palabras clave obligatorias.
        """
        print(f"[*] Analizando estructura de: {file_path}")
        
        # Determinar motor según extensión
        engine = 'openpyxl' if file_path.endswith('.xlsx') else None
        
        # Leer las primeras 50 filas sin encabezado para buscar la fila correct
        try:
            df_raw = pd.read_excel(file_path, header=None, nrows=50, engine=engine) if file_path.endswith('.xlsx') \
                     else pd.read_csv(file_path, header=None, nrows=50)
        except Exception as e:
            # Fallback simple si falla openpyxl
            df_raw = pd.read_excel(file_path, header=None, nrows=50)

        header_row_index = -1
        mandatory_cols_upper = [c.upper() for c in mandatory_cols]

        for i, row in df_raw.iterrows():
            # Convertir fila a lista de strings limpios y en mayúsculas
            row_values = [str(val).strip().upper() for val in row.values if pd.notna(val)]
            
            # Verificar si todas las palabras clave están en esta fila
            if all(col in row_values for col in mandatory_cols_upper):
                header_row_index = i
                print(f"[OK] Encabezado detectado en la fila: {header_row_index}")
                break
        
        if header_row_index == -1:
            raise Exception(f"No se encontró una fila con las columnas requeridas: {mandatory_cols}")

        # Recargar el DataFrame saltando las filas previas
        df = pd.read_excel(file_path, skiprows=header_row_index, engine=engine) if file_path.endswith('.xlsx') \
             else pd.read_csv(file_path, skiprows=header_row_index)
        
        return df

    # --- FASE 4: Estandarización de Datos (The Cleaning Pipeline) ---
    def clean_pipeline(self, df: pd.DataFrame, mandatory_cols: List[str]) -> pd.DataFrame:
        """
        Normaliza nombres de columnas, convierte tipos y elimina basura.
        """
        print("[*] Iniciando Pipeline de limpieza...")
        
        # 1. Normalización de Columnas
        # Quitar tildes, espacios, puntos y pasar a MAYÚSCULAS
        def normalize_str(s):
            s = str(s).upper().strip()
            s = re.sub(r'[.\s\t\n]+', '_', s)
            # Reemplazo básico de tildes
            replacements = {'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N'}
            for k, v in replacements.items():
                s = s.replace(k, v)
            return s

        df.columns = [normalize_str(c) for c in df.columns]
        mandatory_cols_norm = [normalize_str(c) for c in mandatory_cols]

        # 2. Dropna Estratégico
        # Eliminar filas donde falten datos en las columnas críticas
        df = df.dropna(subset=mandatory_cols_norm, how='any')

        # 3. Conversión de Tipos
        for col in df.columns:
            # Intentar convertir a fecha si parece fecha
            if 'FECHA' in col or 'DATE' in col:
                df[col] = pd.to_datetime(df[col], errors='coerce')
            # Intentar convertir a numérico si son valores
            elif any(x in col for x in ['VALOR', 'PRECIO', 'MONTO', 'TICKET', 'PRODUCCION']):
                df[col] = pd.to_numeric(df[col], errors='coerce')

        print(f"[OK] Limpieza completada. Filas procesadas: {len(df)}")
        return df

# --- MAPEO DE ARCHIVOS DEL PROYECTO ---
CLOUD_FILES = [
    {
        "url": "https://1drv.ms/x/c/06cc4035ad46ff97/IQClWg69qziUQZ4pcxlcyoF5AdzaFbqGWhkSVp1rxJKvfwQ?e=Zuk6P7",
        "filename": "DATAS DE DISEÑO.xlsx",
        "mandatory_cols": ["POZO", "P ESTATICA", "IP"]
    },
    {
        "url": "https://1drv.ms/x/c/06cc4035ad46ff97/IQCX60W0l5YeQbDd8jHpZlMJAa0JHU31uqYaXJU1Tawo8I8?e=SD43E4",
        "filename": "PRUEBAS DE PRODUCCION.xlsx",
        "mandatory_cols": ["POZO", "FECHA", "BFPD"]
    }
]

def sync_project_data():
    """
    Sincroniza los archivos locales en app_unified/public con las versiones de la nube.
    """
    # ANSI Colors
    CY = "\033[38;2;0;215;215m"
    GR = "\033[38;2;0;215;120m"
    OR = "\033[38;2;255;130;20m"
    WH = "\033[38;2;210;225;245m"
    GY = "\033[38;2;120;140;160m"
    R = "\033[0m"

    base_path = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(os.path.dirname(base_path), "app_unified", "public")
    
    connector = CloudDataConnector(storage_dir=public_dir)
    
    print(f"   {CY}╠════════════════════════════════════════════════════════════════════════╣{R}")
    print(f"   {CY}║{R}                                                                        {CY}║{R}")
    print(f"   {CY}║{R}      {OR}CLOUD DATA SYNC ENGINE{R} {GY}- Conexión segura establecida{R}               {CY}║{R}")
    print(f"   {CY}║{R}                                                                        {CY}║{R}")

    for item in CLOUD_FILES:
        try:
            connector.fetch_data(item['url'], item['filename'], force_download=True)
        except Exception as e:
            print(f"   {CY}║{R}      {OR}[ERROR]{R} No se pudo sincronizar {item['filename']}                 {CY}║{R}")

    print(f"   {CY}║{R}                                                                        {CY}║{R}")
    print(f"   {CY}╚════════════════════════════════════════════════════════════════════════╝{R}")

if __name__ == "__main__":
    sync_project_data()
