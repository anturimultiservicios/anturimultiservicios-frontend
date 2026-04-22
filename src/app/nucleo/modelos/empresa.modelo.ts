export interface Empresa {
  id: number;
  razonSocial: string;
  nit: string;
  correo?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  activa: boolean;
  creadoEn: string;
  actualizadoEn: string;
  sucursales?: Sucursal[];
}

export interface Sucursal {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
  empresaId: number;
  activa: boolean;
  creadoEn: string;
  actualizadoEn: string;
  afiliados?: Afiliado[];
}

export interface Afiliado {
  id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo?: string;
  telefono?: string;
  fechaNacimiento?: string;
  cargo?: string;
  estado: 'ACTIVO' | 'RETIRADO' | 'SUSPENDIDO';
  sucursalId?: number;
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn?: string;
  seguros?: Seguro[];
  documentos?: Documento[];
}

export interface Seguro {
  id: number;
  afiliadoId: number;
  tipo: 'EPS' | 'PENSION' | 'CAJA_COMPENSACION' | 'ARL';
  entidad: string;
  fechaAfiliacion: string;
  fechaVencimiento?: string;
  estadoPago: 'AL_DIA' | 'PENDIENTE' | 'VENCIDO';
  pagos?: Pago[];
}

export interface Pago {
  id: number;
  seguroId: number;
  fechaPago: string;
  fechaPeriodo: string;
  monto?: number;
  referencia?: string;
  confirmadoEmail: boolean;
}

export interface Documento {
  id: number;
  afiliadoId: number;
  tipo: 'CEDULA' | 'AFILIACION' | 'CONTRATO' | 'CERTIFICADO' | 'OTRO';
  nombre: string;
  rutaArchivo: string;
  extension: string;
  tamanoKb?: number;
  estado: 'ACTIVO' | 'ELIMINADO';
  creadoEn: string;
}
