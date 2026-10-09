import {
  Component,
  OnInit,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

type ModoCalc = 'normal' | 'cientifica';
type EstadoVentana = 'abierta' | 'minimizada' | 'cerrada';
interface OperacionHistorial { expresion: string; resultado: string }

// 2026-10-09 (pedido de Cristopher): se recuerda en este equipo la última
// posición, el modo, si quedó abierta/cerrada y el historial de operaciones.
const CLAVE_CALC = 'anturi_calculadora';
const MAX_HISTORIAL = 30;

@Component({
  selector: 'anturi-calculadora',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calculadora.component.html',
  styleUrls: ['./calculadora.component.css'],
})
export class CalculadoraComponent implements OnInit {
  @ViewChild('ventana') ventanaRef!: ElementRef<HTMLDivElement>;

  modo: ModoCalc = 'normal';
  estado: EstadoVentana = 'abierta';
  verHistorial = false;
  historial: OperacionHistorial[] = [];

  pantalla = '0';
  expresion = '';
  hayError = false;

  // Arrastre
  private arrastrando = false;
  private offsetX = 0;
  private offsetY = 0;
  posX = 80;
  posY = 120;

  ngOnInit(): void {
    this.posX = window.innerWidth - 340;
    this.posY = 120;
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_CALC) || 'null');
      if (g) {
        if (typeof g.posX === 'number') this.posX = g.posX;
        if (typeof g.posY === 'number') this.posY = g.posY;
        if (g.modo === 'normal' || g.modo === 'cientifica') this.modo = g.modo;
        if (g.estado === 'abierta' || g.estado === 'minimizada' || g.estado === 'cerrada') this.estado = g.estado;
        if (Array.isArray(g.historial)) this.historial = g.historial.slice(0, MAX_HISTORIAL);
        // 2026-10-09: el último número queda guardado (aunque se cierre sesión)
        if (typeof g.pantalla === 'string' && g.pantalla !== 'Error') this.pantalla = g.pantalla;
        if (typeof g.expresion === 'string') this.expresion = g.expresion;
      }
    } catch { /* sin almacenamiento: valores por defecto */ }
    this.ajustarALaPantalla();
  }

  // Si la pantalla es más pequeña que donde quedó, la trae a la vista.
  private ajustarALaPantalla(): void {
    const ancho = this.modo === 'cientifica' ? 360 : 290;
    this.posX = Math.max(0, Math.min(this.posX, window.innerWidth - ancho));
    this.posY = Math.max(0, Math.min(this.posY, window.innerHeight - 60));
  }

  private guardar(): void {
    try {
      localStorage.setItem(CLAVE_CALC, JSON.stringify({
        posX: this.posX, posY: this.posY, modo: this.modo, estado: this.estado, historial: this.historial,
        pantalla: this.pantalla, expresion: this.expresion,
      }));
    } catch { /* sin almacenamiento */ }
  }

  // Entrada de botones
  presionar(valor: string): void {
    if (this.hayError) {
      this.limpiar();
    }

    if (valor === 'AC') {
      this.limpiar();
      return;
    }

    if (valor === '=') {
      this.calcular();
      return;
    }

    if (valor === '⌫') {
      this.retroceso();
      return;
    }

    if (valor === '+/-') {
      this.alternarSigno();
      return;
    }

    if (valor === '%') {
      this.calcularPorcentaje();
      return;
    }

    // Funciones científicas
    const funcCientificas = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt'];
    if (funcCientificas.includes(valor)) {
      this.aplicarFuncion(valor);
      return;
    }

    if (valor === 'x²') {
      this.aplicarFuncion('sq');
      return;
    }

    if (valor === 'xʸ') {
      this.agregarAExpresion('**');
      return;
    }

    if (valor === '1/x') {
      this.aplicarFuncion('inv');
      return;
    }

    if (valor === 'π') {
      this.agregarAExpresion(String(Math.PI));
      return;
    }

    if (valor === 'e') {
      this.agregarAExpresion(String(Math.E));
      return;
    }

    this.agregarAExpresion(valor);
  }

  // Cada tecla deja guardado el número en pantalla.
  presionarYGuardar(valor: string): void {
    this.presionar(valor);
    this.guardar();
  }

  private agregarAExpresion(valor: string): void {
    if (this.pantalla === '0' && !isNaN(Number(valor)) && valor !== '.') {
      this.pantalla = valor;
    } else {
      this.pantalla = this.pantalla === '0' ? valor : this.pantalla + valor;
    }
    this.expresion = this.pantalla;
  }

  private calcular(): void {
    try {
      let expr = this.expresion
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/,/g, '.');

      const resultado = Function('"use strict"; return (' + expr + ')')();

      if (!isFinite(resultado)) {
        this.pantalla = 'Error';
        this.hayError = true;
        return;
      }

      const redondeado = parseFloat(resultado.toPrecision(12));
      const operacion = this.expresion;
      this.pantalla = String(redondeado);
      this.expresion = this.pantalla;
      if (operacion && operacion !== this.pantalla) {
        this.historial.unshift({ expresion: operacion.replace(/\*\*/g, '^').replace(/\*/g, '×').replace(/\//g, '÷'), resultado: this.pantalla });
        this.historial = this.historial.slice(0, MAX_HISTORIAL);
        this.guardar();
      }
    } catch {
      this.pantalla = 'Error';
      this.hayError = true;
    }
  }

  private limpiar(): void {
    this.pantalla = '0';
    this.expresion = '';
    this.hayError = false;
  }

  private retroceso(): void {
    if (this.pantalla.length > 1) {
      this.pantalla = this.pantalla.slice(0, -1);
    } else {
      this.pantalla = '0';
    }
    this.expresion = this.pantalla;
  }

  private alternarSigno(): void {
    const num = parseFloat(this.pantalla);
    if (!isNaN(num)) {
      this.pantalla = String(-num);
      this.expresion = this.pantalla;
    }
  }

  private calcularPorcentaje(): void {
    const num = parseFloat(this.pantalla);
    if (!isNaN(num)) {
      this.pantalla = String(num / 100);
      this.expresion = this.pantalla;
    }
  }

  private aplicarFuncion(func: string): void {
    const num = parseFloat(this.pantalla);
    if (isNaN(num)) return;
    let resultado: number;
    switch (func) {
      case 'sin': resultado = Math.sin((num * Math.PI) / 180); break;
      case 'cos': resultado = Math.cos((num * Math.PI) / 180); break;
      case 'tan': resultado = Math.tan((num * Math.PI) / 180); break;
      case 'log': resultado = Math.log10(num); break;
      case 'ln':  resultado = Math.log(num); break;
      case 'sqrt': resultado = Math.sqrt(num); break;
      case 'sq':  resultado = num * num; break;
      case 'inv': resultado = 1 / num; break;
      default: return;
    }
    this.pantalla = String(parseFloat(resultado.toPrecision(12)));
    this.expresion = this.pantalla;
  }

  usarResultado(resultado: string): void {
    this.hayError = false;
    this.pantalla = resultado;
    this.expresion = resultado;
    this.guardar();
  }

  borrarHistorial(): void {
    this.historial = [];
    this.guardar();
  }

  // Control de ventana - el modo se cambia con un clic en la barra
  alternarModo(): void {
    this.modo = this.modo === 'normal' ? 'cientifica' : 'normal';
    this.verHistorial = false;
    this.ajustarALaPantalla();
    this.guardar();
  }

  minimizar(): void {
    this.estado = 'minimizada';
    this.guardar();
  }

  maximizar(): void {
    this.estado = 'abierta';
    this.guardar();
  }

  cerrar(): void {
    this.estado = 'cerrada';
    this.verHistorial = false;
    this.guardar();
  }

  abrir(): void {
    this.estado = 'abierta';
    this.ajustarALaPantalla();
    this.guardar();
  }

  // Arrastre (mouse y táctil)
  iniciarArrastre(event: PointerEvent): void {
    this.arrastrando = true;
    this.offsetX = event.clientX - this.posX;
    this.offsetY = event.clientY - this.posY;
    event.preventDefault();
  }

  @HostListener('document:pointermove', ['$event'])
  alMover(event: PointerEvent): void {
    if (!this.arrastrando) return;
    this.posX = Math.max(0, Math.min(event.clientX - this.offsetX, window.innerWidth - 300));
    this.posY = Math.max(0, Math.min(event.clientY - this.offsetY, window.innerHeight - 100));
  }

  @HostListener('document:pointerup')
  alSoltar(): void {
    if (!this.arrastrando) return;
    this.arrastrando = false;
    this.guardar();
  }
}
