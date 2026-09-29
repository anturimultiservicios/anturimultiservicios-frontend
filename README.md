# Anturi Multiservicios - Frontend

Interfaz web del sistema de Anturi Multiservicios. Hecho en Angular. Igual que el backend, el código está escrito en español: componentes, servicios y carpetas tienen nombres en español, no en inglés.

## Cómo levantarlo en local

Se necesita Node.js y el backend corriendo en local (por defecto en `http://localhost:3000`, ver `src/environments/entorno.ts`).

```
npm install
npm start
```

Esto levanta el servidor de desarrollo en el puerto 4300. `npm run build:prod` genera la versión de producción, la que después se copia al servidor.

## Cómo se conecta al backend

La URL del backend está en `src/environments/entorno.ts` (desarrollo, apunta a `localhost:3000`) y `entorno.produccion.ts` (producción, apunta a `https://api.anturimultiservicios.com`). En producción el frontend llama directo a ese subdominio, que llega al mismo servidor por el túnel de Cloudflare - no es la misma URL desde la que se sirve la página.

## Estructura de carpetas

- **publico**: páginas que cualquiera puede ver sin iniciar sesión (inicio, página de no encontrado).
- **autenticacion**: pantalla de login.
- **admin**: todo el panel de un Admin - afiliados, empresas, sucursales, solicitudes, configuración, barra lateral.
- **secretaria**: panel de una cuenta Secretaria y sus solicitudes.
- **super-admin**: panel del Super Admin.
- **compartido**: cosas que se usan en varias partes - barra de navegación, pie de página, calculadora, el chatbot que manda a WhatsApp.
- **nucleo**: la parte que no es visual - servicios que hablan con el backend, modelos de datos, guardias de rutas, interceptores, utilidades (por ejemplo la de WebAuthn).

## Estado de las ramas

**`main` es lo que está en producción ahora mismo.** Esto se confirmó comparando el código compilado que está desplegado en el servidor contra el código de cada rama - no es una suposición.

**`alcance-scope-ui`** tiene trabajo terminado que todavía no se fusionó a `main`: la pantalla de Sucursales, la papelera de afiliados archivados, la pantalla para asignarle a una cuenta Secretaria qué empresas/sucursales puede ver, y un rediseño del login. Son 14 commits reales, sin conflictos con `main`. Mientras esto no se fusione, no hay forma de crear una sucursal desde la web en producción.

**`feature/dispositivos-frontend`** tiene la pantalla para que un usuario administre sus propios dispositivos WebAuthn y para que un admin administre los de otros. Esta rama nace de `alcance-scope-ui`, así que no se puede fusionar sola - necesita que esa se integre primero.

Ninguna de las dos está fusionada todavía. No hacer el merge sin decidirlo antes - el backend correspondiente a `alcance-scope-ui` (el módulo `alcance`) ya está listo del lado del servidor, pero depende de dos tablas (`UsuarioEmpresa`, `UsuarioSucursal`) que tampoco existen todavía en la base de datos real.

## Qué falta y por qué

Documentos y solicitudes de cambio ya están completos y funcionando. Sucursales y la gestión de dispositivos están escritas pero esperando el merge. No existe ninguna pantalla para registrar pagos porque esa funcionalidad tampoco se construyó del lado del backend.

## Cosas a tener en cuenta antes de modificar

No hay ninguna clave ni secreto en este repositorio - la única configuración sensible sería la URL del backend, que ya está separada por entorno. Antes de fusionar `alcance-scope-ui`, confirmar que las tablas `UsuarioEmpresa` y `UsuarioSucursal` ya existen en la base de datos real, o el módulo de alcance va a fallar en producción.
