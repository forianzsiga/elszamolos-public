/** @file MainLayout.tsx - Main application layout component. Provides a responsive drawer navigation, app bar, theme/developer settings, and viewport management. */
import React, { useState } from 'react';
import {
    AppBar, Box, Toolbar, Typography, Drawer, List, ListItem, ListItemButton,
    ListItemIcon, ListItemText, IconButton, Container, Divider, useTheme, useMediaQuery
} from '@mui/material';
import type { Theme } from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard,
    Work,
    Gavel,
    Assessment as LogsIcon,
    Brightness4,
    Brightness7,
    CloudSync,
    Code,
    Receipt,
    ChevronLeft,
    ChevronRight,
    Layers,
    Mouse
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { FPSMonitor } from '../FPSMonitor';
import { FloatingDevToolbar } from '../FloatingDevToolbar';
import { BuildStatus } from '../BuildStatus';
import { useColorMode } from '../../context/ThemeContext';
import { useDeveloperMode } from '../../context/DeveloperContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageToggle } from '../LanguageToggle';
import { WorktreeSwitcher } from '../WorktreeSwitcher';
import { DRAWER_WIDTH } from '../../utils/constants';
import { useInitialLoad } from '../../hooks/useInitialLoad';
import i11n from './MainLayout-i11n.json';
import './MainLayout.css';

const drawerWidth = DRAWER_WIDTH;
const drawerCollapsedWidth = 72;

/** Props for the {@link DrawerMenuItem} navigation item component. */
interface DrawerMenuItemProps {
    icon: React.ElementType;
    labelKey: string;
    path: string;
    currentPath: string;
    onPress: () => void;
    tooltipKey: string;
    showLabels: boolean;
    localT: (key: string) => string;
    t: (key: string) => string;
    getListItemPx: () => number;
}

/**
 * Renders a single navigation menu item inside the application drawer.
 * Displays an icon and, when labels are visible, a text label with tooltip support.
 *
 * @param icon - The MUI icon component to render for this menu item.
 * @param labelKey - Translation key used for the menu item text label.
 * @param path - The route path that this item navigates to.
 * @param currentPath - The currently active route path; used to apply selected styling.
 * @param onPress - Callback invoked when the menu item is clicked.
 * @param tooltipKey - Translation key for the tooltip displayed on hover.
 * @param showLabels - Whether text labels are visible (drawer expanded state).
 * @param localT - Local translation function (resolves keys from MainLayout-i11n.json).
 * @param t - Global translation function (resolves keys from global locale files).
 * @param getListItemPx - Function that returns the horizontal padding (in theme units) for the list item.
 * @returns A ListItem containing an icon button with optional label and tooltip.
 */
const DrawerMenuItem = ({ 
    icon: Icon, 
    labelKey, 
    path, 
    currentPath, 
    onPress, 
    tooltipKey, 
    showLabels, 
    localT, 
    t, 
    getListItemPx
}: DrawerMenuItemProps) => {
    return (
        <ListItem disablePadding className="drawer-menu-item">
            <ResponsiveTooltip title={localT(tooltipKey)}>
                <ListItemButton
                    {...{ onClick: onPress }}
                    selected={currentPath === path}
                    {...{ sx: {
                        minHeight: 48,
                        borderRadius: 1.5,
                        px: getListItemPx(),
                        justifyContent: showLabels ? 'flex-start' : 'center',
                        '&.Mui-selected': {
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            '& .MuiListItemIcon-root': { color: 'inherit' }
                        }
                    } }}
                >
                    <ListItemIcon
                        color={currentPath === path ? 'primary' : 'inherit'}
                        {...{ sx: {
                            minWidth: showLabels ? 38 : 0,
                            mr: showLabels ? 1 : 0,
                            justifyContent: 'center'
                        } }}
                    >
                        <Icon fontSize="small" />
                    </ListItemIcon>
                    {showLabels && (
                        <ListItemText 
                            primary={<Typography variant="body2" className="drawer-menu-text">{t(labelKey)}</Typography>} 
                        />
                    )}
                </ListItemButton>
            </ResponsiveTooltip>
        </ListItem>
    );
};

/** Props for the {@link DrawerCollapseButton} component. */
interface DrawerCollapseButtonProps {
    onPress: () => void;
    isCollapsed: boolean;
    showLabels: boolean;
    localT: (key: string) => string;
    getListItemPx: () => number;
    theme: Theme;
}

/**
 * Renders a collapse/expand toggle button inside the drawer for desktop layouts.
 * When clicked, the drawer switches between expanded (labels visible) and collapsed (icons only) state.
 *
 * @param onPress - Callback invoked when the collapse button is clicked.
 * @param isCollapsed - Whether the drawer is currently collapsed (icons only).
 * @param showLabels - Whether text labels are currently visible in the drawer.
 * @param localT - Local translation function for resolving tooltip text.
 * @param getListItemPx - Function returning the horizontal padding (in theme units) for the button.
 * @param theme - The MUI theme object, used for smooth CSS transitions.
 * @returns A ListItem with a chevron icon and a collapse/expand label.
 */
const DrawerCollapseButton = ({ onPress, isCollapsed, showLabels, localT, getListItemPx, theme }: DrawerCollapseButtonProps) => (
    <ListItem disablePadding className="drawer-collapse-item">
        <ResponsiveTooltip title={localT('menu.collapse')}>
            <ListItemButton
                {...{ onClick: onPress }}
                {...{ sx: {
                    minHeight: 44,
                    borderRadius: 1.5,
                    px: getListItemPx(),
                    justifyContent: showLabels ? 'space-between' : 'center',
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                        bgcolor: 'action.selected'
                    }
                } }}
            >
                <ListItemIcon
                    {...{ sx: {
                        minWidth: showLabels ? 38 : 0,
                        mr: showLabels ? 1 : 0,
                        justifyContent: 'center'
                    } }}
                >
                    {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
                </ListItemIcon>
                <ListItemText
                    primary={localT('menu.collapse')}
                    primaryTypographyProps={{
                        noWrap: true,
                        fontSize: '0.95rem',
                        fontWeight: 500
                    }}
                    {...{ sx: {
                        overflow: 'hidden',
                        maxWidth: showLabels ? '100%' : 0,
                        opacity: showLabels ? 1 : 0,
                        transition: theme.transitions.create(['opacity', 'max-width'], {
                            duration: 180
                        })
                    } }}
                />
            </ListItemButton>
        </ResponsiveTooltip>
    </ListItem>
);

/**
 * Props for the {@link DrawerSettingsItem} component, which renders a settings control inside the drawer.
 * Used for theme toggles, developer mode switches, and other configuration buttons.
 */
interface DrawerSettingsItemProps {
    label: string;
    onPress: () => void;
    icon: React.ElementType;
    showLabels: boolean;
    tooltipKey: string;
    localT: (key: string) => string;
    color?: "inherit" | "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
    isDeveloperMode?: boolean;
    className?: string;
}

/**
 * Renders a settings button inside the application drawer (theme toggle, developer mode, etc.).
 * Shows a label when the drawer is expanded, otherwise only displays an icon with a tooltip.
 *
 * @param label - Display text for the setting (shown only when drawer is expanded).
 * @param onPress - Callback invoked when the button is clicked.
 * @param icon - MUI icon component to display.
 * @param showLabels - Whether text labels are visible (drawer expanded state).
 * @param tooltipKey - Translation key for the tooltip displayed on hover.
 * @param localT - Local translation function for resolving tooltip text.
 * @param color - Optional MUI color for the icon button.
 * @param isDeveloperMode - Whether this setting is a developer-only feature.
 * @param className - Additional CSS class names for the icon button.
 * @returns A ListItem with an icon button and optional label.
 */
const DrawerSettingsItem = ({ 
    label, 
    onPress, 
    icon: Icon, 
    showLabels, 
    tooltipKey, 
    localT,
    color = "inherit", 
    isDeveloperMode = false,
    className = ""
}: DrawerSettingsItemProps) => {
    return (
        <ListItem dense {...{ sx: { px: showLabels ? 0.75 : 0, justifyContent: showLabels ? 'space-between' : 'center', py: isDeveloperMode ? 0.25 : undefined } }}>
            {showLabels && (
                <ListItemText primary={<Typography variant="body2" noWrap {...{ sx: { fontWeight: 500, fontSize: isDeveloperMode ? '0.85rem' : undefined } }}>{label}</Typography>} />
            )}
            <ResponsiveTooltip title={localT(tooltipKey)}>
                <IconButton {...{ onClick: onPress }} color={color} size="small" className={className}>
                    <Icon fontSize="small" />
                </IconButton>
            </ResponsiveTooltip>
        </ListItem>
    );
};

/**
 * Props for the {@link MainAppBar} component, which renders the top application bar.
 */
interface MainAppBarProps {
    onDrawerToggle: () => void;
    title: string;
    isVeryTightHorizontal: boolean;
    localT: (key: string) => string;
    isDeveloperMode: boolean;
}

/**
 * Renders the top application bar with title, drawer toggle (mobile only), and build status indicator.
 *
 * @param onDrawerToggle - Callback to open/close the mobile drawer.
 * @param title - Application title displayed in the app bar.
 * @param isVeryTightHorizontal - Whether the viewport width is below 'md' breakpoint.
 * @param localT - Local translation function for resolving tooltip text.
 * @param isDeveloperMode - Whether developer mode is currently active.
 * @returns A fixed-position AppBar component with responsive padding and controls.
 */
const MainAppBar = ({ onDrawerToggle, title, isVeryTightHorizontal, localT, isDeveloperMode }: MainAppBarProps) => (
    <AppBar position="fixed" className="main-layout-app-bar" {...{ sx: { zIndex: (theme) => theme.zIndex.drawer + 1 } }}>
        <Toolbar {...{ sx: { px: { xs: 1, sm: isVeryTightHorizontal ? 1.25 : 2 } } }}>
            <ResponsiveTooltip title={localT('tooltip.openDrawer')}>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    {...{ onClick: onDrawerToggle }}
                    {...{ sx: { mr: 2, display: { sm: 'none' } } }}
                >
                    <MenuIcon />
                </IconButton>
            </ResponsiveTooltip>
            <Typography variant="h6" noWrap component="div" className="app-bar-title">
                {title}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
                {isDeveloperMode && (
                    <>
                        <Typography variant="body2" className="app-bar-worktree-label">
                            {localT('app.worktreeLabel')}
                        </Typography>
                        <WorktreeSwitcher />
                        <Divider orientation="vertical" flexItem className="app-bar-divider" />
                    </>
                )}
                <BuildStatus hideTextOnMobile iconOnlyOnMobile />
            </Box>
        </Toolbar>
    </AppBar>
);

/**
 * Props for the {@link MainContent} component, which renders the main content area.
 */
interface MainContentProps {
    children: React.ReactNode;
    padding: number;
    effectiveDrawerWidth: number;
    theme: Theme;
}

/**
 * Renders the main content area with responsive padding, drawer width compensation, and a container.
 * Acts as the primary content wrapper for all application views.
 *
 * @param children - React nodes to render inside the content area.
 * @param padding - Theme spacing unit for padding around the content.
 * @param effectiveDrawerWidth - Current width (in pixels) of the navigation drawer.
 * @param theme - MUI theme object for consistent transitions.
 * @returns A Box component that wraps the main application content.
 */
const MainContent = ({ children, padding, effectiveDrawerWidth, theme }: MainContentProps) => (
    <Box
        component="main"
        {...{ sx: { 
            flexGrow: 1, 
            p: padding,
            width: { sm: `calc(100% - ${effectiveDrawerWidth}px)` }, 
            maxWidth: { xs: '100vw', sm: '100%' },
            overflowX: 'hidden',
            minHeight: '100vh', 
            bgcolor: 'background.default',
            transition: theme.transitions.create('width', { duration: 180 })
        } }}
    >
        <Toolbar />
        <Container maxWidth="xl" disableGutters={false}>
            {children}
        </Container>
    </Box>
);

/**
 * Custom hook that manages the viewport meta tag based on mobile detection.
 * On mobile devices, reduces the initial scale to 0.85 for better touch target sizing.
 * On desktop, resets to default scale of 1.0.
 *
 * @param isMobile - Whether the current viewport is a mobile screen size.
 */
const useViewportMeta = (isMobile: boolean) => {
    React.useEffect(() => {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (isMobile && viewportMeta) {
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=0.85, maximum-scale=0.85, user-scalable=no');
        } else if (viewportMeta) {
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
        }
        return () => {
            if (viewportMeta) {
                viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
            }
        };
    }, [isMobile]);
};

/**
 * Props for the {@link MainLayout} component, the root layout wrapper for the entire application.
 */
interface MainLayoutProps {
    children: React.ReactNode;
}

/**
 * Root layout component providing responsive drawer navigation, app bar, theme switching,
 * developer tools, and viewport management for the entire application.
 * 
 * Features:
 * - Responsive drawer that collapses to icons-only on desktop when space is limited
 * - Mobile drawer with hamburger menu
 * - Theme switching (light/dark mode)
 * - Developer mode with debugging tools (FPS monitor, container borders, React component hover)
 * - Multi-language support via translation context
 * - Build status indicator
 * - Adaptive viewport scaling for mobile touch targets
 * 
 * @param children - Child components to render inside the main content area.
 * @returns The complete application layout with navigation and responsive design.
 */
export const MainLayout = ({ children }: MainLayoutProps) => {
    useInitialLoad();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    useViewportMeta(isMobile);
    const { language } = useLanguage();
    const tData = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => tData[language as 'en' | 'hu']?.[key] || key;

    const isDesktop = useMediaQuery(theme.breakpoints.up('sm'));
    const isTightHorizontal = useMediaQuery(theme.breakpoints.down('lg'));
    const isVeryTightHorizontal = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopAutoCollapsed, setDesktopAutoCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { mode, toggleColorMode } = useColorMode();
    const { 
        isDeveloperMode, 
        toggleDeveloperMode,
        showContainerBorders,
        toggleContainerBorders,
        showReactComponentHover,
        toggleReactComponentHover
    } = useDeveloperMode();
    const { t } = useLanguage();
    const mobileDrawerWidth = 'min(86vw, 320px)';
    const isDesktopCollapsed = isDesktop && desktopAutoCollapsed;
    const showDrawerLabels = !isDesktopCollapsed;
    const effectiveDrawerWidth = isDesktopCollapsed ? drawerCollapsedWidth : drawerWidth;
    
    const getToolbarPx = () => {
        if (!showDrawerLabels) return 0.5;
        return isTightHorizontal ? 0.75 : 1.25;
    };

    const getListItemPx = () => {
        if (!showDrawerLabels) return 0.8;
        return isTightHorizontal ? 1.1 : 1.5;
    };

    const getPadding = () => {
        if (isMobile) return 0.75;
        if (isVeryTightHorizontal) return 1;
        if (isTightHorizontal) return 1.5;
        return 3;
    };
    const mainPadding = getPadding();

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleDesktopDrawerToggle = () => {
        setDesktopAutoCollapsed(prev => !prev);
    };

    const drawerContent = (
        <Box className="drawer-content-box">
            <Toolbar {...{ sx: { minHeight: 64, px: getToolbarPx() } }}>
                <Box className="drawer-header-box">
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        color="primary"
                        {...{ sx: {
                            fontSize: { xs: '1.05rem', sm: '1.15rem' },
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            pr: 1
                        } }}
                    >
                        {t('app.title')}
                    </Typography>
                </Box>
            </Toolbar>
            <Divider />
            <List {...{ sx: { flexGrow: 1, px: isTightHorizontal ? 0.75 : 1, py: isTightHorizontal ? 1 : 1.25 } }}>
                <DrawerCollapseButton 
                    onPress={handleDesktopDrawerToggle} 
                    isCollapsed={isDesktopCollapsed} 
                    showLabels={showDrawerLabels} 
                    localT={localT} 
                    getListItemPx={getListItemPx}
                    theme={theme}
                />
                <DrawerMenuItem 
                    icon={Dashboard} 
                    labelKey="menu.dashboard" 
                    tooltipKey="tooltip.dashboard"
                    path="/" 
                    currentPath={location.pathname}
                    onPress={() => { navigate('/'); setMobileOpen(false); }}
                    showLabels={showDrawerLabels}
                    localT={localT}
                    t={t}
                    getListItemPx={getListItemPx}
                />
                <DrawerMenuItem 
                    icon={Work} 
                    labelKey="menu.jobs" 
                    tooltipKey="tooltip.jobs"
                    path="/jobs" 
                    currentPath={location.pathname}
                    onPress={() => { navigate('/jobs'); setMobileOpen(false); }}
                    showLabels={showDrawerLabels}
                    localT={localT}
                    t={t}
                    getListItemPx={getListItemPx}
                />
                <DrawerMenuItem 
                    icon={Gavel} 
                    labelKey="menu.tariffs" 
                    tooltipKey="tooltip.tariffs"
                    path="/tariffs" 
                    currentPath={location.pathname}
                    onPress={() => { navigate('/tariffs'); setMobileOpen(false); }}
                    showLabels={showDrawerLabels}
                    localT={localT}
                    t={t}
                    getListItemPx={getListItemPx}
                />
                <DrawerMenuItem 
                    icon={Receipt} 
                    labelKey="menu.invoices" 
                    tooltipKey="tooltip.invoices"
                    path="/invoices" 
                    currentPath={location.pathname}
                    onPress={() => { navigate('/invoices'); setMobileOpen(false); }}
                    showLabels={showDrawerLabels}
                    localT={localT}
                    t={t}
                    getListItemPx={getListItemPx}
                />
                <DrawerMenuItem 
                    icon={LogsIcon} 
                    labelKey="menu.logs" 
                    tooltipKey="tooltip.logs"
                    path="/logs" 
                    currentPath={location.pathname}
                    onPress={() => { navigate('/logs'); setMobileOpen(false); }}
                    showLabels={showDrawerLabels}
                    localT={localT}
                    t={t}
                    getListItemPx={getListItemPx}
                />
                <DrawerMenuItem 
                    icon={CloudSync} 
                    labelKey="menu.sync" 
                    tooltipKey="tooltip.sync"
                    path="/sync" 
                    currentPath={location.pathname}
                    onPress={() => { navigate('/sync'); setMobileOpen(false); }}
                    showLabels={showDrawerLabels}
                    localT={localT}
                    t={t}
                    getListItemPx={getListItemPx}
                />
            </List>
            <Divider />
             <List {...{ sx: { p: isTightHorizontal ? 0.9 : 1.25 } }}>
                 <DrawerSettingsItem 
                    label={t('settings.darkMode')}
                    onPress={toggleColorMode}
                    icon={mode === 'dark' ? Brightness7 : Brightness4}
                    showLabels={showDrawerLabels}
                    tooltipKey="tooltip.darkMode"
                    localT={localT}
                 />
                 <DrawerSettingsItem 
                    label={t('settings.developerMode')}
                    onPress={toggleDeveloperMode}
                    icon={Code}
                    showLabels={showDrawerLabels}
                    tooltipKey="tooltip.developerMode"
                    localT={localT}
                    color={isDeveloperMode ? "warning" : "inherit"}
                 />
                 {isDeveloperMode && (
                     <>
                        <DrawerSettingsItem 
                            label={localT('settings.borders')}
                            onPress={toggleContainerBorders}
                            icon={Layers}
                            showLabels={showDrawerLabels}
                            tooltipKey="tooltip.borders"
                            localT={localT}
                            color={showContainerBorders ? "primary" : "inherit"}
                            isDeveloperMode={true}
                        />
                        <DrawerSettingsItem 
                            label={localT('settings.reactHover')}
                            onPress={toggleReactComponentHover}
                            icon={Mouse}
                            showLabels={showDrawerLabels}
                            tooltipKey="tooltip.reactHover"
                            localT={localT}
                            color={showReactComponentHover ? "primary" : "inherit"}
                            isDeveloperMode={true}
                            className="react-hover-toggle-button"
                        />
                     </>
                 )}
                 <ListItem dense {...{ sx: { px: showDrawerLabels ? 0.75 : 0, justifyContent: showDrawerLabels ? 'space-between' : 'center' } }}>
                     {showDrawerLabels && (
                         <ListItemText primary={<Typography variant="body2" noWrap className="drawer-language-text">{t('menu.language')}</Typography>} />
                     )}
                     <LanguageToggle showCode={showDrawerLabels} />
                 </ListItem>
                <Divider {...{ sx: { my: 1, display: { sm: 'none' } } }} />
                <ListItem dense {...{ sx: { display: { sm: 'none' }, justifyContent: 'center', width: '100%', px: 0 } }}>
                    <BuildStatus compact />
                </ListItem>
            </List>
        </Box>
    );

    return (
        <Box className="main-layout-root">
            <MainAppBar onDrawerToggle={handleDrawerToggle} title={t('app.title')} isVeryTightHorizontal={isVeryTightHorizontal} localT={localT} isDeveloperMode={isDeveloperMode} />
            
            <Box
                component="nav"
                {...{ sx: { width: { sm: effectiveDrawerWidth }, flexShrink: { sm: 0 }, transition: theme.transitions.create('width', { duration: 180 }) } }}
            >
                {/* Mobile Drawer */}
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    {...{ sx: {
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: mobileDrawerWidth,
                            borderRight: `1px solid ${theme.palette.divider}`,
                            backdropFilter: 'blur(4px)'
                        },
                    } }}
                >
                    {drawerContent}
                </Drawer>
                
                {/* Desktop Drawer */}
                <Drawer
                    variant="permanent"
                    PaperProps={{
                        onClick: () => {
                            if (isDesktopCollapsed) {
                                setDesktopAutoCollapsed(false);
                            }
                        }
                    }}
                    {...{ sx: {
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: effectiveDrawerWidth,
                            overflowX: 'hidden',
                            transition: theme.transitions.create('width', { duration: 180 })
                        },
                    } }}
                    open
                >
                    {drawerContent}
                </Drawer>
            </Box>

            <MainContent padding={mainPadding} effectiveDrawerWidth={effectiveDrawerWidth} theme={theme}>
                {children}
            </MainContent>
            {isDeveloperMode && (
                <>
                    <FPSMonitor />
                    <FloatingDevToolbar />
                </>
            )}
        </Box>
    );
};
