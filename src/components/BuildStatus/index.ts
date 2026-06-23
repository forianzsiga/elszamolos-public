/**
 * @file BuildStatus/index.ts
 *
 * Barrel module that re-exports the BuildStatus component and its associated
 * props interface. The BuildStatus component displays the current build date
 * and checks for newer versions on the server, showing a warning and restart
 * button when an update is available.
 */

/**
 * Re-exports the BuildStatus component and BuildStatusProps interface.
 */
export * from './BuildStatus';
