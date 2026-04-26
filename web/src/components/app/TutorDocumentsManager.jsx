import { useEffect, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { normalizeDocumentStatus, subscribeToTutorDocuments, uploadTutorDocument } from '../../services/tutorDocumentService';

const STATUS_STYLES = {
  UPLOADED: 'border-sky-200 bg-sky-50 text-sky-700',
  PROCESSING: 'border-amber-200 bg-amber-50 text-amber-700',
  VERIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
};

export default function TutorDocumentsManager({ user, onMessage }) {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToTutorDocuments(user.uid, setDocuments);
  }, [user?.uid]);

  const uploadDocuments = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setIsUploading(true);
    setError('');
    try {
      await Promise.all(files.map((file) => uploadTutorDocument({ uid: user.uid, file })));
      onMessage?.('Result document uploaded. Processing will update automatically.');
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload result document.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center transition hover:bg-zinc-100">
        <Upload className="h-5 w-5 text-brand" />
        <span className="mt-2 text-sm font-semibold text-zinc-900">
          {isUploading ? 'Uploading...' : 'Upload result documents'}
        </span>
        <span className="mt-1 text-xs text-zinc-500">PDF, JPG, JPEG, or PNG. You can upload more later.</span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
          multiple
          disabled={isUploading}
          onChange={uploadDocuments}
          className="hidden"
        />
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="space-y-2">
        {documents.length ? documents.map((document) => {
          const status = normalizeDocumentStatus(document.status);
          return (
            <div key={document.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{document.fileName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {(document.qualifiedSubjects || []).length
                        ? `${document.qualifiedSubjects.length} qualified subject(s)`
                        : 'Waiting for subject verification'}
                    </p>
                    {document.error ? <p className="mt-1 text-xs text-rose-600">{document.error}</p> : null}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[status]}`}>
                  {status}
                </span>
              </div>
            </div>
          );
        }) : (
          <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            Upload your school results so Claxi can verify which subjects you qualify to tutor.
          </p>
        )}
      </div>
    </div>
  );
}
