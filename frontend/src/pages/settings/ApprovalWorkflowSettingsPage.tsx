// import { useEffect, useState } from 'react';
// import { Loader2, Plus, Trash2, GripVertical, Save, AlertCircle, Info } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { approvalWorkflowsApi } from '../../api/workflow';
// import type {
//   ApprovalWorkflow,
//   ApproverOption,
//   ApproverType,
//   WorkflowStep,
// } from '../../types/workflow';
// import toast from 'react-hot-toast';

// // ==============================================================================
// // FORM STATE TYPE
// // ==============================================================================

// interface StepFormState {
//   step_number: number;
//   step_name: string;
//   approver_type: ApproverType;
//   specific_employee: string | null;
//   sla_hours: number;
// }

// const emptyStep = (num: number): StepFormState => ({
//   step_number: num,
//   step_name: `Step ${num} Approval`,
//   approver_type: 'REPORTING_MANAGER',
//   specific_employee: null,
//   sla_hours: 48,
// });

// // ==============================================================================
// // MAIN PAGE
// // ==============================================================================

// export default function ApprovalWorkflowSettingsPage() {
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [workflow, setWorkflow] = useState<ApprovalWorkflow | null>(null);
//   const [approverOptions, setApproverOptions] = useState<ApproverOption[]>([]);

//   // Form state
//   const [name, setName] = useState('Standard Lifecycle Approval');
//   const [description, setDescription] = useState('');
//   const [isActive, setIsActive] = useState(true);
//   const [steps, setSteps] = useState<StepFormState[]>([emptyStep(1)]);

//   // ---------- Load existing workflow + approver options ----------
//   useEffect(() => {
//     const fetchAll = async () => {
//       setLoading(true);
//       try {
//         const [workflowsData, optionsData] = await Promise.all([
//           approvalWorkflowsApi.list(),
//           approvalWorkflowsApi.getApproverOptions(),
//         ]);

//         setApproverOptions(optionsData);

//         // Load first LIFECYCLE workflow if exists
//         const existing = workflowsData.find((w) => w.module === 'LIFECYCLE');
//         if (existing) {
//           setWorkflow(existing);
//           setName(existing.name);
//           setDescription(existing.description);
//           setIsActive(existing.is_active);
//           setSteps(
//   existing.steps
//     .sort((a: WorkflowStep, b: WorkflowStep) => a.step_number - b.step_number)
//     .map((s: WorkflowStep) => ({
//       step_number: s.step_number,
//       step_name: s.step_name,
//       approver_type: s.approver_type,
//       specific_employee: s.specific_employee || null,
//       sla_hours: s.sla_hours,
//     }))
// );
//         }
//       } catch (err) {
//         toast.error('Failed to load workflow settings');
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchAll();
//   }, []);

//   // ---------- Step handlers ----------
//   const addStep = () => {
//     setSteps([...steps, emptyStep(steps.length + 1)]);
//   };

//   const removeStep = (index: number) => {
//     if (steps.length === 1) {
//       toast.error('At least one step is required');
//       return;
//     }
//     const newSteps = steps
//       .filter((_, i) => i !== index)
//       .map((s, i) => ({ ...s, step_number: i + 1 }));
//     setSteps(newSteps);
//   };

//   const updateStep = <K extends keyof StepFormState>(
//   index: number,
//   field: K,
//   value: StepFormState[K]
// ) => {
//   setSteps((prev) => {
//     const newSteps = [...prev];
//     newSteps[index] = { ...newSteps[index], [field]: value };
//     return newSteps;
//   });
// };

//   /**
//    * Handle approver dropdown change.
//    * Value could be 'REPORTING_MANAGER', 'HR_ADMIN', or 'SPECIFIC_EMPLOYEE:uuid'
//    */
//   const handleApproverChange = (index: number, optionId: string) => {
//   setSteps((prev) => {
//     const newSteps = [...prev];
//     if (optionId.startsWith('SPECIFIC_EMPLOYEE:')) {
//       const empId = optionId.split(':')[1];
//       newSteps[index] = {
//         ...newSteps[index],
//         approver_type: 'SPECIFIC_EMPLOYEE',
//         specific_employee: empId,
//       };
//     } else {
//       newSteps[index] = {
//         ...newSteps[index],
//         approver_type: optionId as ApproverType,
//         specific_employee: null,
//       };
//     }
//     return newSteps;
//   });
// };

//   const getApproverValue = (step: StepFormState): string => {
//     if (step.approver_type === 'SPECIFIC_EMPLOYEE' && step.specific_employee) {
//       return `SPECIFIC_EMPLOYEE:${step.specific_employee}`;
//     }
//     return step.approver_type;
//   };

//   // ---------- Save ----------
//   const validate = (): string | null => {
//     if (!name.trim()) return 'Workflow name is required';
//     if (steps.length === 0) return 'At least one step is required';
//     for (const [i, s] of steps.entries()) {
//       if (!s.step_name.trim()) return `Step ${i + 1}: name is required`;
//       if (s.approver_type === 'SPECIFIC_EMPLOYEE' && !s.specific_employee) {
//         return `Step ${i + 1}: select an employee`;
//       }
//       if (s.sla_hours <= 0) return `Step ${i + 1}: SLA must be greater than 0`;
//     }
//     return null;
//   };

//   const handleSave = async () => {
//     const error = validate();
//     if (error) {
//       toast.error(error);
//       return;
//     }

//     const payload = {
//       name: name.trim(),
//       module: 'LIFECYCLE' as const,
//       description: description.trim(),
//       is_active: isActive,
//       steps: steps.map((s) => ({
//         step_number: s.step_number,
//         step_name: s.step_name.trim(),
//         approver_type: s.approver_type,
//         specific_employee: s.specific_employee,
//         sla_hours: s.sla_hours,
//       })),
//     };

//     setSaving(true);
//     try {
//       if (workflow) {
//         const updated = await approvalWorkflowsApi.update(workflow.id, payload);
//         setWorkflow(updated);
//         toast.success('Workflow updated successfully');
//       } else {
//         const created = await approvalWorkflowsApi.create(payload);
//         setWorkflow(created);
//         toast.success('Workflow created successfully');
//       }
//     } catch (err: any) {
//       const detail =
//         err?.response?.data?.detail ||
//         err?.response?.data?.non_field_errors?.[0] ||
//         'Failed to save workflow';
//       toast.error(detail);
//       console.error(err);
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleDelete = async () => {
//     if (!workflow) return;
//     if (!confirm('Delete this workflow? This cannot be undone.')) return;

//     try {
//       await approvalWorkflowsApi.delete(workflow.id);
//       toast.success('Workflow deleted');
//       setWorkflow(null);
//       setName('Standard Lifecycle Approval');
//       setDescription('');
//       setIsActive(true);
//       setSteps([emptyStep(1)]);
//     } catch (err) {
//       toast.error('Failed to delete workflow');
//     }
//   };

//   // ---------- Render ----------
//   if (loading) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 flex-col overflow-hidden">
//           <Topbar />
//           <div className="flex flex-1 items-center justify-center">
//             <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Group approver options by category for the dropdown
//   const groupedOptions = {
//     Dynamic: approverOptions.filter((o) => o.category === 'Dynamic'),
//     'By Role': approverOptions.filter((o) => o.category === 'By Role'),
//     'Specific Employee': approverOptions.filter(
//       (o) => o.category === 'Specific Employee'
//     ),
//   };

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-start justify-between">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">
//                 Approval Workflow Settings
//               </h1>
//               <p className="mt-1 text-sm text-gray-500">
//                 Configure the approval chain for lifecycle change requests
//                 (promotions, transfers, etc.)
//               </p>
//             </div>
//             {workflow && (
//               <button
//                 onClick={handleDelete}
//                 className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
//               >
//                 <Trash2 className="h-4 w-4" />
//                 Delete Workflow
//               </button>
//             )}
//           </div>

//           {/* Info banner */}
//           <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
//             <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
//             <div>
//               <p className="font-medium">How it works</p>
//               <p className="mt-1 text-blue-700">
//                 When HR creates a lifecycle request, it flows through the steps
//                 below in order. Each step's approver is notified via email +
//                 in-app notification. Once all steps are approved, the changes
//                 are applied automatically and a PDF letter is generated.
//               </p>
//             </div>
//           </div>

//           {/* Main Form Card */}
//           <div className="mx-auto max-w-4xl space-y-6">
//             {/* Basic Details */}
//             <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
//               <h2 className="mb-4 text-base font-semibold text-gray-900">
//                 Basic Details
//               </h2>

//               <div className="space-y-4">
//                 <div>
//                   <label className="mb-1 block text-sm font-medium text-gray-700">
//                     Module
//                   </label>
//                   <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
//                     Lifecycle Change
//                     <span className="ml-2 text-xs text-gray-400">
//                       (More modules coming soon)
//                     </span>
//                   </div>
//                 </div>

//                 <div>
//                   <label className="mb-1 block text-sm font-medium text-gray-700">
//                     Workflow Name <span className="text-red-500">*</span>
//                   </label>
//                   <input
//                     type="text"
//                     value={name}
//                     onChange={(e) => setName(e.target.value)}
//                     className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                     placeholder="Standard Lifecycle Approval"
//                   />
//                 </div>

//                 <div>
//                   <label className="mb-1 block text-sm font-medium text-gray-700">
//                     Description
//                   </label>
//                   <textarea
//                     value={description}
//                     onChange={(e) => setDescription(e.target.value)}
//                     rows={2}
//                     className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//                     placeholder="Optional description of when this workflow applies"
//                   />
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <input
//                     id="is_active"
//                     type="checkbox"
//                     checked={isActive}
//                     onChange={(e) => setIsActive(e.target.checked)}
//                     className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
//                   />
//                   <label htmlFor="is_active" className="text-sm text-gray-700">
//                     Active (this workflow will be used for new requests)
//                   </label>
//                 </div>
//               </div>
//             </div>

//             {/* Steps Configuration */}
//             <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
//               <div className="mb-4 flex items-center justify-between">
//                 <div>
//                   <h2 className="text-base font-semibold text-gray-900">
//                     Approval Steps
//                   </h2>
//                   <p className="mt-0.5 text-xs text-gray-500">
//                     Steps execute in order. Each step must be approved before
//                     moving to the next.
//                   </p>
//                 </div>
//               </div>

//               <div className="space-y-4">
//                 {steps.map((step, index) => (
//                   <StepCard
//                     key={index}
//                     step={step}
//                     index={index}
//                     isLast={index === steps.length - 1}
//                     groupedOptions={groupedOptions}
//                     onRemove={() => removeStep(index)}
//                     onUpdate={(field, value) =>
//                       updateStep(index, field, value as any)
//                     }
//                     onApproverChange={(value) =>
//                       handleApproverChange(index, value)
//                     }
//                     getApproverValue={() => getApproverValue(step)}
//                   />
//                 ))}
//               </div>

//               <button
//                 onClick={addStep}
//                 className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
//               >
//                 <Plus className="h-4 w-4" />
//                 Add Another Step
//               </button>
//             </div>

//             {/* Actions */}
//             <div className="flex items-center justify-end gap-3">
//               <button
//                 onClick={handleSave}
//                 disabled={saving}
//                 className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
//               >
//                 {saving ? (
//                   <Loader2 className="h-4 w-4 animate-spin" />
//                 ) : (
//                   <Save className="h-4 w-4" />
//                 )}
//                 {workflow ? 'Update Workflow' : 'Save Workflow'}
//               </button>
//             </div>
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // STEP CARD COMPONENT
// // ==============================================================================

// interface StepCardProps {
//   step: StepFormState;
//   index: number;
//   isLast: boolean;
//   groupedOptions: {
//     Dynamic: ApproverOption[];
//     'By Role': ApproverOption[];
//     'Specific Employee': ApproverOption[];
//   };
//   onRemove: () => void;
//   onUpdate: <K extends keyof StepFormState>(
//     field: K,
//     value: StepFormState[K]
//   ) => void;
//   onApproverChange: (value: string) => void;
//   getApproverValue: () => string;
// }

// function StepCard({
//   step,
//   index,
//   isLast,
//   groupedOptions,
//   onRemove,
//   onUpdate,
//   onApproverChange,
//   getApproverValue,
// }: StepCardProps) {
//   return (
//     <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-5">
//       {/* Step number badge + delete */}
//       <div className="mb-4 flex items-center justify-between">
//         <div className="flex items-center gap-2">
//           <GripVertical className="h-4 w-4 text-gray-400" />
//           <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
//             {step.step_number}
//           </span>
//           <span className="text-sm font-semibold text-gray-700">
//             Step {step.step_number}
//             {isLast && (
//               <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
//                 Final — HR will pick letter template here
//               </span>
//             )}
//           </span>
//         </div>
//         <button
//           onClick={onRemove}
//           className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
//           title="Remove step"
//         >
//           <Trash2 className="h-4 w-4" />
//         </button>
//       </div>

//       <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
//         {/* Step Name */}
//         <div>
//           <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//             Step Name
//           </label>
//           <input
//             type="text"
//             value={step.step_name}
//             onChange={(e) => onUpdate('step_name', e.target.value)}
//             className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//             placeholder="e.g. Manager Approval"
//           />
//         </div>

//         {/* SLA */}
//         <div>
//           <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//             SLA (Hours to Approve)
//           </label>
//           <input
//             type="number"
//             min="1"
//             value={step.sla_hours}
//             onChange={(e) =>
//               onUpdate('sla_hours', parseInt(e.target.value) || 0)
//             }
//             className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//           />
//         </div>

//         {/* Approver Dropdown - Full Width */}
//         <div className="md:col-span-2">
//           <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//             Approver <span className="text-red-500">*</span>
//           </label>
//           <select
//             value={getApproverValue()}
//             onChange={(e) => onApproverChange(e.target.value)}
//             className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//           >
//             {/* Dynamic Group */}
//             {groupedOptions.Dynamic.length > 0 && (
//               <optgroup label="📌 Dynamic (Auto-resolved per request)">
//                 {groupedOptions.Dynamic.map((opt) => (
//                   <option key={opt.id} value={opt.id}>
//                     {opt.label}
//                   </option>
//                 ))}
//               </optgroup>
//             )}

//             {/* By Role Group */}
//             {groupedOptions['By Role'].length > 0 && (
//               <optgroup label="🎭 By Role">
//                 {groupedOptions['By Role'].map((opt) => (
//                   <option key={opt.id} value={opt.id}>
//                     {opt.label}
//                   </option>
//                 ))}
//               </optgroup>
//             )}

//             {/* Specific Employees Group */}
//             {groupedOptions['Specific Employee'].length > 0 && (
//               <optgroup label="👤 Specific Employee">
//                 {groupedOptions['Specific Employee'].map((opt) => (
//                   <option key={opt.id} value={opt.id}>
//                     {opt.label}
//                   </option>
//                 ))}
//               </optgroup>
//             )}
//           </select>

//           {/* Approver hint */}
//           <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500">
//             <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
//             <span>
//               {step.approver_type === 'REPORTING_MANAGER' &&
//                 "Auto-picks the requested employee's reporting manager."}
//               {step.approver_type === 'SKIP_LEVEL_MANAGER' &&
//                 "Auto-picks the manager's manager."}
//               {step.approver_type === 'DEPARTMENT_HEAD' &&
//                 'Auto-picks the head of the employee\'s department.'}
//               {step.approver_type === 'HR_ADMIN' &&
//                 'All active HR Admins get notified — any one can approve.'}
//               {step.approver_type === 'SYSTEM_ADMIN' &&
//                 'All active System Admins get notified — any one can approve.'}
//               {step.approver_type === 'SPECIFIC_EMPLOYEE' &&
//                 'Only this specific person will get the approval.'}
//             </span>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, GripVertical, Save, AlertCircle, Info } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { approvalWorkflowsApi } from '../../api/workflow';
import type {
  ApprovalWorkflow,
  ApproverOption,
  ApproverType,
  ModuleType,
  WorkflowStep,
} from '../../types/workflow';
import toast from 'react-hot-toast';

interface StepFormState {
  step_number: number;
  step_name: string;
  approver_type: ApproverType;
  specific_employee: string | null;
  sla_hours: number;
}

const emptyStep = (num: number): StepFormState => ({
  step_number: num,
  step_name: `Step ${num} Approval`,
  approver_type: 'REPORTING_MANAGER',
  specific_employee: null,
  sla_hours: 48,
});

// 🆕 NEW: Module configuration
const MODULE_CONFIG: Record<ModuleType, {
  label: string;
  description: string;
  defaultName: string;
  helpText: string;
}> = {
  LIFECYCLE: {
    label: 'Lifecycle Change (Promotions, Transfers)',
    description: 'For employee lifecycle changes like promotions, transfers, re-designations',
    defaultName: 'Standard Lifecycle Approval',
    helpText: 'When HR creates a lifecycle request, it flows through the steps below in order. Each step\'s approver is notified via email + in-app notification. Once all steps are approved, the changes are applied automatically and a PDF letter is generated.',
  },
  LEAVE: {
    label: 'Leave Applications',
    description: 'For employee leave requests (CL, SL, EL, etc.)',
    defaultName: 'Standard Leave Approval',
    helpText: 'When an employee applies for leave, it flows through the steps below. Typical setup: Reporting Manager (48h SLA) → HR Admin (only for long leaves > 5 days). Leave balances are reserved on submission and deducted on final approval.',
  },
  POLICY: {                                      // 🆕 ADD
    label: 'Policy Approval',
    description: 'For policy document review and approval',
    defaultName: 'Standard Policy Approval',
    helpText: 'When HR submits a policy for review, it flows through these steps. Each approver reviews the policy content and can approve, reject, or request changes.',
  },
  CALENDAR: {
    label: 'Annual Calendar',
    description: 'For annual holiday calendar approval',
    defaultName: 'Standard Calendar Approval',
    helpText: 'When HR submits the annual calendar for review, it flows through these steps. Approvers review the year\'s holidays and can approve/reject/return.',
  },
};

export default function ApprovalWorkflowSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflow, setWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [approverOptions, setApproverOptions] = useState<ApproverOption[]>([]);

  // 🆕 NEW: Module selection state
  const [selectedModule, setSelectedModule] = useState<ModuleType>('LIFECYCLE');

  // Form state
  const [name, setName] = useState('Standard Lifecycle Approval');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<StepFormState[]>([emptyStep(1)]);

  const currentConfig = MODULE_CONFIG[selectedModule];

  // Load workflow when module changes
  useEffect(() => {
    fetchAll();
  }, [selectedModule]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [workflowsData, optionsData] = await Promise.all([
        approvalWorkflowsApi.list(),
        approvalWorkflowsApi.getApproverOptions(),
      ]);

      setApproverOptions(optionsData);

      // Load workflow for selected module
      const existing = workflowsData.find((w) => w.module === selectedModule);
      if (existing) {
        setWorkflow(existing);
        setName(existing.name);
        setDescription(existing.description);
        setIsActive(existing.is_active);
        setSteps(
          existing.steps
            .sort((a: WorkflowStep, b: WorkflowStep) => a.step_number - b.step_number)
            .map((s: WorkflowStep) => ({
              step_number: s.step_number,
              step_name: s.step_name,
              approver_type: s.approver_type,
              specific_employee: s.specific_employee || null,
              sla_hours: s.sla_hours,
            }))
        );
      } else {
        // Reset form to defaults for this module
        setWorkflow(null);
        setName(currentConfig.defaultName);
        setDescription('');
        setIsActive(true);
        setSteps([emptyStep(1)]);
      }
    } catch (err) {
      toast.error('Failed to load workflow settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    setSteps([...steps, emptyStep(steps.length + 1)]);
  };

  const removeStep = (index: number) => {
    if (steps.length === 1) {
      toast.error('At least one step is required');
      return;
    }
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, step_number: i + 1 }));
    setSteps(newSteps);
  };

  const updateStep = <K extends keyof StepFormState>(
    index: number,
    field: K,
    value: StepFormState[K]
  ) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[index] = { ...newSteps[index], [field]: value };
      return newSteps;
    });
  };

  const handleApproverChange = (index: number, optionId: string) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      if (optionId.startsWith('SPECIFIC_EMPLOYEE:')) {
        const empId = optionId.split(':')[1];
        newSteps[index] = {
          ...newSteps[index],
          approver_type: 'SPECIFIC_EMPLOYEE',
          specific_employee: empId,
        };
      } else {
        newSteps[index] = {
          ...newSteps[index],
          approver_type: optionId as ApproverType,
          specific_employee: null,
        };
      }
      return newSteps;
    });
  };

  const getApproverValue = (step: StepFormState): string => {
    if (step.approver_type === 'SPECIFIC_EMPLOYEE' && step.specific_employee) {
      return `SPECIFIC_EMPLOYEE:${step.specific_employee}`;
    }
    return step.approver_type;
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Workflow name is required';
    if (steps.length === 0) return 'At least one step is required';
    for (const [i, s] of steps.entries()) {
      if (!s.step_name.trim()) return `Step ${i + 1}: name is required`;
      if (s.approver_type === 'SPECIFIC_EMPLOYEE' && !s.specific_employee) {
        return `Step ${i + 1}: select an employee`;
      }
      if (s.sla_hours <= 0) return `Step ${i + 1}: SLA must be greater than 0`;
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const payload = {
      name: name.trim(),
      module: selectedModule,   // 🆕 Use selected module
      description: description.trim(),
      is_active: isActive,
      steps: steps.map((s) => ({
        step_number: s.step_number,
        step_name: s.step_name.trim(),
        approver_type: s.approver_type,
        specific_employee: s.specific_employee,
        sla_hours: s.sla_hours,
      })),
    };

    setSaving(true);
    try {
      if (workflow) {
        const updated = await approvalWorkflowsApi.update(workflow.id, payload);
        setWorkflow(updated);
        toast.success(`${currentConfig.label} workflow updated`);
      } else {
        const created = await approvalWorkflowsApi.create(payload);
        setWorkflow(created);
        toast.success(`${currentConfig.label} workflow created`);
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Failed to save workflow';
      toast.error(detail);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workflow) return;
    if (!confirm(`Delete this ${currentConfig.label} workflow? This cannot be undone.`)) return;

    try {
      await approvalWorkflowsApi.delete(workflow.id);
      toast.success('Workflow deleted');
      fetchAll();
    } catch (err) {
      toast.error('Failed to delete workflow');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  const groupedOptions = {
    Dynamic: approverOptions.filter((o) => o.category === 'Dynamic'),
    'By Role': approverOptions.filter((o) => o.category === 'By Role'),
    'Specific Employee': approverOptions.filter(
      (o) => o.category === 'Specific Employee'
    ),
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Approval Workflow Settings
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure approval chains for different modules
              </p>
            </div>
            {workflow && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Workflow
              </button>
            )}
          </div>

          {/* 🆕 NEW: Module Tabs */}
          <div className="mb-6 flex gap-2 border-b border-gray-200">
            {(Object.keys(MODULE_CONFIG) as ModuleType[]).map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  selectedModule === mod
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {MODULE_CONFIG[mod].label}
              </button>
            ))}
          </div>

          {/* Info banner */}
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">How it works — {currentConfig.label}</p>
              <p className="mt-1 text-blue-700">{currentConfig.helpText}</p>
            </div>
          </div>

          {/* Main Form Card */}
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Basic Details */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                Basic Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Module
                  </label>
                  <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-sm text-purple-800 font-semibold">
                    {currentConfig.label}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{currentConfig.description}</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Workflow Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder={currentConfig.defaultName}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Optional description of when this workflow applies"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Active (this workflow will be used for new requests)
                  </label>
                </div>
              </div>
            </div>

            {/* Steps Configuration */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Approval Steps
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Steps execute in order. Each step must be approved before moving to the next.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <StepCard
                    key={index}
                    step={step}
                    index={index}
                    isLast={index === steps.length - 1}
                    module={selectedModule}
                    groupedOptions={groupedOptions}
                    onRemove={() => removeStep(index)}
                    onUpdate={(field, value) =>
                      updateStep(index, field, value as any)
                    }
                    onApproverChange={(value) =>
                      handleApproverChange(index, value)
                    }
                    getApproverValue={() => getApproverValue(step)}
                  />
                ))}
              </div>

              <button
                onClick={addStep}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
              >
                <Plus className="h-4 w-4" />
                Add Another Step
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {workflow ? 'Update Workflow' : 'Save Workflow'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ==============================================================================
// STEP CARD COMPONENT
// ==============================================================================

interface StepCardProps {
  step: StepFormState;
  index: number;
  isLast: boolean;
  module: ModuleType;
  groupedOptions: {
    Dynamic: ApproverOption[];
    'By Role': ApproverOption[];
    'Specific Employee': ApproverOption[];
  };
  onRemove: () => void;
  onUpdate: <K extends keyof StepFormState>(
    field: K,
    value: StepFormState[K]
  ) => void;
  onApproverChange: (value: string) => void;
  getApproverValue: () => string;
}

function StepCard({
  step,
  index,
  isLast,
  module,
  groupedOptions,
  onRemove,
  onUpdate,
  onApproverChange,
  getApproverValue,
}: StepCardProps) {
  return (
    <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-400" />
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
            {step.step_number}
          </span>
          <span className="text-sm font-semibold text-gray-700">
            Step {step.step_number}
            {isLast && module === 'LIFECYCLE' && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Final — HR will pick letter template here
              </span>
            )}
            {isLast && module === 'LEAVE' && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                Final — Leave will be approved after this
              </span>
            )}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="Remove step"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Step Name
          </label>
          <input
            type="text"
            value={step.step_name}
            onChange={(e) => onUpdate('step_name', e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="e.g. Manager Approval"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            SLA (Hours to Approve)
          </label>
          <input
            type="number"
            min="1"
            value={step.sla_hours}
            onChange={(e) =>
              onUpdate('sla_hours', parseInt(e.target.value) || 0)
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Approver <span className="text-red-500">*</span>
          </label>
          <select
            value={getApproverValue()}
            onChange={(e) => onApproverChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {groupedOptions.Dynamic.length > 0 && (
              <optgroup label="📌 Dynamic (Auto-resolved per request)">
                {groupedOptions.Dynamic.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            )}
            {groupedOptions['By Role'].length > 0 && (
              <optgroup label="🎭 By Role">
                {groupedOptions['By Role'].map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            )}
            {groupedOptions['Specific Employee'].length > 0 && (
              <optgroup label="👤 Specific Employee">
                {groupedOptions['Specific Employee'].map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500">
            <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span>
              {step.approver_type === 'REPORTING_MANAGER' &&
                "Auto-picks the requested employee's reporting manager."}
              {step.approver_type === 'SKIP_LEVEL_MANAGER' &&
                "Auto-picks the manager's manager."}
              {step.approver_type === 'DEPARTMENT_HEAD' &&
                'Auto-picks the head of the employee\'s department.'}
              {step.approver_type === 'HR_ADMIN' &&
                'All active HR Admins get notified — any one can approve.'}
              {step.approver_type === 'SYSTEM_ADMIN' &&
                'All active System Admins get notified — any one can approve.'}
              {step.approver_type === 'SPECIFIC_EMPLOYEE' &&
                'Only this specific person will get the approval.'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
