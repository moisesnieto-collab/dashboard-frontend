import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.prod';


export interface ResumenDiario {
  cliente: string;
  entidad: string;
  fechaScrapper: string;
  horaInicio: string;
  horaFin: string;
  status: string;
  message: string;
  cantidad: number;
}

export interface TimeSeriesData {
  date: string;
  status: string;
  count: number;
}

export interface ErrorStat {
  message: string;
  status: string;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
 // private apiUrl = 'http://192.168.1.98:8080/api/dashboard';
 // private apiUrl = 'https://dashboard-backend-q3f4.onrender.com/api/dashboard';

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getResumen(fecha?: string): Observable<ResumenDiario[]> {
    let url = `${this.apiUrl}/resumen`;
    if (fecha) url += `?date=${fecha}`;
    return this.http.get<ResumenDiario[]>(url);
  }

  getTrend(): Observable<TimeSeriesData[]> {
    return this.http.get<TimeSeriesData[]>(`${this.apiUrl}/trend`);
  }

  getTopErrors(fecha: string, status: string, entidad: string, search: string): Observable<ErrorStat[]> {
    const pStatus = status || 'Todos';
    const pEntity = entidad || 'Todos';
    const pSearch = search || '';
    return this.http.get<ErrorStat[]>(`${this.apiUrl}/errors?date=${fecha}&status=${pStatus}&entity=${pEntity}&search=${pSearch}`);
  }

  searchByCaseKey(caseKey: string, date: string): Observable<ResumenDiario[]> {
    return this.http.get<ResumenDiario[]>(`${this.apiUrl}/search?caseKey=${caseKey}&date=${date}`);
  }

  getEnvironment(): Observable<string> {
    return this.http.get(`${this.apiUrl}/environment`, { responseType: 'text' });
  }

  getLastUpdate(): Observable<string> {
    return this.http.get(`${this.apiUrl}/last-update`, { responseType: 'text' });
  }

// 7. Detalle Error (JSON para Excel)
  getErrorDetail(date: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/errors/detail?date=${date}`);
  }

  // 8. Detalle Fila (JSON para Excel)
  getRowDetail(date: string, client: string, entity: string, status: string, message: string): Observable<any[]> {
    // Codificamos los parámetros para evitar errores con espacios o caracteres raros
    const pClient = encodeURIComponent(client);
    const pEntity = encodeURIComponent(entity);
    const pStatus = encodeURIComponent(status);
    const pMessage = message ? encodeURIComponent(message) : '';

    return this.http.get<any[]>(
      `${this.apiUrl}/row-detail?date=${date}&client=${pClient}&entity=${pEntity}&status=${pStatus}&message=${pMessage}`
    );
  }

}
