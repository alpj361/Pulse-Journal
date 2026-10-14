"""Convierte firmas.jsonl en filas para private.pc_cc_integrantes (SQL por lotes).

Uso: python3 -I armar_integrantes.py <carpeta> <tam_lote>
Escribe <carpeta>/lote_N.sql y muestra un resumen.
"""
import json, os, sys, unicodedata
W, TAM = sys.argv[1], int(sys.argv[2])
CONOCIDOS = ["Astrid Jeannette Lemus Rodríguez","Claudia Elizabeth Paniagua Pérez","Dina Josefina Ochoa Escribá","Gladys Annabella Morfín Mansilla","Héctor Hugo Pérez Aguilera","José Alejandro Córdova Herrera","José Luis Aguirre Pumay","Juan José Samayoa Villatoro","Julia Marisol Rivera Aguilar","Leyla Susana Lemus Arriaga","Luis Alfonso Rosales Marroquín","Luis Fernando Bermejo Quiñónez","María Magdalena Jocholá Tujal","Néster Mauricio Vásquez Pimentel","Roberto Molina Barreto","Rony Eulalio López Contreras","Walter Paulino Jiménez Texaj"]
def plano(t): return ' '.join(unicodedata.normalize('NFD', t).encode('ascii','ignore').decode().lower().split())
MAPA = {plano(n): n for n in CONOCIDOS}
filas = [json.loads(l) for l in open(os.path.join(W,'firmas.jsonl'))]
filas = list({f['slug']: f for f in filas}.values())
out, raros, errores, conteo = [], {}, 0, {}
for f in filas:
    if 'error' in f: errores += 1; continue
    firmas = f.get('firmas', [])
    mag, sec, sin = [], None, []
    for i, x in enumerate(firmas):
        n = MAPA.get(plano(x))
        if n:
            if n not in mag: mag.append(n)
        elif i == len(firmas) - 1:
            sec = x.title()
        else:
            sin.append(x); raros[x] = raros.get(x, 0) + 1
    conteo[len(mag)] = conteo.get(len(mag), 0) + 1
    out.append((f['slug'], mag, sec, sin, firmas))
json.dump([{'slug': s_, 'magistrados': m, 'secretario': sec, 'sin_identificar': sn, 'firmas': fi if sn else []} for s_, m, sec, sn, fi in out],
          open(os.path.join(W, 'integrantes.json'), 'w'), ensure_ascii=False)
print(json.dumps({'leidas': len(out), 'errores': errores, 'magistrados_por_sentencia': dict(sorted(conteo.items())), 'firmas_sin_identificar': raros}, ensure_ascii=False))
