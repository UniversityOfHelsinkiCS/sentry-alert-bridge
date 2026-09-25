import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: { colorSchemeSelector: 'media' },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
    h5: { fontWeight: 600 },
  },
  components: {
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600 } } },
  },
})
