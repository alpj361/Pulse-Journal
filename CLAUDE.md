# 🏗️ Arquitectura Pulse Journal

Pulse Journal es un ecosistema complejo de servicios interconectados para el procesamiento, análisis y presentación de contenido digital y noticias. La arquitectura está diseñada con múltiples capas especializadas que operan tanto independientemente como en conjunto.

## 📱 Capas Principales del Proyecto

### **1. Frontend Móvil/Web - `04bc0317-b8c9-4395-93f8-baaf4706af5c`**
- **Tecnología**: React Native con Expo (multiplataforma)
- **Propósito**: Aplicación cliente temporal que funciona como PWA
- **Audiencia**: Público general - interfaz user-friendly y accesible
- **Características**:
  - Más de 100 dependencias especializadas (cámara, mapas, sensores, etc.)
  - Integración con AI (Anthropic SDK, OpenAI)
  - Conectividad con Supabase para datos en tiempo real
  - Soporte para iOS, Android y Web

### **2. ThePulse - Frontend Profesional de Periodismo**
- **Tecnología**: React/Next.js (especializados en periodismo)
- **Propósito**: Aplicación principal y frontend profesional para periodistas
- **Audiencia**: Periodistas profesionales y analistas - interfaz avanzada y especializada
- **Diferenciación**:
  - Herramientas avanzadas de análisis y visualización
  - Workflows complejos para investigación periodística
  - Interface optimizada para productividad profesional
  - Funciones especializadas de verificación y fact-checking

### **3. Backend Principal - `ExtractorW`**
- **Tecnología**: Node.js con Express
- **Puerto**: 8080
- **Propósito**: API central que coordina todos los servicios
- **Responsabilidades**:
  - Gestión de autenticación y autorización
  - Coordinación entre servicios (ExtractorT, LauraMemory)
  - Procesamiento de contenido multimedia (FFmpeg)
  - Integración con AI (OpenRouter, Google AI)
  - Comunicación con Supabase

### **4. Motor de Extracción - `ExtractorT`**
- **Tecnología**: Python con FastAPI y Playwright
- **Puerto**: 8000
- **Propósito**: Servicio especializado en scraping de redes sociales
- **Capacidades**:
  - Extracción automatizada de Twitter/X
  - Procesamiento OCR (Tesseract)
  - Manejo de medios (yt-dlp)
  - Detección anti-bot y proxy management

### **5. Sistema de Automatización - `NewsCron`**
- **Tecnología**: Node.js con módulos ES6
- **Propósito**: Cron jobs para tendencias y noticias automáticas
- **Funcionalidades**:
  - Análisis de sentimientos con Hugging Face
  - Procesamiento automático de tendencias
  - Integración con OpenAI para categorización

## 🧠 Servicios de Inteligencia

### **6. Memoria Semántica - `LauraMemoryService`**
- **Tecnología**: Python con Flask/Gunicorn
- **Puerto**: 5001
- **Propósito**: Gestión de memoria conversacional con Zep Cloud
- **Características**:
  - Búsqueda semántica avanzada
  - Persistencia de contexto conversacional
  - APIs para enhancing queries

### **7. Automatización Web - `WebAgent` & `mcp-chrome`**
- **Tecnología**: JavaScript con integraciones Chrome
- **Propósito**: Automatización de navegador y manipulación DOM
- **Capacidades**:
  - Control programático de Chrome
  - Automatización de workflows web
  - Integración MCP (Model Context Protocol)

## 🌐 Flujo de Comunicación

```mermaid
graph TB
    subgraph "Frontends"
        APP[04bc - Mobile/Web App<br/>Usuario General]
        TP[ThePulse - Journalism Frontend<br/>Profesional]
    end

    subgraph "Backend Core"
        EW[ExtractorW - API Gateway<br/>:8080]
    end

    subgraph "Servicios Especializados"
        ET[ExtractorT - Social Scraper<br/>:8000]
        LM[LauraMemory - AI Memory<br/>:5001]
        NC[NewsCron - Automation]
        WA[WebAgent - Browser Control]
    end

    subgraph "Datos & AI"
        SB[(Supabase Database)]
        AI[AI Services<br/>OpenRouter/OpenAI/Perplexity]
        ZEP[Zep Memory Cloud]
    end

    APP --> EW
    TP --> EW
    EW --> ET
    EW --> LM
    EW --> NC
    EW --> WA
    LM --> ZEP
    EW --> SB
    EW --> AI
    ET --> SB
    NC --> SB
```

## 🔑 Integraciones Principales

### **Base de Datos**
- **Supabase**: PostgreSQL con Real-time subscriptions y Row Level Security

### **Servicios AI**
- **OpenRouter**: Multiple model access
- **Perplexity**: Search-augmented generation
- **Anthropic**: Claude integration en móvil
- **OpenAI**: GPT models para procesamiento
- **Zep**: Memoria conversacional semántica

### **Procesamiento de Contenido**
- **FFmpeg**: Manipulación multimedia
- **Tesseract**: OCR para imágenes
- **yt-dlp**: Descarga de contenido multimedia
- **Playwright**: Automatización de navegador

## 🚀 Características Arquitecturales

### **Microservicios**
Cada componente opera independientemente con APIs well-defined, permitiendo:
- Escalabilidad horizontal individual
- Deployment independiente
- Tolerancia a fallos aislada

### **Event-Driven**
- Comunicación asíncrona entre servicios
- Procesamiento en tiempo real con Supabase realtime
- Queue-based processing para tareas pesadas

### **AI-First**
- Integración nativa con múltiples proveedores AI
- Memoria conversacional persistente
- Procesamiento inteligente de contenido

### **Multi-Platform**
- Aplicación móvil/web universal (público general)
- Aplicación web profesional especializada (periodistas)
- Soporte para deployment en VPS y contenedores
- Configuración flexible para desarrollo/producción

---

# 🐳 Configuración Docker - Servicios Técnicos

## 🔧 1. ExtractorT - Servicio de Scraping

### **Propósito**
Servicio Python para extraer datos de Twitter/X usando Playwright y técnicas de scraping avanzadas.

### **Configuración Docker**

#### **Dockerfile**
```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Instalar dependencias del sistema (OCR, FFmpeg, etc.)
RUN apt-get update && apt-get install -y \
    tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng \
    jq ffmpeg

# Instalar dependencias Python
COPY requirements.txt ./
RUN pip install -r requirements.txt && \
    pip install psutil yt-dlp

# Copiar código fuente modular
COPY app/ app/
COPY scripts/ scripts/

ENV PYTHONUNBUFFERED=1 \
    DOCKER_ENVIRONMENT=1 \
    PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### **docker-compose.yaml**
```yaml
version: '3.9'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: extractor_api
    ports:
      - "8000:8000"
    env_file:
      - .env
    restart: always

  # Nginx opcional para reverse proxy
  nginx:
    image: nginx:latest
    container_name: nginx_proxy_local
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/local.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/server.conf:/etc/nginx/conf.d/server.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
    restart: always
```

### **Variables de Entorno Principales**
```env
# Configuración Twitter/X
TWITTER_USERNAME=tu_usuario_twitter
TWITTER_PASSWORD=tu_password_twitter

# Proxy Configuration (BrightData)
NITTER_PROXY=http://usuario:password@gw.dataimpulse.com:823
PROXY_USERNAME=tu_usuario_brightdata
PROXY_PASSWORD=tu_password_brightdata

# Docker/Deployment
DOCKER_ENVIRONMENT=1
HEADLESS=1
LOG_LEVEL=INFO
```

### **Endpoints Principales**
- `GET /health` - Health check
- `POST /extract/profile` - Extraer perfil de usuario
- `POST /extract/tweet` - Extraer tweet específico
- `POST /extract/trends` - Extraer tendencias
- `POST /extract/media` - Descargar media

### **Volúmenes y Datos**
- `playwright_data/` - Cookies y estado de autenticación
- `temp_media/` - Archivos multimedia temporales
- `chrome_profile/` - Perfil de Chrome persistente

---

## ⚙️ 2. ExtractorW - Backend API Principal

### **Propósito**
API backend principal en Node.js que coordina todos los servicios, maneja la lógica de negocio y se conecta con Supabase.

### **Configuración Docker**

#### **Dockerfile**
```dockerfile
FROM node:18-alpine

# Instalar FFmpeg y dependencias del sistema
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

WORKDIR /app

# Instalar dependencias Node.js
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S extractorw -u 1001

# Copiar código fuente
COPY --chown=extractorw:nodejs . .

EXPOSE 8080
USER extractorw

CMD ["npm", "start"]
```

#### **docker-compose.yml**
```yaml
services:
  extractorw:
    build: .
    container_name: extractorw-api
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - PORT=8080
      - DOCKER_ENV=true
    env_file:
      - .env
    volumes:
      - logs:/app/logs
      - transcriptions:/tmp
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - extractorw-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  logs:
    driver: local
  transcriptions:
    driver: local

networks:
  extractorw-network:
    driver: bridge
```

### **Variables de Entorno Principales**
```env
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# AI Services
OPENROUTER_API_KEY=tu_openrouter_key
PERPLEXITY_API_KEY=tu_perplexity_key

# Service URLs
EXTRACTOR_T_URL=http://host.docker.internal:8000
LAURA_MEMORY_URL=http://host.docker.internal:5001

# Authentication
JWT_SECRET=tu_jwt_secret
BCRYPT_ROUNDS=12
```

### **Comunicación con Otros Servicios**
```javascript
// Detección automática de URLs en Docker
function getExtractorTUrl() {
  if (process.env.EXTRACTOR_T_URL) {
    return process.env.EXTRACTOR_T_URL;
  }
  
  if (process.env.DOCKER_ENV === 'true') {
    return 'http://host.docker.internal:8000';
  }
  
  return 'http://localhost:8000';
}
```

### **Módulos Principales**
- **Routes**: `/api/capturados`, `/api/trends`, `/api/auth`
- **Services**: `agentesService.js`, `perplexity.js`, `categorization.js`
- **Agents**: `laura/`, `robert/`, `vizta/` (análisis especializado)

---

## 🧠 3. LauraMemoryService - Servicio de Memoria AI

### **Propósito**
Servicio Python independiente para gestionar memoria semántica usando Zep Cloud API.

### **Configuración Docker**

#### **Dockerfile**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    procps

# Crear usuario no-root
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .

# Crear directorios necesarios
RUN mkdir -p logs tests/cassettes /tmp \
    && chown -R app:app /app

USER app
EXPOSE 5001

ENV FLASK_ENV=production
ENV GUNICORN_WORKERS=4

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

CMD ["gunicorn", "--config", "gunicorn.conf.py", "server:app"]
```

#### **docker-compose.yml**
```yaml
version: '3.8'

services:
  laura-memory:
    build: .
    container_name: laura-memory-service
    ports:
      - "5001:5001"
    environment:
      - ZEP_API_KEY=${ZEP_API_KEY}
      - ZEP_URL=${ZEP_URL:-https://api.getzep.com}
      - LAURA_SESSION_ID=${LAURA_SESSION_ID:-laura_memory_session}
      - FLASK_ENV=production
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - ./tests/cassettes:/app/tests/cassettes
      - ./logs:/app/logs
      - /dev/shm:/dev/shm  # Para performance de Gunicorn
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    networks:
      - laura-memory-network

  # Nginx opcional para producción
  nginx:
    image: nginx:alpine
    container_name: laura-memory-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - laura-memory
    profiles:
      - with-nginx

networks:
  laura-memory-network:
    driver: bridge
```

### **Variables de Entorno**
```env
# Zep Cloud Configuration
ZEP_API_KEY=tu_zep_api_key
ZEP_URL=https://api.getzep.com
LAURA_SESSION_ID=laura_memory_session

# Service Configuration
LAURA_MEMORY_ENABLED=true
LAURA_MEMORY_URL=http://localhost:5001
DEBUG=false
SECRET_KEY=tu_secret_key_production
```

### **Endpoints Disponibles**
- `GET /health` - Health check
- `POST /api/laura-memory/search` - Búsqueda semántica
- `POST /api/laura-memory/process-tool-result` - Procesar resultados
- `POST /api/laura-memory/enhance-query` - Mejorar queries
- `GET /api/laura-memory/stats` - Estadísticas del servicio

---

## 🌐 Comunicación Entre Servicios

### **Configuración de Red Docker**

#### **Problema Común**
Los servicios en contenedores separados no pueden usar `localhost` para comunicarse entre sí.

#### **Solución Implementada**
```javascript
// En ExtractorW
function getServiceUrl(serviceName, defaultPort) {
  const envUrl = process.env[`${serviceName.toUpperCase()}_URL`];
  if (envUrl) return envUrl;
  
  if (process.env.DOCKER_ENV === 'true') {
    return `http://host.docker.internal:${defaultPort}`;
  }
  
  return `http://localhost:${defaultPort}`;
}
```

#### **Configuración por Entorno**

**Local Development (Docker)**
```env
# Mac/Windows (Docker Desktop)
EXTRACTOR_T_URL=http://host.docker.internal:8000
LAURA_MEMORY_URL=http://host.docker.internal:5001
DOCKER_ENV=true

# Linux (Docker)
EXTRACTOR_T_URL=http://172.17.0.1:8000
LAURA_MEMORY_URL=http://172.17.0.1:5001
DOCKER_ENV=true
```

**Production (VPS)**
```env
EXTRACTOR_T_URL=http://api.standatpd.com:8000
LAURA_MEMORY_URL=http://memoria.standatpd.com:5001
DOCKER_ENV=false
NODE_ENV=production
```

---

## 🚀 Comandos de Deployment

### **Inicio Completo del Sistema**
```bash
# 1. Iniciar LauraMemoryService
cd LauraMemoryService
docker-compose up -d

# 2. Iniciar ExtractorT
cd ../ExtractorT
docker-compose up -d

# 3. Iniciar ExtractorW
cd ../ExtractorW
docker-compose up -d

# 4. Verificar que todos los servicios están funcionando
curl http://localhost:5001/health  # LauraMemory
curl http://localhost:8000/health  # ExtractorT
curl http://localhost:8080/health  # ExtractorW
```

### **Scripts de Deployment Disponibles**

#### **ExtractorT**
```bash
./run_docker.sh          # Inicio rápido
./rebuild_docker.sh      # Rebuild completo
./update-docker-compose.sh  # Actualizar configuración
```

#### **ExtractorW**
```bash
./deploy.sh              # Deployment completo
make up                  # Usar Makefile
make deploy              # Deployment con checks
```

#### **LauraMemoryService**
```bash
./deploy.sh              # Deployment automático
./start.sh               # Inicio local/desarrollo
```

---

## 📊 Monitoreo y Logs

### **Health Checks**
Todos los servicios implementan health checks automáticos:

```bash
# Verificar estado de todos los servicios
docker-compose ps

# Logs en tiempo real
docker-compose logs -f [service_name]

# Health checks manuales
curl http://localhost:8000/health
curl http://localhost:8080/health  
curl http://localhost:5001/health
```

### **Estructura de Logs**
```
logs/
├── extractort/
│   ├── app.log
│   ├── error.log
│   └── access.log
├── extractorw/
│   ├── application.log
│   ├── api.log
│   └── agent.log
└── laura-memory/
    ├── server.log
    ├── memory.log
    └── zep.log
```

---

## 🔒 Configuración de Seguridad

### **Variables de Entorno Sensibles**
```env
# Mantener en .env local, NUNCA en git
TWITTER_PASSWORD=***
SUPABASE_SERVICE_ROLE_KEY=***
OPENROUTER_API_KEY=***
PERPLEXITY_API_KEY=***
ZEP_API_KEY=***
JWT_SECRET=***
```

### **Usuarios No-Root**
Todos los contenedores ejecutan con usuarios no-root:
- **ExtractorW**: Usuario `extractorw` (uid: 1001)
- **LauraMemory**: Usuario `app`
- **ExtractorT**: Usuario por defecto de Playwright

### **Red Interna**
Los servicios utilizan redes Docker internas para comunicación segura.

---

## 🔧 Troubleshooting Común

### **Error: ECONNREFUSED**
```bash
# Verificar que los servicios están ejecutándose
docker-compose ps

# Verificar configuración de red
echo $EXTRACTOR_T_URL
echo $LAURA_MEMORY_URL
```

### **Error: Puerto en Uso**
```bash
# Verificar puertos ocupados
lsof -i :8000
lsof -i :8080
lsof -i :5001

# Cambiar puertos en docker-compose.yml si es necesario
```

### **Error: Memoria Insuficiente**
```bash
# Verificar uso de memoria
docker stats

# Ajustar límites en docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
```

---

## 📋 Checklist de Deployment

- [ ] **Variables de entorno configuradas** en todos los servicios
- [ ] **Puertos disponibles** (8000, 8080, 5001)
- [ ] **Docker y Docker Compose** instalados
- [ ] **Zep API Key** configurada para LauraMemory
- [ ] **Supabase** configurado para ExtractorW
- [ ] **Proxy/VPN** configurado para ExtractorT (si es necesario)
- [ ] **SSL/TLS** configurado para producción
- [ ] **Nginx** configurado como reverse proxy
- [ ] **Monitoreo y logs** configurados
- [ ] **Backups** de datos importantes configurados

---

## 📝 Notas Importantes para el Desarrollo

### **Deployment Environments**

**Local Development:**
- **ExtractorW**: Ejecuta en Docker local (puerto 8080)
- **ExtractorT**: Ejecuta en Docker local (puerto 8000)
- **LauraMemoryService**: Ejecuta en Docker local (puerto 5001)
- **Comunicación**: Via `host.docker.internal` entre servicios

**Production Environment:**
- **ExtractorW**: VPS con URL oficial
- **ExtractorT**: VPS con URL oficial
- **LauraMemoryService**: VPS con URL oficial
- **URLs de Producción**: Configuradas en variables de entorno

**Configuración por Entorno:**

```env
# Development (Local Docker)
EXTRACTOR_T_URL=http://host.docker.internal:8000
LAURA_MEMORY_URL=http://host.docker.internal:5001
DOCKER_ENV=true

# Production (VPS)
EXTRACTOR_T_URL=http://api.standatpd.com:8000
LAURA_MEMORY_URL=http://memoria.standatpd.com:5001
DOCKER_ENV=false
```

**Deployment Workflow:**
- **Local**: `docker-compose up -d` en cada servicio
- **Production**: Pull changes → restart services en VPS
- **Ubicación Local**: `/Users/pj/Desktop/Pulse Journal/ExtractorW` y `/Users/pj/Desktop/Pulse Journal/ExtractorT`

### **Diferencia Clave entre Frontends:**

**App Móvil (04bc...):**
- **Target**: Usuarios finales del público general
- **UX/UI**: Simple, intuitivo, user-friendly
- **Funcionalidades**: Consumo básico de noticias, interacción social
- **Plataforma**: Móvil-first con soporte web

**ThePulse:**
- **Target**: Periodistas profesionales y analistas
- **UX/UI**: Avanzado, herramientas especializadas, dashboards complejos
- **Funcionalidades**: Investigación profunda, análisis de datos, verificación de hechos
- **Plataforma**: Web-first optimizado para productividad

---

## 🔐 Patrones de Administración y Permisos

### **Implementación de Funcionalidades de Admin**

Cuando necesites añadir funcionalidades que requieren permisos de admin, sigue estos patrones establecidos:

#### **1. Verificación de Admin en Frontend**
```typescript
// En componentes React, usar el hook useAuth
const { isAdmin } = useAuth();
const [isAdminUser, setIsAdminUser] = useState(false);

// Verificar permisos según el contexto
useEffect(() => {
  const checkPermissions = async () => {
    if (item.visibility === 'private') {
      setIsAdminUser(true); // Owner puede editar items privados
    } else {
      const adminStatus = await isAdmin();
      setIsAdminUser(adminStatus);
    }
  };
  checkPermissions();
}, [item.visibility, isAdmin]);
```

#### **2. Verificación de Admin en Backend Services**
```typescript
// En servicios (services/), usar la función RPC is_admin
const { data: userData } = await supabase.auth.getUser();
if (!userData.user) {
  throw new Error('User not authenticated');
}

// Para items públicos, verificar admin
if (item.visibility === 'public') {
  const { data: isUserAdmin, error: adminError } = await supabase.rpc('is_admin', {
    check_user_id: userData.user.id
  });

  if (adminError) {
    console.error('Error checking admin status:', adminError);
    throw new Error('Unable to verify permissions');
  }

  if (!isUserAdmin) {
    throw new Error('Only administrators can perform this action on public items');
  }
} else {
  // Para items privados, verificar ownership
  if (item.owner_id !== userData.user.id) {
    throw new Error('You can only modify your own private items');
  }
}
```

#### **3. RLS Policies para Admin en Base de Datos**

Cuando necesites que admins puedan realizar operaciones (DELETE, UPDATE) en items públicos:

```sql
-- Crear política que permite a admins realizar la operación
CREATE POLICY "Admins can [action] public [table]"
ON [table_name]
FOR [DELETE|UPDATE]
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
```

**Ejemplo real implementado:**
```sql
-- Permite a admins eliminar datasets públicos
CREATE POLICY "Admins can delete public datasets"
ON public_datasets
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
```

#### **4. Patrón de Uso en UI**

**Para mostrar/ocultar funcionalidades admin:**
```typescript
// Mostrar botón solo si es admin (para items públicos) o owner (para privados)
{isAdminUser && (
  <Tooltip title={isAdminUser ? "Admin action" : "Only admins can perform this action"}>
    <span>
      <IconButton
        onClick={handleAdminAction}
        disabled={!isAdminUser}
      >
        <ActionIcon />
      </IconButton>
    </span>
  </Tooltip>
)}
```

#### **5. Flujo Completo de Implementación**

Cuando implementes una nueva funcionalidad de admin:

1. **Frontend**: Usar `useAuth().isAdmin()` para verificar permisos según visibility
2. **Backend**: Usar `supabase.rpc('is_admin')` para validar en el servicio
3. **Database**: Crear RLS policy que permita admin access con `profiles.role = 'admin'`
4. **UI**: Mostrar/habilitar controles basado en `isAdminUser` state

#### **6. Troubleshooting Admin Issues**

**Error común: "Dataset could not be deleted. You may not have permission"**
- **Causa**: Falta RLS policy para admin en la tabla correspondiente
- **Solución**: Crear policy que permita admin access usando `profiles.role = 'admin'`

**Error común: 406 Not Acceptable en requests**
- **Causa**: RLS blocking access to table
- **Solución**: Verificar que existe policy apropiada para la operación (SELECT, INSERT, UPDATE, DELETE)

#### **7. Configuración Actual de Admin**

- **Admin Check Function**: `supabase.rpc('is_admin', { check_user_id: user.id })`
- **Admin Role Storage**: `profiles` table, `role` column con valor `'admin'`
- **Context Hook**: `useAuth().isAdmin()` disponible en todos los componentes
- **Project ID**: `qqshdccpmypelhmyqnut` para operaciones MCP Supabase

---

Este documento proporciona una visión completa de la arquitectura del proyecto Pulse Journal. El sistema está diseñado como microservicios independientes pero interoperables, permitiendo escalabilidad y mantenimiento eficiente tanto para usuarios generales como profesionales del periodismo.

---

# 📊 **ThePulse - Análisis Completo de Características Web**

## 🏗️ **Arquitectura General**
- **Tecnología**: React 18 + TypeScript + Vite
- **UI Framework**: Material-UI (@mui/material) + Radix UI + Chakra UI
- **Routing**: React Router DOM v6
- **Estado**: Zustand + React Context + Jotai
- **232 archivos TypeScript** distribuidos en arquitectura modular

## 🎯 **Páginas Principales (16 rutas)**

### **Rutas Públicas**
- `/` - **Home**: Landing page con redirección inteligente
- `/login` - **Autenticación**: Login con integración OAuth
- `/register` - **Registro**: Formulario de registro de usuarios
- `/pricing` - **Precios**: Planes y suscripciones
- `/terms` - **Términos y Condiciones**
- `/privacy` - **Política de Privacidad**

### **Dashboard Principal**
- `/dashboard` - **Trends**: Panel principal con análisis de tendencias
  - Word clouds dinámicas
  - Distribución por categorías (General/Deportes)
  - Estadísticas en tiempo real
  - Filtros deportivos avanzados

### **Páginas Especializadas (Profesionales)**
- `/codex` - **Enhanced Codex**: Sistema de gestión de conocimiento
  - Wiki organizacional
  - Monitoreo de contenido
  - Integración Google Drive
  - Editor de texto enriquecido (TipTap)
  - Gestión de proyectos y grupos

- `/canvas` - **DashboardsPage**: Tableros interactivos
  - Sistema de sondeos modernos
  - Gráficos interactivos (Recharts)
  - Layouts responsivos con drag-and-drop

- `/news` - **News**: Centro de noticias
  - Feeds personalizados
  - Análisis de contenido
  - Integración con ExtractorW/ExtractorT

- `/analytics` - **Analytics**: Métricas y estadísticas
- `/sources` - **Sources**: Gestión de fuentes de datos
- `/knowledge` - **Knowledge**: Base de conocimiento empresarial
- `/projects` - **Projects**: Gestión de proyectos (Alpha/Admin)

### **Páginas Administrativas**
- `/admin` - **AdminPanel**: Panel de administración completo
- `/recent` - **RecentActivity**: Actividad reciente del sistema
- `/settings` - **DesignSettingsDemo**: Configuración de diseño

## 🧩 **Sistema de Componentes UI**

### **Componentes Base (shadcn/ui)**
- **Cards**: Tarjetas especializadas por tipo de contenido
- **Modals**: Dialogs para creación/edición de datos
- **Charts**: ModernBarChart, ModernLineChart (Recharts)
- **Forms**: React Hook Form con validaciones
- **Data Tables**: Grillas editables con React Datasheet Grid

### **Componentes Especializados**
- **WordCloud**: Visualización interactiva de tendencias
- **TrendingTweetsSection**: Sección de tweets en tiempo real
- **NitterTweetsSection**: Integración con Nitter
- **ViztaChatUI**: Chat AI integrado (fijo en layout)
- **SpreadsheetPanel**: Panel de hoja de cálculo flotante
- **MonitoringCard**: Tarjetas de monitoreo Codex

### **Componentes Wiki (Codex)**
- **WikiItemCard**: Tarjetas de elementos wiki
- **WikiStatsPanel**: Panel estadísticas wiki
- **CreateWikiModal**: Modal creación elementos
- **CategoryFilters**: Filtros por categoría
- **RichTextEditor**: Editor TipTap avanzado

## 🔐 **Sistema de Autenticación y Autorización**

### **Niveles de Acceso**
- **Público**: Home, Login, Register, Pricing
- **Usuario Verificado**: Dashboard, Sources, Analytics, Codex, News, Canvas
- **Admin/Alpha**: Recent Activity, Projects, Admin Panel
- **Rutas Protegidas**: ProtectedRoute, VerifiedRoute, AdminAlphaRoute

### **Contextos y Hooks**
- **AuthContext**: Gestión de autenticación
- **useAuth**: Hook de usuario actual
- **useUserProfile**: Perfil de usuario con LogRocket
- **useUserType**: Verificación de niveles de acceso

## 🗂️ **Gestión de Estado**

### **Context Providers**
- **AuthProvider**: Autenticación global
- **LanguageProvider**: Internacionalización (ES/EN)
- **SpreadsheetProvider**: Estado de spreadsheet flotante

### **Estado Local**
- **Zustand**: Estado global ligero
- **Jotai**: Átomos de estado reactivo
- **React Hook Form**: Formularios complejos

## 🔌 **Integraciones y APIs**

### **Backend Principal (ExtractorW)**
- **Trends**: Análisis de tendencias en tiempo real
- **Categories**: Categorización deportes vs general
- **Twitter Integration**: Scraping y análisis de tweets
- **AI Processing**: OpenRouter, Perplexity, OpenAI

### **Servicios Especializados**
- **ExtractorT**: Python API para scraping social media
- **LauraMemoryService**: Memoria semántica con Zep Cloud
- **Supabase**: Base de datos PostgreSQL con RLS
- **Google Drive**: Integración para gestión de archivos

### **APIs Externas**
- **ElevenLabs**: Text-to-speech
- **Mapbox/Google Maps**: Visualización geográfica
- **21st Extension**: Toolbar integrado
- **LogRocket**: Analytics y monitoreo

## 🎨 **Sistema de Diseño**

### **Design System**
- **Tailwind CSS**: Utility-first styling
- **Material-UI**: Componentes enterprise
- **Radix UI**: Primitivos headless
- **Chakra UI**: Componentes adicionales
- **Framer Motion**: Animaciones avanzadas

### **Temas y Estilos**
- **Dark/Light Mode**: Soporte completo
- **Responsive Design**: Mobile-first
- **Color Palette**: Consistent across frameworks
- **Typography**: Sistema tipográfico coherente

## 📊 **Características Distintivas**

### **Para Periodistas Profesionales**
1. **Enhanced Codex**: Sistema completo de gestión de conocimiento
2. **Advanced Analytics**: Métricas detalladas de contenido
3. **Real-time Monitoring**: Monitoreo en tiempo real
4. **Research Tools**: Herramientas de investigación especializadas
5. **Collaboration**: Gestión de proyectos colaborativos

### **Análisis y Visualización**
1. **Dynamic Word Clouds**: Nubes de palabras interactivas
2. **Trend Analysis**: Análisis de tendencias con IA
3. **Sports Filtering**: Filtros especializados para deportes
4. **Interactive Charts**: Gráficos interactivos (Recharts)
5. **Real-time Data**: Datos en tiempo real vía Supabase

### **Gestión de Contenido**
1. **Rich Text Editor**: Editor TipTap con extensiones
2. **File Management**: Gestión avanzada de archivos
3. **Wiki System**: Sistema wiki organizacional
4. **Project Management**: Gestión completa de proyectos
5. **Version Control**: Control de versiones de contenido

## 🚀 **Tecnologías Avanzadas**

### **AI/ML Integrations**
- **Multiple AI Providers**: OpenRouter, OpenAI, Perplexity
- **Semantic Memory**: Zep Cloud para memoria conversacional
- **Natural Language Processing**: Análisis de sentimientos
- **Content Classification**: Categorización automática

### **Real-time Features**
- **Supabase Realtime**: Subscripciones en tiempo real
- **Live Updates**: Actualizaciones automáticas
- **Chat Integration**: Vizta Chat UI integrado
- **Collaborative Editing**: Edición colaborativa

### **Performance & Optimization**
- **Code Splitting**: División de código automática
- **Lazy Loading**: Carga perezosa de componentes
- **Caching**: Sistema de caché inteligente
- **Bundle Optimization**: Optimización de bundle Vite

## 🎯 **Resumen Ejecutivo**

**ThePulse** es una aplicación web profesional completa para periodismo y análisis de medios, construida con tecnologías modernas y diseñada específicamente para workflows especializados.

### **Estadísticas del Proyecto:**
- **232 archivos TypeScript** con arquitectura modular
- **16 rutas principales** con 3 niveles de autorización
- **150+ componentes React** con hooks y interfaces
- **25+ servicios** de integración con APIs externas
- **Múltiples frameworks UI** integrados coherentemente

### **Fortalezas Clave:**
1. **Arquitectura Profesional**: Sistema modular escalable
2. **Funcionalidades Avanzadas**: Herramientas especializadas para periodistas
3. **Integración IA**: Multiple providers para análisis inteligente
4. **Real-time Capabilities**: Datos en tiempo real vía Supabase
5. **Sistema Completo**: Desde scraping hasta visualización final

La aplicación está claramente diseñada para uso profesional intensivo, con herramientas especializadas que van más allá del consumo básico de noticias hacia análisis, investigación y gestión de contenido empresarial.

---

# 🗺️ **Guía Rápida de Navegación - ThePulse Features**

## 📁 **Estructura de Archivos por Funcionalidad**

### **🔍 Análisis de Tendencias**
```
📂 ThePulse/src/pages/Trends.tsx (línea principal)
📂 ThePulse/src/components/ui/WordCloud.tsx
📂 ThePulse/src/components/ui/BarChart.tsx
📂 ThePulse/src/components/ui/TrendingTweetsSection.tsx
📂 ThePulse/src/services/api.ts (API de tendencias)
```

### **📚 Sistema Codex (Gestión de Conocimiento)**
```
📂 ThePulse/src/pages/EnhancedCodex.tsx (página principal)
📂 ThePulse/src/components/codex/wiki/WikiItemCard.tsx
📂 ThePulse/src/components/codex/monitoring/MonitoringCard.tsx
📂 ThePulse/src/services/wikiService.ts
📂 ThePulse/src/services/codexService.ts
```

### **🎨 Canvas/Dashboards Interactivos**
```
📂 ThePulse/src/pages/DashboardsPage.tsx
📂 ThePulse/src/pages/SondeosModern.tsx
📂 ThePulse/src/components/ui/ModernBarChart.tsx
📂 ThePulse/src/components/ui/ModernLineChart.tsx
```

### **🔐 Autenticación y Autorización**
```
📂 ThePulse/src/context/AuthContext.tsx
📂 ThePulse/src/pages/Login.tsx
📂 ThePulse/src/hooks/useAuth.ts
📂 ThePulse/src/hooks/useUserType.ts
```

### **⚙️ Administración**
```
📂 ThePulse/src/pages/AdminPanel.tsx
📂 ThePulse/src/pages/RecentActivity.tsx
📂 ThePulse/src/services/projects.ts
```

## 🎯 **Ubicación de Features Específicas**

### **Word Clouds Dinámicas**
- **Archivo**: `ThePulse/src/components/ui/WordCloud.tsx`
- **Implementación**: Visualización interactiva con colores dinámicos
- **Datos**: Desde `ThePulse/src/services/api.ts`

### **Filtros Deportivos**
- **Archivo**: `ThePulse/src/pages/Trends.tsx` (líneas 76-81)
- **Componente**: Sistema de tabs (Todos/General/Deportes)
- **Lógica**: Categorización automática vía IA

### **Editor de Texto Enriquecido**
- **Archivo**: `ThePulse/src/components/ui/RichTextEditor.tsx`
- **Framework**: TipTap con extensiones avanzadas
- **Features**: Tablas, enlaces, imágenes, estilos

### **Chat AI (Vizta)**
- **Archivo**: `ThePulse/src/components/ui/vizta-chat.tsx`
- **Ubicación**: Botón flotante en layout
- **Integración**: Siempre disponible en páginas protegidas

### **Sistema de Spreadsheets**
- **Context**: `ThePulse/src/context/SpreadsheetContext.tsx`
- **Componente**: `ThePulse/src/components/ui/SpreadsheetPanel.tsx`
- **Botón**: `ThePulse/src/components/ui/SpreadsheetFloatingButton.tsx`

### **Integración Google Drive**
- **Hook**: `ThePulse/src/hooks/useGoogleDrive.ts`
- **Implementación**: En página Enhanced Codex
- **Funcionalidad**: Upload/download automático

### **Sistema de Proyectos**
- **Archivo**: `ThePulse/src/pages/Projects.tsx`
- **Servicio**: `ThePulse/src/services/projects.ts`
- **Acceso**: Solo Admin/Alpha users

## 🔍 **Funcionalidades por Ruta**

### **`/dashboard` (Trends)**
- **Ubicación**: `ThePulse/src/pages/Trends.tsx`
- **Features**:
  - Word clouds interactivas
  - Filtros por categoría (General/Deportes)
  - Estadísticas en tiempo real
  - Tweets trending

### **`/codex` (Enhanced Codex)**
- **Ubicación**: `ThePulse/src/pages/EnhancedCodex.tsx`
- **Features**:
  - Wiki organizacional (líneas 800-1200)
  - Sistema de monitoreo (líneas 600-800)
  - Editor TipTap integrado
  - Gestión de archivos Google Drive

### **`/canvas` (Dashboards)**
- **Ubicación**: `ThePulse/src/pages/DashboardsPage.tsx`
- **Features**:
  - Gráficos interactivos
  - Sistema de sondeos
  - Layouts drag-and-drop

### **`/admin` (Panel de Administración)**
- **Ubicación**: `ThePulse/src/pages/AdminPanel.tsx`
- **Features**:
  - Gestión de usuarios
  - Monitoreo de sistema
  - Configuraciones globales

## 📊 **Servicios y APIs**

### **API Principal**
- **Archivo**: `ThePulse/src/services/api.ts`
- **Endpoints**: Trends, Categories, Statistics
- **Backend**: Conecta con ExtractorW (:8080)

### **Base de Datos**
- **Archivo**: `ThePulse/src/services/supabase.ts`
- **Funciones**: CRUD operations, RLS policies
- **Real-time**: Subscripciones automáticas

### **Servicios Especializados**
```
📂 ThePulse/src/services/
├── wikiService.ts (gestión wiki)
├── codexService.ts (codex operations)
├── projects.ts (gestión proyectos)
├── elevenLabs.ts (text-to-speech)
└── nitterTweets.ts (Twitter integration)
```

## 🎨 **Componentes UI por Categoría**

### **Charts y Visualizaciones**
```
📂 ThePulse/src/components/ui/
├── ModernBarChart.tsx
├── ModernLineChart.tsx
├── WordCloud.tsx
└── BarChart.tsx
```

### **Modals y Dialogs**
```
📂 ThePulse/src/components/ui/
├── CreateDecisionModal.tsx
├── EditDecisionModal.tsx
├── SondeoConfigModal.tsx
└── MiniModal.tsx
```

### **Componentes Layout**
```
📂 ThePulse/src/components/layout/
├── Layout.tsx (layout principal)
├── Header.tsx
└── sidebar.tsx
```

Esta guía te permite localizar rápidamente cualquier funcionalidad específica dentro del proyecto ThePulse. 