import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container, IconButton, Menu, MenuItem, Drawer, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Action Logs', to: '/action-logs' },
  { label: 'Users', to: '/users' },
  { label: 'Departments', to: '/departments' },
];

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    setDrawerOpen(false);
    logout();
    navigate('/login');
  };

  const toggleDrawer = (open: boolean) => () => {
    setDrawerOpen(open);
  };

  const navContent = (
    <Box sx={{ width: 260 }} role="presentation" onClick={toggleDrawer(false)} onKeyDown={toggleDrawer(false)}>
      <List>
        {navItems.map(({ label, to }) => (
          <ListItem key={to} disablePadding>
            <ListItemButton component={Link} to={to}>
              <ListItemText primary={label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box>
      <AppBar position="static">
        <Toolbar sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <IconButton
            color="inherit"
            aria-label="open menu"
            edge="start"
            onClick={toggleDrawer(true)}
            sx={{ mr: 1, display: { xs: 'block', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Action Log System
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, alignItems: 'center' }}>
            {navItems.map(({ label, to }) => (
              <Button key={to} color="inherit" component={Link} to={to} sx={{ minWidth: 'auto', px: 1.5 }}>
                {label}
              </Button>
            ))}
          </Box>
          <Box sx={{ ml: 1 }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              keepMounted
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem disabled>
                {user?.first_name} {user?.last_name}
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 260 } }}
      >
        {navContent}
      </Drawer>
      <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 3, md: 4 }, px: { xs: 1.5, sm: 2 }, pb: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
};

export default Layout; 