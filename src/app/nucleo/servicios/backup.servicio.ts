import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { entorno } from '../../../environments/entorno';

export interface BackupArchivo {
  nombre: string;
  tamanioKb: number;
  fecha: string;
}

@Injectable({ providedIn: 'root' })
export class BackupServicio {
  private readonly URL = `${entorno.urlApi}/backup`;

  constructor(private http: HttpClient) {}

  listar(): Observable<BackupArchivo[]> {
    return this.http.get<BackupArchivo[]>(this.URL);
  }

  ejecutar(): Observable<string> {
    return this.http.post(`${this.URL}/ejecutar`, {}, { responseType: 'text' });
  }
}
