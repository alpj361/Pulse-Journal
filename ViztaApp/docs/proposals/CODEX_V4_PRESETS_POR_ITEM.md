# Propuesta de presets de Codex v4 por tipo de ítem

Estado: borrador para aprobación  
Alcance: contrato, MCP e interfaces futuras  
No implementado todavía

## 1. Decisiones de base

Codex tiene siete tipos oficiales de ítem:

1. `Actor`
2. `Entidad`
3. `Territorio`
4. `Evento`
5. `Historia`
6. `Objeto`
7. `Artefacto`

`Post` y `Snippet` son tipos auxiliares de contenido. No forman parte de los ítems del universo y no reciben los presets descritos aquí.

Un preset es un machote de campos. No crea un tipo nuevo, no interpreta automáticamente el dato y no impide combinar otros presets.

### Campos centrales

Todos los ítems ya tienen estas propiedades:

| Propiedad | Uso |
| --- | --- |
| `name` | Nombre o título principal |
| `description` | Descripción o resumen |
| `aliases` | Nombres alternativos |
| `tags` | Etiquetas libres |

Los presets pueden mostrar estas propiedades dentro de su formulario, pero no deben duplicarlas como `field_key` dentro de `details`.

### Convención propuesta

- Preset base por ítem: `sys_base_<tipo>`.
- Preset temático por ítem: `sys_preset_<uso>_<tipo>`.
- Preset creado por un usuario: `usr_preset_<slug>`.
- Campo del sistema: `sys_<tipo>_<slug>`.
- Campo creado por un usuario: `usr_<slug>`.

Las claves de este documento son propuestas. Los labels están escritos para la interfaz y pueden ajustarse antes de implementar.

## 2. Actor

### 2.1 Personal — base recomendada

Clave propuesta: `sys_base_actor`  
Objetivo: describir la identidad básica de una persona.

| Campo visible | Persistencia o `field_key` | Tipo | Regla |
| --- | --- | --- | --- |
| Nombre | `name` | central | Requerido |
| Descripción | `description` | central | Opcional |
| También conocido como | `aliases` | central | Opcional |
| Etiquetas | `tags` | central | Opcional |
| Fecha de nacimiento | `sys_actor_fecha_nacimiento` | `fecha` | Opcional |
| Edad | `sys_actor_edad` | `formula` | Derivada de la fecha de nacimiento; no se escribe manualmente |
| Fecha de fallecimiento | `sys_actor_fecha_fallecimiento` | `fecha` | Opcional |
| País | `sys_actor_pais` | `ref` | Debe apuntar a un `Territorio` de país |
| Lugar de nacimiento | `sys_actor_lugar_nacimiento` | `ref` | Debe apuntar a un `Territorio` |
| Lugar de residencia | `sys_actor_residencia` | `ref` | Debe apuntar a un `Territorio` |
| Nacionalidad | `sys_actor_nacionalidad` | `tags` | Puede contener más de una |
| Estado personal | `sys_actor_estado` | `dropdown` | Activo, inactivo, retirado o fallecido |
| Imagen principal | `sys_actor_imagen` | `imagen` | Referencia a un ítem del Codex |
| Sitio o perfil principal | `sys_actor_link` | `link` | Opcional |

Campos que conviene mantener fuera del preset base por sensibilidad: dirección exacta, documento de identidad, teléfono personal y correo personal. Podrían añadirse mediante un preset creado por el usuario cuando su investigación lo requiera.

### 2.2 Profesional

Clave propuesta: `sys_preset_profesional_actor`

| Campo | `field_key` | Tipo |
| --- | --- | --- |
| Profesión | `sys_actor_profesion` | `texto` |
| Rol / función | `sys_actor_rol` | `texto` |
| Cargo | `sys_actor_cargo` | `texto` |
| Organización o afiliación | `sys_actor_afiliacion` | `refs` |
| Oficina | `usr_oficina` | `texto` |
| Período en el cargo | `sys_actor_periodo_cargo` | `rango` |
| Trayectoria | `sys_actor_trayectoria` | `parrafo` |

### 2.3 Política

Clave propuesta: `sys_preset_politica_actor`

| Campo | `field_key` | Tipo |
| --- | --- | --- |
| Partido o movimiento | `sys_actor_partido` | `refs` |
| Cargo público | `sys_actor_cargo_publico` | `texto` |
| Distrito o jurisdicción | `sys_actor_jurisdiccion` | `ref` |
| Período político | `sys_actor_periodo_politico` | `rango` |
| Alianzas | `sys_actor_alianzas` | `refs` |
| Oponentes | `sys_actor_oponentes` | `refs` |
| Eje político | `sys_actor_eje_politico` | `eje` |
| Eje social | `sys_actor_eje_social` | `eje` |
| Posiciones públicas | `sys_actor_posiciones` | `repetible` |

### 2.4 Legal

Clave propuesta: `sys_preset_legal_actor`

| Campo | `field_key` | Tipo |
| --- | --- | --- |
| Situación legal | `sys_actor_situacion_legal` | `parrafo` |
| Rol procesal | `sys_actor_rol_procesal` | `tags` |
| Casos relacionados | `sys_actor_casos_legales` | `refs` |
| Representantes legales | `sys_actor_representantes_legales` | `refs` |
| Medidas o sanciones | `sys_actor_medidas_legales` | `repetible` |
| Última actualización legal | `sys_actor_revision_legal` | `fecha` |

### 2.5 Investigación

Clave propuesta: `sys_preset_investigacion_actor`

| Campo | `field_key` | Tipo |
| --- | --- | --- |
| Relevancia para la investigación | `sys_actor_relevancia` | `parrafo` |
| Estado de verificación | `sys_actor_estado_verificacion` | `dropdown` |
| Nivel de confianza | `sys_actor_confianza` | `escala` |
| Fuentes relacionadas | `sys_actor_fuentes` | `refs` |
| Evidencia relacionada | `sys_actor_evidencia` | `refs` |
| Historias o investigaciones | `sys_actor_investigaciones` | `refs` |
| Última revisión | `sys_actor_ultima_revision` | `fecha` |
| Notas de investigación | `sys_actor_notas_investigacion` | `parrafo` |

## 3. Entidad

### 3.1 Institucional — base recomendada

Clave propuesta: `sys_base_entidad`

| Campo | Persistencia o `field_key` | Tipo |
| --- | --- | --- |
| Nombre | `name` | central |
| Descripción | `description` | central |
| Otros nombres o siglas | `aliases` | central |
| Tipo de entidad | `sys_entidad_tipo` | `dropdown` |
| País o jurisdicción | `sys_entidad_pais` | `ref` |
| Sede principal | `sys_entidad_sede` | `ref` |
| Fecha de fundación | `sys_entidad_fecha_fundacion` | `fecha` |
| Fecha de cierre | `sys_entidad_fecha_cierre` | `fecha` |
| Estado | `sys_entidad_estado` | `dropdown` |
| Representantes | `sys_entidad_representantes` | `refs` |
| Entidad matriz | `sys_entidad_matriz` | `ref` |
| Sitio oficial | `sys_entidad_sitio` | `link` |

Opciones iniciales para `Tipo de entidad`: pública, privada, mixta, internacional, política, comunitaria e informal.

### 3.2 Política

Clave propuesta: `sys_preset_politica_entidad`

- Tipo de organización política — `sys_entidad_tipo_politico`, `dropdown`.
- Líderes — `sys_entidad_lideres`, `refs`.
- Ideología declarada — `sys_entidad_ideologia`, `tags`.
- Eje político — `sys_entidad_eje_politico`, `eje`.
- Jurisdicción electoral — `sys_entidad_jurisdiccion_electoral`, `ref`.
- Alianzas — `sys_entidad_alianzas`, `refs`.
- Partidos u organizaciones opositoras — `sys_entidad_opositores`, `refs`.
- Estado de registro — `sys_entidad_registro_politico`, `dropdown`.

### 3.3 Corporativo

Clave propuesta: `sys_preset_corporativo_entidad`

- Razón social — `sys_entidad_razon_social`, `texto`.
- Identificador fiscal o registral — `sys_entidad_identificador_registral`, `id`.
- Forma jurídica — `sys_entidad_forma_juridica`, `dropdown`.
- Propietarios o beneficiarios — `sys_entidad_propietarios`, `refs`.
- Subsidiarias — `sys_entidad_subsidiarias`, `refs`.
- Sector económico — `sys_entidad_sector`, `tags`.
- Ingresos o presupuesto — `sys_entidad_ingresos`, `moneda`.

### 3.4 Legal y regulatorio

Clave propuesta: `sys_preset_legal_entidad`

- Jurisdicción legal — `sys_entidad_jurisdiccion_legal`, `ref`.
- Reguladores — `sys_entidad_reguladores`, `refs`.
- Casos legales — `sys_entidad_casos_legales`, `refs`.
- Sanciones — `sys_entidad_sanciones`, `repetible`.
- Estado de cumplimiento — `sys_entidad_cumplimiento`, `dropdown`.
- Licencias o registros — `sys_entidad_licencias`, `repetible`.

### 3.5 Investigación

Clave propuesta: `sys_preset_investigacion_entidad`

Usa los mismos conceptos editoriales del preset de Actor: relevancia, estado de verificación, confianza, fuentes, evidencia, investigaciones relacionadas, última revisión y notas. Las claves deben conservar el prefijo `sys_entidad_...`.

## 4. Territorio

### 4.1 Representación espacial previa

Antes de aplicar presets, el territorio debe declarar cómo se representa:

| Modo | Uso | Regla |
| --- | --- | --- |
| Frontera administrativa | Países, departamentos, provincias, municipios y niveles inferiores | Puede usar jerarquía 1–6, códigos postales y un límite oficial o curado |
| Área personalizada | Jurisdicciones informales, zonas de influencia, áreas de cobertura o polígonos de una investigación | No usa jerarquía administrativa ni códigos postales como modelo principal |
| Punto / POI | Lugar con coordenadas exactas | Se muestra como pin y puede asociarse automáticamente al territorio que lo contiene |

El modo espacial es parte del contrato geográfico, no un preset editorial.

### 4.2 Geográfico — base recomendada

Clave propuesta: `sys_base_territorio`

- Nombre — `name`, central.
- Descripción — `description`, central.
- Otros nombres — `aliases`, central.
- País — `sys_territorio_pais`, `ref`.
- Centro o punto — `sys_territorio_centro`, `geo`.
- Tipo de representación — propiedad geográfica del contrato.
- Fuente geográfica — `sys_territorio_fuente_geografica`, `link`.
- Fecha de verificación — `sys_territorio_fecha_verificacion`, `fecha`.

### 4.3 Administrativo

Clave propuesta: `sys_preset_administrativo_territorio`  
Aplicación: únicamente fronteras administrativas.

- Posición jerárquica 1–6 — propiedad del contrato de fronteras.
- Nombre local del nivel — propiedad curada por país y localidad.
- Territorio padre — referencia jerárquica.
- Límite canónico — referencia a la frontera oficial curada.
- Procedencia — oficial, curada o creada por usuario.
- Códigos postales — lista asociada al territorio.
- Identificador administrativo externo — `sys_territorio_codigo_administrativo`, `id`.

### 4.4 Punto / POI

Clave propuesta: `sys_preset_poi_territorio`  
Aplicación: únicamente puntos con coordenadas.

- Categoría del lugar — `sys_territorio_categoria_poi`, `dropdown`.
- Coordenadas — `sys_territorio_coordenadas`, `geo`.
- Dirección — `sys_territorio_direccion`, `texto`.
- Código postal — `sys_territorio_codigo_postal`, `texto`.
- Identificador del proveedor de mapas — `sys_territorio_external_place_id`, `id`.
- Enlace del proveedor — `sys_territorio_enlace_mapa`, `link`.
- Territorio contenedor — relación calculada por posición geográfica.

### 4.5 Socioeconómico

Clave propuesta: `sys_preset_socioeconomico_territorio`

| Campo | `field_key` | Tipo |
| --- | --- | --- |
| Población | `sys_territorio_poblacion` | `numero` |
| Año de referencia | `sys_territorio_anio_datos` | `numero` |
| Fuente estadística | `sys_territorio_fuente_estadistica` | `ref` |
| Densidad poblacional | `sys_territorio_densidad` | `numero` |
| Ingreso estimado | `sys_territorio_ingreso_estimado` | `moneda` |
| Estrato socioeconómico | `sys_territorio_estrato` | `dropdown` |
| Pobreza | `sys_territorio_pobreza` | `porcentaje` |
| Escolaridad | `sys_territorio_escolaridad` | `numero` |
| Acceso a servicios | `sys_territorio_servicios` | `repetible` |
| Condiciones de vivienda | `sys_territorio_vivienda` | `repetible` |
| Clasificación urbana o rural | `sys_territorio_entorno` | `dropdown` |
| Metodología y observaciones | `sys_territorio_metodologia` | `parrafo` |

Cada métrica debe conservar su fuente y período. No conviene asignar un estrato sin documentar la metodología.

### 4.6 Control o jurisdicción efectiva

Clave propuesta: `sys_preset_control_territorio`

- Actores o entidades que controlan — `sys_territorio_controladores`, `refs`.
- Tipo de control — `sys_territorio_tipo_control`, `dropdown`.
- Período — `sys_territorio_periodo_control`, `rango`.
- Jurisdicción legal — `sys_territorio_jurisdiccion_legal`, `refs`.
- Evidencia — `sys_territorio_evidencia_control`, `refs`.
- Nivel de confianza — `sys_territorio_confianza_control`, `escala`.
- Notas — `sys_territorio_notas_control`, `parrafo`.

## 5. Evento

### 5.1 Cronología — base recomendada

Clave propuesta: `sys_base_evento`

- Nombre — `name`, central.
- Descripción — `description`, central.
- Período — `sys_evento_periodo`, `rango`.
- Hora — `sys_evento_hora`, `hora`.
- Lugares — `sys_evento_lugares`, `refs`.
- Participantes — `sys_evento_participantes`, `refs`.
- Organizador — `sys_evento_organizador`, `ref`.
- Estado — `sys_evento_estado`, `dropdown`.
- Resultado o desenlace — `sys_evento_resultado`, `parrafo`.

### 5.2 Político

Clave propuesta: `sys_preset_politica_evento`

- Tipo de evento político — `sys_evento_tipo_politico`, `dropdown`.
- Convocantes — `sys_evento_convocantes`, `refs`.
- Partidos o entidades — `sys_evento_entidades_politicas`, `refs`.
- Territorio electoral — `sys_evento_territorio_electoral`, `ref`.
- Resultado político — `sys_evento_resultado_politico`, `parrafo`.
- Impacto — `sys_evento_impacto_politico`, `parrafo`.

### 5.3 Legal

Clave propuesta: `sys_preset_legal_evento`

- Tipo de actuación — `sys_evento_tipo_legal`, `dropdown`.
- Caso relacionado — `sys_evento_caso_legal`, `ref`.
- Tribunal o autoridad — `sys_evento_autoridad_legal`, `ref`.
- Partes — `sys_evento_partes_legales`, `refs`.
- Resolución — `sys_evento_resolucion`, `parrafo`.
- Documentos — `sys_evento_documentos_legales`, `refs`.
- Próxima actuación — `sys_evento_proxima_actuacion`, `fecha`.

### 5.4 Investigación

Clave propuesta: `sys_preset_investigacion_evento`

- Estado de verificación, confianza, fuentes y evidencia.
- Versiones o relatos contradictorios — `sys_evento_versiones`, `repetible`.
- Eventos anteriores — `sys_evento_antecedentes`, `refs`.
- Eventos posteriores — `sys_evento_consecuencias`, `refs`.
- Investigación principal — `sys_evento_investigacion`, `ref`.

## 6. Historia

`Historia` puede funcionar como contenedor editorial de una narrativa, una investigación, un caso, una ley o un concepto. Los elementos concretos se relacionan como actores, entidades, territorios, eventos, objetos y artefactos.

### 6.1 Marco o narrativa — base recomendada

Clave propuesta: `sys_base_historia`

- Título — `name`, central.
- Resumen — `description`, central.
- Tipo de marco — `sys_historia_tipo`, `dropdown`.
- Tesis o idea central — `sys_historia_tesis`, `parrafo`.
- Período — `sys_historia_periodo`, `rango`.
- Actores — `sys_historia_actores`, `refs`.
- Entidades — `sys_historia_entidades`, `refs`.
- Territorios — `sys_historia_territorios`, `refs`.
- Eventos — `sys_historia_eventos`, `refs`.
- Fuentes — `sys_historia_fuentes`, `refs`.

### 6.2 Investigación periodística

Clave propuesta: `sys_preset_investigacion_historia`

| Campo | `field_key` | Tipo |
| --- | --- | --- |
| Hipótesis | `sys_historia_hipotesis` | `parrafo` |
| Preguntas de investigación | `sys_historia_preguntas` | `repetible` |
| Estado editorial | `sys_historia_estado_editorial` | `dropdown` |
| Responsable | `sys_historia_responsable` | `ref` |
| Colaboradores | `sys_historia_colaboradores` | `refs` |
| Evidencia | `sys_historia_evidencia` | `refs` |
| Fuentes | `sys_historia_fuentes_investigacion` | `refs` |
| Línea de tiempo | `sys_historia_linea_tiempo` | `refs` |
| Hallazgos | `sys_historia_hallazgos` | `repetible` |
| Pendientes de verificación | `sys_historia_pendientes` | `repetible` |
| Nivel de confianza | `sys_historia_confianza` | `escala` |
| Embargo | `sys_historia_embargo` | `fecha` |
| Fecha de última revisión | `sys_historia_ultima_revision` | `fecha` |

### 6.3 Caso legal

Clave propuesta: `sys_preset_legal_historia`

- Número de expediente — `sys_historia_expediente`, `id`.
- Materia o tipo de caso — `sys_historia_materia_legal`, `dropdown`.
- Tribunal — `sys_historia_tribunal`, `ref`.
- Jurisdicción — `sys_historia_jurisdiccion`, `ref`.
- Partes — `sys_historia_partes`, `refs`.
- Delitos, reclamos o asuntos — `sys_historia_asuntos_legales`, `tags`.
- Etapa procesal — `sys_historia_etapa_procesal`, `dropdown`.
- Eventos procesales — `sys_historia_eventos_procesales`, `refs`.
- Evidencia — `sys_historia_evidencia_legal`, `refs`.
- Resoluciones — `sys_historia_resoluciones`, `refs`.
- Estado del caso — `sys_historia_estado_legal`, `dropdown`.

### 6.4 Análisis político

Clave propuesta: `sys_preset_politica_historia`

- Tema político — `sys_historia_tema_politico`, `tags`.
- Hipótesis política — `sys_historia_hipotesis_politica`, `parrafo`.
- Actores y entidades — referencias a ítems.
- Territorios y eventos — referencias a ítems.
- Posiciones — `sys_historia_posiciones`, `repetible`.
- Ejes de análisis — `sys_historia_ejes`, `repetible`.
- Evidencia y fuentes — referencias a ítems.
- Impacto o escenarios — `sys_historia_escenarios`, `repetible`.

## 7. Objeto

### 7.1 Identificación — base recomendada

Clave propuesta: `sys_base_objeto`

- Nombre — `name`, central.
- Descripción — `description`, central.
- Tipo — `sys_objeto_tipo`, `dropdown`.
- Fecha de creación — `sys_objeto_fecha_creacion`, `fecha`.
- Autor o emisor — `sys_objeto_autor`, `refs`.
- Fuente de origen — `sys_objeto_fuente`, `ref`.
- Archivo principal — `sys_objeto_archivo`, `archivo`.
- Enlace original — `sys_objeto_enlace`, `link`.
- Estado de verificación — `sys_objeto_estado_verificacion`, `dropdown`.
- Identificador o checksum — `sys_objeto_identificador`, `id`.

### 7.2 Documento

Clave propuesta: `sys_preset_documento_objeto`

- Número de documento — `sys_objeto_numero_documento`, `id`.
- Fecha del documento — `sys_objeto_fecha_documento`, `fecha`.
- Emisor y destinatarios — referencias a ítems.
- Idioma — `sys_objeto_idioma`, `dropdown`.
- Número de páginas — `sys_objeto_paginas`, `numero`.
- Resumen — `sys_objeto_resumen`, `parrafo`.
- Caso o investigación relacionada — `sys_objeto_contexto`, `refs`.

### 7.3 Evidencia

Clave propuesta: `sys_preset_evidencia_objeto`

- Fecha de obtención — `sys_objeto_fecha_obtencion`, `fecha`.
- Obtenido por — `sys_objeto_obtenido_por`, `ref`.
- Procedencia — `sys_objeto_procedencia`, `parrafo`.
- Método de verificación — `sys_objeto_metodo_verificacion`, `parrafo`.
- Integridad — `sys_objeto_integridad`, `dropdown`.
- Cadena de custodia — `sys_objeto_cadena_custodia`, `repetible`.
- Actores, eventos o casos relacionados — `sys_objeto_relaciones_evidencia`, `refs`.
- Nivel de confianza — `sys_objeto_confianza`, `escala`.

### 7.4 Dataset

Clave propuesta: `sys_preset_dataset_objeto`

- Fuente — `sys_objeto_fuente_dataset`, `ref`.
- Período cubierto — `sys_objeto_periodo_dataset`, `rango`.
- Formato — `sys_objeto_formato_dataset`, `dropdown`.
- Número de registros — `sys_objeto_registros`, `numero`.
- Metodología — `sys_objeto_metodologia_dataset`, `parrafo`.
- Licencia — `sys_objeto_licencia`, `texto`.
- Limitaciones — `sys_objeto_limitaciones`, `parrafo`.

### 7.5 Multimedia

Clave propuesta: `sys_preset_multimedia_objeto`

- Formato de medio, duración, fecha de captura, lugar, autor, transcripción, estado de verificación y contexto relacionado.
- La imagen, audio o video debe estar representado por una referencia de archivo; el preset no almacena un upload libre dentro del campo.

## 8. Artefacto

### 8.1 Función — base recomendada

Clave propuesta: `sys_base_artefacto`

- Nombre — `name`, central.
- Descripción — `description`, central.
- Tipo — `sys_artefacto_tipo`, `dropdown`.
- Propósito o función — `sys_artefacto_proposito`, `parrafo`.
- Creador o responsable — `sys_artefacto_creador`, `refs`.
- Estado — `sys_artefacto_estado`, `dropdown`.
- Período de uso — `sys_artefacto_periodo`, `rango`.
- Documentación — `sys_artefacto_documentacion`, `refs`.
- Enlace principal — `sys_artefacto_enlace`, `link`.

### 8.2 Software o sistema

Clave propuesta: `sys_preset_software_artefacto`

- Versión — `sys_artefacto_version`, `texto`.
- Plataforma — `sys_artefacto_plataforma`, `tags`.
- Proveedor — `sys_artefacto_proveedor`, `ref`.
- Dependencias — `sys_artefacto_dependencias`, `refs`.
- Datos que procesa — `sys_artefacto_datos`, `parrafo`.
- Acceso — `sys_artefacto_acceso`, `dropdown`.
- Riesgos o limitaciones — `sys_artefacto_riesgos`, `parrafo`.

### 8.3 Infraestructura

Clave propuesta: `sys_preset_infraestructura_artefacto`

- Ubicación o cobertura — `sys_artefacto_territorios`, `refs`.
- Operador — `sys_artefacto_operador`, `refs`.
- Capacidad — `sys_artefacto_capacidad`, `texto`.
- Componentes — `sys_artefacto_componentes`, `refs`.
- Estado operativo — `sys_artefacto_estado_operativo`, `dropdown`.
- Eventos relacionados — `sys_artefacto_eventos`, `refs`.

### 8.4 Método o protocolo

Clave propuesta: `sys_preset_metodo_artefacto`

- Objetivo — `sys_artefacto_objetivo`, `parrafo`.
- Pasos — `sys_artefacto_pasos`, `repetible`.
- Entradas — `sys_artefacto_entradas`, `refs`.
- Salidas — `sys_artefacto_salidas`, `refs`.
- Responsable — `sys_artefacto_responsable`, `refs`.
- Versión o fecha de vigencia — `sys_artefacto_vigencia`, `rango`.
- Validación o resultados — `sys_artefacto_validacion`, `parrafo`.

### 8.5 Investigación

Clave propuesta: `sys_preset_investigacion_artefacto`

- Uso observado — `sys_artefacto_uso_observado`, `parrafo`.
- Actores o entidades que lo utilizan — `sys_artefacto_usuarios`, `refs`.
- Eventos relacionados — `sys_artefacto_eventos_investigados`, `refs`.
- Evidencia — `sys_artefacto_evidencia`, `refs`.
- Alcance territorial — `sys_artefacto_alcance`, `refs`.
- Estado de verificación y confianza — `dropdown` + `escala`.

## 9. Casos de uso resultantes

### Investigación periodística

1. Crear una `Historia` con el preset Investigación periodística.
2. Agregar `Actor` y `Entidad` con sus presets Personal, Institucional e Investigación.
3. Construir la cronología con `Evento`.
4. Guardar documentos y evidencia como `Objeto`.
5. Relacionar territorios y artefactos cuando expliquen dónde y cómo ocurrieron los hechos.

### Análisis de estratos socioeconómicos

1. Crear o asociar los `Territorio` relevantes.
2. Aplicar el preset Socioeconómico.
3. Registrar año, fuente y metodología junto con cada análisis.
4. Comparar indicadores sin convertirlos en atributos permanentes de personas individuales.

### Representación de un caso legal

1. Crear una `Historia` con el preset Caso legal.
2. Representar audiencias, capturas y resoluciones como `Evento` legal.
3. Asociar personas y organizaciones mediante los presets legales de `Actor` y `Entidad`.
4. Guardar expedientes, resoluciones y evidencia como `Objeto`.

### Análisis político

1. Crear una `Historia` con Análisis político.
2. Asociar actores, partidos, instituciones y territorios.
3. Registrar elecciones, nombramientos, protestas o votaciones como eventos.
4. Usar ejes únicamente cuando sus polos estén definidos en el campo.

## 10. Puntos que requieren aprobación

1. Confirmar que `Personal` es el preset base de `Actor`.
2. Confirmar si teléfono y correo deben permanecer fuera de Personal por defecto.
3. Confirmar que Edad es calculada y Fecha de nacimiento es la fuente persistida.
4. Aprobar o rechazar los presets propuestos para cada ítem.
5. Confirmar si Socioeconómico será un preset oficial de `Territorio`.
6. Confirmar si Investigación periodística y Caso legal deben vivir principalmente en `Historia`.
7. Aprobar los labels antes de fijar las `field_key` definitivas.
8. Definir qué campos deben ser obligatorios. Esta propuesta deja casi todos como opcionales para no forzar datos desconocidos.

