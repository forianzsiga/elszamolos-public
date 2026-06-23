/** @file Type definitions for the dental billing application. Includes interfaces for Jobs, Teeth, Invoices, Tariff Rules, and related data structures. */

/**
 * Represents a single tooth/unit in a dental job.
 */
export interface Tooth {
    /** Unique identifier for the tooth/unit */
    id?: string;
    /** The tooth number (FDI notation or index) */
    number: number; // e.g., 18, 21, etc.
    /** The material of this specific unit */
    material: string;
    /** The restoration type of this specific unit */
    type: string;
    /** The implant connection type */
    implantType?: string;
    /** Whether this unit is screw retained (derived from implantType) */
    isScrewRetained?: boolean;
    
    /** Calculated price for this tooth */
    price?: number;
    /** Base price from the primary matching rule */
    basePrice?: number;
    /** Sum of additive extras applied on top of base price */
    extraPrice?: number;
    /** Currency of the calculated price */
    currency?: 'HUF' | 'EUR';
    /** Status of pricing for this tooth */
    status?: 'Pending' | 'Calculated' | 'Review' | 'Invalid' | 'Invoiced';
    /** Validation errors if status is Invalid */
    validationErrors?: string[];
    /** ID of the rule that applied to this tooth */
    appliedRuleId?: string;
    /** Name of the rule that applied to this tooth */
    appliedRuleName?: string;
    /** Label of the rule that applied to this tooth */
    appliedRuleLabel?: string;
    /** Priority of the rule that applied to this tooth */
    appliedRulePriority?: number;
    /** Detailed applied rule breakdown for transparent invoicing */
    appliedRules?: AppliedRuleBreakdown[];
    /** ID of the invoice this unit belongs to */
    parentInvoiceId?: string;
    /** List of rule IDs that are excluded from applying to this specific tooth */
    excludedRuleIds?: string[];
    /** Whether this specific tooth/unit was excluded from its matching rule */
    isExcluded?: boolean;
    /**
     * Whether this unit is ignored by an `ignoreUnit` rule.
     * Ignored units are excluded from the teeth list, invoice, 3D viewer, and
     * the job's `unitCount` (so they do not contribute to the pending count).
     */
    isIgnored?: boolean;
    /** ID of the rule that ignored this unit (if any). */
    ignoredByRuleId?: string;
    /** Name of the rule that ignored this unit (if any). */
    ignoredByRuleName?: string;
}

/**
 * Represents the status of a dental job in the system.
 */
export type JobStatus = 'Pending' | 'Calculated' | 'Review' | 'Invalid' | 'Discarded' | 'Invoiced' | 'Manual';

/**
 * Represents a single dental job imported from the file system (mocked).
 */
export interface Job {
    /** Unique identifier for the job */
    id: string;
    /** Name of the patient */
    patientName: string;
    /** Name of the doctor requesting the work */
    doctorName: string;
    /** Original filename */
    fileName: string;
    /** Creation date of the job (ISO string) */
    createdAt: string;
    /** List of individual teeth/units involved */
    teeth: Tooth[];
    /** Number of units (teeth) involved */
    unitCount: number;
    /** Number of teeth that successfully matched a rule */
    teethMatched?: number;
    /** Current processing status */
    status: JobStatus;
    /** Calculated price. 0 if invalid or pending. */
    price: number;
    /** Sum of all tooth base prices */
    basePrice?: number;
    /** Sum of all tooth and job-level additive extras */
    extraPrice?: number;
    /** Currency of the total price (e.g. 'HUF', 'EUR', 'MIXED') */
    currency?: string;
    /** Raw notes or warnings extracted from the job file */
    notes: string;
    /** The Project ID extracted from the file */
    projectId?: string;
    /** Hash of the original imported data for change detection */
    originalHash?: string;
    /** Global validation errors for the job */
    validationErrors?: string[];
    /** ID of the invoice this job belongs to */
    parentInvoiceId?: string;
    /** Detailed job-level additive rules applied once per job */
    appliedJobRules?: AppliedRuleBreakdown[];
    /** Attached file assets metadata (local-first). Blobs stored separately in IndexedDB 'assets' store. */
    assets?: JobAsset[];
    /** List of rule IDs that are excluded from applying to this job */
    excludedRuleIds?: string[];
}

/**
 * Minimal metadata stored on a Job to reference the actual binary in the DB.
 */
export interface JobAsset {
    /** Unique identifier for the asset. */
    id: string; // unique id for the asset
    /** ID of the parent job this asset belongs to. */
    jobId: string; // parent job id
    /** Original file name of the asset. */
    fileName: string;
    /** MIME type of the asset file. */
    mimeType: string;
    /** File size in bytes. */
    size: number;
    /** ISO timestamp of when the asset was created. */
    createdAt: string; // ISO
}

/**
 * Represents an Invoice entity.
 */
export interface Invoice {
    /** Unique identifier for the invoice. */
    id: string;
    /** Human-readable invoice number (e.g., "INV-2025-001"). */
    invoiceNumber: string; // e.g., "INV-2025-001"
    /** Start date of the invoicing period (ISO 8601). */
    startDate: string; // ISO Date
    /** End date of the invoicing period (ISO 8601). */
    endDate: string; // ISO Date
    /** Date when the invoice was created (ISO 8601). */
    createdAt: string; // ISO Date
    /** Total invoiced amount. */
    totalAmount: number;
    /** Currency of the invoice (HUF, EUR, or MIXED). */
    currency: 'HUF' | 'EUR' | 'MIXED';
    /** Number of jobs included in this invoice. */
    jobCount: number;
}

/**
 * Available fields that can be checked in a tariff rule.
 */
export type ConditionField = 'material' | 'type' | 'unitCount' | 'notes' | 'doctorName' | 'patientName' | 'isScrewRetained' | 'projectId' | 'number';

/**
 * Available operators for comparison.
 */
export type ConditionOperator = 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'isOneOf' | 'notEquals' | 'notContains' | 'notOneOf';

/**
 * Represents a single condition in a tariff rule (e.g., "Material equals Zircon").
 */
export interface TariffCondition {
    /** The field of the Job to inspect */
    field: ConditionField;
    /** The comparison operator */
    operator: ConditionOperator;
    /** The value to compare against */
    value: string | number | string[] | boolean;
}

/**
 * Classification for tariff rule execution behavior.
 *
 * - `base`      - sets the unit's base price (or status Invalid/Review)
 * - `unitExtra` - adds to the unit's price on top of a base match
 * - `jobExtra`  - adds a one-time amount to the job total
 * - `review`    - flags the unit for human review (no price change)
 * - `invalid`   - flags the unit as invalid (no price change)
 * - `ignoreUnit`- removes the unit from the teeth list, invoice, 3D viewer,
 *                 and the job's unitCount / pending count
 */
export type TariffRuleKind =
    | 'base'
    | 'unitExtra'
    | 'jobExtra'
    | 'review'
    | 'invalid'
    | 'ignoreUnit';

/**
 * Stored line-level result of a matched tariff rule.
 */
export interface AppliedRuleBreakdown {
    id: string;
    name: string;
    label: string;
    priority: number;
    kind: TariffRuleKind;
    amount: number;
    currency: 'HUF' | 'EUR';
    isExcluded?: boolean;
}

/**
 * Represents the consequence of a rule match.
 */
export interface TariffAction {
    /** The numeric value associated (e.g., price amount). Optional for status changes. */
    value?: number;
    /** The currency for the price value */
    currency?: 'HUF' | 'EUR';
}

/**
 * Represents a user-defined pricing logic rule.
 */
export interface TariffRule {
    /** Unique ID of the rule */
    id: string;
    /** Human-readable name of the rule */
    name: string;
    /** The label for the rule to be displayed on invoices */
    label: string;
    /** Priority order (lower numbers run first) */
    priority: number;
    /** List of conditions that must ALL be true for the rule to trigger */
    conditions: TariffCondition[];
    /** Rule execution mode. Defaults to 'base' for backward compatibility. */
    kind?: TariffRuleKind;
    /** The action to apply if triggered */
    action: TariffAction;
    /** Whether this is a hardened system rule */
    isSystem?: boolean;
}

/**
 * User preferences settings.
 */
export interface UserSettings {
    language: 'en' | 'hu' | 'debug';
}

/**
 * Represents the backup data structure for cloud sync.
 */
export interface BackupData {
    version: number;
    timestamp: string;
    jobs: Job[];
    rules: TariffRule[];
    invoices: Invoice[];
    metadata: {
        materials: string[];
        types: string[];
    };
    settings?: UserSettings;
}    
    /**
     * Represents the personal details to be displayed on an invoice.
     */
    export interface PersonalDetails {
        /** Name of the company. */
        companyName: string;
        /** Street address of the company. */
        streetAddress: string;
        /** City, state, and ZIP code. */
        cityStateZip: string;
        /** Primary phone number. */
        phone: string;
        /** Fax number. */
        fax: string;
        /** Company website URL. */
        website: string;
        /** Name of the primary contact person. */
        contactName: string;
        /** Phone number of the contact person. */
        contactPhone: string;
        /** Email address of the contact person. */
        contactEmail: string;
        /** Tax rate percentage (e.g., 27 for 27% VAT). */
        taxRate: number;
    }
    