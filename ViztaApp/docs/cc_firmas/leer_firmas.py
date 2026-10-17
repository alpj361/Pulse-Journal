"""Lee las firmas de las sentencias de la CC (últimas 2 páginas de cada PDF).

Uso: python3 -I leer_firmas.py <carpeta> [limite]
Escribe <carpeta>/firmas.jsonl (una línea por expediente) y reanuda si se corta.
No guarda los PDF: los baja, lee y borra.
"""
import json, os, re, subprocess, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

W = sys.argv[1]
LIMITE = int(sys.argv[2]) if len(sys.argv) > 2 else None
BASE = 'https://jurisprudencia.cc.gob.gt/Sentencias/'
salida = os.path.join(W, 'firmas.jsonl')
hechos = set()
if os.path.exists(salida):
    for l in open(salida):
        try: hechos.add(json.loads(l)['slug'])
        except Exception: pass
lista = [l.split('\t') for l in open(os.path.join(W, 'lista.tsv')).read().split('\n') if l]
pendientes = [(s, r) for s, r in lista if s not in hechos][:LIMITE]

def firmas_de(texto):
    out, lineas = [], texto.split('\n')
    for i, l in enumerate(lineas):
        if l.strip().startswith('Firmado por'):
            partes = []
            for k in lineas[i + 1:i + 12]:
                k = k.strip()
                if not k: continue
                if '/' in k:
                    antes = k.split('/')[0].strip()
                    if antes: partes.append(antes)
                    break
                if k.startswith('Fecha'): break
                partes.append(k)
            nombre = ' '.join(partes).strip()
            if nombre: out.append(nombre)
    return out

def uno(par):
    slug, ruta = par
    pdf = os.path.join(W, 'pdf', re.sub(r'[^\w.\-]', '_', ruta))
    try:
        for intento in range(3):
            try:
                req = urllib.request.Request(BASE + ruta, headers={'User-Agent': 'Mozilla/5.0 (Vizta; lectura de firmas)'})
                with urllib.request.urlopen(req, timeout=60) as r, open(pdf, 'wb') as f:
                    f.write(r.read())
                break
            except Exception:
                if intento == 2: raise
                time.sleep(5)
        info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
        n = int(re.search(r'Pages:\s+(\d+)', info).group(1))
        texto = subprocess.run(['pdftotext', '-raw', '-f', str(max(1, n - 1)), '-l', str(n), pdf, '-'], capture_output=True, text=True).stdout
        return {'slug': slug, 'firmas': firmas_de(texto), 'paginas': n}
    except Exception as e:
        return {'slug': slug, 'error': str(e)[:200]}
    finally:
        if os.path.exists(pdf): os.remove(pdf)
        time.sleep(0.4)

with open(salida, 'a') as f, ThreadPoolExecutor(3) as ex:
    for i, res in enumerate(ex.map(uno, pendientes), 1):
        f.write(json.dumps(res, ensure_ascii=False) + '\n'); f.flush()
        if i % 100 == 0: print(i, 'de', len(pendientes), flush=True)
print('listo', len(pendientes))
