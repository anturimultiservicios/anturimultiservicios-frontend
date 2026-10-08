// 2026-10-08 (pedido de Cristopher): los cambios se muestran como datos de
// la persona/empresa, en español y con formato normal - nunca como código.

export interface FilaComparacion {
  etiqueta: string;
  antes: string;
  despues: string;
  cambio: boolean;
}

const ETIQUETAS: Record<string, string> = {
  nombres: 'Nombres', apellidos: 'Apellidos', cedula: 'Número de documento', tipoDocumento: 'Tipo de documento',
  genero: 'Género', correo: 'Correo', telefono: 'Teléfono', direccion: 'Dirección', municipio: 'Municipio',
  fechaNacimiento: 'Fecha de nacimiento', cargo: 'Cargo', claseAportante: 'Clase de aportante', diasPago: 'Días a cotizar',
  tipoAfiliacion: 'Tipo de afiliación', claseRiesgoArl: 'Clase de riesgo ARL', actividadEconomica: 'Actividad económica',
  ibc: 'Base de cotización (IBC)', valor: 'Seguridad social (mes)', comision: 'Administración Anturi', cuatroXMil: '4 x Mil',
  totalPago: 'Total mensual', cesantias: 'Cesantías', valorAfiliacion: 'Valor afiliación',
  porcentajeSalud: 'Salud (%)', porcentajePension: 'Pensión (%)', porcentajeArl: 'ARL (%)', porcentajeCaja: 'Caja (%)',
  porcentajeSaludEmpleador: 'Salud empleador (%)', porcentajePensionEmpleador: 'Pensión empleador (%)',
  porcentajeSena: 'SENA (%)', porcentajeIcbf: 'ICBF (%)',
  eps: 'EPS', afp: 'AFP (pensión)', arl: 'ARL', caja: 'Caja de compensación',
  estado: 'Estado', fechaIngreso: 'Fecha de ingreso', fechaRetiro: 'Fecha de retiro',
  notificarCorreo: 'Avisar por correo', notificarSms: 'Avisar por mensaje', notificarLlamada: 'Avisar por llamada',
  razonSocial: 'Razón social', nit: 'NIT', activa: 'Activa', ciudad: 'Ciudad', nombre: 'Nombre',
  tipoEvento: 'Tipo de evento', fechaInicio: 'Fecha de inicio', fechaFin: 'Fecha de fin',
};

const DINERO = new Set(['ibc', 'valor', 'comision', 'cuatroXMil', 'totalPago', 'cesantias', 'valorAfiliacion']);
const FECHAS = new Set(['fechaNacimiento', 'fechaIngreso', 'fechaRetiro', 'fechaInicio', 'fechaFin']);
const VALORES: Record<string, string> = {
  M: 'Masculino', F: 'Femenino', INDETERMINADO: 'Indeterminado',
  ACTIVO: 'Activo', RETIRADO: 'Retirado', SUSPENDIDO: 'Suspendido',
  INDEPENDIENTE: 'Independiente', INDEPENDIENTE_PARCIAL: 'Independiente parcial',
  INDEPENDIENTE_RESIDENTE_EXTERIOR: 'Residente en el exterior', INDEPENDIENTE_VOLUNTARIO_ARL: 'Independiente voluntario ARL',
  INDEPENDIENTE_CONTRATISTA: 'Independiente contratista', EMPRESA_EXONERADA: 'Empresa exonerada', EMPRESA_NO_EXONERADA: 'Empresa no exonerada',
};
// Datos internos que no le dicen nada a una persona
const OCULTOS = new Set(['id', 'personaId', 'sucursalId', 'creadoEn', 'actualizadoEn', 'eliminadoEn', 'eliminacionDefinitivaEn', 'creadoPorId', 'persona', 'sucursal', 'seguros', 'documentos', 'historial', 'clave', 'asopagos']);

function leer(json: string | object | null | undefined): Record<string, any> {
  if (!json) return {};
  if (typeof json === 'object') return json as Record<string, any>;
  try { return JSON.parse(json) ?? {}; } catch { return {}; }
}

export function formatearValor(campo: string, v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (DINERO.has(campo) && !isNaN(Number(v))) return '$' + Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  if (FECHAS.has(campo)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }
  if (typeof v === 'string' && VALORES[v]) return VALORES[v];
  if (typeof v === 'object') return '—';
  return String(v);
}

export function etiquetaCampo(campo: string): string {
  return ETIQUETAS[campo] ?? campo.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

// Filas "antes → después". soloCambios=true deja solo lo que cambió.
export function compararDatos(antesJson: any, despuesJson: any, soloCambios = true): FilaComparacion[] {
  const antes = { ...leer(antesJson) };
  const despues = leer(despuesJson);
  // el tipo de documento de los datos viejos viene dentro de la persona
  if (antes['tipoDocumento'] === undefined && antes['persona']?.tipoDocumento) antes['tipoDocumento'] = antes['persona'].tipoDocumento;
  const esObjeto = (v: any) => v !== null && typeof v === 'object';
  const campos = Array.from(new Set([...Object.keys(despues), ...(soloCambios ? [] : Object.keys(antes))]))
    .filter((c) => !OCULTOS.has(c) && !esObjeto(despues[c]) && !esObjeto(antes[c]));
  const filas = campos.map((c) => {
    const a = formatearValor(c, antes[c]);
    const d = formatearValor(c, despues[c]);
    return { etiqueta: etiquetaCampo(c), antes: a, despues: d, cambio: a !== d };
  });
  return soloCambios ? filas.filter((f) => f.cambio) : filas;
}

// Resumen legible de un registro (para eliminaciones/restauraciones).
export function resumenDatos(json: any): { etiqueta: string; valor: string }[] {
  const datos = leer(json);
  const orden = ['nombres', 'apellidos', 'razonSocial', 'nombre', 'tipoDocumento', 'cedula', 'nit', 'estado', 'tipoAfiliacion', 'telefono', 'correo', 'fechaIngreso', 'totalPago'];
  return orden
    .filter((c) => datos[c] !== undefined && datos[c] !== null && datos[c] !== '')
    .map((c) => ({ etiqueta: etiquetaCampo(c), valor: formatearValor(c, datos[c]) }));
}
