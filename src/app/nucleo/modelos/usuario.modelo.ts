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

// HALLAZGO (29/08): faltaban puedeCrearSucursales/puedeEditarSucursales/
// puedeVerDocumentos - existen en el backend (ActualizarPermisosDto,
// PermisoSecretaria del schema) y ya los aplican guards reales
// (SucursalesControlador, DocumentosControlador), pero esta interfaz ni
// siquiera los declaraba. Se agregan, sin tocar los que ya estaban.
export interface PermisoSecretaria {
  id: number;
  usuarioId: number;
  puedeCrearAfiliados: boolean;
  puedeEditarAfiliados: boolean;
  puedeEliminarAfiliados: boolean;
  puedeCrearEmpresas: boolean;
  puedeEditarEmpresas: boolean;
  puedeEliminarEmpresas: boolean;
  puedeCrearSucursales: boolean;
  puedeEditarSucursales: boolean;
  puedeSubirDocumentos: boolean;
  puedeEliminarDocumentos: boolean;
  puedeVerDocumentos: boolean;
  puedeVerPagos: boolean;
  puedeRegistrarPagos: boolean;
}
