# Parches de ExtractorW para la app

ExtractorW vive en el VPS (`root@157.245.115.216:/home/pj/ExtractorW`, rama
`vps/app-movil-2026-09`) y se parchea a mano, no desde ThePulse. Estos
archivos son lo que hay que copiar.

## Fórmulas: `routes/latex.js` (STA-200)

`POST /api/latex/svg` — LaTeX → SVG con MathJax, para los bloques de fórmula
del editor de bloques. Pide la sesión de Supabase (`Authorization: Bearer …`).

```bash
# 1. Copiar el archivo
scp ViztaApp/vps/ExtractorW/routes/latex.js root@157.245.115.216:/home/pj/ExtractorW/routes/latex.js

# 2. En el VPS: la dependencia
cd /home/pj/ExtractorW && npm i mathjax-full@3

# 3. Montarlo donde se arma la app de Express (junto a las otras rutas /api):
#      app.use('/api', require('./routes/latex'));

# 4. Reiniciar el servicio y probar
curl -s -X POST https://server.standatpd.com/api/latex/svg \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"latex":"E=mc^2"}' | head -c 200
```

Usa `SUPABASE_URL` y `SUPABASE_ANON_KEY`, que ExtractorW ya tiene en su `.env`.

Mientras el endpoint no esté, la app muestra la fórmula como texto LaTeX y la
vuelve a pedir la próxima vez que se edita: no se pierde nada.
