import React from 'react';
import { Box, Container, Typography, Button, Card, CardContent, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Check } from '@mui/icons-material';
import Logo from '../components/Logo';

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Alpha',
      price: 'Gratis',
      description: 'Acceso anticipado por invitación',
      features: [
        'Todas las funcionalidades',
        'Monitoreo de tendencias',
        'Gestión de proyectos',
        'Soporte prioritario',
        'Sin límites de uso'
      ],
      cta: 'Solicitar Invitación',
      href: 'mailto:soporte@standatpd.com?subject=Solicitud de Invitación - Pulse Journal Alpha'
    }
  ];

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
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight="700" textAlign="center" color="#1a1a1a" sx={{ mb: 2 }}>
          Precios
        </Typography>
        <Typography variant="body1" textAlign="center" color="#666" sx={{ mb: 8, maxWidth: 600, mx: 'auto' }}>
          Durante la fase Alpha de ALAB, acceso completamente gratuito a todas las funcionalidades.
        </Typography>

        <Grid container spacing={4} justifyContent="center">
          {plans.map((plan, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card sx={{
                height: '100%',
                border: '2px solid #3b82f6',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.12)'
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h5" fontWeight="700" color="#1a1a1a" sx={{ mb: 1 }}>
                    {plan.name}
                  </Typography>
                  <Typography variant="h3" fontWeight="700" color="#3b82f6" sx={{ mb: 1 }}>
                    {plan.price}
                  </Typography>
                  <Typography variant="body2" color="#666" sx={{ mb: 3 }}>
                    {plan.description}
                  </Typography>

                  <Box sx={{ mb: 3 }}>
                    {plan.features.map((feature, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Check sx={{ color: '#3b82f6', fontSize: 20 }} />
                        <Typography variant="body2" color="#666">
                          {feature}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    href={plan.href}
                    sx={{
                      py: 1.5,
                      textTransform: 'none',
                      bgcolor: '#3b82f6',
                      '&:hover': { bgcolor: '#2563eb' }
                    }}
                  >
                    {plan.cta}
                  </Button>
                  <Typography variant="caption" color="#999" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                    ALAB Alpha Testing Program
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default Pricing;
