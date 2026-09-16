/*
  THE CASE LIBRARY.

  Why this is static content and not an application: the case library ships as
  software in December 2026, but the member pipeline runs in September. A case
  is a document. Published as pages, with claims made in person and tracked by
  officers, the pipeline runs a full semester without application code.

  The sealed solution is not modelled here on purpose. The organization's
  solution is held by the Lab and shared only with the Representative (Google
  Drive, single-person share, until the portal exists). Do not add a solution
  field to this file, and do not ship one to the client.

  CONTENTS (Kylar, 2026-08-17): two worked examples, both marked example on
  every surface. The first is drawn from real work the Lab built this summer,
  with details changed. The second is lighter and non-technical, so the
  library doesn't read as business majors only. Real cases arrive before the
  September 3 kickoff, seeded from the founder's summer work.

  Voice: brand spec §3, plus Kylar's 2026-08-17 direction: simple, humble,
  few sentences. STATUS: provisional pending Kylar's language pass.
*/

export interface CaseMetric {
  label: string;
  before: string;
  after: string;
}

export interface CasePackage {
  slug: string;
  /** Marks a worked example so it can never be mistaken for a claimable case. */
  isExample: boolean;
  title: string;
  /** Generic descriptor, never a real partner name until one has signed off. */
  org: string;
  domain: string;
  /** Rough size of the work, so a member can pick something they can finish. */
  scope: string;
  /** What a member should already be comfortable with. Deliberately low. */
  needs: string;
  summary: string;
  businessModel: string;
  problem: string[];
  dependencies: string[];
  solvingAchieves: string;
  constraints: string[];
  deliverable: string;
  /** The messy parts kept in on purpose. This is the point of the case. */
  mess: string[];
  status: "example" | "open" | "claimed" | "complete";
}

/** What every case package has to contain before it goes in the library. */
export const CASE_SCHEMA = [
  {
    field: "The organization",
    body: "How the organization works and what it cares about. Without this, you solve the wrong problem well.",
  },
  {
    field: "The problem",
    body: "Why the problem needed solving, in the words of someone who lived with it.",
  },
  {
    field: "Dependencies",
    body: "The specific constraints, including the systems in use, who touches the process, and what cannot change.",
  },
  {
    field: "What solving it achieves",
    body: "The result the organization was after, whether hours, accuracy, risk, or something else concrete.",
  },
  {
    field: "The sealed solution",
    body: "The organization's own answer, when they hold one. It stays sealed while you work, and your Representative opens it with you at the review, in person.",
  },
  {
    field: "Redactions",
    body: "Sensitive detail comes out before the case enters the library, not after.",
  },
] as const;

export const CASE_RUBRIC = [
  {
    criterion: "Problem understanding",
    body: "Did you solve the actual problem, including the parts nobody stated?",
  },
  {
    criterion: "Method",
    body: "Was the approach sound, and can you defend it?",
  },
  {
    criterion: "Effectiveness",
    body: "Would it hold up in the organization it was built for?",
  },
  {
    criterion: "Communication",
    body: "Can someone outside the room understand what it does and where it stops?",
  },
] as const;

export const cases: CasePackage[] = [
  {
    slug: "example-seasonal-budget",
    isExample: true,
    status: "example",
    title: "The budget that took weeks",
    org: "A seasonal business",
    domain: "Finance and operations",
    scope: "One semester, one member",
    needs: "Comfort with spreadsheets. No programming assumed.",
    summary:
      "Building the annual budget took weeks of copying between spreadsheets, and no two departments did it the same way.",
    businessModel:
      "The business runs a dozen departments whose staffing and costs swing with the season. Each department head builds a labor budget, and finance rolls them into one company plan. The budget decides hiring, so late or wrong numbers are expensive.",
    problem: [
      "Every department built its budget in its own spreadsheet, its own way. Some started from last year's file, some from scratch.",
      "Finance spent weeks reconciling formats before the numbers could even be compared.",
      "By the time the rollup was done, the early departments' assumptions were stale, and nobody was sure which file was current.",
    ],
    dependencies: [
      "Department heads are seasonal managers, not accountants. Whatever they use has to be simpler than what it replaces.",
      "Finance needs one consistent rollup at the end. That format is fixed, and the path to it is open.",
      "The company runs on spreadsheets and is not buying budgeting software.",
    ],
    solvingAchieves:
      "The rebuilt process finishes in days instead of weeks, and finance trusts the rollup enough to stop re-checking department math.",
    constraints: [
      "Spreadsheets only.",
      "Department heads get no training time. It has to be learnable in one sitting.",
      "Last year's numbers carry forward without retyping.",
    ],
    deliverable:
      "A working template system, and a short note on what it doesn't handle.",
    mess: [
      "Half the departments will say their case is special. Some of them are right.",
      "The slow step is not where people say it is. Finding it is part of the work.",
      "A version everyone tolerates beats a version one person loves.",
    ],
  },
  {
    slug: "example-orientation-inbox",
    isExample: true,
    status: "example",
    title: "The August inbox",
    org: "A campus office",
    domain: "Communication",
    scope: "Half a semester, one member",
    needs: "None. If you can write clearly, you can work this case.",
    summary:
      "Every August, one office answers the same few dozen questions hundreds of times, one email at a time.",
    businessModel:
      "The office serves incoming students, and August is its heaviest month, when families ask about deadlines, documents, and where to go. Every answer has to be right, and writing them by hand takes over the month.",
    problem: [
      "Most questions are versions of the same thirty or so.",
      "The answers exist, scattered across a website, two PDFs, and staff memory.",
      "In peak weeks, response time stretches to days, which produces more email asking why nobody answered.",
    ],
    dependencies: [
      "Answers must stay accurate when a deadline or room changes. A wrong answer is worse than a slow one.",
      "Staff must be able to see and correct what goes out.",
      "The office can't add software that stores student records.",
    ],
    solvingAchieves:
      "Same-day answers in August without adding staff, and staff time back for the questions that need a person.",
    constraints: [
      "No student personal data leaves office systems.",
      "A person stays in the loop. Nothing sends unreviewed.",
      "Plain email in, plain email out.",
    ],
    deliverable:
      "A drafting tool the office uses through August, and one page on where a person still has to decide.",
    mess: [
      "Nobody agrees on the right answer to some of the questions. Getting them written down is half the value.",
      "Some questions look routine and are not. Telling one from the other is the actual problem.",
    ],
  },
];

export function getCase(slug: string): CasePackage | undefined {
  return cases.find((c) => c.slug === slug);
}

/** Real, claimable cases. Empty until the library is seeded. */
export function claimableCases(): CasePackage[] {
  return cases.filter((c) => !c.isExample);
}
