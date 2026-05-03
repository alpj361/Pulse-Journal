import React from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

const Privacy: React.FC = () => {
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
        <Typography variant="h3" fontWeight="700" color="#1a1a1a" sx={{ mb: 4 }}>
          Política de Privacidad
        </Typography>
        <Typography variant="body1" color="#666" sx={{ mb: 2, lineHeight: 1.8 }}>
          Política de privacidad y manejo de datos de Pulse Journal.
        </Typography>
        <Typography variant="body2" color="#999">
          Última actualización: {new Date().toLocaleDateString('es-ES')}
        </Typography>
      </Container>
    </Box>
  );
};

export default Privacy;
