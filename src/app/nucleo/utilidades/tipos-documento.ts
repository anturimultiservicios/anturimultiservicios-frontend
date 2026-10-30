// 2026-10-08: tipos de documento de identidad (mismos códigos que valida el
// backend en CrearAfiliadoDto). No todos los afiliados tienen cédula: hay
// menores (TI/RC), extranjeros (CE/PPT/PEP/pasaporte), etc.
export const TIPOS_DOCUMENTO: { valor: string; nombre: string }[] = [
  { valor: 'CC', nombre: 'Cédula de ciudadanía' },
  { valor: 'TI', nombre: 'Tarjeta de identidad' },
  { valor: 'CE', nombre: 'Cédula de extranjería' },
  { valor: 'PPT', nombre: 'Permiso por protección temporal (PPT)' },
  { valor: 'PE', nombre: 'Permiso especial de permanencia (PEP)' },
  { valor: 'PP', nombre: 'Pasaporte' },
  { valor: 'RC', nombre: 'Registro civil' },
  { valor: 'CD', nombre: 'Carné diplomático' },
  // 2026-10-30 (Cristopher): los que faltaban para extranjeros (venezolanos...)
  { valor: 'SC', nombre: 'Salvoconducto de permanencia (SC)' },
  { valor: 'DE', nombre: 'Documento de identidad extranjero (ej. cédula venezolana)' },
  { valor: 'NUIP', nombre: 'NUIP (número único de identificación personal)' },
];

// Sigla corta para mostrar junto al número (ej. "PPT 12345678").
export function siglaDocumento(tipo?: string | null): string {
  if (!tipo) return 'CC';
  return tipo === 'PP' || tipo === 'PA' ? 'Pasaporte' : tipo === 'PE' ? 'PEP' : tipo;
}
