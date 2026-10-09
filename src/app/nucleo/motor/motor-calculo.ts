// MOTOR DE LIQUIDACIÓN - CÁLCULO PURO (sin base de datos ni NestJS).
// 2026-10-09 (plan "sin internet", paso 3): separado del servicio para que
// el navegador use EXACTAMENTE el mismo cálculo cuando no hay internet.
// El frontend tiene una copia idéntica de este archivo y de
// motor-liquidacion.tipos.ts en src/app/nucleo/motor/ - si se cambia algo
// aquí, copiar ambos archivos allá (scripts/copiar-motor.sh).
import {
  ClaseRiesgoArl,
  EntradaIndependiente,
  EntradaEmpleador,
  EntradaParcial,
  LineaCalculo,
  OpcionesCobro,
  ParametroUsado,
  ResultadoMotorLiquidacion,
  VERSION_MOTOR,
} from './motor-liquidacion.tipos';

export interface FuenteParametros {
  obtenerVigente(codigo: string, fecha: Date): Promise<{ valor: unknown; vigenteDesde: Date; fuente: string }>;
}

export interface PlantillaCalculo {
  descripcion: string;
  claseRiesgo?: string | number | null;
  porcentajeSalud: number;
  porcentajePension: number;
  porcentajeArl: number;
  porcentajeCaja: number;
}

export interface FuentePlantillas {
  obtenerPlantilla(tipo: number): Promise<PlantillaCalculo>;
}

// Motor de liquidaciones — FASE B. Cierra las 6 modalidades reales sobre la
// matriz definitiva de database/historia/MOTOR-LIQUIDACION-CIERRE-FASE-A-
// 2026-10-02.md (ver historia completa en motor-liquidacion.servicio.ts).
export class MotorCalculo {
  constructor(
    protected parametros: FuenteParametros,
    protected liquidacionLegado: FuentePlantillas,
    protected crearError: (mensaje: string) => Error = (m) => new Error(m),
  ) {}

  // Redondeo al múltiplo más cercano (ROUND(x,-2) de Excel = múltiplo 100).
  // El múltiplo mismo es un parámetro (REDONDEO_MULTIPLO) - si el día de
  // mañana cambia, es un valor editable, no una constante en el código.
  private redondear(valor: number, multiplo: number): number {
    if (multiplo <= 0) return Math.round(valor);
    return Math.round(valor / multiplo) * multiplo;
  }

  // 2026-10-08 (confirmado contra los valores reales del Excel de Anturi, ej.
  // 508.300 = salud 218.900 + pensión 280.200 + ARL 9.200 sobre el mínimo):
  // en la PILA cada aporte se aproxima al múltiplo de 100 SUPERIOR, no al
  // más cercano. El -0.000001 evita que un producto exacto (375000.0000001
  // por punto flotante) suba una centena de más.
  private redondearAporte(valor: number, multiplo: number): number {
    if (multiplo <= 0) return Math.ceil(valor - 1e-6);
    return Math.ceil((valor - 1e-6) / multiplo) * multiplo;
  }

  // La base de cotización (IBC del mes completo) nunca puede ser menor a 1
  // salario mínimo - los días menores a 30 la vuelven proporcional después.
  private async validarBaseMinima(ibc: number, fecha: Date, usados: ParametroUsado[]): Promise<void> {
    const smlmv = await this.leerParametro('SMLMV', fecha, usados);
    if (ibc + 0.5 < smlmv) {
      throw this.crearError(
        `La base de cotización (IBC) no puede ser menor a 1 salario mínimo ($${smlmv.toLocaleString('es-CO')}). ` +
        `Si cotiza menos días, escriba el IBC del mes completo y ponga los días.`,
      );
    }
  }

  // Mes comercial de 30 días: base proporcional a los días cotizados
  // (redondeada al peso hacia arriba, como el IBC en la PILA).
  private baseProporcional(ibc: number, dias: number): number {
    return dias === 30 ? ibc : Math.ceil((ibc * dias) / 30);
  }

  private validarOpciones(op: OpcionesCobro): { dias: number; afiliacion: number } {
    const dias = op.diasCotizados ?? 30;
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) {
      throw this.crearError('Los días cotizados deben estar entre 1 y 30 (el mes se liquida siempre por 30 días)');
    }
    const afiliacion = op.valorAfiliacion ?? 0;
    if (!(afiliacion >= 0)) throw this.crearError('El valor de afiliación no puede ser negativo');
    return { dias, afiliacion };
  }

  private mapaArl(clase: ClaseRiesgoArl): string {
    const mapa: Record<ClaseRiesgoArl, string> = {
      I: 'ARL_R1',
      II: 'ARL_R2',
      III: 'ARL_R3',
      IV: 'ARL_R4',
      V: 'ARL_R5',
    };
    return mapa[clase];
  }

  // Lee un parámetro y lo registra en la lista de "usados" para que el
  // resultado final sea explicable (sección 18) - nunca se usa un valor sin
  // que quede trazado de dónde salió.
  private async leerParametro(
    codigo: string,
    fecha: Date,
    usados: ParametroUsado[],
  ): Promise<number> {
    const fila = await this.parametros.obtenerVigente(codigo, fecha);
    usados.push({
      codigo,
      valor: Number(fila.valor),
      vigenteDesde: fila.vigenteDesde.toISOString().slice(0, 10),
      fuente: fila.fuente,
    });
    return Number(fila.valor);
  }

  // Mora: tasaDiaria = (interés bancario corriente + ajuste en puntos) / denominador.
  // El ajuste es ADITIVO (el Excel mostraba "tasa + 2%", no "tasa × 1.02").
  // CONFIRMADO por Cristopher (2026-10-07, ya no pendiente): el ajuste
  // queda en 0 para siempre - Anturi no cobra ningún interés propio ni
  // recargo. INTERES_BANCARIO_CORRIENTE sigue aplicando porque es la tasa
  // legal real que la EPS exige sobre lo adeudado (ajena a Anturi, no se
  // puede poner en 0); "ponerse al día" (pagar los meses atrasados a
  // valor normal, sin recargo) es el mecanismo real para el día a día -
  // ver PagosServicio.registrarCompleto(). Queda parametrizado (no un
  // número fijo en el código) solo por si la ley cambia algún día, no
  // porque siga abierta la decisión de negocio.
  private async calcularMora(
    valorAdeudado: number,
    diasMora: number,
    fecha: Date,
    multiploRedondeo: number,
    usados: ParametroUsado[],
  ): Promise<number> {
    if (diasMora <= 0) return 0;
    const interesBancario = await this.leerParametro('INTERES_BANCARIO_CORRIENTE', fecha, usados);
    const denominador = await this.leerParametro('MORA_DENOMINADOR_DIAS', fecha, usados);
    const ajuste = await this.leerParametro('MORA_AJUSTE_PUNTOS', fecha, usados);
    const tasaDiaria = (interesBancario + ajuste) / denominador;
    return this.redondear(valorAdeudado * tasaDiaria * diasMora, multiploRedondeo);
  }

  // Cola común a las 6 modalidades: a partir de L (seguridad social) +
  // mora, arma N/O/P/Q y el objeto explicable completo. Q es SIEMPRE
  // N+O+P - ninguna variante (ver sección 6 del cierre: la evidencia de
  // "L+O+P" en algunas filas del Excel era una inconsistencia real, no una
  // regla, y solo coincidía con N+O+P cuando no había mora).
  private async cerrarResultado(
    modalidad: string,
    ibc: number,
    lineas: LineaCalculo[],
    diasMora: number,
    fecha: Date,
    multiploRedondeo: number,
    usados: ParametroUsado[],
    codigoComision: string,
    extras: { diasCotizados?: number; valorAfiliacion?: number } = {},
  ): Promise<ResultadoMotorLiquidacion> {
    const valorSeguridadSocial = lineas
      .filter((l) => l.categoria === 'APORTE_SUBSISTEMA')
      .reduce((acc, l) => acc + l.valor, 0);

    const valorMora = await this.calcularMora(valorSeguridadSocial, diasMora, fecha, multiploRedondeo, usados);
    if (valorMora > 0) {
      lineas.push({
        categoria: 'MORA',
        concepto: `Mora (${diasMora} días)`,
        base: valorSeguridadSocial,
        tarifa: valorMora / valorSeguridadSocial,
        valor: valorMora,
        parametroCodigo: 'INTERES_BANCARIO_CORRIENTE',
      });
    }

    const totalValorSeguridadSocial = valorSeguridadSocial + valorMora;

    const tarifaCuatroXMil = await this.leerParametro('CUATRO_POR_MIL', fecha, usados);
    const valorCuatroXMil = this.redondear(totalValorSeguridadSocial * tarifaCuatroXMil, multiploRedondeo);
    lineas.push({
      categoria: 'CARGO_FINANCIERO',
      concepto: 'Gravamen a los Movimientos Financieros (4x1000)',
      base: totalValorSeguridadSocial,
      tarifa: tarifaCuatroXMil,
      valor: valorCuatroXMil,
      parametroCodigo: 'CUATRO_POR_MIL',
    });

    const valorAdministracion = await this.leerParametro(codigoComision, fecha, usados);
    lineas.push({
      categoria: 'PROPIA_ANTURI',
      concepto: 'Administración Anturi',
      base: 0,
      tarifa: 0,
      valor: valorAdministracion,
      parametroCodigo: codigoComision,
    });

    const valorAfiliacion = extras.valorAfiliacion ?? 0;
    if (valorAfiliacion > 0) {
      lineas.push({
        categoria: 'PROPIA_ANTURI',
        concepto: 'Afiliación (cobro único)',
        base: 0,
        tarifa: 0,
        valor: valorAfiliacion,
      });
    }

    const totalAPagar = totalValorSeguridadSocial + valorCuatroXMil + valorAdministracion + valorAfiliacion;

    return {
      modalidad,
      ibc,
      diasMora,
      lineas,
      valorSeguridadSocial,
      valorMora,
      totalValorSeguridadSocial,
      valorCuatroXMil,
      valorAdministracion,
      valorAfiliacion,
      totalAPagar,
      diasCotizados: extras.diasCotizados ?? 30,
      metadatos: {
        fecha: fecha.toISOString().slice(0, 10),
        redondeoMultiplo: multiploRedondeo,
        versionMotor: VERSION_MOTOR,
        parametrosUsados: usados,
      },
    };
  }

  // ── Independiente (las 4 modalidades que comparten camino) ─────────────
  // Reutiliza PlantillaLiquidacion (ya probado, ya en producción, 34 filas
  // reales) para salud/pensión/arl/caja - el motor nuevo solo corrige cómo
  // se redondea y agrega mora/4x1000/administración reales encima.
  async liquidarIndependiente(entrada: EntradaIndependiente): Promise<ResultadoMotorLiquidacion> {
    const fecha = entrada.fecha ?? new Date();
    const usados: ParametroUsado[] = [];
    const multiploRedondeo = await this.leerParametro('REDONDEO_MULTIPLO', fecha, usados);

    const { dias, afiliacion } = this.validarOpciones(entrada);
    await this.validarBaseMinima(entrada.ibc, fecha, usados);
    const base = this.baseProporcional(entrada.ibc, dias);
    const plantilla = await this.liquidacionLegado.obtenerPlantilla(entrada.tipoPlantilla);

    const lineas: LineaCalculo[] = [];
    const agregar = (subsistema: LineaCalculo['subsistema'], concepto: string, tarifa: number) => {
      if (tarifa <= 0) return;
      lineas.push({
        categoria: 'APORTE_SUBSISTEMA',
        subsistema,
        concepto,
        base,
        tarifa,
        valor: this.redondearAporte(base * tarifa, multiploRedondeo),
      });
    };
    agregar('EPS', 'Salud', plantilla.porcentajeSalud);
    agregar('PENSION', 'Pensión', plantilla.porcentajePension);
    agregar('ARL', `ARL clase ${plantilla.claseRiesgo || '-'}`, plantilla.porcentajeArl);
    agregar('CAJA_COMPENSACION', 'Caja de Compensación', plantilla.porcentajeCaja);

    if (lineas.length === 0) {
      throw this.crearError(`La plantilla ${entrada.tipoPlantilla} no tiene ningún componente con tarifa > 0`);
    }

    return this.cerrarResultado(
      `INDEPENDIENTE (plantilla ${entrada.tipoPlantilla} — ${plantilla.descripcion})${dias < 30 ? ` · ${dias} días` : ''}`,
      base,
      lineas,
      entrada.diasMora ?? 0,
      fecha,
      multiploRedondeo,
      usados,
      'COMISION_INDEPENDIENTE',
      { diasCotizados: dias, valorAfiliacion: afiliacion },
    );
  }

  // Decreto 2616/2013 art. 5: 1-7 días = 1 cotización mínima semanal,
  // 8-14 = 2, 15-21 = 3, más de 21 = 4 (equivale a 1 SMLMV).
  static semanasPorDias(dias: number): number {
    if (dias <= 7) return 1;
    if (dias <= 14) return 2;
    if (dias <= 21) return 3;
    return 4;
  }

  // ── Independiente parcial (ingresos < 1 SMLMV, por semanas) ────────────
  // Ver EntradaParcial: cada subsistema tiene su propia base, por eso no
  // pasa por PlantillaLiquidacion. Todas las tarifas salen de
  // parametros_legales (las mismas que ya usan las otras modalidades).
  async liquidarParcial(entrada: EntradaParcial): Promise<ResultadoMotorLiquidacion> {
    if (!Number.isInteger(entrada.diasCotizados) || entrada.diasCotizados < 1 || entrada.diasCotizados > 30) {
      throw this.crearError('Los días cotizados deben estar entre 1 y 30');
    }
    const { afiliacion } = this.validarOpciones({ valorAfiliacion: entrada.valorAfiliacion });
    const fecha = entrada.fecha ?? new Date();
    const usados: ParametroUsado[] = [];
    const multiploRedondeo = await this.leerParametro('REDONDEO_MULTIPLO', fecha, usados);
    const smlmv = await this.leerParametro('SMLMV', fecha, usados);

    const semanas = MotorCalculo.semanasPorDias(entrada.diasCotizados);
    const baseSemanal = Math.ceil((smlmv / 4) * semanas);

    const lineas: LineaCalculo[] = [];
    const agregar = async (
      subsistema: LineaCalculo['subsistema'],
      concepto: string,
      codigoParametro: string,
      base: number,
    ) => {
      const tarifa = await this.leerParametro(codigoParametro, fecha, usados);
      if (tarifa <= 0) return;
      lineas.push({
        categoria: 'APORTE_SUBSISTEMA',
        subsistema,
        concepto,
        base,
        tarifa,
        valor: this.redondearAporte(base * tarifa, multiploRedondeo),
        parametroCodigo: codigoParametro,
      });
    };

    await agregar('PENSION', `Pensión (${semanas} semana${semanas > 1 ? 's' : ''})`, 'PENSION_INDEPENDIENTE', baseSemanal);
    await agregar('ARL', `ARL clase ${entrada.claseRiesgoArl} (sobre 1 SMLMV)`, this.mapaArl(entrada.claseRiesgoArl), smlmv);
    if (entrada.codigoCaja) {
      await agregar('CAJA_COMPENSACION', `Caja de Compensación (${semanas} semana${semanas > 1 ? 's' : ''})`, entrada.codigoCaja, baseSemanal);
    }

    return this.cerrarResultado(
      `INDEPENDIENTE_PARCIAL (${entrada.diasCotizados} días → ${semanas} semana${semanas > 1 ? 's' : ''})`,
      baseSemanal,
      lineas,
      entrada.diasMora ?? 0,
      fecha,
      multiploRedondeo,
      usados,
      'COMISION_INDEPENDIENTE',
      { diasCotizados: entrada.diasCotizados, valorAfiliacion: afiliacion },
    );
  }

  // ── Empleador (las 2 modalidades que antes no tenían ningún motor) ─────
  // La regla de exoneración (Ley 1607/2012) ya estaba correctamente
  // modelada en los NOMBRES de los parámetros reales (SALUD_EMPLEADOR/
  // SENA/ICBF dicen "solo No Exonerada") - acá se aplica por primera vez.
  async liquidarEmpleador(entrada: EntradaEmpleador): Promise<ResultadoMotorLiquidacion> {
    const fecha = entrada.fecha ?? new Date();
    const usados: ParametroUsado[] = [];
    const multiploRedondeo = await this.leerParametro('REDONDEO_MULTIPLO', fecha, usados);
    const esNoExonerada = entrada.modalidad === 'EMPRESA_NO_EXONERADA';
    const { dias, afiliacion } = this.validarOpciones(entrada);
    await this.validarBaseMinima(entrada.ibc, fecha, usados);
    const base = this.baseProporcional(entrada.ibc, dias);

    const lineas: LineaCalculo[] = [];
    const agregar = async (
      subsistema: LineaCalculo['subsistema'],
      concepto: string,
      codigoParametro: string,
    ) => {
      const tarifa = await this.leerParametro(codigoParametro, fecha, usados);
      if (tarifa <= 0) return;
      lineas.push({
        categoria: 'APORTE_SUBSISTEMA',
        subsistema,
        concepto,
        base,
        tarifa,
        valor: this.redondearAporte(base * tarifa, multiploRedondeo),
        parametroCodigo: codigoParametro,
      });
    };

    await agregar('EPS', 'Salud (empleado)', 'SALUD_EMPLEADO');
    if (esNoExonerada) {
      await agregar('EPS', 'Salud (empleador)', 'SALUD_EMPLEADOR');
    }
    await agregar('PENSION', 'Pensión (empleado)', 'PENSION_EMPLEADO');
    await agregar('PENSION', 'Pensión (empleador)', 'PENSION_EMPLEADOR');
    if (esNoExonerada) {
      await agregar(undefined, 'SENA', 'SENA');
      await agregar(undefined, 'ICBF', 'ICBF');
    }
    await agregar('CAJA_COMPENSACION', 'Caja de Compensación (empleador)', 'CAJA_EMPRESA');

    const codigoArl = this.mapaArl(entrada.claseRiesgoArl);
    await agregar('ARL', `ARL clase ${entrada.claseRiesgoArl}`, codigoArl);

    return this.cerrarResultado(
      dias < 30 ? `${entrada.modalidad} · ${dias} días` : entrada.modalidad,
      base,
      lineas,
      entrada.diasMora ?? 0,
      fecha,
      multiploRedondeo,
      usados,
      'COMISION_EMPRESA',
      { diasCotizados: dias, valorAfiliacion: afiliacion },
    );
  }
}
