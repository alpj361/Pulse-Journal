#!/bin/bash

echo "🚀 Inicializando ThePulse-Landing..."

# Inicializar git
git init
echo "✅ Git inicializado"

# Crear .env desde .env.example
cp .env.example .env
echo "✅ .env creado"

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

echo ""
echo "✨ Repositorio inicializado correctamente!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Edita .env con la URL de tu app"
echo "2. Ejecuta: npm run dev"
echo "3. Crea repo en GitHub"
echo "4. Ejecuta: git remote add origin <tu-repo-url>"
echo "5. Ejecuta: git add . && git commit -m 'Initial commit' && git push -u origin main"
echo ""
