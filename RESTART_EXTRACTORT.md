# 🔄 Reiniciar ExtractorT

## Cambios Implementados

✅ ExtractorT ahora acepta parámetro `limit` (1-50)
✅ Por defecto devuelve 15, pero puede devolver hasta 50 si están disponibles
✅ NewsCron ajusta dinámicamente el balanceo según trends recibidos

---

## 🚀 Reiniciar ExtractorT

### Opción 1: Docker Compose (Recomendado)

```bash
cd "Pulse Journal/ExtractorT"
docker-compose restart
```

### Opción 2: Detener y Levantar

```bash
cd "Pulse Journal/ExtractorT"
docker-compose down
docker-compose up -d
```

### Opción 3: Rebuild (Si hay problemas)

```bash
cd "Pulse Journal/ExtractorT"
docker-compose down
docker-compose build
docker-compose up -d
```

---

## ✅ Verificar que Funciona

### Test 1: Sin limit (default 15)

```bash
curl "https://api.standatpd.com/trending?location=guatemala"
```

### Test 2: Con limit=50

```bash
curl "https://api.standatpd.com/trending?location=guatemala&limit=50"
```

### Test 3: Ver logs

```bash
docker logs extractort-api -f
```

---

## 🧪 Probar NewsCron

Una vez que ExtractorT esté reiniciado:

```bash
cd "Pulse Journal/NewsCron"
node fetch_trending_process.js
```

**Esperado:**
- 🤖 Gemini clasifica los trends recibidos (15-50)
- ⚖️ Balanceo dinámico:
  - Si recibe 30+: 5 deportivos + 10 no deportivos = 15 total
  - Si recibe 15-30: 3 deportivos + 7 no deportivos = 10 total
- ✅ ExtractorW procesa solo los seleccionados

---

## 📊 Balanceo Dinámico

| Trends Recibidos | Deportivos | No Deportivos | Total Procesado |
|------------------|------------|---------------|-----------------|
| 50 trends | 5 máx | 10 máx | 15 |
| 30 trends | 5 máx | 10 máx | 15 |
| 15 trends | 3 máx | 7 máx | 10 |

---

## ⚠️ Nota Importante

**Trends24 típicamente solo muestra 15-20 trends actuales en tiempo real.**

Para obtener 50 trends necesitarías:
- Múltiples fuentes (Twitter API, Google Trends, etc.)
- Trends históricos (últimas horas)
- Trends de diferentes categorías

Por ahora, el sistema trabajará con los 15-20 trends que Trends24 proporciona, pero está preparado para escalar si agregas más fuentes.

