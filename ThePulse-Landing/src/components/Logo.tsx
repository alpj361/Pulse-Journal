import React from 'react';
import { Box, Typography } from '@mui/material';

interface AlabLogoProps {
  size?: number;
  variant?: 'full' | 'icon';
  textColor?: string;
}

const AlabLogoComponent: React.FC<AlabLogoProps> = ({ size = 32, textColor = '#1a1a1a' }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography
        variant="h4"
        fontWeight="800"
        sx={{
          color: textColor,
          fontSize: size,
          letterSpacing: 2,
          fontFamily: 'monospace'
        }}
      >
        ALAB
      </Typography>
    </Box>
  );
};

export default AlabLogoComponent;
