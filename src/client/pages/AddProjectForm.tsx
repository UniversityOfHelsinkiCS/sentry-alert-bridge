import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useState, type FormEvent } from 'react'

export function AddProjectForm({ onAdd }: { onAdd: (slug: string) => Promise<boolean> }) {
  const [newSlug, setNewSlug] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await onAdd(newSlug.trim())) setNewSlug('')
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack component="form" onSubmit={submit} direction="row" spacing={2} alignItems="center">
        <TextField
          size="small"
          label="Add a project slug"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          helperText="Only needed for a project that has not been seen yet"
        />
        <Button type="submit" disabled={newSlug.trim().length === 0}>
          Add
        </Button>
      </Stack>
    </Paper>
  )
}
