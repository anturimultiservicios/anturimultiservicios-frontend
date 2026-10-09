// 2026-10-09: imprimir un documento (recibo, colilla de nómina) en una
// ventana aparte, sin el menú ni la barra del panel.
export const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const pesos = (v: unknown): string => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');

export const fechaCorta = (v: unknown): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

export function imprimirHtml(titulo: string, cuerpo: string, css = ''): boolean {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return false;
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #000; background: #fff; margin: 24px; }
  .et { font-weight: 700; }
  @page { margin: 12mm; }
  .salto { page-break-after: always; }
  ${css}
</style></head><body>${cuerpo}<script>window.onload = function () { window.print(); };<\/script></body></html>`);
  w.document.close();
  return true;
}
