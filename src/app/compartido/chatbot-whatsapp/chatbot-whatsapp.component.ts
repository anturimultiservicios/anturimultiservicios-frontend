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

  // Ver nota en el template: fuerza silencio + reproducción, que es lo que
  // exigen Chrome/Safari para el autoplay. Si igual lo bloquean (ahorro de
  // batería, etc.), queda el poster de la misma mascota.
  iniciarVideo(video: HTMLVideoElement): void {
    video.muted = true;
    if (video.paused) video.play().catch(() => undefined);
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
    this.abrirEnlace(`https://wa.me/${this.NUMERO_WA}?text=${texto}`);
  }

  abrirWhatsAppConTranscript(): void {
    const transcript = this.mensajes
      .map(m => `${m.tipo === 'bot' ? 'Anturi Bot' : 'Usuario'}: ${m.texto}`)
      .join('\n');
    const texto = encodeURIComponent(
      `Hola, me contacto desde el sitio web de Anturi Multiservicios.\n\nConversación con el bot:\n${transcript}\n\nNecesito hablar con un asesor.`
    );
    this.abrirEnlace(`https://wa.me/${this.NUMERO_WA}?text=${texto}`);
  }

  // 2026-10-08: el navegador de la app de Google (y Safari) bloquea
  // window.open cuando no viene directo de un toque (ej. tras un
  // setTimeout) - si lo bloquea, se abre en la misma pestaña.
  private abrirEnlace(url: string): void {
    const ventana = window.open(url, '_blank');
    if (ventana) ventana.opener = null;
    else window.location.href = url;
  }

  private agregarMensajeBot(texto: string): void {
    this.mensajes.push({ tipo: 'bot', texto });
  }
}
