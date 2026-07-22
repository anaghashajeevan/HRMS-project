// import { useCallback, useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   Upload, Loader2, FileText, Image, File, X, AlertCircle,
//   CheckCircle2, Sparkles, FolderArchive, Info, ArrowRight,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { quickClaimApi, reimbursementProfileApi } from '../../api/reimbursement';
// import type { ReimbursementProfile, SmartReimbursementUpload } from '../../types/reimbursement';
// import toast from 'react-hot-toast';

// const ACCEPTED_TYPES = [
//   'image/jpeg', 'image/png', 'application/pdf',
//   'application/zip', 'application/x-zip-compressed',
// ];

// const FILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
//   'image/jpeg': Image,
//   'image/png': Image,
//   'application/pdf': FileText,
//   'application/zip': FolderArchive,
//   'application/x-zip-compressed': FolderArchive,
// };

// export default function SmartUploadPage() {
//   const navigate = useNavigate();
//   const [profile, setProfile] = useState<ReimbursementProfile | null>(null);
//   const [loadingProfile, setLoadingProfile] = useState(true);
//   const [files, setFiles] = useState<File[]>([]);
//   const [uploading, setUploading] = useState(false);
//   const [dragOver, setDragOver] = useState(false);
//   const [recentUploads, setRecentUploads] = useState<SmartReimbursementUpload[]>([]);

//   // Load profile on mount
//   useEffect(() => {
//     reimbursementProfileApi
//       .get()
//       .then(setProfile)
//       .catch(() => toast.error('Failed to load profile'))
//       .finally(() => setLoadingProfile(false));
//   }, []);

//   // Drag & drop handlers
//   const handleDragOver = useCallback((e: React.DragEvent) => {
//     e.preventDefault();
//     setDragOver(true);
//   }, []);

//   const handleDragLeave = useCallback(() => {
//     setDragOver(false);
//   }, []);

//   const handleDrop = useCallback((e: React.DragEvent) => {
//     e.preventDefault();
//     setDragOver(false);
//     const droppedFiles = Array.from(e.dataTransfer.files);
//     addFiles(droppedFiles);
//   }, []);

//   const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files) {
//       addFiles(Array.from(e.target.files));
//     }
//   };

//   const addFiles = (newFiles: File[]) => {
//     const validFiles = newFiles.filter((f) => {
//       if (f.size > 10 * 1024 * 1024) {
//         toast.error(`${f.name}: File exceeds 10MB limit`);
//         return false;
//       }
//       return true;
//     });
//     setFiles((prev) => [...prev, ...validFiles].slice(0, 50));
//   };

//   const removeFile = (index: number) => {
//     setFiles((prev) => prev.filter((_, i) => i !== index));
//   };

//   const handleUpload = async () => {
//     if (files.length === 0) {
//       toast.error('Please select at least one file');
//       return;
//     }

//     if (!profile?.is_complete) {
//       toast.error('Please complete your reimbursement profile first');
//       return;
//     }

//     setUploading(true);
//     try {
//       const formData = new FormData();
//       formData.append('employee_name', profile.employee_name);
//       formData.append('month', String(profile.default_claim_month || new Date().getMonth() + 1));
//       formData.append('year', String(profile.default_claim_year || new Date().getFullYear()));

//       files.forEach((file) => {
//         formData.append('files[]', file);
//       });

//       const upload = await quickClaimApi.upload(formData);
//       toast.success(`Uploaded ${files.length} file(s). Processing...`);
//       setFiles([]);
//       navigate(`/reimbursements/smart-upload/${upload.id}`);
//     } catch (err: any) {
//       const detail = err?.response?.data?.detail || err?.response?.data?.[0] || 'Upload failed';
//       toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
//     } finally {
//       setUploading(false);
//     }
//   };

//   const formatFileSize = (bytes: number) => {
//     if (bytes < 1024) return `${bytes} B`;
//     if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
//     return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
//   };

//   const getFileIcon = (file: File) => {
//     const Icon = FILE_ICONS[file.type] || File;
//     return Icon;
//   };

//   const totalSize = files.reduce((sum, f) => sum + f.size, 0);

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6">
//             <div className="flex items-center gap-2">
//               <Sparkles className="h-6 w-6 text-primary-600" />
//               <h1 className="text-2xl font-bold text-gray-900">
//                 Smart Reimbursement Upload
//               </h1>
//             </div>
//            <p className="mt-1 text-sm text-gray-500">
//   Upload individual files, a folder of bills, or a ZIP archive • Max 50 files, 10MB each
// </p>
//           </div>

//           {/* Profile Check */}
//           {loadingProfile ? (
//             <div className="flex justify-center py-8">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : !profile?.is_complete ? (
//             <div className="rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200">
//               <div className="flex items-start gap-3">
//                 <AlertCircle className="mt-0.5 h-6 w-6 text-amber-600" />
//                 <div>
//                   <h3 className="text-base font-semibold text-amber-900">
//                     Complete Your Profile First
//                   </h3>
//                   <p className="mt-1 text-sm text-amber-700">
//                     You need to set up your reimbursement profile (name, department,
//                     finance email) before uploading bills.
//                   </p>
//                   <button
//                     onClick={() => navigate('/reimbursements/profile')}
//                     className="mt-3 flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
//                   >
//                     Setup Profile
//                     <ArrowRight className="h-4 w-4" />
//                   </button>
//                 </div>
//               </div>
//             </div>
//           ) : (
//             <div className="mx-auto max-w-4xl space-y-6">
//               {/* Profile Summary */}
//               <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <h3 className="text-sm font-semibold text-gray-900">
//                       Uploading as: {profile.employee_name}
//                     </h3>
//                     <p className="text-xs text-gray-500">
//                       {profile.department} • Claim:{' '}
//                       {profile.default_claim_month}/{profile.default_claim_year} • Finance:{' '}
//                       {profile.finance_head_email}
//                     </p>
//                   </div>
//                   <button
//                     onClick={() => navigate('/reimbursements/profile')}
//                     className="text-xs text-primary-600 hover:underline"
//                   >
//                     Edit Profile
//                   </button>
//                 </div>
//               </div>

//               {/* Info Banner */}
//               <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
//                 <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
//                 <div>
//                   <p className="font-medium">How it works</p>
//                   <p className="mt-1 text-blue-700">
//                     1. Upload bills (JPG, PNG, PDF, or ZIP) →{' '}
//                     2. AI extracts vendor, amount, date →{' '}
//                     3. Review & fix any errors →{' '}
//                     4. Confirm & send report to finance
//                   </p>
//                 </div>
//               </div>

//               {/* Drop Zone */}
//               <div
//                 onDragOver={handleDragOver}
//                 onDragLeave={handleDragLeave}
//                 onDrop={handleDrop}
//                 className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
//                   dragOver
//                     ? 'border-primary-500 bg-primary-50 scale-[1.01]'
//                     : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-gray-50'
//                 }`}
//               >
//                 <div className="flex flex-col items-center">
//                   <div
//                     className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
//                       dragOver
//                         ? 'bg-primary-600 text-white'
//                         : 'bg-primary-100 text-primary-600'
//                     }`}
//                   >
//                     <Upload className="h-8 w-8" />
//                   </div>
//                  <h3 className="text-lg font-semibold text-gray-900">
//   {dragOver ? 'Drop files here!' : 'Drag & drop your bills or folders'}
// </h3>
//                   <p className="mt-1 text-sm text-gray-500">
//                     JPG, PNG, PDF files or ZIP archives • Max 50 files, 10MB each
//                   </p>
//                   <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
//   {/* Browse Files */}
//   <label className="cursor-pointer">
//     <span className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
//       <Upload className="h-4 w-4" />
//       Browse Files
//     </span>
//     <input
//       type="file"
//       multiple
//       accept=".jpg,.jpeg,.png,.pdf,.zip"
//       onChange={handleFileInput}
//       className="hidden"
//     />
//   </label>

//   {/* Browse Folder */}
//   <label className="cursor-pointer">
//     <span className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-600 bg-white px-5 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50">
//       <FolderArchive className="h-4 w-4" />
//       Upload Folder
//     </span>
//     <input
//       type="file"
//       multiple
//       accept=".jpg,.jpeg,.png,.pdf"
//       onChange={handleFileInput}
//       className="hidden"
//       {...({ webkitdirectory: '', directory: '' } as any)}
//     />
//   </label>

//   {/* Browse ZIP */}
//   <label className="cursor-pointer">
//     <span className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
//       <FolderArchive className="h-4 w-4" />
//       Upload ZIP
//     </span>
//     <input
//       type="file"
//       accept=".zip"
//       onChange={handleFileInput}
//       className="hidden"
//     />
//   </label>
// </div>
//                 </div>
//               </div>

//               {/* Selected Files */}
//               {files.length > 0 && (
//                 <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
//                   <div className="flex items-center justify-between border-b border-gray-100 p-5">
//                     <div>
//                       <h3 className="text-sm font-semibold text-gray-900">
//                         Selected Files ({files.length})
//                       </h3>
//                       <p className="text-xs text-gray-500">
//                         Total: {formatFileSize(totalSize)}
//                       </p>
//                     </div>
//                     <button
//                       onClick={() => setFiles([])}
//                       className="text-xs text-red-600 hover:underline"
//                     >
//                       Clear All
//                     </button>
//                   </div>

//                   <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
//                     {files.map((file, idx) => {
//                       const FileIcon = getFileIcon(file);
//                       return (
//                         <div
//                           key={`${file.name}-${idx}`}
//                           className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50"
//                         >
//                           <FileIcon className="h-5 w-5 flex-shrink-0 text-gray-400" />
//                           <div className="flex-1 min-w-0">
//                             <p className="truncate text-sm font-medium text-gray-900">
//                               {file.name}
//                             </p>
//                             <p className="text-xs text-gray-500">
//                               {formatFileSize(file.size)}
//                             </p>
//                           </div>
//                           <button
//                             onClick={() => removeFile(idx)}
//                             className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
//                           >
//                             <X className="h-4 w-4" />
//                           </button>
//                         </div>
//                       );
//                     })}
//                   </div>

//                   {/* Upload Button */}
//                   <div className="border-t border-gray-100 p-5">
//                     <button
//                       onClick={handleUpload}
//                       disabled={uploading || files.length === 0}
//                       className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
//                     >
//                       {uploading ? (
//                         <>
//                           <Loader2 className="h-4 w-4 animate-spin" />
//                           Uploading & Processing...
//                         </>
//                       ) : (
//                         <>
//                           <Sparkles className="h-4 w-4" />
//                           Upload & Extract ({files.length} file{files.length > 1 ? 's' : ''})
//                         </>
//                       )}
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Loader2, FileText, Image, File, X, AlertCircle,
  CheckCircle2, Sparkles, FolderArchive, Info, ArrowRight,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { quickClaimApi, reimbursementProfileApi } from '../../api/reimbursement';
import type { ReimbursementProfile, SmartReimbursementUpload } from '../../types/reimbursement';
import toast from 'react-hot-toast';

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'application/pdf',
  'application/zip', 'application/x-zip-compressed',
];

const FILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'image/jpeg': Image,
  'image/png': Image,
  'application/pdf': FileText,
  'application/zip': FolderArchive,
  'application/x-zip-compressed': FolderArchive,
};

export default function SmartUploadPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ReimbursementProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [recentUploads, setRecentUploads] = useState<SmartReimbursementUpload[]>([]);

  // Load profile on mount
  useEffect(() => {
    reimbursementProfileApi
      .get()
      .then(setProfile)
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoadingProfile(false));
  }, []);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: File exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...validFiles].slice(0, 50));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    if (!profile?.is_complete) {
      toast.error('Please complete your reimbursement profile first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('employee_name', profile.employee_name);
      formData.append('month', String(profile.default_claim_month || new Date().getMonth() + 1));
      formData.append('year', String(profile.default_claim_year || new Date().getFullYear()));

      files.forEach((file) => {
        formData.append('files[]', file);
      });

      const upload = await quickClaimApi.upload(formData);
      toast.success(`Uploaded ${files.length} file(s). Processing...`);
      setFiles([]);
      navigate(`/reimbursements/smart-upload/${upload.id}`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.[0] || 'Upload failed';
      toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (file: File) => {
    const Icon = FILE_ICONS[file.type] || File;
    return Icon;
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-10 xl:px-14">
            {/* Header */}
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 p-6 sm:p-8 shadow-lg shadow-indigo-200/50">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    Smart Reimbursement Upload
                  </h1>
                  <p className="mt-1 text-sm text-indigo-100">
                    Upload individual files, a folder of bills, or a ZIP archive • Max 50 files, 10MB each
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Check */}
            {loadingProfile ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : !profile?.is_complete ? (
              <div className="w-full rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600" />
                  <div>
                    <h3 className="text-base font-semibold text-amber-900">
                      Complete Your Profile First
                    </h3>
                    <p className="mt-1 text-sm text-amber-700">
                      You need to set up your reimbursement profile (name, department,
                      finance email) before uploading bills.
                    </p>
                    <button
                      onClick={() => navigate('/reimbursements/profile')}
                      className="mt-3 flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
                    >
                      Setup Profile
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Profile Summary */}
                <div className="w-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                        {profile.employee_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Uploading as: {profile.employee_name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {profile.department} • Claim:{' '}
                          {profile.default_claim_month}/{profile.default_claim_year} • Finance:{' '}
                          {profile.finance_head_email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/reimbursements/profile')}
                      className="whitespace-nowrap text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>

                {/* Info Banner */}
                <div className="flex w-full items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">How it works</p>
                    <p className="mt-1 text-blue-700">
                      1. Upload bills (JPG, PNG, PDF, or ZIP) →{' '}
                      2. AI extracts vendor, amount, date →{' '}
                      3. Review & fix any errors →{' '}
                      4. Confirm & send report to finance
                    </p>
                  </div>
                </div>

                {/* Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative w-full rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all ${
                    dragOver
                      ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                      : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                        dragOver
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600'
                      }`}
                    >
                      <Upload className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {dragOver ? 'Drop files here!' : 'Drag & drop your bills or folders'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      JPG, PNG, PDF files or ZIP archives • Max 50 files, 10MB each
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      {/* Browse Files */}
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
                          <Upload className="h-4 w-4" />
                          Browse Files
                        </span>
                        <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.pdf,.zip"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                      </label>

                      {/* Browse Folder */}
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-2 rounded-lg border-2 border-indigo-600 bg-white px-5 py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50">
                          <FolderArchive className="h-4 w-4" />
                          Upload Folder
                        </span>
                        <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={handleFileInput}
                          className="hidden"
                          {...({ webkitdirectory: '', directory: '' } as any)}
                        />
                      </label>

                      {/* Browse ZIP */}
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                          <FolderArchive className="h-4 w-4" />
                          Upload ZIP
                        </span>
                        <input
                          type="file"
                          accept=".zip"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Selected Files */}
                {files.length > 0 && (
                  <div className="w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Selected Files ({files.length})
                        </h3>
                        <p className="text-xs text-slate-500">
                          Total: {formatFileSize(totalSize)}
                        </p>
                      </div>
                      <button
                        onClick={() => setFiles([])}
                        className="self-start text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline sm:self-auto"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {files.map((file, idx) => {
                        const FileIcon = getFileIcon(file);
                        return (
                          <div
                            key={`${file.name}-${idx}`}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                          >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                              <FileIcon className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {file.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <button
                              onClick={() => removeFile(idx)}
                              className="flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Upload Button */}
                    <div className="border-t border-slate-100 p-5">
                      <button
                        onClick={handleUpload}
                        disabled={uploading || files.length === 0}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading & Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Upload & Extract ({files.length} file{files.length > 1 ? 's' : ''})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}