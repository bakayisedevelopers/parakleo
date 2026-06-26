import { useMemo } from 'react';
import { parseQuestionsFromExtraction, parseQuestionsFromGptExtraction } from '../../services/questionParsingService';

function normalizeQuestions(boardPreparationSource) {
  const source = boardPreparationSource || {};
  const extractedText = String(source?.extractedText || source?.combinedText || source?.typedText || '').trim();
  const attachments = Array.isArray(source?.attachments) ? source.attachments : [];
  const attachmentExtractions = Array.isArray(source?.attachmentExtractions) ? source.attachmentExtractions : [];
  const ocrImageReferences = Array.isArray(source?.ocrImageReferences) ? source.ocrImageReferences : [];

  const gptQuestions = parseQuestionsFromGptExtraction({
    gptExtraction: source?.documentAiExtraction || source?.gptExtraction || null,
    attachments,
  });
  const parsed = gptQuestions?.length
    ? gptQuestions
    : parseQuestionsFromExtraction({ extractedText, attachments, attachmentExtractions, ocrImageReferences });

  return Array.isArray(parsed) ? parsed : [];
}

function normalizeSourcePages(boardPreparationSource) {
  const source = boardPreparationSource || {};
  const imageCandidates = [
    ...(Array.isArray(source?.ocrImageReferences) ? source.ocrImageReferences : []),
    ...((Array.isArray(source?.attachmentExtractions) ? source.attachmentExtractions : [])
      .flatMap((entry) => Array.isArray(entry?.pages) ? entry.pages : [])
      .flatMap((page) => Array.isArray(page?.images) ? page.images : [])),
  ];

  const pagesByNumber = new Map();
  imageCandidates.forEach((image) => {
    const src = String(image?.src || image?.downloadUrl || image?.url || '').trim();
    if (!src) return;
    const pageNumber = Number(image?.pageNumber || 0);
    const key = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : src;
    if (pagesByNumber.has(key)) return;
    pagesByNumber.set(key, {
      src,
      fileName: String(image?.fileName || ''),
      pageNumber: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : null,
      width: Number(image?.width || 0) || null,
      height: Number(image?.height || 0) || null,
    });
  });

  return [...pagesByNumber.values()].sort((left, right) => (left.pageNumber || 0) - (right.pageNumber || 0));
}

export default function AiClassWhiteboard({
  boardPreparationSource,
  transcript = '',
  boardActions = [],
  activeQuestionId = null,
  answersByQuestion = {},
}) {
  const questions = useMemo(() => normalizeQuestions(boardPreparationSource), [boardPreparationSource]);
  const sourcePages = useMemo(() => normalizeSourcePages(boardPreparationSource), [boardPreparationSource]);
  const activeQuestion = useMemo(() => {
    if (!questions.length) return null;
    const withFallbackIds = questions.map((question, index) => ({
      ...question,
      _qid: question?.questionId || `q${index + 1}`,
      _qindex: index + 1,
    }));
    if (activeQuestionId) {
      const found = withFallbackIds.find((question) => question._qid === activeQuestionId);
      if (found) return found;
    }
    return withFallbackIds[0];
  }, [activeQuestionId, questions]);

  return (
    <div className="grid h-full grid-cols-1 gap-4 bg-zinc-50/80 p-4 md:grid-cols-12">
      <section className="md:col-span-3 rounded-[28px] bg-white/80 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-700">Source Pages</h3>
        <div className="mt-3 space-y-3 overflow-auto pr-1">
          {sourcePages.length ? sourcePages.map((page) => (
            <div key={`${page.pageNumber || page.src}`} className="rounded-[24px] bg-zinc-950/5 p-2">
              <img
                alt={page.fileName || `Page ${page.pageNumber || ''}`.trim() || 'Source page'}
                className="h-auto w-full rounded-[20px] object-contain"
                src={page.src}
              />
              {page.pageNumber ? (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Page {page.pageNumber}
                </p>
              ) : null}
            </div>
          )) : <p className="text-sm text-zinc-500">No source pages available.</p>}
        </div>
      </section>

      <section className="md:col-span-4 rounded-[28px] bg-white/80 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-700">Active Question</h3>
        <div className="mt-3 space-y-3 overflow-auto pr-1">
          {activeQuestion ? (
            <div className="rounded-[24px] bg-emerald-50/80 p-4 text-sm text-zinc-800">
              <p className="font-semibold text-zinc-900">
                {activeQuestion?.questionNumber ? `Question ${activeQuestion.questionNumber}` : `Question ${activeQuestion._qindex}`}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-zinc-700">{String(activeQuestion?.text || '').trim() || 'No extracted text.'}</p>
              {(answersByQuestion?.[activeQuestion._qid] || []).length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Answers</p>
                  {(answersByQuestion[activeQuestion._qid] || []).map((entry, answerIndex) => (
                    <div key={`${activeQuestion._qid}-a-${answerIndex}`} className="rounded-[18px] bg-white/90 p-3 shadow-sm">
                      <p className="whitespace-pre-wrap text-xs text-zinc-700">{String(entry?.text || '').trim()}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                        {entry?.textMode === 'readwrite' ? 'Read + Write' : 'Read Only'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-4 text-xs text-zinc-500">No answers saved yet for this question.</p>}
            </div>
          ) : <p className="text-sm text-zinc-500">Preparing whiteboard questions...</p>}
        </div>
      </section>

      <section className="md:col-span-5 rounded-[28px] bg-white/80 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-700">AI Explanation Board</h3>
        <div className="mt-3 rounded-[24px] bg-zinc-950/5 p-4 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">Live explanation</p>
          <p className="mt-2 whitespace-pre-wrap">{transcript || 'The AI tutor transcript will appear here.'}</p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Board Actions</p>
          <div className="mt-2 max-h-[40vh] space-y-2 overflow-auto pr-1">
            {boardActions.length ? boardActions.map((action, index) => (
              <div key={`${action?.type || 'action'}-${index}`} className="rounded-[20px] bg-zinc-950/5 p-3 text-sm">
                <p className="font-semibold text-zinc-900">{action?.type || 'action'}</p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-700">{String(action?.text || action?.content || '').trim() || 'No text payload.'}</p>
                {action?.imageRef ? <p className="mt-1 text-xs text-zinc-500">Image ref: {String(action.imageRef)}</p> : null}
              </div>
            )) : <p className="text-sm text-zinc-500">No board actions yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
