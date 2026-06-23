/* eslint-disable */
/** @file DeveloperContext.tsx
 *  @brief Provides a React context and provider for developer-mode features such as
 *         container border visualization, component hover inspection, and toggles.
 *
 *  This module exports:
 *    - DeveloperProvider  (component)
 *    - useDeveloperMode   (hook)
 *
 *  Internal utilities:
 *    - getElementTextContent
 *    - DeveloperContext
 *    - DeveloperContextType
 */

import { createContext, useState, useContext, useEffect } from 'react';

/** @interface DeveloperContextType
 *  @brief Defines the shape of the developer-mode context value.
 *
 *  @property {boolean}  isDeveloperMode         - Whether developer mode is currently active.
 *  @property {() => void} toggleDeveloperMode   - Toggles the developer mode on/off.
 *  @property {boolean}  showContainerBorders    - Whether container border outlines are visible.
 *  @property {() => void} toggleContainerBorders - Toggles the container border visualization on/off.
 *  @property {boolean}  showReactComponentHover - Whether the React component hover inspector is active.
 *  @property {() => void} toggleReactComponentHover - Toggles the React hover inspector on/off.
 */
interface DeveloperContextType {
    isDeveloperMode: boolean;
    toggleDeveloperMode: () => void;
    showContainerBorders: boolean;
    toggleContainerBorders: () => void;
    showReactComponentHover: boolean;
    toggleReactComponentHover: () => void;
}

/** @brief Extracts and cleans the text content from a given DOM element.
 *
 *  For input and textarea elements, returns the trimmed value. For all other
 *  elements, returns the trimmed textContent with normalized whitespace. Long
 *  strings (over 60 characters) are truncated with an ellipsis.
 *
 *  @param el - The target HTMLElement to extract text from.
 *  @returns The cleaned text string, or an empty string if the element is
 *           falsy or has no meaningful content.
 */
const getElementTextContent = (el: HTMLElement): string => {
    if (!el) return '';
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return el.value ? el.value.trim() : '';
    }
    const text = el.textContent ? el.textContent.trim() : '';
    const cleanText = text.replace(/\s+/g, ' ');
    if (cleanText.length > 60) {
        return cleanText.substring(0, 57) + '...';
    }
    return cleanText;
};

/** @brief The React context instance that carries developer-mode state.
 *
 *  Defaults to `undefined`; components must be wrapped inside a
 *  {@link DeveloperProvider} to access the context value safely.
 */
const DeveloperContext = createContext<DeveloperContextType | undefined>(undefined);

/** @brief Provider component that manages developer-mode state and persists
 *         preferences to localStorage.
 *
 *  Wraps the application (or a subtree) so that any consumer can call
 *  {@link useDeveloperMode} to read and toggle developer features such as
 *  container border visualization and the React component hover inspector.
 *
 *  When the hover inspector is active, this component attaches global event
 *  listeners (mousemove, click, keydown) to highlight custom React components
 *  on the page, display a tooltip with component details, and offer an
 *  action menu on click. All DOM artifacts (tooltip, action menu, ESC card,
 *  toast, injection styles) are cleaned up when the inspector is deactivated.
 *
 *  @param props.children - The child elements that will have access to the
 *                           developer-mode context.
 *  @returns A context provider wrapping the given children.
 */
export const DeveloperProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDeveloperMode, setIsDeveloperMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('developerMode');
        return saved === 'true';
    });

    const [showContainerBorders, setShowContainerBorders] = useState<boolean>(() => {
        return localStorage.getItem('showContainerBorders') === 'true';
    });

    const [showReactComponentHover, setShowReactComponentHover] = useState<boolean>(() => {
        return localStorage.getItem('showReactComponentHover') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('developerMode', String(isDeveloperMode));
    }, [isDeveloperMode]);

    useEffect(() => {
        localStorage.setItem('showContainerBorders', String(showContainerBorders));
    }, [showContainerBorders]);

    useEffect(() => {
        localStorage.setItem('showReactComponentHover', String(showReactComponentHover));
    }, [showReactComponentHover]);

    const toggleDeveloperMode = () => {
        setIsDeveloperMode((prev) => !prev);
    };

    const toggleContainerBorders = () => {
        setShowContainerBorders((prev) => !prev);
    };

    const toggleReactComponentHover = () => {
        setShowReactComponentHover((prev) => !prev);
    };

    // Container borders visualizer effect
    useEffect(() => {
        let style = document.getElementById('container-visualizer-style');
        if (showContainerBorders && isDeveloperMode) {
            if (!style) {
                style = document.createElement('style');
                style.id = 'container-visualizer-style';
                style.innerHTML = `
                    div, section, main, header, footer, nav, article, aside {
                        outline: 1px solid rgba(255, 0, 0, 0.4) !important;
                        outline-offset: -1px !important;
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            if (style) {
                style.remove();
            }
        }
    }, [showContainerBorders, isDeveloperMode]);

    // React components hover inspector effect
    useEffect(() => {
        if (!showReactComponentHover || !isDeveloperMode) {
            const existingTooltip = document.getElementById('react-component-tooltip');
            if (existingTooltip) existingTooltip.remove();
            const existingMenu = document.getElementById('react-component-action-menu');
            if (existingMenu) existingMenu.remove();
            const existingToast = document.getElementById('react-component-toast');
            if (existingToast) existingToast.remove();
            return;
        }

        // Suppress standard Material-UI tooltips so they don't obscure inspector overlays
        let muiStyle = document.getElementById('disable-mui-tooltips-style');
        if (!muiStyle) {
            muiStyle = document.createElement('style');
            muiStyle.id = 'disable-mui-tooltips-style';
            muiStyle.innerHTML = `
                .MuiTooltip-popper {
                    display: none !important;
                }
            `;
            document.head.appendChild(muiStyle);
        }

        // Create tooltip
        let tooltip = document.getElementById('react-component-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'react-component-tooltip';
            Object.assign(tooltip.style, {
                position: 'fixed',
                padding: '6px 12px',
                background: 'rgba(33, 150, 243, 0.95)',
                color: '#ffffff',
                fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                fontSize: '11px',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: '9999999',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                fontWeight: 'bold',
                border: '1px solid #1976d2',
                letterSpacing: '0.5px',
                display: 'none'
            });
            document.body.appendChild(tooltip);
        }

        // Create the Escape instruction card
        let escCard = document.getElementById('react-component-esc-card');
        if (!escCard) {
            escCard = document.createElement('div');
            escCard.id = 'react-component-esc-card';
            const currentLang = localStorage.getItem('language') || 'en';
            escCard.innerText = currentLang === 'hu' ? 'Nyomja meg az Esc-et a kilépéshez' : 'Press Esc to exit React Hover Mode';
            Object.assign(escCard.style, {
                position: 'fixed',
                left: '50%',
                top: '24px', // Placed perfectly at the top center of the screen
                transform: 'translateX(-50%)', // Centered mathematically
                padding: '14px 22px', // Larger and cleaner padding
                background: 'rgba(30, 30, 30, 0.95)',
                border: '1px solid #444444',
                color: '#ffffff',
                fontFamily: 'sans-serif',
                fontSize: '15px', // Larger font size
                borderRadius: '8px', // Nicer border radius
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)', // Stronger premium shadow
                fontWeight: '600', // Bolder typography
                pointerEvents: 'none', // Allow click/hover events to pass through
                zIndex: '20000005',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                letterSpacing: '0.5px'
            });
            document.body.appendChild(escCard);
        }

        // Create persistent success toast notifier
        let toast = document.getElementById('react-component-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'react-component-toast';
            Object.assign(toast.style, {
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                padding: '10px 16px',
                background: '#2e7d32',
                color: '#ffffff',
                fontFamily: 'sans-serif',
                fontSize: '13px',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: '20000001',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                fontWeight: '500',
                display: 'none',
                transition: 'opacity 0.2s ease'
            });
            document.body.appendChild(toast);
        }

        function showMenuToast(msg: string) {
            if (toast) {
                toast.innerText = msg;
                toast.style.display = 'block';
                toast.style.opacity = '1';
                setTimeout(() => {
                    if (toast) {
                        toast.style.opacity = '0';
                        setTimeout(() => {
                            if (toast) toast.style.display = 'none';
                        }, 200);
                    }
                }, 3000);
            }
        }

        let activeComponentHighlight: HTMLElement | null = null;
        let activeItemHighlight: HTMLElement | null = null;
        let lockedComponentHighlight: HTMLElement | null = null;
        let lockedItemHighlight: HTMLElement | null = null;

        const loadHtml2Canvas = (): Promise<any> => {
            return new Promise((resolve, reject) => {
                if ((window as any).html2canvas) {
                    resolve((window as any).html2canvas);
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = () => resolve((window as any).html2canvas);
                script.onerror = reject;
                document.head.appendChild(script);
            });
        };

        const isGenericComponent = (name: string): boolean => {
            const genericNames = new Set([
                'Box', 'Typography', 'Stack', 'Container', 'Grid', 'Paper', 
                'AppBar', 'Toolbar', 'IconButton', 'Card', 'CardContent', 
                'Divider', 'List', 'ListItem', 'ListItemIcon', 'ListItemText', 
                'Menu', 'MenuItem', 'Dialog', 'DialogTitle', 'DialogContent', 
                'DialogActions', 'Input', 'InputLabel', 'TextField', 'FormControl', 
                'FormHelperText', 'Select', 'Button', 'SvgIcon', 'Icon', 'Link',
                'Fade', 'Grow', 'Collapse', 'Zoom', 'Slide', 'Popover', 'Backdrop',
                'Modal', 'NativeSelect', 'InputBase', 'ButtonBase', 'TouchRipple'
            ]);
            
            return (
                genericNames.has(name) ||
                name.startsWith('Mui') ||
                name.startsWith('Select') ||
                name.startsWith('Button') ||
                name.startsWith('ForwardRef') ||
                name.startsWith('Styled') ||
                name === 'Inner' ||
                name === 'StyledComponent' ||
                name === 'Provider' ||
                name === 'ResponsiveTooltip' ||
                name === 'GridCell' ||
                name.toLowerCase().includes('tooltip')
            );
        };

        function getCustomComponentNameForRootNode(domNode: any): string | null {
            if (!domNode) return null;
            let key = Object.keys(domNode).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
            if (!key) return null;
            let fiber = domNode[key];
            
            // Go up the return tree of this DOM node's fiber
            let parent = fiber ? fiber.return : null;
            while (parent) {
                // If we hit another DOM host component, it means our domNode is nested inside another DOM element,
                // so it cannot be the custom component's outermost root DOM node!
                if (parent.stateNode && parent.stateNode instanceof HTMLElement) {
                    return null;
                }
                
                // If we hit a custom component, then our domNode is indeed the root DOM node of this component!
                if (parent.type && typeof parent.type === 'function') {
                    const name = parent.type.displayName || parent.type.name;
                    if (name && !isGenericComponent(name)) {
                        return name;
                    }
                }
                parent = parent.return;
            }
            return null;
        }

        function getReactComponentHierarchy(domNode: any) {
            if (!domNode) return '';
            let key = Object.keys(domNode).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
            if (!key) return '';
            let fiber = domNode[key];
            
            const hierarchy: string[] = [];
            let startTagName = domNode.tagName ? domNode.tagName.toLowerCase() : '';
            if (domNode.id) {
                startTagName += `#${domNode.id}`;
            } else if (domNode.className && typeof domNode.className === 'string') {
                const customClass = domNode.className.split(/\s+/).find((c: string) => c && !c.startsWith('Mui') && !c.startsWith('css-') && !c.includes(':'));
                if (customClass) {
                    startTagName += `.${customClass}`;
                }
            }

            while (fiber) {
                if (fiber.type) {
                    if (typeof fiber.type === 'function') {
                        const name = fiber.type.displayName || fiber.type.name;
                        if (name && !isGenericComponent(name)) {
                            if (!hierarchy.includes(name)) {
                                hierarchy.push(name);
                            }
                        }
                    } else if (typeof fiber.type === 'string') {
                        // This is an HTML element like 'button', 'div', etc.
                        if (hierarchy.length === 0) {
                            hierarchy.push(fiber.type);
                        }
                    }
                }
                fiber = fiber.return;
            }

            // Ensure the startTagName (with id/classes) is used as the leaf if appropriate
            if (startTagName && !hierarchy.includes(startTagName)) {
                // Remove the raw tagName from hierarchy if it's there, to replace with the richer descriptor
                const rawTagName = domNode.tagName ? domNode.tagName.toLowerCase() : '';
                const rawTagIndex = hierarchy.indexOf(rawTagName);
                if (rawTagIndex !== -1) {
                    hierarchy.splice(rawTagIndex, 1);
                }
                hierarchy.unshift(startTagName);
            }

            return hierarchy.reverse().join(' -> ');
        }

        const updateEscCard = () => {
            if (!escCard) return;

            const currentLang = localStorage.getItem('language') || 'en';
            const defaultText = currentLang === 'hu' ? 'Nyomja meg az Esc-et a kilépéshez' : 'Press Esc to exit React Hover Mode';

            // Check if there is an active hover, or fall back to the locked highlights
            const isHover = activeComponentHighlight || activeItemHighlight;
            const compEl = activeComponentHighlight || lockedComponentHighlight;
            const itemEl = activeItemHighlight || lockedItemHighlight;

            if (compEl && itemEl) {
                const itemRect = itemEl.getBoundingClientRect();
                const compRect = compEl.getBoundingClientRect();
                const color = isHover ? '#2196f3' : '#4caf50';
                const compColor = isHover ? 'rgba(33, 150, 243, 0.7)' : 'rgba(76, 175, 80, 0.7)';
                const prefix = isHover ? '' : 'Locked ';

                if (compEl !== itemEl) {
                    escCard.innerHTML = `
                        <div style="text-align: center; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 6px;">
                            ${defaultText}
                        </div>
                        <div style="font-family: monospace; font-size: 11px; display: grid; grid-template-columns: auto auto; gap: 4px 16px; font-weight: 500; line-height: 1.4;">
                            <span style="color: ${color}; text-align: left;">● ${prefix}Item:</span>
                            <span style="color: #dddddd; text-align: right;">${Math.round(itemRect.width)} × ${Math.round(itemRect.height)} <span style="color: #888;">at</span> (${Math.round(itemRect.left)}, ${Math.round(itemRect.top)})</span>
                            <span style="color: ${compColor}; text-align: left;">● ${prefix}Component:</span>
                            <span style="color: #dddddd; text-align: right;">${Math.round(compRect.width)} × ${Math.round(compRect.height)} <span style="color: #888;">at</span> (${Math.round(compRect.left)}, ${Math.round(compRect.top)})</span>
                        </div>
                    `;
                } else {
                    escCard.innerHTML = `
                        <div style="text-align: center; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 6px;">
                            ${defaultText}
                        </div>
                        <div style="font-family: monospace; font-size: 11px; display: grid; grid-template-columns: auto auto; gap: 4px 16px; font-weight: 500; line-height: 1.4;">
                            <span style="color: ${color}; text-align: left;">● ${prefix}Item & Comp:</span>
                            <span style="color: #dddddd; text-align: right;">${Math.round(itemRect.width)} × ${Math.round(itemRect.height)} <span style="color: #888;">at</span> (${Math.round(itemRect.left)}, ${Math.round(itemRect.top)})</span>
                        </div>
                    `;
                }
            } else {
                escCard.innerHTML = `<div>${defaultText}</div>`;
            }
        };

        const clearHoverHighlights = () => {
            if (activeComponentHighlight && activeComponentHighlight !== lockedComponentHighlight && activeComponentHighlight !== lockedItemHighlight) {
                activeComponentHighlight.style.outline = '';
                activeComponentHighlight.style.outlineOffset = '';
            }
            if (activeItemHighlight && activeItemHighlight !== lockedComponentHighlight && activeItemHighlight !== lockedItemHighlight) {
                activeItemHighlight.style.outline = '';
                activeItemHighlight.style.outlineOffset = '';
            }
            activeComponentHighlight = null;
            activeItemHighlight = null;
            updateEscCard();
        };

        const clearLockedHighlights = () => {
            if (lockedComponentHighlight) {
                lockedComponentHighlight.style.outline = '';
                lockedComponentHighlight.style.outlineOffset = '';
            }
            if (lockedItemHighlight) {
                lockedItemHighlight.style.outline = '';
                lockedItemHighlight.style.outlineOffset = '';
            }
            lockedComponentHighlight = null;
            lockedItemHighlight = null;
            updateEscCard();
        };

        const handleMouseMove = (e: MouseEvent) => {
            // Update Escape card opacity on hover
            if (escCard) {
                const cardRect = escCard.getBoundingClientRect();
                const isInsideCard = e.clientX >= cardRect.left && e.clientX <= cardRect.right && e.clientY >= cardRect.top && e.clientY <= cardRect.bottom;
                if (isInsideCard) {
                    escCard.style.opacity = '0.3';
                } else {
                    escCard.style.opacity = '1';
                }
            }

            let target = e.target as HTMLElement;
            if (!target || target === tooltip || target === escCard || target.closest('#react-component-esc-card')) return;

            // Bubble up from SVG elements to nearest standard HTML element (since SVGs don't support CSS outlines)
            if ((target as any).ownerSVGElement || target.tagName.toLowerCase() === 'svg') {
                const htmlParent = target.closest('svg')?.parentElement;
                if (htmlParent) {
                    target = htmlParent;
                }
            }

            // Exclude only the React Hover toggle button from being targeted by the inspector
            if (target.closest('.react-hover-toggle-button')) {
                clearHoverHighlights();
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            // Find the closest custom React component containing this target, and its root DOM element!
            let current: HTMLElement | null = target;
            let compElement: HTMLElement | null = null;
            let compName: string | null = null;

            while (current && current !== document.body) {
                const name = getCustomComponentNameForRootNode(current);
                if (name) {
                    compElement = current;
                    compName = name;
                    break;
                }
                current = current.parentElement;
            }

            // Do not trace hover on locked highlights
            if (compElement && (compElement === lockedComponentHighlight || target === lockedItemHighlight)) {
                clearHoverHighlights();
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            if (compElement && compName) {
                // Clear old active highlights if they changed
                if (activeComponentHighlight !== compElement || activeItemHighlight !== target) {
                    clearHoverHighlights();
                }

                activeComponentHighlight = compElement;
                activeItemHighlight = target;

                // Highlight the actual item with 100% blue outline
                target.style.outline = '2px dashed #2196f3';
                target.style.outlineOffset = '-2px';

                // If the component is a parent of the actual item, highlight it with 50% blue outline
                if (compElement !== target) {
                    compElement.style.outline = '2px dashed rgba(33, 150, 243, 0.5)';
                    compElement.style.outlineOffset = '-2px';
                }

                if (tooltip) {
                    let startTagName = target.tagName ? target.tagName.toLowerCase() : '';
                    if (target.id) {
                        startTagName += `#${target.id}`;
                    } else if (target.className && typeof target.className === 'string') {
                        const customClass = target.className.split(/\s+/).find((c: string) => c && !c.startsWith('Mui') && !c.startsWith('css-') && !c.includes(':'));
                        if (customClass) {
                            startTagName += `.${customClass}`;
                        }
                    }

                    const elementText = getElementTextContent(target);
                    const displayText = elementText ? ` - "${elementText}"` : '';

                    tooltip.innerText = `<${compName} /> (${startTagName})${displayText}`;
                    tooltip.style.left = `${Math.min(window.innerWidth - 200, e.clientX + 15)}px`;
                    tooltip.style.top = `${Math.min(window.innerHeight - 50, e.clientY + 15)}px`;
                    tooltip.style.display = 'block';
                }
            } else {
                clearHoverHighlights();
                if (tooltip) {
                    tooltip.style.display = 'none';
                }
            }
            updateEscCard();
        };

        const closeActionMenu = () => {
            const menu = document.getElementById('react-component-action-menu');
            if (menu) menu.remove();
            clearLockedHighlights();
            if (tooltip) tooltip.style.display = 'none';
        };

        const openActionMenu = (componentElement: HTMLElement, actualItem: HTMLElement, componentName: string, x: number, y: number) => {
            const prevMenu = document.getElementById('react-component-action-menu');
            if (prevMenu) prevMenu.remove();
            
            if (tooltip) tooltip.style.display = 'none';

            // Clear old locked highlights
            clearLockedHighlights();

            // Outline selected actual item green (100%)
            actualItem.style.outline = '2px dashed #4caf50';
            actualItem.style.outlineOffset = '-2px';
            lockedItemHighlight = actualItem;

            // Outline selected component element green (50%) if different
            if (componentElement !== actualItem) {
                componentElement.style.outline = '2px dashed rgba(76, 175, 80, 0.5)';
                componentElement.style.outlineOffset = '-2px';
                lockedComponentHighlight = componentElement;
            } else {
                lockedComponentHighlight = actualItem;
            }

            updateEscCard();

            const menu = document.createElement('div');
            menu.id = 'react-component-action-menu';
            Object.assign(menu.style, {
                position: 'fixed',
                left: `${Math.min(window.innerWidth - 250, x + 5)}px`,
                top: `${Math.min(window.innerHeight - 155, y + 5)}px`,
                background: '#1e1e1e',
                border: '1px solid #424242',
                borderRadius: '6px',
                padding: '4px 0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                zIndex: '20000000',
                fontFamily: 'sans-serif',
                fontSize: '13px',
                width: '220px'
            });

            // Menu Header
            const header = document.createElement('div');
            header.innerText = `<${componentName} />`;
            Object.assign(header.style, {
                padding: '6px 12px',
                fontWeight: 'bold',
                color: '#2196f3',
                borderBottom: '1px solid #333333',
                marginBottom: '4px',
                fontFamily: 'monospace',
                fontSize: '11px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            });
            menu.appendChild(header);

             const options = [
                {
                    label: 'Copy Component Details',
                    action: async () => {
                        let startTagName = actualItem.tagName ? actualItem.tagName.toLowerCase() : '';
                        if (actualItem.id) {
                            startTagName += `#${actualItem.id}`;
                        } else if (actualItem.className && typeof actualItem.className === 'string') {
                            const customClass = actualItem.className.split(/\s+/).find((c: string) => c && !c.startsWith('Mui') && !c.startsWith('css-') && !c.includes(':'));
                            if (customClass) {
                                startTagName += `.${customClass}`;
                            }
                        }
                        const elementText = getElementTextContent(actualItem);
                        const displayText = elementText ? ` - "${elementText}"` : '';
                        const details = `<${componentName} /> (${startTagName})${displayText}`;
                        await navigator.clipboard.writeText(details);
                        showMenuToast(`Copied details to clipboard!`);
                    }
                },
                {
                    label: 'Copy Component Name',
                    action: async () => {
                        await navigator.clipboard.writeText(componentName);
                        showMenuToast(`Copied "${componentName}" to clipboard!`);
                    }
                },
                {
                    label: 'Copy Component Hierarchy',
                    action: async () => {
                        const hierarchy = getReactComponentHierarchy(actualItem);
                        await navigator.clipboard.writeText(hierarchy);
                        showMenuToast('Copied component hierarchy!');
                    }
                },
                {
                    label: 'Copy Screenshot',
                    action: async () => {
                        showMenuToast('Capturing page screenshot...');
                        try {
                            // Hide developer overlays
                            const menu = document.getElementById('react-component-action-menu');
                            const escCard = document.getElementById('react-component-esc-card');
                            const tooltip = document.getElementById('react-component-tooltip');
                            if (menu) menu.style.display = 'none';
                            if (escCard) escCard.style.display = 'none';
                            if (tooltip) tooltip.style.display = 'none';

                            // Clear any active outlines temporarily so they aren't baked into the image
                            const oldStyles: Array<{ el: HTMLElement, outline: string, outlineOffset: string }> = [];
                            [activeComponentHighlight, activeItemHighlight, lockedComponentHighlight, lockedItemHighlight].forEach(el => {
                                if (el) {
                                    oldStyles.push({ el, outline: el.style.outline, outlineOffset: el.style.outlineOffset });
                                    el.style.outline = '';
                                    el.style.outlineOffset = '';
                                }
                            });

                            // Get component boundary details relative to the full document
                            const scrollX = window.scrollX || window.pageXOffset;
                            const scrollY = window.scrollY || window.pageYOffset;
                            const rect = componentElement.getBoundingClientRect();

                            const elementLeft = rect.left + scrollX;
                            const elementTop = rect.top + scrollY;
                            const elementWidth = rect.width;
                            const elementHeight = rect.height;

                            const padding = 128;

                            // Calculate crop area boundaries in logical pixels, clamped to document bounds
                            const docWidth = document.documentElement.scrollWidth;
                            const docHeight = document.documentElement.scrollHeight;

                            const cropLeft = Math.max(0, elementLeft - padding);
                            const cropTop = Math.max(0, elementTop - padding);
                            const cropRight = Math.min(docWidth, elementLeft + elementWidth + padding);
                            const cropBottom = Math.min(docHeight, elementTop + elementHeight + padding);

                            const cropWidth = cropRight - cropLeft;
                            const cropHeight = cropBottom - cropTop;

                            // Dynamically load html2canvas from CDN
                            const html2canvas = await loadHtml2Canvas();

                            // Render and crop natively in one step!
                            // By setting scrollX/Y to 0 and x/y to absolute document coordinates, 
                            // we guarantee perfect pixel alignment regardless of active window scroll or DPI!
                            const cropCanvas = await html2canvas(document.body, {
                                useCORS: true,
                                allowTaint: true,
                                backgroundColor: null,
                                x: cropLeft,
                                y: cropTop,
                                width: cropWidth,
                                height: cropHeight,
                                scrollX: 0,
                                scrollY: 0
                            });

                            // Restore developer overlays & outlines
                            if (menu) menu.style.display = '';
                            if (escCard) escCard.style.display = '';
                            if (tooltip) tooltip.style.display = 'block';
                            oldStyles.forEach(item => {
                                item.el.style.outline = item.outline;
                                item.el.style.outlineOffset = item.outlineOffset;
                            });

                            // Copy the cropped image to clipboard
                            cropCanvas.toBlob(async (blob: Blob | null) => {
                                if (blob) {
                                    try {
                                        await navigator.clipboard.write([
                                            new ClipboardItem({ 'image/png': blob })
                                        ]);
                                        showMenuToast('Screenshot copied as image!');
                                    } catch (e) {
                                        await navigator.clipboard.writeText(componentElement.outerHTML);
                                        showMenuToast('Copied HTML (Clipboard block)!');
                                    }
                                } else {
                                    await navigator.clipboard.writeText(componentElement.outerHTML);
                                    showMenuToast('Copied HTML (Canvas render empty)!');
                                }
                            }, 'image/png');
                        } catch (err) {
                            // In case of any unexpected errors, restore overlays first!
                            const menu = document.getElementById('react-component-action-menu');
                            const escCard = document.getElementById('react-component-esc-card');
                            const tooltip = document.getElementById('react-component-tooltip');
                            if (menu) menu.style.display = '';
                            if (escCard) escCard.style.display = '';
                            if (tooltip) tooltip.style.display = 'block';

                            await navigator.clipboard.writeText(componentElement.outerHTML);
                            showMenuToast('Copied HTML code!');
                        }
                    }
                }
            ];

            options.forEach((opt) => {
                const btn = document.createElement('button');
                btn.innerText = opt.label;
                Object.assign(btn.style, {
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    color: '#dddddd',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'sans-serif',
                    transition: 'background 0.15s, color 0.15s'
                });
                
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = '#2196f3';
                    btn.style.color = '#ffffff';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'none';
                    btn.style.color = '#dddddd';
                });
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await opt.action();
                    closeActionMenu();
                });
                menu.appendChild(btn);
            });

            document.body.appendChild(menu);
        };

        const handleMouseClick = (e: MouseEvent) => {
            let target = e.target as HTMLElement;
            if (!target || target === escCard || target.closest('#react-component-esc-card')) return;

            // Bubble up from SVG elements to nearest standard HTML element (since SVGs don't support CSS outlines)
            if ((target as any).ownerSVGElement || target.tagName.toLowerCase() === 'svg') {
                const htmlParent = target.closest('svg')?.parentElement;
                if (htmlParent) {
                    target = htmlParent;
                }
            }

            // Exclude only the React Hover toggle button from click interception
            if (target.closest('.react-hover-toggle-button')) {
                return;
            }

            const menu = document.getElementById('react-component-action-menu');
            if (menu && menu.contains(target)) {
                return;
            }

            let current: HTMLElement | null = target;
            let compElement: HTMLElement | null = null;
            let compName: string | null = null;

            while (current && current !== document.body) {
                const name = getCustomComponentNameForRootNode(current);
                if (name) {
                    compElement = current;
                    compName = name;
                    break;
                }
                current = current.parentElement;
            }

            if (compElement && compName) {
                e.preventDefault();
                e.stopPropagation();
                openActionMenu(compElement, target, compName, e.clientX, e.clientY);
            } else {
                closeActionMenu();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                toggleReactComponentHover();
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('click', handleMouseClick, true);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('click', handleMouseClick, true);
            document.removeEventListener('keydown', handleKeyDown);
            
            if (activeComponentHighlight) {
                activeComponentHighlight.style.outline = '';
                activeComponentHighlight.style.outlineOffset = '';
            }
            if (activeItemHighlight) {
                activeItemHighlight.style.outline = '';
                activeItemHighlight.style.outlineOffset = '';
            }
            if (lockedComponentHighlight) {
                lockedComponentHighlight.style.outline = '';
                lockedComponentHighlight.style.outlineOffset = '';
            }
            if (lockedItemHighlight) {
                lockedItemHighlight.style.outline = '';
                lockedItemHighlight.style.outlineOffset = '';
            }

            const existingTooltip = document.getElementById('react-component-tooltip');
            if (existingTooltip) existingTooltip.remove();
            const existingMenu = document.getElementById('react-component-action-menu');
            if (existingMenu) existingMenu.remove();
            const existingToast = document.getElementById('react-component-toast');
            if (existingToast) existingToast.remove();
            const existingEscCard = document.getElementById('react-component-esc-card');
            if (existingEscCard) existingEscCard.remove();

            const muiStyleElement = document.getElementById('disable-mui-tooltips-style');
            if (muiStyleElement) muiStyleElement.remove();
        };
    }, [showReactComponentHover, isDeveloperMode]);

    return (
        <DeveloperContext.Provider value={{ 
            isDeveloperMode, 
            toggleDeveloperMode,
            showContainerBorders,
            toggleContainerBorders,
            showReactComponentHover,
            toggleReactComponentHover
        }}>
            {children}
        </DeveloperContext.Provider>
    );
};

/** @brief Hook to access the developer-mode context.
 *
 *  Must be called from within a {@link DeveloperProvider}. Returns the
 *  full context value, including all flags and toggle functions.
 *
 *  @throws {Error} If no {@link DeveloperProvider} is found in the component
 *          tree above the caller.
 *  @returns The {@link DeveloperContextType} object containing developer-mode
 *           state and toggle callbacks.
 */
export const useDeveloperMode = () => {
    const context = useContext(DeveloperContext);
    if (!context) {
        throw new Error('useDeveloperMode must be used within a DeveloperProvider');
    }
    return context;
};
