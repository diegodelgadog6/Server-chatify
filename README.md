# Server-chatify

Servidor de [Chatify](https://github.com/diegodelgadog6/chatify-app), una app de chat en tiempo real por canales. Maneja las conexiones con Socket.IO y guarda los mensajes en PostgreSQL.

**Demo de la app:** https://chatify.diegodelgadogontes.com

## Funcionalidades

- Salas (canales) a las que cada usuario se une con su nombre.
- Envío de mensajes a todos los usuarios de la sala, guardados en PostgreSQL.
- Historial completo de la sala al entrar.
- Lista de usuarios conectados por sala, con avisos de entrada y salida.
- Indicador de "está escribiendo…".
- Crea la tabla `messages` automáticamente al arrancar.

## Tecnologías

Node.js · Express · Socket.IO · PostgreSQL (`pg`)

## Eventos de Socket.IO

**Del cliente al servidor**

| Evento | Datos | Descripción |
| --- | --- | --- |
| `join room` | `{ username, room }` | Entra a una sala |
| `leave room` | `{ room }` | Sale de una sala |
| `chat message` | `{ content, username, room }` | Envía un mensaje |
| `typing` | `{ username, room }` | Empieza a escribir |
| `stop typing` | `{ username, room }` | Deja de escribir |

**Del servidor al cliente**

| Evento | Descripción |
| --- | --- |
| `room history` | Mensajes guardados de la sala |
| `room users` | Usuarios conectados en la sala |
| `user joined` / `user left` | Un usuario entró o salió |
| `chat message` | Mensaje nuevo |
| `user typing` / `stop typing` | Alguien empezó o dejó de escribir |

## Puesta en marcha

Requiere Node.js 20 o superior y una base de datos PostgreSQL.

```bash
npm install
```

Crea un archivo `.env`:

```bash
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/chatify
CLIENT_URL=http://localhost:5173   # origen permitido por CORS
PORT=3000
```

Arranca el servidor:

```bash
npm start
```

## Equipo

Proyecto en equipo del Tecnológico de Monterrey. Repositorio mantenido por [Diego Delgado](https://github.com/diegodelgadog6).
