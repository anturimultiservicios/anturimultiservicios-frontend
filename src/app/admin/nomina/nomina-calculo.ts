// Copia del cálculo del servidor (src/nomina/nomina-calculo.ts) para ver los
// totales mientras se escribe. El servidor recalcula al guardar.
export interface EntradaLineaNomina {
  salarioBase: number;
  dias: number;
  conAuxilio?: boolean;
  valorIncapacidad?: number;
  valorVacaciones?: number;
  horasExtras?: number;
  recargos?: number;
  otrosIngresos?: number;
  otrosDescuentos?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularLineaNomina(e: EntradaLineaNomina, salarioMinimo: number, auxilioMensual: number) {
  const n = (v?: number) => Number(v ?? 0) || 0;
  const dias = Math.max(0, Math.min(31, n(e.dias)));
  const salario = r2((n(e.salarioBase) * dias) / 30);
  const auxTransporte = e.conAuxilio ? r2((auxilioMensual * dias) / 30) : 0;
  const salarial = salario + n(e.valorIncapacidad) + n(e.valorVacaciones) + n(e.horasExtras) + n(e.recargos);
  const totalDevengado = r2(salarial + auxTransporte + n(e.otrosIngresos));
  const salud = r2(salarial * 0.04);
  const pension = r2(salarial * 0.04);
  const fondoSolidaridad = n(e.salarioBase) >= 4 * salarioMinimo ? r2(salarial * 0.01) : 0;
  const totalDescuentos = r2(salud + pension + fondoSolidaridad + n(e.otrosDescuentos));
  return { salario, auxTransporte, totalDevengado, salud, pension, fondoSolidaridad, totalDescuentos, neto: r2(totalDevengado - totalDescuentos) };
}
