# WebAgent Deployment Guide

## Resumen
Esta guía explica cómo desplegar el WebAgent integrado con ExtractorW tanto en desarrollo local como en producción (VPS).

## Arquitectura de Comunicación

```
Frontend (Producción) 
    ↓ HTTPS
ExtractorW (Docker VPS:8080)
    ↓ HTTP (red interna Docker)
WebAgent (Docker VPS:8787)
```

## 🏠 Desarrollo Local

### Configuración Actual
- **ExtractorW**: Ejecutándose localmente (Node.js directo)
- **WebAgent**: Ejecutándose en Docker (puerto 8787)
- **Comunicación**: `http://127.0.0.1:8787`

### Comandos de Desarrollo
```bash
# Iniciar WebAgent
docker compose -f docker-compose.webagent.yml up -d

# Iniciar ExtractorW (en otra terminal)
cd ExtractorW && npm start

# Probar integración
curl -X POST http://127.0.0.1:8080/api/webagent/explore \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "goal": "buscar iniciativas"}'
```

## 🚀 Producción (VPS)

### 1. Configuración Docker
```bash
# Subir archivos al VPS
scp -r . user@your-vps:/home/user/pulse-journal/

# En el VPS
cd /home/user/pulse-journal/
docker compose -f docker-compose.unified.yml up -d
```

### 2. Variables de Entorno Críticas

**ExtractorW (.env)**:
```env
NODE_ENV=production
PORT=8080
DOCKER_ENV=true
WEBAGENT_URL=http://webagent:8787
```

**WebAgent (.env)**:
```env
NODE_ENV=production
PORT=8787
OPENROUTER_API_KEY=tu_clave_aqui
OPENAI_API_KEY=tu_clave_fallback
```

### 3. Configuración de Red Docker
```yaml
# docker-compose.unified.yml
services:
  extractorw:
    environment:
      - WEBAGENT_URL=http://webagent:8787  # Nombre del contenedor
    networks:
      - pulse-network
    
  webagent:
    networks:
      - pulse-network

networks:
  pulse-network:
    driver: bridge
```

## 🔧 Configuración Inteligente

El código detecta automáticamente el entorno:

```javascript
// En webAgent.js
const WEBAGENT_URL = process.env.WEBAGENT_URL || 
  (process.env.DOCKER_ENV === 'true' ? 'http://webagent:8787' : 'http://127.0.0.1:8787');
```

- **Desarrollo**: `http://127.0.0.1:8787` (localhost)
- **Producción**: `http://webagent:8787` (red Docker)

## 📋 Endpoints Disponibles

### A través de ExtractorW
```bash
# Explorar una página web
POST /api/webagent/explore
{
  "url": "https://congreso.gob.gt",
  "goal": "Necesito buscar 'iniciativas'",
  "maxSteps": 3
}

# Verificar salud
GET /api/webagent/health

# Información del servicio
GET /api/webagent/info
```

### Directo (solo desarrollo)
```bash
# Acceso directo al WebAgent
POST http://127.0.0.1:8787/explore/summarize
GET  http://127.0.0.1:8787/health
```

## 🌐 Integración Frontend

### Desarrollo
```javascript
const response = await fetch('http://localhost:8080/api/webagent/explore', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://congreso.gob.gt',
    goal: 'Necesito buscar "iniciativas"'
  })
});
```

### Producción
```javascript
const response = await fetch('https://your-domain.com/api/webagent/explore', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://congreso.gob.gt',
    goal: 'Necesito buscar "iniciativas"'
  })
});
```

## 🔍 Troubleshooting

### Error: "WebAgent no está disponible"
1. Verificar que WebAgent esté ejecutándose:
   ```bash
   docker ps | grep webagent
   curl http://127.0.0.1:8787/health
   ```

2. Verificar configuración de red:
   ```bash
   docker network ls
   docker network inspect pulse-network
   ```

3. Verificar logs:
   ```bash
   docker logs webagent
   docker logs extractorw-api
   ```

### Error: "Cannot POST /api/webagent/explore"
- ExtractorW necesita reiniciarse después de agregar nuevos endpoints
- Verificar que el archivo `webAgent.js` esté en `/server/routes/`

### Error: "ECONNREFUSED"
- En desarrollo: WebAgent no está ejecutándose en puerto 8787
- En producción: Verificar red Docker y nombres de contenedores

## 🚦 Comandos de Verificación

```bash
# Verificar servicios
curl http://127.0.0.1:8080/api/health          # ExtractorW
curl http://127.0.0.1:8787/health               # WebAgent directo
curl http://127.0.0.1:8080/api/webagent/health  # WebAgent via proxy

# Probar integración completa
node test-webagent-integration.js
```

## 📦 Estructura de Archivos
```
├── WebAgent/
│   ├── src/server.ts          # Servidor WebAgent
│   ├── Dockerfile             # Imagen WebAgent
│   └── .env                   # Config WebAgent
├── ExtractorW/
│   ├── server/routes/webAgent.js  # Proxy endpoint
│   ├── Dockerfile             # Imagen ExtractorW
│   └── .env                   # Config ExtractorW
├── docker-compose.unified.yml # Despliegue conjunto
└── docker-compose.webagent.yml # Solo WebAgent (dev)
```

Esta configuración permite que el frontend en producción acceda al WebAgent a través de ExtractorW sin exponer WebAgent directamente al público.

