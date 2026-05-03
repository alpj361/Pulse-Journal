import React from 'react';
import { Box, Container, Typography, Button, Paper, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

const features = [
  {
    title: 'Trending en Tiempo Real',
    description:
      'Descubre qué está moviendo la conversación en Guatemala ahora mismo. Desde política hasta cultura, los temas más importantes aparecen primero.',
    emoji: '📡',
  },
  {
    title: 'Hot Topics con Contexto',
    description:
      'No solo titulares. Cada noticia viene con resumen, datos clave, perspectivas y los actores involucrados, para que entiendas el trasfondo completo.',
    emoji: '🔍',
  },
  {
    title: 'Narrativa del Día',
    description:
      'Una síntesis editorial inteligente que te explica qué historia define el día, quiénes son los protagonistas y hacia dónde apunta la conversación.',
    emoji: '📰',
  },
];

const Marketing: React.FC = () => {
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

      {/* Hero */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          py: { xs: 8, md: 12 },
          px: 4,
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Chip
            label="Disponible en App Store"
            size="small"
            sx={{ bgcolor: '#3b82f6', color: 'white', mb: 3, fontWeight: 600 }}
          />
          <Typography variant="h2" fontWeight="800" color="white" sx={{ mb: 3, lineHeight: 1.2 }}>
            Tu radar de noticias para Guatemala
          </Typography>
          <Typography variant="h6" color="#94a3b8" sx={{ mb: 5, lineHeight: 1.7, fontWeight: 400 }}>
            Vizta convierte el ruido del día en información clara, relevante y accionable.
            Diseñado para guatemaltecos que quieren estar al tanto sin perder el tiempo.
          </Typography>
          <Button
            variant="contained"
            size="large"
            href="https://apps.apple.com/app/vizta/id6756479470"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              bgcolor: '#3b82f6',
              px: 5,
              py: 1.8,
              borderRadius: 3,
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: '#2563eb' },
            }}
          >
            Descargar gratis en App Store
          </Button>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Typography variant="h4" fontWeight="700" color="#1a1a1a" textAlign="center" sx={{ mb: 2 }}>
          ¿Qué hace Vizta por ti?
        </Typography>
        <Typography variant="body1" color="#666" textAlign="center" sx={{ mb: 7, lineHeight: 1.8 }}>
          Tres pilares que transforman cómo entiendes las noticias de Guatemala.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {features.map((feature, i) => (
            <Paper
              key={i}
              elevation={0}
              sx={{
                border: '1px solid #e0e0e0',
                borderRadius: 3,
                p: 4,
                display: 'flex',
                gap: 3,
                alignItems: 'flex-start',
              }}
            >
              <Typography fontSize="2.5rem" lineHeight={1}>
                {feature.emoji}
              </Typography>
              <Box>
                <Typography variant="h6" fontWeight="700" color="#1a1a1a" sx={{ mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body1" color="#555" sx={{ lineHeight: 1.8 }}>
                  {feature.description}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Container>

      {/* CTA */}
      <Box sx={{ bgcolor: '#f0f7ff', py: 10, px: 4, textAlign: 'center' }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight="700" color="#1a1a1a" sx={{ mb: 2 }}>
            Vizta no te bombardea de información —<br />te ayuda a entenderla.
          </Typography>
          <Typography variant="body1" color="#555" sx={{ mb: 4, lineHeight: 1.8 }}>
            Únete a los guatemaltecos que ya usan Vizta para mantenerse informados de forma inteligente.
          </Typography>
          <Button
            variant="contained"
            size="large"
            href="https://apps.apple.com/app/vizta/id6756479470"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              bgcolor: '#3b82f6',
              px: 5,
              py: 1.8,
              borderRadius: 3,
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: '#2563eb' },
            }}
          >
            Descargarlo ahora — Es gratis
          </Button>
        </Container>
      </Box>
    </Box>
  );
};

export default Marketing;
