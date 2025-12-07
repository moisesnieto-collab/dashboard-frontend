// ... imports (igual que antes)
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import * as XLSX from 'xlsx';
import { DataService, ResumenDiario } from './services/data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  // ... (VARIABLES IGUAL QUE ANTES) ...
  datos: ResumenDiario[] = [];
  datosFiltrados: ResumenDiario[] = [];
  cargando: boolean = true;
  fechaSeleccionada: string = '';
  filtroStatus: string = 'Todos';
  filtroEntidad: string = 'Todos';
  filtroMensaje: string = '';
  filtroCaseKey: string = '';
  listaStatus: string[] = ['Todos'];
  listaEntidades: string[] = ['Todos'];
  ambiente: string = '...';
  ultimaActualizacion: string = '...';
  kpi = { scraped: 0, scrapedError: 0, error: 0, scraping: 0, total: 0, percentSuccess: 0 };

  // ... (CONFIGURACIÓN DE GRÁFICOS IGUAL QUE ANTES) ...
  public lineChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  public lineChartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false };
  public lineChartLegend = true;
  public barChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  public barChartOptions: ChartOptions<'bar'> = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }
  };

  constructor(private dataService: DataService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.fechaSeleccionada = this.getTodayString();
    // Suscripción al ambiente
    this.dataService.getEnvironment().subscribe(env => {
      this.ambiente = env || 'DESCONOCIDO'; // Protección contra null
      this.cd.detectChanges();
    });
    this.dataService.getLastUpdate().subscribe(upd => this.ultimaActualizacion = upd);
    this.cargarTodo();
  }

  // --- NUEVA FUNCIÓN PARA EL COLOR DEL BADGE ---
// --- FUNCIÓN MEJORADA PARA EL COLOR DEL BADGE ---
  getBadgeClass(): string {
    // 1. Protección contra nulos o "..." iniciales
    if (!this.ambiente || this.ambiente === '...') {
      return 'badge-other'; // Color por defecto (Naranja) mientras carga
    }

    // 2. Normalización: Mayúsculas y sin espacios a los lados
    const env = this.ambiente.toString().trim().toUpperCase();

    // 3. Debug: Mira la consola del navegador (F12) para ver qué llega exactamente
    console.log('Ambiente detectado:', env);

    // 4. Lógica de selección
    if (env.includes('PROD')) {
      return 'badge-prod'; // Rojo
    } else if (
      env.includes('DESA') ||
      env.includes('DEV') ||
      env.includes('LOCAL') // Agregamos LOCAL por si acaso
    ) {
      return 'badge-dev';  // Verde
    } else {
      return 'badge-other'; // Naranjo (Cualquier otro caso)
    }
  }

  // ... (MANTÉN EL RESTO DE TUS MÉTODOS IGUAL: getTodayString, cargarTodo, exportarExcel, etc.) ...
  getTodayString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  cargarTodo() {
    this.cargando = true;
    this.cd.detectChanges();

    this.dataService.getLastUpdate().subscribe(upd => this.ultimaActualizacion = upd);

    this.dataService.getResumen(this.fechaSeleccionada).subscribe(data => {
      this.datos = data;
      this.datosFiltrados = [...data];
      this.actualizarDropdowns();
      this.aplicarFiltrosLocales();
      this.cargando = false;
      this.cd.detectChanges();
    });
    this.cargarTendencia();
    this.cargarGraficoErrores();
  }

  aplicarFiltrosLocales() {
    this.datosFiltrados = this.datos.filter(item => {
      const matchStatus = this.filtroStatus === 'Todos' || item.status === this.filtroStatus;
      const matchEntidad = this.filtroEntidad === 'Todos' || item.entidad === this.filtroEntidad;
      const mensajeItem = (item.message || '').toLowerCase();
      const matchMsg = !this.filtroMensaje || mensajeItem.includes(this.filtroMensaje.toLowerCase());
      return matchStatus && matchEntidad && matchMsg;
    });
    this.calculateKpis(this.datosFiltrados);
    this.cargarGraficoErrores();
  }

  buscarPorCaseKey() {
    if (!this.filtroCaseKey.trim()) { this.cargarTodo(); return; }
    this.cargando = true;
    this.dataService.searchByCaseKey(this.filtroCaseKey, this.fechaSeleccionada).subscribe(data => {
      this.datos = data; this.datosFiltrados = [...data];
      this.calculateKpis(this.datosFiltrados);
      this.cargando = false; this.cd.detectChanges();
    });
  }

  calculateKpis(lista: ResumenDiario[]) {
    this.kpi = { scraped: 0, scrapedError: 0, error: 0, scraping: 0, total: 0, percentSuccess: 0 };
    lista.forEach(r => {
      const c = Number(r.cantidad);
      this.kpi.total += c;
      if (r.status === 'SCRAPED') this.kpi.scraped += c;
      else if (r.status === 'SCRAPED-ERROR') this.kpi.scrapedError += c;
      else if (r.status === 'ERROR') this.kpi.error += c;
      else if (r.status === 'SCRAPING') this.kpi.scraping += c;
    });
    const valid = this.kpi.scraped + this.kpi.scrapedError + this.kpi.error;
    if (valid > 0) this.kpi.percentSuccess = Math.round((this.kpi.scraped / valid) * 1000) / 10;
  }

  actualizarDropdowns() {
    const sSet = new Set(this.datos.map(d => d.status));
    this.listaStatus = ['Todos', ...Array.from(sSet)];
    const eSet = new Set(this.datos.map(d => d.entidad));
    this.listaEntidades = ['Todos', ...Array.from(eSet)];
  }

  cargarTendencia() {
    this.dataService.getTrend().subscribe(trends => {
      const fechas = Array.from(new Set(trends.map(t => t.date)));
      this.lineChartData = {
        labels: fechas,
        datasets: [
          { data: fechas.map(f => trends.find(t => t.date === f && t.status === 'SCRAPED-ERROR')?.count || 0), label: 'S. Error', borderColor: '#FFA500', backgroundColor: '#FFA500', pointBackgroundColor: '#FFA500' },
          { data: fechas.map(f => trends.find(t => t.date === f && t.status === 'ERROR')?.count || 0), label: 'Error', borderColor: '#FF0000', backgroundColor: '#FF0000', pointBackgroundColor: '#FF0000' },
          { data: fechas.map(f => trends.find(t => t.date === f && t.status === 'SCRAPING')?.count || 0), label: 'Scraping', borderColor: '#00BFFF', backgroundColor: '#00BFFF', pointBackgroundColor: '#00BFFF' }
        ]
      };
      this.cd.detectChanges();
    });
  }

  cargarGraficoErrores() {
    this.dataService.getTopErrors(this.fechaSeleccionada, this.filtroStatus, this.filtroEntidad, this.filtroMensaje).subscribe(stats => {
      this.barChartData = {
        labels: stats.map(s => { let msg = (s.message || 'Sin Mensaje').replace(/[\n\r]+/g, ' ').trim(); return msg.length > 50 ? msg.substring(0, 50) + '...' : msg; }),
        datasets: [{ data: stats.map(s => s.count), label: 'Cantidad', backgroundColor: '#d32f2f', hoverBackgroundColor: '#b71c1c', barThickness: 20 }]
      };
      this.cd.detectChanges();
    });
  }

  // --- MÉTODOS EXCEL ---
  exportarExcelGlobal() {
    const dataToExport = this.datosFiltrados.map(item => ({ 'Cliente': item.cliente, 'Entidad': item.entidad, 'Fecha': item.fechaScrapper, 'Inicio': item.horaInicio, 'Fin': item.horaFin, 'Status': item.status, 'Mensaje': item.message, 'Cantidad': item.cantidad }));
    this.generarExcel(dataToExport, `Resumen_${this.fechaSeleccionada}`);
  }
  exportarSoloErrores() {
    this.cargando = true;
    this.dataService.getErrorDetail(this.fechaSeleccionada).subscribe({
      next: (data) => { if (data && data.length > 0) this.generarExcel(data, `Detalle_ScrapedError_${this.fechaSeleccionada}`); else alert('No hay errores hoy.'); this.cargando = false; this.cd.detectChanges(); },
      error: () => { this.cargando = false; alert('Error al descargar.'); }
    });
  }
  exportarFila(item: ResumenDiario) {
    this.cargando = true;
    this.dataService.getRowDetail(this.fechaSeleccionada, item.cliente, item.entidad, item.status, item.message).subscribe({
      next: (data) => { if (data && data.length > 0) this.generarExcel(data, `Detalle_${item.cliente}_${item.status}`); else alert('Sin detalles.'); this.cargando = false; this.cd.detectChanges(); },
      error: () => { this.cargando = false; alert('Error al descargar.'); }
    });
  }
  private generarExcel(json: any[], fileName: string) {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(json);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }
}
