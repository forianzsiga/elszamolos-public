/**
 * @file MainLayout barrel module
 * @module MainLayout
 * @description Barrel module that re-exports the MainLayout component and its dependencies.
 * 
 * This module serves as the public API for the MainLayout component, providing
 * a single import point for the main application layout. It exports all named
 * exports from the MainLayout module, making them available through this barrel entry.
 * 
 * The MainLayout component provides:
 * - Responsive drawer navigation with collapsible sidebar
 * - Application bar with title and build status
 * - Theme switching (light/dark mode) support
 * - Developer mode with additional debugging tools
 * - Viewport management for mobile/desktop optimization
 * - Internationalization (i18n) support
 * - FPS monitoring in developer mode
 * 
 * @see {@link ./MainLayout} for the main component implementation
 * @see {@link ./MainLayout-i11n.json} for localization strings
 * @see {@link ./MainLayout.css} for component-specific styles
 */

/**
 * MainLayout — top-level application layout component.
 *
 * Provides a responsive drawer navigation, app bar, theme/developer settings
 * and viewport management. All named exports from the MainLayout module are
 * publicly available through this barrel entry.
 * 
 * @example
 * ```tsx
 * import { MainLayout } from './components/MainLayout';
 * 
 * function App() {
 *   return (
 *     <MainLayout>
 *       <YourContent />
 *     </MainLayout>
 *   );
 * }
 * ```
 * 
 * @exports MainLayout The main layout component
 */

/**
 * Re-exports all named exports from the MainLayout module.
 * 
 * Currently exports:
 * - {@link MainLayout} - The main application layout component
 * 
 * @see {@link ./MainLayout} for the source module
 */
export * from './MainLayout';
