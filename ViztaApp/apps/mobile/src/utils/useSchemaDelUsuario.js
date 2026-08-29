import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getCodexSchema } from './codexSchema';

/**
 * El schema de esta persona.
 *
 * Existe para que ningún llamador tenga que acordarse de pasar el `userId`. La
 * caché del catálogo va indexada por persona —la respuesta trae campos y
 * presets propios— y un llamador que olvide el id no falla: recibe el schema de
 * otra cuenta, que es el tipo de error que nadie reporta porque parece que
 * funciona.
 */
export function useSchemaDelUsuario() {
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data?.session?.user?.id || 'anon';
      const s = await getCodexSchema(id);
      if (vivo) setSchema(s);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return schema;
}
