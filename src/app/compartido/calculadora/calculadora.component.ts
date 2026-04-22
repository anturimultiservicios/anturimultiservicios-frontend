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
  modoSelector = false;

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
  }

  get tituloBarra(): string {
    return this.modo === 'normal' ? 'Calculadora' : 'Calculadora Científica';
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
      this.pantalla = String(redondeado);
      this.expresion = this.pantalla;
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

  // Control de ventana
  seleccionarModo(m: ModoCalc): void {
    this.modo = m;
    this.modoSelector = false;
    this.limpiar();
  }

  minimizar(): void {
    this.estado = 'minimizada';
  }

  maximizar(): void {
    this.estado = 'abierta';
  }

  cerrar(): void {
    this.estado = 'cerrada';
  }

  abrir(): void {
    this.estado = 'abierta';
    this.modoSelector = true;
  }

  // Arrastre
  iniciarArrastre(event: MouseEvent): void {
    this.arrastrando = true;
    this.offsetX = event.clientX - this.posX;
    this.offsetY = event.clientY - this.posY;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  alMover(event: MouseEvent): void {
    if (!this.arrastrando) return;
    this.posX = Math.max(0, Math.min(event.clientX - this.offsetX, window.innerWidth - 300));
    this.posY = Math.max(0, Math.min(event.clientY - this.offsetY, window.innerHeight - 100));
  }

  @HostListener('document:mouseup')
  alSoltar(): void {
    this.arrastrando = false;
  }
}
