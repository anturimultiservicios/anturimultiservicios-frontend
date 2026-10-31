// 2026-10-31 (Anturi): PRESUNCIÓN DE COSTOS UGPP (antes el Excel "PRESUNCION
// DE COSTOS UPGG.xlsx"). Para independientes por cuenta propia y contratos
// distintos a prestación de servicios personales:
//   total de ingresos (contratos) × % de la actividad = costos presuntos
//   total − costos presuntos = base
//   base × 40% = IBC para pago   (mínimo 1 SMLMV, máximo 25 SMLMV)
// Tabla: Resolución UGPP 532 de 2024, aplicada desde el 9 de mayo de 2026
// (Decreto 379 de 2026). Si la UGPP la actualiza, se cambia SOLO aquí.

export interface OpcionPresuncion { clave: string; grupo: string; nombre: string; porcentaje: number }

export const PRESUNCION_COSTOS: OpcionPresuncion[] = [
  { clave: 'A', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'A - Agricultura, ganadería, caza, silvicultura y pesca', porcentaje: 66.85 },
  { clave: 'B', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'B - Explotación de minas y canteras', porcentaje: 56.39 },
  { clave: 'C', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'C - Industrias manufactureras', porcentaje: 62.34 },
  { clave: 'D', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'D - Electricidad, gas, vapor y aire acondicionado', porcentaje: 60.30 },
  { clave: 'E', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'E - Agua, alcantarillado, desechos y saneamiento', porcentaje: 65.15 },
  { clave: 'F', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'F - Construcción', porcentaje: 62.89 },
  { clave: 'G', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'G - Comercio al por mayor y al por menor; reparación de vehículos', porcentaje: 66.97 },
  { clave: 'H', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'H - Transporte y almacenamiento', porcentaje: 63.79 },
  { clave: 'I', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'I - Alojamiento y servicios de comida', porcentaje: 61.67 },
  { clave: 'J', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'J - Información y comunicaciones', porcentaje: 61.17 },
  { clave: 'K', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'K - Actividades financieras y de seguros', porcentaje: 60.65 },
  { clave: 'L', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'L - Actividades inmobiliarias', porcentaje: 61.73 },
  { clave: 'M', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'M - Actividades profesionales, científicas y técnicas', porcentaje: 62.04 },
  { clave: 'N', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'N - Servicios administrativos y de apoyo', porcentaje: 59.10 },
  { clave: 'O', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'O - Administración pública y defensa', porcentaje: 65.25 },
  { clave: 'P', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'P - Educación', porcentaje: 67.08 },
  { clave: 'Q', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'Q - Salud humana y asistencia social', porcentaje: 63.24 },
  { clave: 'R', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'R - Artes, entretenimiento y recreación', porcentaje: 56.92 },
  { clave: 'S', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'S - Otras actividades de servicios', porcentaje: 56.33 },
  { clave: 'T', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'T - Hogares como empleadores', porcentaje: 56.01 },
  { clave: 'U', grupo: 'Actividad (sección CIIU del RUT)', nombre: 'U - Organizaciones extraterritoriales', porcentaje: 64.26 },
  { clave: 'NC', grupo: 'Otros casos', nombre: 'Actividad no clasificada en otra parte', porcentaje: 62.53 },
  { clave: 'MEDIA', grupo: 'Otros casos', nombre: 'Presunción media', porcentaje: 62.88 },
  { clave: 'RENTISTA', grupo: 'Otros casos', nombre: 'Rentistas de capital (incluye dividendos)', porcentaje: 28.08 },
  // Transporte público automotor de carga: según los ingresos brutos ANUALES
  { clave: 'CARGA1', grupo: 'Transporte de carga (según ingresos del año)', nombre: 'Carga - hasta 485 SMLMV al año', porcentaje: 67.6 },
  { clave: 'CARGA2', grupo: 'Transporte de carga (según ingresos del año)', nombre: 'Carga - de 485 a 970 SMLMV al año', porcentaje: 71.1 },
  { clave: 'CARGA3', grupo: 'Transporte de carga (según ingresos del año)', nombre: 'Carga - de 970 a 1.455 SMLMV al año', porcentaje: 72.2 },
  { clave: 'CARGA4', grupo: 'Transporte de carga (según ingresos del año)', nombre: 'Carga - de 1.455 a 1.940 SMLMV al año', porcentaje: 72.8 },
  { clave: 'CARGA5', grupo: 'Transporte de carga (según ingresos del año)', nombre: 'Carga - de 1.940 a 2.425 SMLMV al año', porcentaje: 73.1 },
  { clave: 'CARGA6', grupo: 'Transporte de carga (según ingresos del año)', nombre: 'Carga - más de 2.425 SMLMV al año', porcentaje: 73.4 },
];

export const GRUPOS_PRESUNCION = [...new Set(PRESUNCION_COSTOS.map((o) => o.grupo))];

export interface ResultadoPresuncion {
  total: number;
  costos: number;
  base: number;
  ibcCalculado: number;
  // con los topes de ley (1 y 25 SMLMV) si se conoce el salario mínimo
  ibcPago: number;
  ajuste: 'MINIMO' | 'MAXIMO' | null;
}

// Mismo cálculo que el Excel (redondeado al peso).
export function calcularPresuncion(valores: number[], porcentaje: number, smlmv?: number | null): ResultadoPresuncion {
  const total = valores.reduce((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);
  const costos = Math.round(total * (porcentaje / 100));
  const base = total - costos;
  const ibcCalculado = Math.round(base * 0.4);
  let ibcPago = ibcCalculado;
  let ajuste: ResultadoPresuncion['ajuste'] = null;
  if (smlmv && smlmv > 0 && total > 0) {
    if (ibcCalculado < smlmv) { ibcPago = smlmv; ajuste = 'MINIMO'; }
    else if (ibcCalculado > smlmv * 25) { ibcPago = smlmv * 25; ajuste = 'MAXIMO'; }
  }
  return { total, costos, base, ibcCalculado, ibcPago, ajuste };
}
