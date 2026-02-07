import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6750A4', // Material You purple
    },
    secondary: {
      main: '#625B71',
    },
    background: {
      default: '#FFFBFE',
      paper: '#F7F2FA',
    },
    error: {
      main: '#B3261E',
    },
    success: {
      main: '#2E7D32',
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          textTransform: 'none',
          padding: '12px 24px',
          fontWeight: 600,
        },
        contained: {
            boxShadow: 'none',
            '&:hover': {
                boxShadow: '0px 1px 3px rgba(0,0,0,0.12)',
            }
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
            boxShadow: 'none',
            border: '1px solid #E7E0EC',
            padding: 16,
        }
      }
    },
    MuiTextField: {
        styleOverrides: {
            root: {
                '& .MuiOutlinedInput-root': {
                    borderRadius: 8,
                }
            }
        }
    }
  },
});

export default theme;
