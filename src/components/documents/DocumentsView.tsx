import React, { useState } from 'react';
import {
  FileText,
  Lock,
  Unlock,
  Upload,
  Download,
  Clock,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  FileCheck,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ProjectDocument } from '../../types';
import { storeLocalFile, uploadToStorage, downloadDocumentFile } from '../../lib/fileStorage';

export const DocumentsView: React.FC = () => {
  const {
    documents,
    projects,
    activeProjectId,
    currentUser,
    isSuperAdmin,
    createDocument,
    requestDocumentAccess,
    reviewDocumentAccess,
    documentGrants,
  } = useWorkspace();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || projects[0]?.id || '');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [requestDocModal, setRequestDocModal] = useState<ProjectDocument | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [viewGrantModal, setViewGrantModal] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [isRestricted, setIsRestricted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const projectDocs = documents.filter((d) => d.projectId === selectedProjectId);
  const currentProject = projects.find((p) => p.id === selectedProjectId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      if (!docTitle.trim()) {
        const titleFromFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setDocTitle(titleFromFileName.charAt(0).toUpperCase() + titleFromFileName.slice(1));
      }
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      setUploadError('Document title is required.');
      return;
    }
    if (!selectedFile && !fileName.trim()) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const finalFileName = selectedFile ? selectedFile.name : fileName.trim();
      const finalFileSize = selectedFile ? selectedFile.size : 1024;
      const finalMimeType = selectedFile ? (selectedFile.type || 'application/octet-stream') : (finalFileName.endsWith('.json') ? 'application/json' : 'application/pdf');
      const storagePath = `projects/${selectedProjectId}/${isRestricted ? 'restricted' : 'docs'}/${finalFileName}`;

      const newDoc = createDocument({
        projectId: selectedProjectId,
        title: docTitle.trim(),
        fileName: finalFileName,
        fileSize: finalFileSize,
        mimeType: finalMimeType,
        storagePath,
        isRestricted,
        uploadedBy: currentUser?.id || '',
      });

      if (selectedFile) {
        // Store in IndexedDB for 100% offline-ready authentic binary download
        await storeLocalFile(newDoc.id, selectedFile);
        // Also upload to remote Supabase Storage if configured
        await uploadToStorage(storagePath, selectedFile);
      }

      setSelectedFile(null);
      setDocTitle('');
      setFileName('');
      setIsRestricted(false);
      setIsUploadModalOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestDocModal || !requestReason.trim()) return;

    requestDocumentAccess(requestDocModal.id, requestReason.trim());
    setRequestDocModal(null);
    setRequestReason('');
  };

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownloadDocument = async (doc: ProjectDocument) => {
    setDownloadNotice(`Retrieving ${doc.fileName}...`);
    try {
      const res = await downloadDocumentFile(doc.id, doc.storagePath, doc.fileName, doc.mimeType);
      if (res.success) {
        setDownloadNotice(`Downloaded ${doc.fileName} successfully.`);
        setTimeout(() => setDownloadNotice(null), 3000);
      } else {
        setDownloadNotice(res.message || `Download unavailable for ${doc.fileName}`);
        setTimeout(() => setDownloadNotice(null), 5000);
      }
    } catch (err) {
      setDownloadNotice(err instanceof Error ? err.message : 'Download failed');
      setTimeout(() => setDownloadNotice(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Private Document Library</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Encrypted project storage. Restricted documents are protected by server-enforced access policies and require Super Admin approval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/40 p-3 text-xs text-indigo-300">
          <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Project Selector Bar */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3 text-xs">
        <span className="text-slate-400">Select Project:</span>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projectDocs.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-12 text-center text-xs text-slate-500">
            No documents found for this project.
          </div>
        ) : (
          projectDocs.map((doc) => {
            const isUserAdmin = isSuperAdmin;
            const existingGrant = documentGrants.find(
              (g) => g.documentId === doc.id && g.userId === currentUser?.id
            );
            const isApproved = existingGrant?.status === 'approved';
            const isPending = existingGrant?.status === 'pending';

            return (
              <div
                key={doc.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-white leading-tight">
                          {doc.title}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          {doc.fileName}
                        </div>
                      </div>
                    </div>

                    {doc.isRestricted ? (
                      <span className="flex items-center gap-1 font-mono text-[10px] text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> RESTRICTED
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50 shrink-0">
                        STANDARD
                      </span>
                    )}
                  </div>

                  <div className="mt-3 text-[11px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="font-mono text-slate-300">
                        {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uploaded by:</span>
                      <span className="text-slate-300">{doc.uploader?.fullName || 'Member'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions & Access status */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {doc.isRestricted && !isUserAdmin && !isApproved ? (
                    isPending ? (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Request Pending Review
                      </span>
                    ) : (
                      <button
                        onClick={() => setRequestDocModal(doc)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Request Access →
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleDownloadDocument(doc)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Securely</span>
                    </button>
                  )}

                  {doc.isRestricted && isUserAdmin && (
                    <button
                      onClick={() => setViewGrantModal(doc.id)}
                      className="text-[10px] text-slate-400 hover:text-white underline font-mono"
                    >
                      Manage Grants
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Super Admin Document Grants Governance Table */}
      {isSuperAdmin && documentGrants.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <h2 className="font-semibold text-sm text-white">
                Restricted Document Access Requests & Approvals
              </h2>
            </div>
            <span className="font-mono text-[10px] text-emerald-400">ADMIN CONTROL</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Document</th>
                  <th className="p-3">Requester</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {documentGrants.map((grant) => (
                  <tr key={grant.id} className="hover:bg-slate-900/30">
                    <td className="p-3 font-medium text-slate-200">
                      {grant.document?.title || grant.documentId}
                    </td>
                    <td className="p-3">{grant.user?.fullName} ({grant.user?.email})</td>
                    <td className="p-3 text-slate-400">{grant.reason || '—'}</td>
                    <td className="p-3">
                      <span
                        className={`font-mono text-[10px] uppercase font-semibold ${
                          grant.status === 'approved'
                            ? 'text-emerald-400'
                            : grant.status === 'rejected'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {grant.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {grant.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              reviewDocumentAccess(grant.id, 'approved', '2026-12-31T00:00:00Z', 'Approved by admin')
                            }
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[11px] font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              reviewDocumentAccess(grant.id, 'rejected', undefined, 'Declined by admin')
                            }
                            className="bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded text-[11px] font-semibold"
                          >
                            Reject
                          </button>
                        </div>
                      ) : grant.status === 'approved' ? (
                        <button
                          onClick={() => reviewDocumentAccess(grant.id, 'rejected')}
                          className="text-[11px] text-rose-400 hover:underline"
                        >
                          Revoke Grant
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Decided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-sm">Upload Project Document</h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4 text-xs">
              {uploadError && (
                <div className="rounded-lg border border-[#FB7185]/40 bg-[#FB7185]/10 p-2.5 text-xs text-[#FB7185]">
                  {uploadError}
                </div>
              )}

              {/* Real File Input Area */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-300">Select Document File *</label>
                <div className="relative border-2 border-dashed border-slate-700 hover:border-[#8B5CF6]/50 rounded-xl p-4 bg-slate-950 transition text-center cursor-pointer group">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileCheck className="w-6 h-6 text-[#34D399] shrink-0" />
                      <div className="text-left min-w-0">
                        <div className="font-semibold text-white truncate max-w-[240px] text-xs">
                          {selectedFile.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'binary/raw'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 text-[#8B5CF6] mx-auto transition-transform group-hover:-translate-y-0.5" />
                      <div className="text-xs text-slate-300 font-medium">
                        Click or drag a file to upload
                      </div>
                      <p className="text-[10px] text-slate-500">
                        PDF, JSON, YAML, Markdown, text, archives (up to 50MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Threat Model and Pen-Test v2"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              {isSuperAdmin && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRestricted}
                      onChange={(e) => setIsRestricted(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-[#8B5CF6] focus:ring-0"
                    />
                    <span className="font-semibold text-slate-200">
                      Mark as Restricted Document
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Restricted documents are visible and downloadable ONLY by the Super Admin unless explicitly granted through the access request workflow.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isUploading}
                  className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || (!selectedFile && !docTitle)}
                  className="rounded bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition flex items-center gap-1.5"
                >
                  {isUploading && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUploading ? 'Securing & Storing...' : 'Upload & Secure'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Access Modal */}
      {requestDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-sm">Request Restricted Document Access</h3>
              <button
                onClick={() => setRequestDocModal(null)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded bg-slate-950 p-2.5 border border-slate-800 text-slate-300">
                <span className="font-semibold text-white">{requestDocModal.title}</span>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {requestDocModal.fileName}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Business / Technical Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State why you require access to this restricted document and the expected duration..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRequestDocModal(null)}
                  className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
