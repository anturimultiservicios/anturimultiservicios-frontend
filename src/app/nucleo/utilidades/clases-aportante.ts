// 2026-10-15 (pedido de Cristopher): opciones de "Clase de aportante" para
// afiliados. Si una ficha vieja trae otro valor (del Excel), se sigue
// mostrando como opción para no perderlo.
export const CLASES_APORTANTE = [
  'Independiente',
  'Independiente contrato mayor a 1 mes',
  'Independiente residente en el exterior',
  'Independiente voluntario al sistema de riesgos laborales',
  'Independiente pensionado',
  'Independiente no obligado a pagar pensión',
  'Cooperativa',
  'Empleador',
];

export function opcionesClaseAportante(actual?: string | null): string[] {
  const v = (actual ?? '').trim();
  if (!v) return CLASES_APORTANTE;
  const igual = CLASES_APORTANTE.some((c) => c.toLowerCase() === v.toLowerCase());
  return igual ? CLASES_APORTANTE : [v, ...CLASES_APORTANTE];
}
