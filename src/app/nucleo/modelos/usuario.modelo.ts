export type Rol = 'SUPER_ADMIN' | 'ADMIN' | 'SECRETARIA';

export interface UsuarioSistema {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  fotoPerfil?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface SesionLog {
  id: number;
  usuarioId: number;
  inicioSesion: string;
  cierreSesion?: string;
  ipAcceso?: string;
  navegador?: string;
}

export interface PermisoSecretaria {
  id: number;
  usuarioId: number;
  puedeCrearAfiliados: boolean;
  puedeEditarAfiliados: boolean;
  puedeEliminarAfiliados: boolean;
  puedeCrearEmpresas: boolean;
  puedeEditarEmpresas: boolean;
  puedeEliminarEmpresas: boolean;
  puedeSubirDocumentos: boolean;
  puedeEliminarDocumentos: boolean;
  puedeVerPagos: boolean;
  puedeRegistrarPagos: boolean;
}
