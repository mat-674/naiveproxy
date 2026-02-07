import { useState, useEffect, useRef } from 'react';
import {
  Box, Card, Typography, TextField, Button,
  Paper, Snackbar, Alert, Container
} from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SettingsIcon from '@mui/icons-material/Settings';

// Define the API on window
declare global {
  interface Window {
    electronAPI: {
      startProxy: (config: ProxyConfig) => Promise<boolean>;
      stopProxy: () => Promise<boolean>;
      onLog: (callback: (event: unknown, log: string) => void) => void;
      onStatus: (callback: (event: unknown, status: string) => void) => void;
      onDeepLink: (callback: (event: unknown, url: string) => void) => void;
    };
  }
}

interface ProxyConfig {
  listen: string;
  proxy: string;
}

function App() {
  const [status, setStatus] = useState<'stopped' | 'running' | 'error'>('stopped');
  const [config, setConfig] = useState<ProxyConfig>({
    listen: 'socks://127.0.0.1:1080',
    proxy: '',
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const handleLinkPaste = (input: string) => {
    if (!input) return;

    let url = input.trim();
    if (url.startsWith('naiveproxy://')) {
      url = url.replace('naiveproxy://', '');
    }

    // Basic validation: check for protocol
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
        // Maybe user pasted just user:pass@domain? Prepend https://?
        // Naive usually implies https.
        if (url.includes('@')) {
            url = 'https://' + url;
        } else {
             setSnackbarMessage('Invalid link format. Expected protocol://...');
             setSnackbarOpen(true);
             return;
        }
    }

    setConfig(prev => ({ ...prev, proxy: url }));
    setLinkInput('');
    setSnackbarMessage('Configuration updated from link!');
    setSnackbarOpen(true);
  };

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onLog((_event, msg) => {
        setLogs(prev => {
            const newLogs = [...prev, msg];
            if (newLogs.length > 500) return newLogs.slice(-500);
            return newLogs;
        });
      });

      window.electronAPI.onStatus((_event, newStatus) => {
        if (newStatus === 'Running') setStatus('running');
        else if (newStatus === 'Stopped') setStatus('stopped');
        else setStatus('error');
      });

      window.electronAPI.onDeepLink((_event, url) => {
        handleLinkPaste(url);
      });
    }
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleToggle = async () => {
    if (status === 'running') {
      await window.electronAPI.stopProxy();
    } else {
      if (!config.proxy) {
        setSnackbarMessage('Please enter a proxy URL first.');
        setSnackbarOpen(true);
        return;
      }
      setLogs([]);
      await window.electronAPI.startProxy(config);
    }
  };

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default',
      p: 2
    }}>
      <Container maxWidth="md" sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 3 }}>

        {/* Header */}
        <Box sx={{ py: 2 }}>
            <Typography variant="h4" fontWeight="bold" color="primary">
                NaiveProxy
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Secure & Minimalist Proxy Client
            </Typography>
        </Box>

        {/* Status Card */}
        <Card sx={{
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: status === 'running' ? 'primary.light' : 'background.paper',
            transition: 'background-color 0.3s'
        }}>
            <Box>
                <Typography variant="overline" color="text.secondary">CURRENT STATUS</Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ color: status === 'running' ? 'white' : 'text.primary' }}>
                    {status === 'running' ? 'CONNECTED' : 'DISCONNECTED'}
                </Typography>
            </Box>
            <Button
                variant="contained"
                color={status === 'running' ? 'error' : 'primary'}
                size="large"
                onClick={handleToggle}
                startIcon={<PowerSettingsNewIcon />}
                sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    bgcolor: status === 'running' ? 'error.main' : 'primary.main',
                    color: 'white'
                }}
            >
                {status === 'running' ? 'Stop' : 'Start'}
            </Button>
        </Card>

        {/* Configuration */}
        <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                <SettingsIcon fontSize="small"/> Configuration
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 33%' } }}>
                    <TextField
                        label="Listen Address"
                        fullWidth
                        variant="outlined"
                        value={config.listen}
                        onChange={(e) => setConfig({...config, listen: e.target.value})}
                        disabled={status === 'running'}
                        helperText="e.g. socks://127.0.0.1:1080"
                    />
                </Box>
                <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 66%' } }}>
                    <TextField
                        label="Remote Proxy URL"
                        placeholder="https://user:pass@example.com"
                        fullWidth
                        variant="outlined"
                        value={config.proxy}
                        onChange={(e) => setConfig({...config, proxy: e.target.value})}
                        disabled={status === 'running'}
                        helperText="Your NaiveProxy server URL"
                    />
                </Box>
            </Box>

            {/* Quick Link Import */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                    label="Import Link"
                    fullWidth
                    size="small"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Paste naiveproxy:// or https:// link here..."
                    disabled={status === 'running'}
                />
                <Button
                    variant="outlined"
                    sx={{ height: 40 }}
                    onClick={() => handleLinkPaste(linkInput)}
                    startIcon={<ContentPasteIcon />}
                    disabled={status === 'running'}
                >
                    Import
                </Button>
            </Box>
        </Card>

        {/* Logs */}
        <Paper variant="outlined" sx={{
            flexGrow: 1,
            p: 2,
            bgcolor: '#1e1e1e',
            color: '#00ff00',
            fontFamily: 'monospace',
            overflowY: 'auto',
            fontSize: '0.85rem',
            borderRadius: 2,
            maxHeight: '300px'
        }}>
            {logs.length === 0 ? (
                <Typography color="text.secondary" sx={{ opacity: 0.5, fontStyle: 'italic' }}>
                    {'>'} System ready. Logs will appear here...
                </Typography>
            ) : (
                logs.map((log, i) => (
                    <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{log}</div>
                ))
            )}
            <div ref={logEndRef} />
        </Paper>

      </Container>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info" variant="filled" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
