// 2026-10-22 (Anyi): misma regla que el servidor (backend src/comun/desglose-pago.ts)
// para mostrar al registrar un pago cuánto es trámite, seguridad social y 4x1000.
// Si el valor se cambia, se respetan el trámite y el 4x1000 y la diferencia
// va a seguridad social; lo que sobra en el primer pago es la afiliación.
export interface PartesCuota { seguridadSocial: number; cuatroXMil: number; comision: number; valorAfiliacion?: number }
export interface Desglose { seguridadSocial: number; cuatroXMil: number; comision: number; afiliacion: number; total: number }

export function desglosar(monto: number, meses: number, partes: PartesCuota, esPrimerPago = false): Desglose {
  const m = Math.max(1, meses || 1);
  const esperado = { seguridadSocial: partes.seguridadSocial * m, cuatroXMil: partes.cuatroXMil * m, comision: partes.comision * m };
  const totalEsperado = esperado.seguridadSocial + esperado.cuatroXMil + esperado.comision;
  let afiliacion = 0;
  let resto = monto - totalEsperado;
  if (resto > 0 && esPrimerPago && (partes.valorAfiliacion ?? 0) > 0) {
    afiliacion = Math.min(resto, partes.valorAfiliacion ?? 0);
    resto -= afiliacion;
  }
  if (Math.abs(resto) < 0.5) return { ...esperado, afiliacion, total: monto };
  const disponible = monto - afiliacion;
  const comision = Math.min(esperado.comision, Math.max(0, disponible));
  const cuatroXMil = Math.min(esperado.cuatroXMil, Math.max(0, disponible - comision));
  const seguridadSocial = Math.max(0, disponible - comision - cuatroXMil);
  return { seguridadSocial, cuatroXMil, comision, afiliacion, total: monto };
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// "2026-10" -> "octubre 2026"
export function nombreMes(texto: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(texto ?? '');
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
}

// meses alrededor de uno dado, para escoger "Mes que paga"
export function mesesCercanos(centro: string, antes = 3, despues = 3): { valor: string; nombre: string }[] {
  const m = /^(\d{4})-(\d{2})/.exec(centro);
  const base = m ? Number(m[1]) * 12 + Number(m[2]) - 1 : new Date().getFullYear() * 12 + new Date().getMonth();
  const lista = [];
  for (let i = base - antes; i <= base + despues; i++) {
    const valor = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
    lista.push({ valor, nombre: nombreMes(valor) });
  }
  return lista;
}
