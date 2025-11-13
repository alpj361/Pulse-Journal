# 🐳 Arquitectura Docker - Pulse Journal

Esta documentación explica la estructura completa de los servicios Docker del proyecto Pulse Journal, incluyendo su configuración, dependencias y comunicación entre servicios.

## 📋 Resumen de Servicios

```mermaid
graph TB
    subgraph "Frontend"
        PJ[PulseJ - React Frontend]
    end
    
    subgraph "Backend Services"
        EW[ExtractorW - API Backend<br/>Puerto: 8080]
        ET[ExtractorT - Scraper Service<br/>Puerto: 8000]
        LM[LauraMemoryService - Memory AI<br/>Puerto: 5001]
    end
    
    subgraph "External Services"
        SB[(Supabase Database)]
        PX[Perplexity API]
        OR[OpenRouter API]
        ZEP[Zep Memory API]
    end
    
    PJ --> EW
    EW --> ET
    EW --> LM
    LM --> ZEP
    EW --> SB
    EW --> PX
    EW --> OR
    ET --> SB
```

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

#### **Configuración por Plataforma**

**Mac/Windows (Docker Desktop)**
```env
EXTRACTOR_T_URL=http://host.docker.internal:8000
LAURA_MEMORY_URL=http://host.docker.internal:5001
```

**Linux**
```env
EXTRACTOR_T_URL=http://172.17.0.1:8000
LAURA_MEMORY_URL=http://172.17.0.1:5001
```

**Producción (VPS)**
```env
EXTRACTOR_T_URL=http://api.standatpd.com:8000
LAURA_MEMORY_URL=http://memoria.standatpd.com:5001
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

Este documento proporciona una visión completa de la arquitectura Docker del proyecto Pulse Journal. Cada servicio está diseñado para ser independiente pero interoperable, permitiendo escalabilidad y mantenimiento eficiente. 