import { Link } from 'react-router-dom';
import LegalPageShell, { LegalSection } from '../components/legal/LegalPageShell';
import { normalizePortalRole } from '../constants/portal';
import { usePortal } from '../hooks/usePortal';

const ABOUT_COPY = {
  student: {
    eyebrow: 'About Parakleo',
    title: 'Learning support that moves at student speed',
    updatedAt: 'June 7, 2026',
    intro:
      'Parakleo helps students request academic support quickly and connect with verified tutors through a simple, reliable session flow. The product is designed for urgent help, flexible scheduling, and clear progress from request to live session.',
    contact:
      'For partnership, support, or platform questions, contact the Parakleo team through the app support channels.',
    sections: [
      {
        title: 'What Parakleo Does',
        body: (
          <>
            <p>
              Parakleo helps students request help for school subjects, describe what they need, and get matched with tutors
              who are available to assist. The platform is built around fast requests, structured session management, and a
              learning experience that feels straightforward on web.
            </p>
            <p>
              Students can submit a request, track its progress, and join a live session once a tutor accepts. Tutors can
              review incoming requests, respond to suitable sessions, and teach through the same connected workflow.
            </p>
          </>
        ),
      },
      {
        title: 'How The Platform Helps',
        body: (
          <>
            <p>
              The goal is to remove friction from getting academic help. Instead of long signup-to-booking delays, Parakleo
              focuses on immediate action: request support, confirm the details, and move into a live lesson with better
              visibility over status, timing, and follow-through.
            </p>
            <p>
              The platform also supports the wider session journey through notifications, tutor verification, session status
              tracking, payment-related policy pages, and account flows tailored for students and tutors.
            </p>
          </>
        ),
      },
      {
        title: 'Who It Is For',
        body: (
          <p>
            Parakleo is built for students who need extra help with schoolwork and for tutors who want to respond to real
            learning needs through a focused digital workflow. It is especially useful when a student needs help quickly,
            wants a more guided request process, or needs a clearer path from question to live support.
          </p>
        ),
      },
      {
        title: 'What Matters To Us',
        body: (
          <>
            <p>
              The platform is shaped around clarity, trust, and responsiveness. That means verified tutors, clearer student
              flows, transparent policies, and a product experience that makes it easier to ask for help without confusion.
            </p>
            <p>
              If you want to explore Parakleo further, you can return to the{' '}
              <Link to="/" className="font-bold text-brand underline underline-offset-2">
                landing page
              </Link>{' '}
              to review the product overview and core features.
            </p>
          </>
        ),
      },
    ],
  },
  tutor: {
    eyebrow: 'About Parakleo Tutors',
    title: 'A focused workspace for live tutoring',
    updatedAt: 'June 26, 2026',
    intro:
      'Parakleo Tutors is the tutor portal for accepting requests, managing availability, reviewing agreements, and handling session work in one place. It is tuned for fast response, clear matching, and teaching flow.',
    contact:
      'For tutor onboarding or portal support, use the tutor support channels in the app.',
    sections: [
      {
        title: 'What The Tutor Portal Does',
        body: (
          <>
            <p>
              The tutor portal keeps the workflow focused on live class requests, subject alignment, session management, and
              payout tracking. It is intended to minimize distractions so tutors can respond quickly and stay organized.
            </p>
            <p>
              Tutors can review incoming requests, accept sessions that fit their skill set, join the room, and follow the
              class flow from start to finish.
            </p>
          </>
        ),
      },
      {
        title: 'How It Helps Tutors',
        body: (
          <>
            <p>
              The portal surfaces live opportunities, agreement status, and payout-related tools in one workspace. This makes
              it easier to remain online when available, understand current obligations, and manage tutoring activity without
              jumping between apps.
            </p>
            <p>
              The matching and dispatch flow is designed to make tutors visible to relevant students when they are online and
              eligible.
            </p>
          </>
        ),
      },
      {
        title: 'Who It Is For',
        body: (
          <p>
            This portal is for tutors who want a clean operational view of the work they are taking on. It is useful for
            independent tutors, part-time tutors, and any educator who wants to keep request handling and session delivery in
            one place.
          </p>
        ),
      },
      {
        title: 'What Matters To Us',
        body: (
          <>
            <p>
              We prioritize clear dispatch, reliable session handling, and a support flow that helps tutors stay ready for
              students. Verified access and role separation keep the portal focused on tutoring only.
            </p>
            <p>
              You can return to the{' '}
              <Link to="/tutor" className="font-bold text-brand underline underline-offset-2">
                tutor landing page
              </Link>{' '}
              for a quick overview of the portal.
            </p>
          </>
        ),
      },
    ],
  },
  admin: {
    eyebrow: 'About Parakleo Admin',
    title: 'Platform operations in one control room',
    updatedAt: 'June 26, 2026',
    intro:
      'The admin portal is for operational oversight, tutor management, payments, agreements, and platform review. It is intentionally narrow so administrators can focus on governance and support.',
    contact:
      'For platform issues or admin access questions, use the internal admin support process.',
    sections: [
      {
        title: 'What The Admin Portal Does',
        body: (
          <>
            <p>
              The admin portal centralizes platform-level activity such as tutor review, payment oversight, agreement
              management, and unsupported subject tracking.
            </p>
            <p>
              It is not a student or tutor workspace. It exists so administrators can manage operational concerns without
              exposing end-user tools.
            </p>
          </>
        ),
      },
      {
        title: 'Why It Exists',
        body: (
          <>
            <p>
              Admin work needs a different surface from student and tutor flows. Keeping it separate reduces confusion and
              makes it easier to protect platform operations.
            </p>
            <p>
              This portal is intentionally lightweight and access-controlled, with sign-in reserved for approved admin
              accounts.
            </p>
          </>
        ),
      },
      {
        title: 'What Matters To Us',
        body: (
          <>
            <p>
              We care about governance, reliability, and safe access. The admin portal is built to keep platform controls
              distinct from the learning experience.
            </p>
            <p>
              You can return to the{' '}
              <Link to="/admin" className="font-bold text-brand underline underline-offset-2">
                admin landing page
              </Link>{' '}
              for the portal overview.
            </p>
          </>
        ),
      },
    ],
  },
};

export default function AboutPage() {
  const portal = usePortal();
  const role = normalizePortalRole(portal.role);
  const copy = ABOUT_COPY[role] || ABOUT_COPY.student;

  return (
    <LegalPageShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      updatedAt={copy.updatedAt}
      intro={copy.intro}
      contact={copy.contact}
    >
      {copy.sections.map((section) => (
        <LegalSection key={section.title} title={section.title}>
          {section.body}
        </LegalSection>
      ))}
    </LegalPageShell>
  );
}
