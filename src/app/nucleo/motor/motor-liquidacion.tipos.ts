// 2026-10-09: sin depender de @prisma/client - este archivo también se usa
// en el navegador (cálculo sin internet). Igual al enum ClaseRiesgoArl de Prisma.
export type ClaseRiesgoArl = 'I' | 'II' | 'III' | 'IV' | 'V';

// 2026-10-02 — FASE B del motor de liquidaciones. Ver
// database/historia/MOTOR-LIQUIDACION-CIERRE-FASE-A-2026-10-02.md para la
// matriz de reglas que esto implementa. Las 6 modalidades reales:
//   INDEPENDIENTE                       → liquidarIndependiente(tipo, ...)
//   INDEPENDIENTE_VOLUNTARIO_ARL        → liquidarIndependiente(tipo, ...)
//   INDEPENDIENTE_CONTRATISTA           → liquidarIndependiente(tipo, ...) (= "Contrato Mayor Un Mes")
//   INDEPENDIENTE_RESIDENTE_EXTERIOR    → liquidarIndependiente(tipo, ...) (plantilla 35, solo pensión - 2026-10-08)
//   INDEPENDIENTE_PARCIAL               → liquidarParcial(...) (cotización por semanas, Decreto 2616/2013)
//   EMPRESA_EXONERADA / NO_EXONERADA    → liquidarEmpleador(modalidad, ...)
// Las 4 modalidades de independiente comparten el mismo camino de cálculo
// (vía PlantillaLiquidacion, tipo 1-34) - lo que cambia es CUÁL tipo/fila
// corresponde, decisión que ya toma la pantalla de afiliados hoy, no el
// motor.

export type ModalidadEmpleador = 'EMPRESA_EXONERADA' | 'EMPRESA_NO_EXONERADA';

// Una línea de cálculo explicable - un componente del total, con su base y
// tarifa visibles, nunca solo el resultado final. Mapea 1:1 a
// LineaLiquidacion (categoria/subsistema/base/tarifa/valor) para cuando se
// persista.
export interface LineaCalculo {
  categoria: 'APORTE_SUBSISTEMA' | 'PROPIA_ANTURI' | 'CARGO_FINANCIERO' | 'MORA';
  subsistema?: 'EPS' | 'PENSION' | 'CAJA_COMPENSACION' | 'ARL';
  concepto: string;
  base: number;
  tarifa: number;
  valor: number;
  parametroCodigo?: string;
}

export interface ParametroUsado {
  codigo: string;
  valor: number;
  vigenteDesde: string;
  fuente: string;
}

// Resultado completo, explicable - responde "¿por qué este valor dio así?"
// (sección 18 del pedido) sin tener que volver al Excel original.
export interface ResultadoMotorLiquidacion {
  modalidad: string;
  ibc: number; // K
  diasMora: number;
  lineas: LineaCalculo[];
  valorSeguridadSocial: number;       // L = suma de líneas APORTE_SUBSISTEMA
  valorMora: number;                  // M
  totalValorSeguridadSocial: number;  // N = L + M
  valorCuatroXMil: number;            // O
  valorAdministracion: number;        // P
  valorAfiliacion: number;            // cobro único de afiliación (0 si no aplica) - 2026-10-08
  totalAPagar: number;                // Q = N + O + P + afiliación (única fórmula, sin variantes)
  diasCotizados: number;              // 1-30, mes comercial de 30 días
  metadatos: {
    fecha: string;
    redondeoMultiplo: number;
    versionMotor: string;
    parametrosUsados: ParametroUsado[];
  };
}

// 2026-10-08 (decisión de Cristopher): mes comercial SIEMPRE de 30 días
// (aunque el mes tenga 28 o 31). diasCotizados < 30 = ingreso a mitad de mes
// (ej. entra el 28 → 3 días: 28, 29, 30) o retiro (días que alcanzó a estar):
// base y aportes proporcionales, como en la PILA. valorAfiliacion = cobro
// ÚNICO al afiliarse (variable, lo escribe quien registra), aparte de la
// administración de Anturi - se suma al total solo cuando se manda.
export interface OpcionesCobro {
  diasCotizados?: number; // 1-30, por defecto 30
  valorAfiliacion?: number; // >= 0, por defecto 0
}

export interface EntradaIndependiente extends OpcionesCobro {
  tipoPlantilla: number; // id de plantillas_liquidacion (1-34 hoy)
  ibc: number;
  diasMora?: number;
  fecha?: Date;
}

// 2026-10-08 — INDEPENDIENTE_PARCIAL: ingresos menores a 1 SMLMV, cotización
// por semanas (Decreto 2616/2013, compilado en Decreto 1072/2015). No usa
// plantilla porque cada subsistema tiene su propia base:
//   pensión y caja → semanas × (SMLMV / 4)   (1-7 días = 1 semana, 8-14 = 2, 15-21 = 3, >21 = 4)
//   ARL            → 1 SMLMV completo, sin importar los días
//   salud          → no cotiza (debe estar en régimen subsidiado o como beneficiario)
export interface EntradaParcial extends Pick<OpcionesCobro, 'valorAfiliacion'> {
  diasCotizados: number; // 1-30
  claseRiesgoArl: ClaseRiesgoArl;
  codigoCaja?: 'CAJA_06' | 'CAJA_2' | 'CAJA_EMPRESA' | null; // caja opcional: 0.6%/2% sin contrato, 4% con contrato (Decreto 2616)
  diasMora?: number;
  fecha?: Date;
}

export interface EntradaEmpleador extends OpcionesCobro {
  modalidad: ModalidadEmpleador;
  ibc: number; // base del trabajador
  claseRiesgoArl: ClaseRiesgoArl;
  diasMora?: number;
  fecha?: Date;
}

export const VERSION_MOTOR = 'motor-liquidacion-v1';
