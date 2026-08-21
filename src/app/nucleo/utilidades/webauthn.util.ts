// Conversión base64url <-> ArrayBuffer para WebAuthn. Misma lógica ya
// validada en D2.5/D6 (páginas de prueba temporales) - centralizada acá
// para no duplicarla entre el registro y la futura verificación de login.

export function base64urlABuffer(base64url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
  return buffer.buffer;
}

export function bufferABase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convierte las opciones de registro (JSON del servidor, con challenge/
 * user.id/excludeCredentials en base64url) a lo que exige
 * navigator.credentials.create(). OJO: user.id NO es base64url - el
 * servidor lo manda tal cual (String(usuarioId)), se codifica como UTF-8,
 * nunca se decodifica como base64 (hallazgo real de D2.5).
 */
export function opcionesRegistroACredentialOptions(opciones: any): CredentialCreationOptions {
  return {
    publicKey: {
      ...opciones,
      challenge: base64urlABuffer(opciones.challenge),
      user: { ...opciones.user, id: new TextEncoder().encode(opciones.user.id) },
      excludeCredentials: (opciones.excludeCredentials || []).map((c: any) => ({
        ...c,
        id: base64urlABuffer(c.id),
      })),
    },
  };
}

export function opcionesAutenticacionACredentialOptions(opciones: any): CredentialRequestOptions {
  return {
    publicKey: {
      ...opciones,
      challenge: base64urlABuffer(opciones.challenge),
      allowCredentials: (opciones.allowCredentials || []).map((c: any) => ({
        ...c,
        id: base64urlABuffer(c.id),
      })),
    },
  };
}

export function credencialRegistroARespuesta(credential: PublicKeyCredential): any {
  const respuesta = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferABase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferABase64url(respuesta.clientDataJSON),
      attestationObject: bufferABase64url(respuesta.attestationObject),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

export function credencialAutenticacionARespuesta(credential: PublicKeyCredential): any {
  const respuesta = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferABase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferABase64url(respuesta.clientDataJSON),
      authenticatorData: bufferABase64url(respuesta.authenticatorData),
      signature: bufferABase64url(respuesta.signature),
      userHandle: respuesta.userHandle ? bufferABase64url(respuesta.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}