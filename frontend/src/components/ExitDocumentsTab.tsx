import { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadMyExitDocument, getMyExitDocuments } from '../api/payrollApi';

type ExitDocument = {
  id: string;
  document_type: string;
  label: string;
  document_name: string;
  issued_at: string;
  exit_date: string;
  download_count: number;
};

export default function ExitDocumentsTab() {
  const [documents, setDocuments] = useState<ExitDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    getMyExitDocuments()
      .then(response => setDocuments(response.data.results || []))
      .catch(() => toast.error('Could not load your exit documents.'))
      .finally(() => setLoading(false));
  }, []);

  const download = async (document: ExitDocument) => {
    setDownloading(document.id);
    try {
      const response = await downloadMyExitDocument(document.id);
      const objectUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const anchor = window.document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${document.document_name.replace(/[^\w.-]+/g, '_')}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      toast.success('Exit document downloaded.');
    } catch {
      toast.error('Could not download this exit document.');
    } finally {
      setDownloading(null);
    }
  };

  return <section>
    <div className="mb-4"><h3 className="text-lg font-semibold text-gray-900">Exit Documents</h3><p className="mt-1 text-sm text-gray-500">Documents issued for your completed employee exit are available here.</p></div>
    {loading ? <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary-600" /></div>
      : documents.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center"><FileText className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 text-sm font-medium text-gray-700">No exit documents have been issued</p><p className="mt-1 text-xs text-gray-500">Eligible documents will appear here after HR issues them.</p></div>
      : <div className="space-y-3">{documents.map(document => <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
        <div className="flex items-start gap-3"><FileText className="mt-0.5 h-5 w-5 text-indigo-600" /><div><h4 className="text-sm font-semibold text-gray-900">{document.label}</h4><p className="mt-1 text-xs text-gray-500">Issued {new Date(document.issued_at).toLocaleDateString()} · Exit date {document.exit_date}</p></div></div>
        <button onClick={() => void download(document)} disabled={downloading === document.id} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{downloading === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download</button>
      </article>)}</div>}
  </section>;
}
