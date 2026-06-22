import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { signOut } from 'firebase/auth';
import { useThemeMode } from '../theme/useThemeMode';
import { useAuth } from '../features/auth/useAuth';
import { auth } from '../lib/firebase';

const NAV_WIDTH = 220;

const NAV_ITEMS = [
  { label: 'Dashboard',   path: '/',            icon: <DashboardIcon /> },
  { label: 'Payables',    path: '/payables',    icon: <PaymentsIcon /> },
  { label: 'Receivables', path: '/receivables', icon: <ReceiptIcon /> },
  { label: 'Members',     path: '/members',     icon: <PeopleIcon /> },
  { label: 'Settings',    path: '/settings',    icon: <SettingsIcon /> },
];

function NavItems({ onClose, isSuperAdmin, role }: { onClose?: () => void; isSuperAdmin?: boolean; role?: string | null }) {
  const location = useLocation();
  const items = [
    ...NAV_ITEMS.filter(item => item.path !== '/members' || role === 'admin'),
    ...(isSuperAdmin
      ? [{ label: 'Platform Admin', path: '/super-admin', icon: <AdminPanelSettingsIcon /> }]
      : []),
  ];

  return (
    <List disablePadding>
      {items.map(({ label, path, icon }) => {
        const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
        return (
          <ListItem key={path} disablePadding>
            <ListItemButton
              component={NavLink}
              to={path}
              onClick={onClose}
              selected={active}
              sx={{ borderRadius: 1, mx: 1, my: 0.25 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

export default function Shell() {
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();
  const { user, isSuperAdmin, role } = useAuth();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const drawerContent = (
    <Box sx={{ pt: 1, pb: 2 }}>
      <NavItems onClose={() => setMobileOpen(false)} isSuperAdmin={isSuperAdmin} role={role} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Top AppBar */}
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>
            Society Finance
          </Typography>
          <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton
              color="inherit"
              onClick={toggleMode}
              aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={user?.email ?? 'Account'}>
            <IconButton
              color="inherit"
              aria-label="User menu"
              onClick={e => setUserMenuAnchor(e.currentTarget)}
            >
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={() => setUserMenuAnchor(null)}
          >
            <MenuItem disabled sx={{ fontSize: '0.8125rem' }}>
              {user?.email}
            </MenuItem>
            <MenuItem
              onClick={() => { setUserMenuAnchor(null); signOut(auth); }}
            >
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Side nav — persistent on desktop, temporary drawer on mobile */}
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: NAV_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box', top: '64px', height: 'calc(100% - 64px)' },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: NAV_WIDTH } }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '64px',
          ml: isDesktop ? `${NAV_WIDTH}px` : 0,
          p: 3,
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
