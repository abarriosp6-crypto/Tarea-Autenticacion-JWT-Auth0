# Tarea 5 – Autenticación JWT, Refresh Tokens y Auth0

**Estudiante:** Anthony Jacob Barrios Pérez
**Carné:** 0902-20-9735
**Universidad:** Universidad Mariano Gálvez de Guatemala
**Carrera:** Ingeniería en Sistemas
**Curso:** Desarrollo Web

## Descripción del proyecto

Este proyecto corresponde a la práctica de autenticación y seguridad en aplicaciones web. Se trabajaron dos implementaciones: una autenticación local utilizando JWT y una autenticación mediante Auth0.

Durante el desarrollo implementamos refresh tokens rotativos, rate limiting, verificación en dos pasos y control de acceso basado en roles (RBAC). También realizamos pruebas para comprobar que los endpoints protegidos respondieran correctamente según los permisos de cada usuario.

## Tecnologías utilizadas

- ASP.NET Core con .NET 10
- React con TypeScript
- Vite
- Entity Framework Core
- SQLite
- Auth0
- JWT (HS256 y RS256)
- TOTP
- Visual Studio Code y REST Client
- Git y GitHub

## Estructura del proyecto

```text
Tarea-Autenticacion-JWT-Auth0/
├── 01-local/
│   ├── Auth.Local.Api/
│   └── auth-local-web/
├── 02-auth0/
│   ├── Auth.Auth0.Api/
│   └── auth0-web/
├── .gitignore
├── GUION-DEMO.md
└── README.md
```

Las dos partes se ejecutan por separado, ya que utilizan el mismo puerto para el frontend.

## Parte 1. Autenticación local con JWT

En esta parte trabajamos con una API desarrollada en ASP.NET Core y una interfaz en React.

### Funcionalidades implementadas

**1. Refresh tokens rotativos**

Implementamos refresh tokens generados de forma segura mediante `RandomNumberGenerator`. Los tokens se almacenan en SQLite utilizando un hash SHA-256, evitando guardar sus valores originales.

Los refresh tokens tienen una duración de siete días. Cuando se solicita una renovación válida, se revoca el token anterior y se genera uno nuevo junto con otro access token.

También incorporamos una validación para detectar la reutilización de tokens revocados y proteger las sesiones activas.

**2. Rate limiting**

Configuramos límites de solicitudes utilizando las herramientas nativas de ASP.NET Core.

Se permite un máximo de cinco intentos por minuto por dirección IP para los endpoints de inicio de sesión y verificación 2FA. Cuando se supera el límite, la API responde con HTTP 429.

**3. Autenticación en dos pasos (TOTP)**

Se utiliza una aplicación autenticadora para generar códigos temporales. El usuario puede configurar y activar la verificación en dos pasos desde la aplicación.

**4. Renovación automática en React**

El frontend identifica cuando un access token ha expirado y solicita uno nuevo mediante el refresh token. Después, vuelve a intentar la petición original una sola vez.

**5. Cierre de sesión**

Se implementó un endpoint para revocar el refresh token y finalizar la sesión.

### Endpoints principales

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/refresh` | Renovar tokens |
| POST | `/api/auth/logout` | Cerrar sesión y revocar token |
| POST | `/api/auth/2fa/setup` | Configurar TOTP |
| POST | `/api/auth/2fa/enable` | Activar TOTP |
| POST | `/api/auth/2fa/verify` | Verificar código TOTP |
| GET | `/api/profile` | Consultar perfil protegido |

### Ejecutar la Parte 1

**Requisitos:** .NET 10 SDK, Node.js y npm.

**Paso 1. Configurar la clave JWT**

Abrir una terminal en:

```powershell
cd 01-local/Auth.Local.Api
```

Generar una clave segura y guardarla mediante User Secrets:

```powershell
$key = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
dotnet user-secrets set "Jwt:Key" "$key"
```

La clave no se publica en GitHub.

**Paso 2. Ejecutar la API**

```powershell
dotnet restore
dotnet run
```

La API local utiliza:

`http://localhost:5080`

La base de datos SQLite se crea localmente.

**Paso 3. Ejecutar React**

Abrir otra terminal:

```powershell
cd 01-local/auth-local-web
Copy-Item .env.example .env
npm install
npm run dev
```

El frontend estará disponible en:

`http://localhost:5173`

La variable `VITE_API_URL` debe apuntar a `http://localhost:5080`.

## Parte 2. Autenticación con Auth0 y RBAC

En esta parte utilizamos Auth0 como proveedor de identidad para administrar el inicio de sesión y los permisos de acceso.

### Funcionalidades implementadas

**1. Autenticación mediante Auth0**

Integramos una aplicación React con Auth0 utilizando OpenID Connect y el flujo Authorization Code con PKCE.

La API valida los access tokens emitidos por Auth0 mediante JWT Bearer y firmas RS256.

**2. Roles y permisos**

Configuramos dos roles:

| Rol | Permisos |
|---|---|
| Lector | `read:messages` |
| Administrador | `read:messages`, `delete:messages` |

**3. Gestión de mensajes**

Implementamos una lista de mensajes almacenada en memoria. Los usuarios autorizados pueden consultar los mensajes, mientras que únicamente los administradores pueden eliminarlos.

**4. Protección de endpoints**

La API valida los permisos incluidos en el access token.

El frontend también oculta los botones de eliminación a los usuarios que no cuentan con el permiso correspondiente. Sin embargo, la seguridad se aplica principalmente desde el backend.

### Endpoints principales

| Método | Endpoint | Permiso requerido |
|---|---|---|
| GET | `/api/health` | Público |
| GET | `/api/public` | Público |
| GET | `/api/private` | Usuario autenticado |
| GET | `/api/private-scoped` | `read:messages` |
| GET | `/api/messages` | `read:messages` |
| DELETE | `/api/messages/{id}` | `delete:messages` |

### Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Lector consulta mensajes | HTTP 200 |
| Administrador consulta mensajes | HTTP 200 |
| Administrador elimina un mensaje | HTTP 204 |
| Lector intenta eliminar un mensaje mediante DELETE | HTTP 403 |

Estas pruebas demostraron que las restricciones se aplican correctamente en la API.

### Configuración de Auth0

Para ejecutar esta parte se necesita crear una aplicación SPA y una API en Auth0.

**Configuración de la API:**

- Identificador (Audience): `https://api.umg-messages.com`
- Algoritmo: RS256
- Enable RBAC: activado
- Add Permissions in the Access Token: activado
- Permisos: `read:messages` y `delete:messages`

**Configuración de la aplicación SPA:**

- Allowed Callback URLs: `http://localhost:5173`
- Allowed Logout URLs: `http://localhost:5173`
- Allowed Web Origins: `http://localhost:5173`

También se deben crear los roles Lector y Administrador, asignarles sus permisos y asociarlos a usuarios de prueba.

### Ejecutar la Parte 2

Antes de iniciar, detener la API y el frontend de la Parte 1.

**Paso 1. Configurar la API de Auth0**

```powershell
cd 02-auth0/Auth.Auth0.Api
dotnet user-secrets set "Auth0:Domain" "TU-DOMINIO.auth0.com"
dotnet user-secrets set "Auth0:Audience" "https://api.umg-messages.com"
dotnet restore
dotnet run
```

La API de Auth0 utiliza:

`http://localhost:5090`

**Paso 2. Configurar el frontend**

Abrir otra terminal:

```powershell
cd 02-auth0/auth0-web
Copy-Item .env.example .env
npm install
```

Editar el archivo `.env` con los valores de la aplicación Auth0:

```env
VITE_AUTH0_DOMAIN=TU-DOMINIO.auth0.com
VITE_AUTH0_CLIENT_ID=TU_CLIENT_ID
VITE_AUTH0_AUDIENCE=https://api.umg-messages.com
VITE_API_URL=http://localhost:5090
```

Después ejecutar:

```powershell
npm run dev
```

Abrir:

`http://localhost:5173`

## Parte 3. Investigación: passkeys frente a TOTP

Como complemento de la práctica, realizamos una investigación sobre passkeys (WebAuthn/FIDO2) y TOTP.

Se analizaron sus mecanismos de registro y autenticación, resistencia al phishing, experiencia de usuario, recuperación de cuentas y aplicación en un sistema universitario de notas.

Esta investigación se encuentra desarrollada en el informe PDF de la tarea.

## Seguridad del repositorio

Para evitar exponer información privada, se excluyeron del repositorio:

- Archivos `.env` con configuraciones locales.
- Claves JWT y secretos privados.
- Bases de datos SQLite locales.
- Carpetas `node_modules`, `bin`, `obj` y `dist`.
- Tokens reales utilizados durante las pruebas.

Las claves JWT se configuran mediante `dotnet user-secrets` y las variables del frontend mediante archivos `.env` locales.

## Resultados y aprendizajes

Durante esta práctica aprendí a implementar mecanismos de autenticación más seguros y a controlar los permisos de los usuarios desde el backend.

Las pruebas de refresh tokens, rate limiting y Auth0 permitieron comprobar cómo responde una aplicación ante tokens vencidos, intentos repetidos de acceso y operaciones sin autorización.

También comprendí que ocultar opciones en el frontend no sustituye las validaciones de seguridad en la API.

## Repositorio

Proyecto desarrollado como parte de la Tarea 5 de autenticación en aplicaciones web.

**Estudiante:** Anthony Jacob Barrios Pérez
**Carné:** 0902-20-9735

**GitHub:** https://github.com/abarriosp6-crypto/Tarea-Autenticacion-JWT-Auth0