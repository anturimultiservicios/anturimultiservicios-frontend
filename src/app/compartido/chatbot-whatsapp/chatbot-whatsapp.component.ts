import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface MensajeChat {
  tipo: 'bot' | 'usuario';
  texto: string;
}

@Component({
  selector: 'anturi-chatbot-whatsapp',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './chatbot-whatsapp.component.html',
  styleUrls: ['./chatbot-whatsapp.component.css'],
})
export class ChatbotWhatsappComponent {
  abierto = false;
  mensajes: MensajeChat[] = [];
  mostrarPreguntas = true;
  readonly NUMERO_WA = '573162852138';

  readonly preguntas = [
    { clave: 'servicios', textoKey: 'chatbot.preguntas.servicios' },
    { clave: 'afiliacion', textoKey: 'chatbot.preguntas.afiliacion' },
    { clave: 'ubicacion', textoKey: 'chatbot.preguntas.ubicacion' },
    { clave: 'horarios', textoKey: 'chatbot.preguntas.horarios' },
    { clave: 'documentos', textoKey: 'chatbot.preguntas.documentos' },
    { clave: 'costos', textoKey: 'chatbot.preguntas.costos' },
    { clave: 'asesor', textoKey: 'chatbot.preguntas.asesor' },
  ];

  constructor(private translate: TranslateService) {}

  abrir(): void {
    this.abierto = true;
    if (this.mensajes.length === 0) {
      this.agregarMensajeBot(this.translate.instant('chatbot.bienvenida'));
    }
  }

  cerrar(): void {
    this.abierto = false;
  }

  responder(clave: string): void {
    const textoUsuario = this.translate.instant(`chatbot.preguntas.${clave}`);
    this.mensajes.push({ tipo: 'usuario', texto: textoUsuario });
    this.mostrarPreguntas = false;

    if (clave === 'asesor') {
      setTimeout(() => {
        this.agregarMensajeBot(this.translate.instant(`chatbot.respuestas.${clave}`));
        setTimeout(() => {
          this.abrirWhatsAppConTranscript();
          this.mostrarPreguntas = true;
        }, 800);
      }, 400);
      return;
    }

    setTimeout(() => {
      this.agregarMensajeBot(this.translate.instant(`chatbot.respuestas.${clave}`));
      setTimeout(() => {
        this.mostrarPreguntas = true;
      }, 600);
    }, 400);
  }

  abrirWhatsApp(mensaje: string): void {
    const texto = mensaje
      ? encodeURIComponent(mensaje)
      : encodeURIComponent('Hola, me comunico desde el sitio web de Anturi Multiservicios. Quisiera más información sobre sus servicios.');
    window.open(`https://wa.me/${this.NUMERO_WA}?text=${texto}`, '_blank');
  }

  abrirWhatsAppConTranscript(): void {
    const transcript = this.mensajes
      .map(m => `${m.tipo === 'bot' ? 'Anturi Bot' : 'Usuario'}: ${m.texto}`)
      .join('\n');
    const texto = encodeURIComponent(
      `Hola, me contacto desde el sitio web de Anturi Multiservicios.\n\nConversación con el bot:\n${transcript}\n\nNecesito hablar con un asesor.`
    );
    window.open(`https://wa.me/${this.NUMERO_WA}?text=${texto}`, '_blank');
  }

  private agregarMensajeBot(texto: string): void {
    this.mensajes.push({ tipo: 'bot', texto });
  }
}
