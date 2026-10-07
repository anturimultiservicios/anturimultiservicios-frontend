import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface ConfigSistema {
  enviarCorreosCobro: boolean;
  correoTestDestinatario: string;
  dispositivoObligatorio: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigSistemaServicio {
  private readonly URL = `${entorno.urlApi}/config-sistema`;

  constructor(private http: HttpClient) {}

  obtener(): Observable<ConfigSistema> {
    return this.http.get<ConfigSistema>(this.URL);
  }

  // dispositivoObligatorio deliberadamente fuera del DTO real del backend -
  // no es togglable por este endpoint (ver comentario en
  // config-sistema.dto.ts), por eso no se manda acá.
  actualizar(enviarCorreosCobro: boolean): Observable<ConfigSistema> {
    return this.http.patch<ConfigSistema>(this.URL, { enviarCorreosCobro });
  }

  enviarCorreoTest(): Observable<{ mensaje: string }> {
    return this.http.get<{ mensaje: string }>(`${this.URL}/test-correo`);
  }
}
