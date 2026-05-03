import React from 'react';
import { Box, Container, Typography, Button, Paper, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

const Support: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      {/* Header */}
      <Box component="header" sx={{ py: 3, px: 4, bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Logo size={36} />
            </Box>
            <Button
              variant="text"
              size="small"
              onClick={() => navigate('/')}
              sx={{
                textTransform: 'none',
                color: '#666',
                '&:hover': { color: '#3b82f6', bgcolor: 'transparent' }
              }}
            >
              Volver al inicio
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight="700" color="#1a1a1a" sx={{ mb: 2 }}>
          Soporte
        </Typography>
        <Typography variant="body1" color="#666" sx={{ mb: 6, lineHeight: 1.8 }}>
          Estamos aquí para ayudarte. Si tienes alguna duda, problema o sugerencia con Vizta, no dudes en contactarnos.
        </Typography>

        <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 3, p: 4, mb: 4 }}>
          <Typography variant="h5" fontWeight="600" color="#1a1a1a" sx={{ mb: 2 }}>
            Contacto por correo electrónico
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" color="#444" sx={{ mb: 2, lineHeight: 1.8 }}>
            Para recibir soporte, envíanos un correo a:
          </Typography>
          <Box
            component="a"
            href="mailto:contacto@standatpd.com"
            sx={{
              display: 'inline-block',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#3b82f6',
              textDecoration: 'none',
              bgcolor: '#eff6ff',
              px: 3,
              py: 1.5,
              borderRadius: 2,
              mb: 3,
              '&:hover': { bgcolor: '#dbeafe' }
            }}
          >
            contacto@standatpd.com
          </Box>
          <Typography variant="body2" color="#666" sx={{ lineHeight: 1.8 }}>
            Respondemos en un plazo de 24 a 48 horas hábiles. Por favor incluye en tu mensaje:
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 3 }}>
            {[
              'Tu nombre y correo de cuenta registrada (si aplica)',
              'Descripción detallada del problema o consulta',
              'Capturas de pantalla si es un problema técnico',
              'El dispositivo y sistema operativo que usas',
            ].map((item, i) => (
              <Typography key={i} component="li" variant="body2" color="#666" sx={{ mb: 0.5, lineHeight: 1.8 }}>
                {item}
              </Typography>
            ))}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 3, p: 4 }}>
          <Typography variant="h5" fontWeight="600" color="#1a1a1a" sx={{ mb: 2 }}>
            Preguntas frecuentes
          </Typography>
          <Divider sx={{ mb: 3 }} />
          {[
            {
              q: '¿Vizta está disponible para Android?',
              a: 'Actualmente Vizta está disponible para iOS. Estamos trabajando en la versión para Android. Suscríbete a nuestra lista de espera enviando un correo a contacto@standatpd.com.',
            },
            {
              q: '¿Cómo reporto un error o contenido inapropiado?',
              a: 'Escríbenos a contacto@standatpd.com con el asunto "Reporte de error" o "Contenido inapropiado" y lo atenderemos a la brevedad.',
            },
          ].map((faq, i) => (
            <Box key={i} sx={{ mb: 3 }}>
              <Typography variant="body1" fontWeight="600" color="#1a1a1a" sx={{ mb: 0.5 }}>
                {faq.q}
              </Typography>
              <Typography variant="body2" color="#666" sx={{ lineHeight: 1.8 }}>
                {faq.a}
              </Typography>
              {i < 1 && <Divider sx={{ mt: 3 }} />}
            </Box>
          ))}
        </Paper>

        <Typography variant="body2" color="#999" sx={{ mt: 4 }}>
          Última actualización: {new Date().toLocaleDateString('es-ES')}
        </Typography>
      </Container>
    </Box>
  );
};

export default Support;
