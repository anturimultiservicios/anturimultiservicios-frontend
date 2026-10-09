// El frontend tiene una copia idéntica de este archivo (calendario sin
// internet) - si cambia, correr scripts/copiar-motor.sh.
// 2026-10-08 (decisión de Cristopher): el vencimiento mensual de cada
// afiliado es la fecha límite de la PILA según los dos últimos dígitos de su
// documento - Decreto 1990 de 2016, compilado en el Decreto 780 de 2016,
// art. 3.2.2.1. Los plazos son en DÍAS HÁBILES (lunes a viernes, sin
// festivos de Colombia).

// [hasta qué terminación, día hábil]
const TABLA_PILA: [number, number][] = [
  [7, 2], [14, 3], [21, 4], [28, 5], [35, 6], [42, 7], [49, 8], [56, 9],
  [63, 10], [69, 11], [75, 12], [81, 13], [87, 14], [93, 15], [99, 16],
];

export function diaHabilPorDocumento(documento: string): number {
  const digitos = String(documento ?? '').replace(/\D/g, '');
  const dos = digitos.length === 0 ? 0 : Number(digitos.slice(-2));
  return TABLA_PILA.find(([hasta]) => dos <= hasta)![1];
}

function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Domingo de Pascua (algoritmo anónimo gregoriano).
function domingoDePascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

function sumarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Ley Emiliani (Ley 51 de 1983): el festivo se corre al lunes siguiente.
function alLunes(d: Date): Date {
  const dia = d.getDay();
  return dia === 1 ? d : sumarDias(d, (8 - dia) % 7);
}

const cache = new Map<number, Set<string>>();

export function festivosColombia(anio: number): Set<string> {
  if (cache.has(anio)) return cache.get(anio)!;
  const p = domingoDePascua(anio);
  const fechas: Date[] = [
    // fijos
    new Date(anio, 0, 1), new Date(anio, 4, 1), new Date(anio, 6, 20),
    new Date(anio, 7, 7), new Date(anio, 11, 8), new Date(anio, 11, 25),
    // se corren al lunes
    alLunes(new Date(anio, 0, 6)), alLunes(new Date(anio, 2, 19)), alLunes(new Date(anio, 5, 29)),
    alLunes(new Date(anio, 7, 15)), alLunes(new Date(anio, 9, 12)), alLunes(new Date(anio, 10, 1)),
    alLunes(new Date(anio, 10, 11)),
    // según Pascua
    sumarDias(p, -3), sumarDias(p, -2), // Jueves y Viernes Santo
    sumarDias(p, 43), sumarDias(p, 64), sumarDias(p, 71), // Ascensión, Corpus Christi, Sagrado Corazón (lunes)
  ];
  const set = new Set(fechas.map(clave));
  cache.set(anio, set);
  return set;
}

export function esDiaHabil(d: Date): boolean {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6 && !festivosColombia(d.getFullYear()).has(clave(d));
}

// N-ésimo día hábil del mes (mes 0-11).
export function enesimoDiaHabil(anio: number, mes: number, n: number): Date {
  let cuenta = 0;
  for (let dia = 1; dia <= 31; dia++) {
    const d = new Date(anio, mes, dia);
    if (d.getMonth() !== mes) break;
    if (esDiaHabil(d) && ++cuenta === n) return d;
  }
  // No debería pasar (todo mes tiene al menos 16 días hábiles); por si acaso, último día.
  return new Date(anio, mes + 1, 0);
}

export function fechaLimitePila(documento: string, anio: number, mes: number): Date {
  return enesimoDiaHabil(anio, mes, diaHabilPorDocumento(documento));
}
