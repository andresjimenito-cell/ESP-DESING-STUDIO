# 📊 Guía Técnica: Motor de Cálculos PVT (Termodinámica de Fluidos)

Este documento detalla los fundamentos matemáticos y termodinámicos que utiliza el motor de la **Fase 2: Fluids** para calcular las propiedades del petróleo, gas y agua en condiciones de yacimiento y tubería.

---

## 🔍 1. Descripción General
El motor PVT (Presión - Volumen - Temperatura) predice el comportamiento físico de las fases líquidas y gaseosas a medida que el fluido viaja desde el yacimiento hasta la superficie del pozo. Es la base indispensable para el posterior análisis hidráulico y el diseño del Bombeo Electrosumergible (ESP).

---

## 🧪 2. Correlaciones Termodinámicas Utilizadas

### A. Correlación de Lasater
Utilizada principalmente para calcular la **Relación Gas-Aceite en Solución ($R_s$)** y la **Presión de Burbuja ($P_b$)** en crudos saturados.
*   **Ideal para:** Crudos livianos e intermedios (gravedad API entre $13.7^\circ$ y $51.1^\circ$).
*   **Límite de aplicación:** Temperaturas de yacimiento de hasta $272^\circ\text{F}$.

### B. Correlación de Vazquez & Beggs
Es el estándar industrial para calcular el **Factor de Volumen del Petróleo ($B_o$)** y la **Viscosidad del Petróleo ($u_o$)**.
*   **Funcionamiento:** Ajusta sus coeficientes según el rango de gravedad API (dividiendo en crudos menores y mayores a $30^\circ\text{API}$).
*   **Rango de Presión:** Válido para presiones por encima y por debajo de la Presión de Burbuja ($P_b$).

### C. Correlación de Glaso
Utilizada como alternativa robusta para crudos del Mar del Norte y regiones con composiciones específicas de gas.
*   **Cálculos clave:** Factor de volumen ($B_o$) y solubilidad de gas ($R_s$) con factores de corrección por gravedad específica del gas.

---

## 📐 3. Ecuaciones Clave del Motor

### 1. Factor de Volumen del Petróleo ($B_o$)
Representa la relación entre el volumen de petróleo más el gas disuelto en condiciones de yacimiento y el volumen de petróleo estabilizado en superficie (su unidad es $\text{bbl/STB}$):
$$ B_o = 1.0 + C_1 \cdot R_s + C_2 \cdot (T - 60) \cdot \left(\frac{API}{\gamma_{gs}}\right) + C_3 \cdot R_s \cdot (T - 60) \cdot \left(\frac{API}{\gamma_{gs}}\right) $$
*Donde $C_1, C_2, C_3$ son coeficientes que varían según la correlación seleccionada (Vazquez & Beggs, Glaso o Standish).*

### 2. Viscosidad del Petróleo Muerto ($u_{od}$)
Viscosidad a presión atmosférica y temperatura de yacimiento:
$$ u_{od} = \frac{10^x}{T^{1.163}} $$
$$ x = \frac{10^{y}}{API^{1.897}} $$

---

## ⚠️ 4. Reglas de Validación y Consistencia
Para evitar que la simulación de la bomba ESP falle por cálculos irreales, el motor de la suite aplica validaciones automáticas:

1.  **Presión vs. Presión de Burbuja ($P$ vs $P_b$):**
    *   **Bajo el punto de burbuja ($P < P_b$):** El gas libre comienza a liberarse. El motor activa la correlación de gas libre y reduce el volumen de líquido efectivo que ingresa a la bomba.
    *   **Sobre el punto de burbuja ($P \ge P_b$):** Todo el gas está disuelto. Se asume comportamiento de líquido subsaturado y el factor de volumen disminuye levemente debido a la compresibilidad del aceite.
2.  **Validación de Unidades:**
    *   **Presión ($P$):** Siempre en libras por pulgada cuadrada manométricas ($\text{psig}$).
    *   **Temperatura ($T$):** Ingresada en Fahrenheit ($^\circ\text{F}$), pero convertida a Rankine ($^\circ\text{R}$) internamente para las correlaciones que lo exigen.
    *   **Relación Gas-Aceite ($GOR$):** Expresada en pies cúbicos estándar por barril en condiciones de tanque ($\text{SCF/STB}$).

---

## 💡 5. Diagnóstico de Errores Comunes en Fluids

Si la app te advierte de inconsistencias, revisa los siguientes parámetros:
*   **Gravedad del gas ($\gamma_g$):** Debe estar en el rango de $0.5$ a $1.2$. Valores fuera de este rango distorsionan el cálculo de la Presión de Burbuja.
*   **Gravedad del Petróleo ($API$):** Si ingresas valores menores a $10$ (petróleo extrapesado), la correlación de Lasater puede divergir. Se recomienda cambiar a correlaciones adaptadas para crudos pesados si están disponibles.
*   **Relación Agua-Aceite ($WOR$):** Asegúrate de que los cálculos de viscosidad de la emulsión utilicen la fracción de agua correcta para evitar sobreestimar las pérdidas de fricción en la bomba.
