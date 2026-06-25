# Tokimori

Aplicación web para gestionar tu colección personal de elementos (juegos, libros, series, etc.), con seguimiento de tiempo, notas, objetivos y un canvas visual por elemento.

## Características

- **Colección personal** — añade, elimina, fija y marca como favoritos los elementos de tu biblioteca
- **Notas** — crea y edita notas por elemento con soporte para pin y favoritos
- **Checklist** — objetivos con tareas anidadas y reordenación mediante drag & drop
- **Canvas** — lienzo visual por elemento con dibujo libre, tarjetas de notas/checklist e imágenes
- **Sesiones** — registro manual de tiempo o cuenta atrás automática con guardado de sesión
- **Estadísticas** — total de horas, número de sesiones, media por sesión, día más activo y gráfico de los últimos 7 días
- **Indicador de temporizador flotante** — burbuja arrastrable que persiste al cambiar de página
- **Autenticación JWT** — registro e inicio de sesión con tokens de 7 días

## Tecnologías

### Frontend

| Tecnología | Versión |
|---|---|
| React | 19 |
| TypeScript | ~5.9 |
| Vite | 7 |
| React Router | 7 |

### Backend (microservicios)

| Servicio | Puerto | Responsabilidad |
|---|---|---|
| `authenticationService` | 8000 | Registro, login, gestión de usuarios y JWT |
| `gameService` | 8001 | CRUD de elementos y subida de imágenes |
| `libraryService` | 8002 | Colección del usuario (favoritos, pins, horas) |
| `notesService` | — | Notas por elemento |
| `objectivesService` | — | Checklist, tareas y canvas |
| `sessionService` | — | Sesiones de tiempo por elemento |

Todos los servicios están construidos con **Node.js + Express + TypeScript** y usan **MySQL** como base de datos.

## Estructura del proyecto

```
Tokimori/
├── Frontend/
│   └── tokimori/          # App React + Vite
│       └── src/
│           ├── pages/     # Login, Register, Home, AddGame, ItemDetail
│           ├── components/# Sidebar, CreateGameModal
│           └── services/  # Clientes HTTP para cada microservicio
└── Backend/
    └── services/
        ├── authenticationService/
        ├── gameService/
        ├── libraryService/
        ├── notesService/
        ├── objectivesService/
        └── sessionService/
```

## Instalación y arranque

### Requisitos

- Node.js 18+
- MySQL 8+

### Base de datos

Crea una base de datos MySQL llamada `tokimori` y configura las variables de entorno en cada servicio del backend:

```env
MYSQL_HOST=localhost
MYSQL_USER=tokimori_user
MYSQL_PASSWORD=tokimori_password
MYSQL_DATABASE=tokimori
MYSQL_PORT=3306
JWT_SECRET=tu_secreto_jwt
```

### Backend

Instala las dependencias y arranca cada servicio de forma independiente:

```bash
cd Backend/services/authenticationService && npm install && npm run dev
cd Backend/services/gameService           && npm install && npm run dev
cd Backend/services/libraryService        && npm install && npm run dev
cd Backend/services/notesService          && npm install && npm run dev
cd Backend/services/objectivesService     && npm install && npm run dev
cd Backend/services/sessionService        && npm install && npm run dev
```

### Frontend

```bash
cd Frontend/tokimori
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

## Licencia

Consulta el archivo [LICENSE](LICENSE) para más información.
