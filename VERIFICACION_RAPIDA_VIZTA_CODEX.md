# ✅ Verificación Rápida: Vizta + Codex Context

## 🔍 Estado de Implementación

### Flujo Completo Implementado

```
Usuario selecciona Wiki item en modal
         ↓
Frontend: selectedCodex = ["codex_abc-123"]
         ↓
Usuario envía mensaje
         ↓
Frontend: sendViztaChatQuery(message, sessionId, mode, genUI, selectedCodex)
         ↓
Backend: viztaChat.js recibe codex_item_ids
         ↓
Backend: inyecta codex_item_ids en processChatMode/processAgenticMode
         ↓
Backend: cuando OpenPipe sugiere user_codex, inyecta codex_item_ids
         ↓
Backend: Vizta detecta params.codex_item_ids y llama user_codex_specific
         ↓
Backend: mcp.js ejecuta executeUserCodexSpecific()
         ↓
Backend: Robert obtiene items específicos con getCodexItemsByIds()
         ↓
Backend: formatea con metadata de Wiki/Monitoring
         ↓
Vizta recibe contexto estructurado y responde
```

## ✅ Archivos Modificados

1. ✅ `ThePulse/src/services/viztaChat.ts` - Parámetro codexItemIds agregado
2. ✅ `ThePulse/src/components/ui/vizta-chat.tsx` - Estado selectedCodex + CodexSelector
3. ✅ `ThePulse/src/components/ui/CodexSelector.tsx` - Filtros de categoría/Wiki
4. ✅ `ExtractorW/server/routes/viztaChat.js` - Recibe y pasa codex_item_ids
5. ✅ `ExtractorW/server/services/agents/vizta/index.js` - Detecta codex_item_ids
6. ✅ `ExtractorW/server/services/mcp.js` - Handler user_codex_specific
7. ✅ `ExtractorW/server/services/agents/robert/codexEngine.js` - getCodexItemsByIds()

## 🧪 Cómo Probar

### Paso 1: Verificar que tienes items en tu Codex
```bash
# En consola del navegador (ThePulse)
# O consultar directamente Supabase
```

### Paso 2: Abrir Vizta Chat
1. Ir a ThePulse
2. Abrir el chat de Vizta (sidebar)

### Paso 3: Abrir Modal de Contexto
1. Click en botón de Info (abajo izquierda del input)
2. Click en "📚 Codex" en el dropdown
3. Se abre modal completo con CodexSelector

### Paso 4: Seleccionar Items
1. Ver filtros de categoría: [Todos] [📁 General] [📊 Monitoreos] [📚 Wiki]
2. Click en "📚 Wiki"
3. Ver subfiltros: [👤 Personas] [🏢 Orgs] [📍 Lugares] [📅 Eventos] [💡 Conceptos]
4. Seleccionar uno o más items con checkbox
5. Click "Aplicar (N)"

### Paso 5: Hacer Pregunta
1. Escribir pregunta relacionada con los items seleccionados
2. Enviar
3. Ver respuesta de Vizta con contexto

## ⚠️ Problema Actual

**EL CONTEXTO DEBERÍA FUNCIONAR PERO...**

Hay un pequeño issue: cuando OpenPipe/AI decide automáticamente usar `user_codex`, los `codex_item_ids` ya están inyectados en las tool calls (líneas 306-309 y 448-451 de viztaChat.js).

PERO si el usuario NO selecciona nada del Codex, el comportamiento es normal (búsqueda automática).

## 🔧 Para que funcione 100%

Necesito verificar que el backend de Vizta esté corriendo con los cambios. Los archivos están modificados pero **necesitas reiniciar el servidor ExtractorW** para que tome los cambios:

```bash
cd "/Users/pj/Desktop/Pulse Journal/ExtractorW"
# Detener servidor actual
# Iniciar de nuevo (según tu setup de Docker)
docker-compose restart
```

## 📝 Logs para Verificar

Cuando funcione correctamente, verás en los logs del backend:

```
📚 Codex items seleccionados manualmente: 2
[CHAT_MODE] 🎯 Inyectando 2 codex items seleccionados a user_codex
[VIZTA] 🎯 Usando 2 items específicos del Codex seleccionados manualmente
[ROBERT/CODEX] 🎯 Obteniendo 2 items específicos del Codex
[ROBERT/CODEX] ✅ Obtenidos 2 items específicos
📚 Ejecutando user_codex_specific para usuario: user@example.com
🎯 Items solicitados: 2
```

Y en el frontend (consola del navegador):

```
📚 Codex items seleccionados: 2
🤖 Enviando consulta a Vizta Chat: ¿Qué opinas de esto?
✅ Respuesta de Vizta Chat recibida
```

## ✅ Qué Deberías Ver

### En el Modal de Contexto:
- ✅ Filtros de categoría (General, Monitoring, Wiki)
- ✅ Subfiltros según categoría seleccionada
- ✅ Items con badges de categoría
- ✅ Wiki items con metadata (⭐ relevancia, 🏛️ partido, etc.)
- ✅ Contador "✅ N items seleccionados"

### En la Respuesta de Vizta:
Si seleccionaste un Wiki item de "Bernardo Arévalo":

```
Basándome en tu Codex personal (selección manual):

📚 Wiki: 1 item
👤 Bernardo Arévalo
   Categoría: wiki > wiki_person
   ⭐ Relevancia: 95/100
   🏛️ Partido: Movimiento Semilla
   💼 Cargo: Presidente de Guatemala

[Respuesta contextualizada usando esta información...]
```

## 🐛 Si NO Funciona

1. **Verificar que CodexSelector carga items:**
   - Abrir modal
   - Ver si aparecen items
   - Verificar en consola: "Cargando items del codex..."

2. **Verificar que selectedCodex se actualiza:**
   - Hacer click en checkbox
   - Ver contador "✅ N items seleccionados"

3. **Verificar que se envía al backend:**
   - Consola del navegador debe mostrar:
     `📚 Codex items seleccionados: N`

4. **Verificar logs del backend:**
   - Debe aparecer: `📚 Codex items seleccionados manualmente: N`

## 🔍 Debug en Consola

```javascript
// En ThePulse (consola del navegador)
// Después de seleccionar items y antes de enviar

// Ver estado actual
console.log('Selected Codex:', selectedCodex);

// Ver si llega al servicio
// (Agregar breakpoint en viztaChat.ts línea 124)
```

## ⚡ Solución Rápida si No Aparece

Si el modal se abre pero no ves el CodexSelector:

1. Verificar que el import está correcto en vizta-chat.tsx
2. Verificar que CodexSelector.tsx existe en la ruta correcta
3. Posible error de compilación - revisar terminal de ThePulse

**Comando para verificar:**
```bash
cd "/Users/pj/Desktop/Pulse Journal/ThePulse"
npm run dev
# Ver si hay errores de compilación
```

---

**TL;DR:**
- ✅ Código implementado
- ⚠️ Necesitas reiniciar ExtractorW backend
- ⚠️ Necesitas rebuild de ThePulse frontend
- 🧪 Luego probar flujo completo


