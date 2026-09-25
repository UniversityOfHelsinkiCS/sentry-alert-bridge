import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import { useCallback, useState, type ReactElement } from 'react'

type Severity = 'success' | 'error' | 'info'

/** One snackbar per page, driven by show('saved') / show(err.message, 'error'). */
export function useToast(): {
  show: (message: string, severity?: Severity) => void
  toast: ReactElement
} {
  const [state, setState] = useState<{ message: string; severity: Severity } | null>(null)

  const show = useCallback((message: string, severity: Severity = 'success') => {
    setState({ message, severity })
  }, [])

  const toast = (
    <Snackbar
      open={state !== null}
      autoHideDuration={5000}
      onClose={() => setState(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity={state?.severity ?? 'info'} onClose={() => setState(null)}>
        {state?.message ?? ''}
      </Alert>
    </Snackbar>
  )

  return { show, toast }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'something went wrong'
}
