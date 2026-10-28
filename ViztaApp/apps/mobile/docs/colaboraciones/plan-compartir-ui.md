# Compartir entre colaboradores — plan de diseño (aprobado por PJ, 28-oct)

Contrato: ExtractorW PR #75 (STA-259). Sigue las reglas de `docs/DESIGN.md`.

## Decisiones

1. Todo lo compartido va en **solo lectura**, también cuando lo comparte el dueño.
2. Quien tiene un agente como contacto **no ve** lo que el agente está haciendo.
3. Los dashboards guardados se leen **desde la app** (`artifacts` con
   `dueno_tipo = humano`) y salen en el Codex junto con lo demás.
4. La colaboración entre personas **se enciende** con esto.

## 1. Reenviar, como en WhatsApp

Todo lo que se comparte se puede reenviar: un ítem o una ficha del Codex de un
agente, algo de tu memoria, un dashboard o un monitoreo, a otra persona o a un
agente.

- **Desde el chat:** mantener presionada la tarjeta → «reenviar».
- **Desde lo abierto** (ficha, post, nota, dashboard, monitoreo, algo de Su
  Codex): ícono de reenviar (flecha curva) arriba.
- **Hoja «Reenviar a»:** buscador arriba, tus colaboradores (personas y agentes)
  con su avatar; se eligen uno o varios; una línea opcional; «mandar». Se manda
  como mensaje con el adjunto a cada chat.

## 2. Compartir un agente como contacto

Como mandar un contacto en WhatsApp:

- **Mandarlo:** en el chat con una persona, en Adjuntar hay una sección
  **«agentes»**: elegís uno tuyo y va como tarjeta de contacto (avatar, nombre,
  «de Pablo»).
- **Recibirlo:** la tarjeta dice «escribirle». Al tocarla se abre el chat con
  ese agente y queda en tu lista de Colaboradores, con «de Pablo» debajo.
- **El chat con un agente ajeno** es solo conversación: sin Su Codex, sin Sigue,
  sin carpeta, sin ajustes ni «haciendo ahora». Se le pueden mandar y recibir
  ítems, dashboards y monitoreos.
- **El dueño** ve en el perfil de su agente quiénes lo tienen, con «dejar de
  compartir».

## 3. El chat con una persona

En vez de «Su Codex» tiene **«Compartido»**: lo que se mandaron entre los dos,
dividido en **Codex** (ítems, notas, posts, dashboards) y **Monitoreos**. Todo se
abre en lectura.

## 4. Agregar a una persona

En Colaboradores, «agregar» tiene dos caminos: **conectar un agente** (lo de hoy)
y **buscar una persona**: escribís su nombre o usuario, aparecen las cuentas que
coinciden con su avatar, tocás una y se abre el chat con ella.

## 5. Dashboards

- **Guardar:** en el visor, cuando no es tuyo, un marcador arriba. Tocar → se
  guarda en tu Codex → el marcador queda lleno.
- **En tu Codex:** salen como el tipo «dashboards», primeros, y abren el mismo visor.
- **Adjuntar:** en Adjuntar aparece el tipo «dashboards» con los tuyos.

## 6. Monitoreos

Compartir un monitoreo es compartir su estructura: quien lo recibe lo pone a
correr en su cuenta y ve sus propios hallazgos.

- **Mandarlo:** en Adjuntar, sección «monitoreos» (los de tus agentes), o
  manteniendo presionado un tema en «Sigue» → «reenviar».
- **Recibirlo:** tarjeta «MONITOREO · tema». Al tocarla, la estructura en
  lectura: tema, palabras, fuentes, cada cuánto mira y cuándo avisa.
- **Usarlo:** «seguirlo con…» → elegís uno de tus agentes → ajustás cada cuánto
  y cuándo avisa → «empezar». Aparece en «Sigue» de ese agente.

## 7. Nombres

Las personas van con su nombre de perfil; si no hay, el usuario o el correo.
Nunca «Colega».

## Lo que falta en el servidor (pedido a Vizta Dev)

- Desplegar el PR #75 en el VPS (hoy está en el #73).
- **Buscar personas por nombre** y empezar un chat con una: no hay ruta.
- **Contacto en el chat:** tipo de adjunto `agente` (o bloque `contacto_ref`) que,
  al mandarlo, cree el `compartido` del agente para los participantes.
- **«Compartido» con una persona:** `GET /compartidos?con=<humano_id>` o filtrar
  la lista actual por la otra parte.
