import type { TariffRule, Job, AppliedRuleBreakdown } from '../../types';

export type ActiveItem = {
    id: string;
    jobId: string;
    patientName: string;
    doctorName: string;
    projectId: string;
    toothNumber?: number;
    toothId?: string;
    type: 'job' | 'tooth';
    /**
     * True when the unit has a base/invalid/review rule applied
     * (i.e. it is calculated by a base rule). Used to decide whether
     * non-priority rule applications should show a green checkmark
     * (unit is calculated) or a yellow warning icon (unit is not
     * calculated by default). `ignoreUnit` and `unitExtra` rules are
     * intentionally NOT considered "calculating" since they don't set
     * the unit's base price/status.
     */
    isCalculatedByBaseRule?: boolean;
};

const isCalculatingRule = (breakdown: AppliedRuleBreakdown): boolean => {
    // A rule "calculates" a tooth when it determines the tooth's price/status
    // via the base/invalid/review pipeline. `ignoreUnit` and `unitExtra` are
    // not base calculations; they are either short-circuits or stack on top
    // of an existing base match. `jobExtra` applies to the job total, not a
    // specific tooth.
    return breakdown.kind === 'base'
        || breakdown.kind === 'invalid'
        || breakdown.kind === 'review';
};

const toothIsCalculatedByBaseRule = (tooth: { appliedRuleId?: string; appliedRules?: AppliedRuleBreakdown[] }): boolean => {
    if (tooth.appliedRuleId) {
        const matched = tooth.appliedRules?.find(r => r.id === tooth.appliedRuleId);
        if (matched && !matched.isExcluded && isCalculatingRule(matched)) {
            return true;
        }
    }
    return !!tooth.appliedRules?.some(r => !r.isExcluded && isCalculatingRule(r));
};

export const processApplications = (initialRule: TariffRule | null, jobs: Job[]): ActiveItem[] => {
    if (!initialRule || !jobs) return [];
    const list: ActiveItem[] = [];

    jobs.forEach(job => {
        const hasJobExtraApplied = job.appliedJobRules?.some(r => r.id === initialRule!.id && !r.isExcluded);
        if (hasJobExtraApplied) {
            const isCalculatedByBaseRule = job.teeth.some(tooth => toothIsCalculatedByBaseRule(tooth));
            list.push({
                id: `job-app-${job.id}`,
                jobId: job.id,
                patientName: job.patientName,
                doctorName: job.doctorName,
                projectId: job.projectId || 'N/A',
                type: 'job',
                isCalculatedByBaseRule
            });
        }
        job.teeth.forEach(tooth => {
            const isApplied = tooth.appliedRuleId === initialRule!.id || tooth.appliedRules?.some(r => r.id === initialRule!.id && !r.isExcluded);
            if (isApplied) {
                list.push({
                    id: `tooth-app-${job.id}-${tooth.number}`,
                    jobId: job.id,
                    patientName: job.patientName,
                    doctorName: job.doctorName,
                    projectId: job.projectId || 'N/A',
                    toothNumber: tooth.number,
                    type: 'tooth',
                    isCalculatedByBaseRule: toothIsCalculatedByBaseRule(tooth)
                });
            }
        });
    });

    return list;
};
