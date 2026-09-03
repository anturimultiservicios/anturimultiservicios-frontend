# Matriz de frontend acumulado (2026-08-29)

> Solo inspección y documentación — **cero commits de frontend en este
> bloque**. Diffs medidos con `git diff --stat`/`git diff` reales, no
> estimados. Nada de esto se toca sin tu autorización explícita de cuáles
> archivos ajenos separar.

| Pendiente | Archivo(s) | Diff (ins/del) | Dependencia | Separable? | Riesgo | Orden recomendado |
|---|---|---|---|---|---|---|
| Visor de documentos (alinear con backend real) | `nucleo/servicios/documentos.servicio.ts` | 14/2 | Ninguna - corrige `tipo` al enum real (`REGISTRO`/`FACTURA` en vez de `CONTRATO`/`CERTIFICADO`), agrega `SlotDocumento`/`completitudAfiliado()`, corrige URL de `subir()` a `/documentos/subir` (la real) | **Sí — coherente y autocontenido** | Bajo - corrige, no rompe (URL vieja ya estaba mal contra el backend real) | **1º** |
| Header: ocultar apellido/rol de SUPER_ADMIN | `admin/panel-principal/panel-principal.component.ts` | 4/6 | Ninguna funcional - además quita un menú de idioma no relacionado (`IdiomaServicio`) | **Sí, si se acepta también retirar el selector de idioma** (viene en el mismo archivo, no separable de eso puntual) | Bajo | 2º |
| Loader de i18n resistente a subruta | `app.config.ts` | 6/1 | Ninguna | **Sí, autocontenido** | Muy bajo | 2º (junto al anterior, cambios chicos y sin relación entre sí) |
| Cambiar Empresa a PUT+motivo, ampliar interfaz | `nucleo/servicios/empresas.servicio.ts` | 18/2 | **Alta con `detalle-empresa.component.ts`** (los campos nuevos del modelo y el nuevo `actualizar()` existen para que ese formulario los use) | No, en la práctica - separarlo del componente grande le quita sentido | Bajo el cambio en sí, pero incompleto sin su consumidor | Ir junto con `detalle-empresa.component.ts` (ver abajo) |
| Badge visual para solicitudes tipo RESTAURACION | `admin/solicitudes/solicitudes-admin.component.ts` | 94/41 | Ninguna funcional - **hoy ya funciona sin esto** (`{{ sol.tipo }}` renderiza el texto igual, solo falta el color del badge) | No inseparable (23 hunks previos, refactor grande), pero **tampoco urgente** - es cosmético | Ninguno si se deja como está | Sin prioridad - no bloquea nada |
| Reconstrucción completa de ficha de Afiliado | `admin/afiliados/detalle-afiliado/detalle-afiliado.component.ts` | 165/156 | — | **No** (ya confirmado en rondas anteriores: 23 hunks, cubren casi todo el archivo) | — | Bloqueado, necesita tu decisión (ver `INSPECCION-FINAL-ARCHIVOS-AJENOS`) |
| Navegación Empresa → Sucursal para Secretaria | `admin/empresas/lista-empresas/lista-empresas.component.ts`, `admin/empresas/detalle-empresa/detalle-empresa.component.ts` | 347/18, 441/19 | Entre sí (mismo feature de empresas) | **No** - refactors grandes, rutas hardcodeadas `/admin/empresas` mezcladas con el resto del componente | Alto si se toca a medias (rompería navegación) | Bloqueado |
| Formulario de configuración ampliado | `admin/configuracion/configuracion.component.ts` | 165/13 | Sin tarea pendiente identificada explícitamente en nuestras listas - parece una ampliación de opciones de configuración | **No evaluado en detalle** (fuera del alcance de lo pedido) | Desconocido | Bloqueado hasta que definas si hay algo específico que necesitás de ahí |
| Resumen del panel principal | `admin/panel-principal/resumen/resumen.component.ts` | 23/14 | Probablemente ligado a `panel-principal.component.ts`/`panel-principal.component.html` (mismo panel) | No evaluado en profundidad | Desconocido | Bloqueado |
| Layout del panel principal | `admin/panel-principal/panel-principal.component.html` | 5/26 | Con `panel-principal.component.ts` y `resumen.component.ts` | No evaluado en profundidad | Desconocido | Bloqueado |
| Login SUPER_ADMIN (bug ya diagnosticado) + WebAuthn D3/D4 | `autenticacion/inicio-sesion/inicio-sesion.component.ts` (118/15), `.html` (56/21), `nucleo/servicios/autenticacion.servicio.ts` (82/8), `nucleo/utilidades/webauthn.util.ts` (nuevo, sin rastrear) | — | Los 4 son **el mismo feature** (WebAuthn D3+D4) - el bug de redirección de SUPER_ADMIN vive DENTRO de este refactor, ya confirmado no separable en rondas anteriores | **No** - fix de 4 líneas ya escrito y revertido explícitamente por no poder aislarse sin absorber las 259 líneas del feature completo | Ninguno mientras no se toque; el bug de redirección sigue activo hasta que se autorice absorber el feature completo | Bloqueado - **requiere tu decisión explícita** entre: (a) autorizar absorber el feature WebAuthn completo, (b) que reconstruyas vos el fix de 4 líneas por fuera, (c) dejarlo así hasta que WebAuthn se termine de decidir como funcionalidad |

## Resumen de orden recomendado para el próximo lote grande

1. `documentos.servicio.ts` (visor de documentos) — autocontenido, corrige
   una URL que hoy está mal.
2. `panel-principal.component.ts` + `app.config.ts` — chicos,
   autocontenidos, sin relación entre sí ni con el resto.
3. **Todo lo demás queda bloqueado** hasta que definas qué hacer con los
   archivos ajenos grandes (Empresa/Sucursal, ficha de Afiliado, WebAuthn/
   login) — ninguno es seguro de tocar parcialmente sin absorber el
   trabajo completo que ya contienen.

**Nada de esto se implementó en este bloque** — es la matriz pedida, para
decidir con vos antes de construir nada más.
