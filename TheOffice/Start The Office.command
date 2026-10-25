#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR"

if [[ ! -d node_modules ]]; then
  echo "Preparando The Office por primera vez..."
  npm install
fi

VPS_KEY="/Users/pj/Desktop/PDKey"
VPS_SOCKET="${TMPDIR%/}/the-office-vps-${UID}.sock"
if [[ -f "$VPS_KEY" ]]; then
  echo "Conectando el observador de resultados del VPS..."
  ssh -i "$VPS_KEY" \
    -o BatchMode=yes \
    -o ConnectTimeout=8 \
    -o ControlMaster=auto \
    -o ControlPersist=12h \
    -S "$VPS_SOCKET" \
    -fNT root@157.245.115.216 2>/dev/null || echo "VPS no disponible; la oficina usará la última señal conocida."
  export THE_OFFICE_VPS_SOCKET="$VPS_SOCKET"
fi

echo "Abriendo The Office..."
echo "Mantén esta ventana abierta mientras utilizas la aplicación."
npm start
