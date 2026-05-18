import MainLayout from '../layouts/MainLayout';

export default function DataVoicePolicyPage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-zinc-800 dark:text-zinc-200">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white">Data, Voice, and Session Handling Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: April 25, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7">
          <p>
            This policy gives extra detail about how Parakleo handles live session data, microphone audio, screen sharing,
            attachments, extracted text, diagnostics, and safety review.
          </p>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">1. Microphone and voice handling</h2>
            <p className="mt-3">
              Parakleo sessions may request microphone access so students and tutors can speak during class. Audio is used to
              provide the live session. Parakleo does not intentionally record, store, or transcribe live voice audio unless a
              future recording or transcription feature is introduced with clear notice and any required consent. Users can
              mute audio in the session or deny microphone permission, but doing so may prevent the class from working properly.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">2. WebRTC connection data</h2>
            <p className="mt-3">
              To connect calls, Parakleo may process WebRTC offers, answers, ICE candidates, connection state, relay usage,
              reconnect attempts, and timestamps. This data is used for session connection, troubleshooting, abuse prevention,
              and dispute review. It is not intended to reveal lesson content.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">3. Screen sharing</h2>
            <p className="mt-3">
              Tutors may share a screen during a session. Tutors are responsible for choosing the correct window or screen and
              avoiding disclosure of private information. Students must not capture, distribute, or misuse shared screen content
              without permission. Parakleo may process screen sharing state and related diagnostics to operate the feature.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">4. Attachments and OCR</h2>
            <p className="mt-3">
              Students may upload images or files related to a tutoring request. Parakleo may use OCR or similar extraction tools
              to read question text from attachments and make it available for request matching, tutor preparation, session
              delivery, quality review, and dispute handling. Users must not upload content they do not have the right to share.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">5. Safety, moderation, and disputes</h2>
            <p className="mt-3">
              Parakleo may review account data, request details, session metadata, uploaded content, extracted text, messages,
              payment records, ratings, and support history when investigating safety concerns, complaints, refunds, tutor
              quality, fraud, chargebacks, or policy violations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">6. User responsibilities</h2>
            <p className="mt-3">
              Users must join sessions from a safe environment, avoid sharing unnecessary personal information, respect privacy,
              keep login details secure, avoid recording other users without permission, and report unsafe or abusive behavior
              promptly.
            </p>
          </div>

          <p>Contact: privacy@parakleo.app</p>
        </div>
      </section>
    </MainLayout>
  );
}
