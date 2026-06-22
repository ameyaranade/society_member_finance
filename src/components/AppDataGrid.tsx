import { DataGrid, type DataGridProps, type GridColDef } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';

export type { GridColDef };

interface AppDataGridProps extends Omit<DataGridProps, 'slots'> {
  /** When provided, the grid shows a save bar when dirty */
  onSave?: () => void;
  onDiscard?: () => void;
  isDirty?: boolean;
  saving?: boolean;
  /** Optional title shown above the grid */
  title?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function AppDataGrid({
  onSave,
  onDiscard,
  isDirty = false,
  saving = false,
  title,
  ...props
}: AppDataGridProps) {
  return (
    <Box>
      {title && (
        <Typography variant="h5" sx={{ mb: 1 }}>
          {title}
        </Typography>
      )}

      {/* Stage-then-save bar — only visible when dirty */}
      {isDirty && onSave && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            px: 2, py: 1, mb: 1,
            bgcolor: 'warning.light',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'warning.main',
          }}
        >
          <Typography variant="body2" color="warning.main" sx={{ flex: 1 }}>
            Unsaved changes
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<UndoIcon />}
            onClick={onDiscard}
            disabled={saving}
          >
            Discard
          </Button>
          <Button
            size="small"
            variant="contained"
            color="warning"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={saving}
          >
            Save changes
          </Button>
        </Stack>
      )}

      <DataGrid
        autoHeight
        density="comfortable"
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        disableRowSelectionOnClick
        aria-label={title ?? 'Data table'}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.paper' },
          '& .MuiDataGrid-cell': { fontSize: '0.875rem' },
          '& .MuiDataGrid-row--editing .MuiDataGrid-cell': {
            bgcolor: 'action.hover',
          },
        }}
        {...props}
      />
    </Box>
  );
}
