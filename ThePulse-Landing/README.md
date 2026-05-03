# ALAB Landing

Landing page para ALAB - Sistema de Análisis y Gestión de Información.
(Nombre código para fase Alpha de testing)

## 🚀 Características

- ⚡ Vite + React + TypeScript
- 🎨 Material-UI para componentes
- 📱 Diseño responsive
- 🎭 Animaciones con Framer Motion
- 🔒 SEO optimizado

## 📋 Requisitos

- Node.js 18+
- npm o yarn

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Copiar archivo .env
cp .env.example .env

# Editar .env con la URL de tu app
```

## 🏃 Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Preview de producción
npm run preview
```

## 📁 Estructura

```
src/
├── assets/          # Imágenes y GIFs
│   └── gifs/        # GIFs de showcase
├── components/      # Componentes reutilizables
│   └── Logo.tsx
├── pages/           # Páginas
│   ├── Home.tsx
│   ├── Pricing.tsx
│   ├── Terms.tsx
│   └── Privacy.tsx
├── App.tsx          # Router principal
└── main.tsx         # Entry point
```

## 🌐 Deployment

### Vercel
```bash
vercel --prod
```

### Netlify
```bash
netlify deploy --prod
```

## 📝 Variables de Entorno

- `VITE_APP_URL`: URL de la aplicación principal (ej: https://app.thepulse.com)

## 📄 Assets Requeridos

Debes copiar manualmente estos archivos desde ThePulse:

1. **Logo**: `/public/logo.png`
2. **GIFs**:
   - `/src/assets/gifs/Sondeos.gif`
   - `/src/assets/gifs/Projects.gif`
   - `/src/assets/gifs/Trends.gif`

## 🔗 Configuración de Dominio

**Dominio principal**: `thepulse.com` → Landing (este repo)
**Subdominio app**: `app.thepulse.com` → Aplicación completa (ThePulse repo)

### Configuración DNS

```
A     @     [IP de Vercel/Netlify]
CNAME app   [URL deployment de ThePulse]
```

## 📞 Soporte

contacto@standatpd.com
