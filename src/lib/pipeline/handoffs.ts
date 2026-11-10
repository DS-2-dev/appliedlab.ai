// What we tell people when the ball leaves their court (a confirmation before
// they act) and when it comes back (instructions for what to do next).
//
// Universal rule: no hand-off happens without the actor seeing, in order, what
// the system will do next. Every hand-off transition in machines.ts must have
// an entry in HANDOFF; tests enforce it.

export type CopyCtx = {
  /** A member's own project, with no partner. */
  selfDirected?: boolean;
  partner: string;
  member: string;
  posting: string;
  sealed?: boolean;
  affiliate?: boolean;
  firstPosting?: boolean;
  needsConsent?: boolean;
};

export type HandoffCopy = {
  title: string;
  lead?: string;
  steps: string[];
  note?: string;
  /** The label over the notes box, for a move that asks its own question. */
  prompt?: string;
  confirm: string;
};

export type NextStepsCopy = {
  tone: "good" | "warn" | "info";
  title: string;
  body?: string;
  steps: string[];
};

export const HANDOFF: Record<string, (c: CopyCtx) => HandoffCopy> = {
  // ------------------------------------------------------------ postings
  "posting.submit": (c) => ({
    title: "Send this posting to the Lab for review?",
    lead: "Here's what happens next.",
    steps: [
      "A faculty representative reads your posting before it goes on the notice board.",
      c.firstPosting
        ? "Since this is your first posting, a representative will reach out to learn more about what you need."
        : "If anything is unclear, a representative may message you with questions.",
      "When it's ready, they publish it to the notice board and you're notified. If it needs work, it comes back to you with notes.",
    ],
    note: "You can't edit while it's in review. Withdraw it if you need to make changes.",
    confirm: "Send for review",
  }),
  "posting.approve": (c) => ({
    title: "Publish to the notice board?",
    steps: [
      `“${c.posting}” goes live on the notice board. Every member can see and claim it.`,
      `${c.partner} is notified that it's live, along with any feedback you add.`,
      "Members who follow these disciplines are notified of a new posting.",
    ],
    confirm: "Publish",
  }),
  "posting.return": (c) => ({
    title: `Return to ${c.partner} with notes?`,
    steps: [
      `The posting goes back to ${c.partner}'s court with your notes.`,
      "They edit it and resubmit, and it comes back to this queue.",
    ],
    note: "Be specific. Your notes are the only thing they'll see.",
    confirm: "Return with notes",
  }),
  "posting.close": (c) => ({
    title: "Close this posting to new claims?",
    steps: [
      `“${c.posting}” comes off the notice board. No one new can claim it.`,
      "Members already working on it keep going, and you still receive their submissions.",
    ],
    note: "You can reopen it any time.",
    confirm: "Close posting",
  }),

  // ------------------------------------------------------------ projects
  "project.claim": (c) => ({
    title: `Claim “${c.posting}”?`,
    lead: "Claiming is free and open. Anyone can claim any posting.",
    steps: [
      "The project appears in your projects under Claimed.",
      "Next, write an action plan and lay out your milestones.",
      "When you submit the plan, a faculty representative reviews it. Approval makes the project active" +
        (c.affiliate ? " and makes you a Sponsored member." : "."),
    ],
    note: "Other members may claim the same posting. You'll work in parallel. That's normal.",
    confirm: "Claim",
  }),
  "project.submitPlan": (c) => ({
    title: "Submit your action plan for review?",
    lead: "The ball leaves your court. Here's what happens next.",
    steps: [
      "Your plan and milestones go to the faculty representatives. A snapshot is saved, so the review matches exactly what you sent.",
      "A representative approves the plan or returns it with notes.",
      c.selfDirected
        ? "If it's approved, the project becomes active. If it's returned, you'll see their notes and can resubmit."
        : `If it's approved, the project becomes active and ${c.partner} can follow your milestones. If it's returned, you'll see their notes and can resubmit.`,
    ],
    note: "You can keep editing while you wait, but the review covers the version you submit now.",
    confirm: "Submit plan",
  }),
  "project.approvePlan": (c) => ({
    title: "Approve this action plan?",
    steps: [
      `The project becomes active. ${c.member} is notified, along with your feedback.`,
      "Today's milestones become the baseline, and later changes are measured against it.",
      ...(c.selfDirected ? [] : [`${c.partner} can now follow the project's progress.`]),
      ...(c.affiliate ? [`${c.member} becomes a Sponsored member, and an admin task is created for their AI account.`] : []),
    ],
    confirm: "Approve plan",
  }),
  "project.returnPlan": (c) => ({
    title: `Return the plan to ${c.member}?`,
    steps: [
      `The plan goes back to ${c.member}'s court with your notes.`,
      "They revise it and resubmit, and it comes back to this queue.",
    ],
    note: "Say what would make it approvable.",
    confirm: "Return with notes",
  }),
  "project.submitWork": (c) => ({
    title: "Submit your project for review?",
    lead: "The ball leaves your court. Here's what happens next.",
    steps: [
      "Your submission goes to a faculty representative for review. A snapshot is saved.",
      "They may accept it or send it back with notes.",
      c.selfDirected
        ? "If it's accepted, the project is complete, and you can submit it to the public showcase."
        : `If it's accepted, it's delivered to ${c.partner}. ${c.partner} decides whether to follow up.`,
    ],
    note: "Before you submit, mark the milestones you finished and fill in your AI-use disclosure.",
    confirm: "Submit project",
  }),
  "project.approveWork": (c) =>
    c.selfDirected
      ? {
          title: "Approve this self-directed project?",
          steps: [`${c.member} is notified, along with your feedback.`, "There's no partner, so approval completes the project. It can then be submitted to the public showcase."],
          confirm: "Approve & complete",
        }
      : {
          title: `Approve and deliver to ${c.partner}?`,
          steps: [
            `${c.member} is notified, along with your feedback.`,
            `The submission is delivered to ${c.partner}'s portal, and they're notified. They can read it, but the work stays ${c.member}'s: they can't use it without an internship or an agreement with the student.`,
            ...(c.sealed ? [`${c.member} can now open ${c.partner}'s sealed solution in the secure viewer.`] : []),
          ],
          confirm: "Approve & deliver",
        },
  "project.returnWork": (c) => ({
    title: `Return the submission to ${c.member}?`,
    steps: [
      `The submission goes back to ${c.member}'s court with your notes.`,
      "They make the changes and resubmit, and it comes back to this queue.",
    ],
    note: "The partner doesn't see returned submissions.",
    confirm: "Return with notes",
  }),
  "project.integrate": (c) => ({
    title: `Bring ${c.member} on to implement this?`,
    lead: "This starts Phase 2, the integrated pipeline.",
    steps: [
      `This records that ${c.partner} is bringing ${c.member} on, as an intern, to implement the project. The terms of the internship are between you and the people you bring on. On a team, you choose who.`,
      `${c.member} sets implementation milestones here, and you and the representatives can follow progress.`,
      `${c.member} becomes a Builder. When the work is done, they'll ask you to confirm it's complete.`,
    ],
    confirm: "Start Phase 2",
  }),
  "project.requestCompletion": (c) => ({
    title: `Ask ${c.partner} to confirm the project is complete?`,
    steps: [
      `${c.partner} is asked to confirm that the implementation is done.`,
      "If they confirm, the project is complete. If not, it comes back to you with their notes.",
    ],
    confirm: "Request sign-off",
  }),
  "project.confirmCompletion": (c) => ({
    title: "Confirm the project is complete?",
    steps: [
      `The project is marked complete. ${c.member} and the representatives are notified.`,
      "It counts toward the member's record and, with your consent, can be showcased publicly.",
    ],
    confirm: "Confirm complete",
  }),
  "project.returnCompletion": (c) => ({
    title: `Send it back to ${c.member}?`,
    steps: [`The project returns to ${c.member} with your notes, and they keep working.`],
    confirm: "Send back",
  }),
  "project.withdraw": () => ({
    title: "Release your claim?",
    steps: [
      "The project moves to Withdrawn. Your milestones and history are kept for the record.",
      "The posting stays open for other members, and you can claim it again later.",
    ],
    prompt: "Why are you releasing this claim?",
    confirm: "Release claim",
  }),
  "project.reopen": (c) => ({
    title: "Reopen this project?",
    steps: [`The project goes back to where ${c.member}'s team left it, with its milestones and history.`, "The team is notified."],
    confirm: "Reopen",
  }),
};

/**
 * Shown to whoever holds the ball, keyed `${entity}.${status}.${role}`. The
 * latest gate feedback (if any) is shown above these steps.
 */
export const NEXT_STEPS: Record<string, (c: CopyCtx) => NextStepsCopy> = {
  "project.claimed.member": () => ({
    tone: "info",
    title: "Next: write your action plan",
    steps: [
      "Write your plan in the editor, upload a file, or link a Google Doc.",
      "Lay out major milestones, and nest the details under them.",
      "Submit the plan for review when it covers all nine parts of the guide.",
    ],
  }),
  "project.plan_review.member": () => ({
    tone: "info",
    title: "Your plan is with a representative",
    steps: ["Nothing to do until it comes back. You'll be notified either way."],
  }),
  "project.plan_returned.member": () => ({
    tone: "warn",
    title: "Your action plan came back with notes",
    steps: [
      "Read the representative's notes above.",
      "Go back and make the changes to your plan and milestones.",
      "Come back and resubmit. It returns to the same review queue.",
    ],
  }),
  "project.active.member": (c) => ({
    tone: "good",
    title: "Your plan is approved. Get to work.",
    steps: [
      "Log progress against your milestones as you go.",
      "When you learn something that changes the plan, change the milestones and say why. Every change is recorded.",
      c.selfDirected ? "When you're done, submit the project for review." : `When you're done, submit the project. ${c.partner} can follow your progress in the meantime.`,
    ],
  }),
  "project.submission_review.member": () => ({
    tone: "info",
    title: "Your submission is with a representative",
    steps: ["They'll approve it or send it back with notes. You'll be notified either way."],
  }),
  "project.submission_returned.member": () => ({
    tone: "warn",
    title: "Your submission came back with notes",
    steps: [
      "Read the representative's notes above.",
      "Go back and make the changes.",
      "Come back and resubmit when you're ready.",
    ],
  }),
  "project.delivered.member": (c) => ({
    tone: "good",
    title: `Your project has been submitted to ${c.partner}`,
    body: `${c.partner} reads your submission on their own schedule. If they're interested, they can ask to meet, and a representative will join. Meetings are at the partner's discretion, so a response isn't guaranteed. Either way, the work is yours: ${c.partner} can't use it without bringing you on or making an agreement with you.`,
    steps: [
      "Your project files stay private. You can choose to share them with the partner from this page.",
      "Consider submitting it to the public showcase so it appears on your profile.",
      "Pick it as your highlight project if you're proud of it.",
      ...(c.sealed ? [`${c.partner} left a sealed solution. You can open it in the secure viewer to compare approaches.`] : []),
    ],
  }),
  "project.integrated.member": (c) => ({
    tone: "good",
    title: "You're in the integrated pipeline",
    steps: [
      `Add implementation milestones for the work you're doing with ${c.partner}.`,
      "Keep logging progress. The representatives stay in the loop.",
      `When the implementation is done, ask ${c.partner} to sign off.`,
    ],
  }),
  "project.completion_review.member": (c) => ({
    tone: "info",
    title: `Waiting for ${c.partner} to sign off`,
    steps: ["You'll be notified when they respond."],
  }),
  "project.complete.member": (c) => ({
    tone: "good",
    title: c.selfDirected ? "Approved and complete" : "Complete",
    steps: ["Submit it to the showcase so the public can see what you built.", "Pick it as your highlight project if you're proud of it."],
  }),
  "project.delivered.partner": (c) => ({
    tone: "info",
    title: `New delivery from ${c.member}`,
    body: `A faculty representative reviewed and approved this work before it reached you. It belongs to ${c.member}: you can read it, but not use it without an internship or an agreement with them, process it with AI, or share it outside your organization.`,
    steps: [
      "Read the submission.",
      "Sort it in Deliveries (shortlist, meet, hold) to keep track.",
      "If you want to talk, request a meeting. There's no obligation.",
    ],
  }),
  "project.completion_review.partner": (c) => ({
    tone: "info",
    title: `${c.member} says the implementation is done`,
    steps: ["Confirm it's complete, or send it back with notes."],
  }),
  "posting.returned.partner": () => ({
    tone: "warn",
    title: "Your posting came back with notes",
    steps: ["Read the representative's notes above.", "Edit the posting.", "Send it for review again."],
  }),
  "posting.draft.partner": () => ({
    tone: "info",
    title: "This posting is a draft",
    steps: [
      "A title and a few sentences about the problem are enough to send it.",
      "Add detail, files or a sealed solution if you have them.",
      "Send it for review. A representative publishes it to the notice board.",
    ],
  }),
  "posting.in_review.partner": () => ({
    tone: "info",
    title: "A representative is reviewing your posting",
    steps: ["You'll be notified when it's live or if it needs changes."],
  }),
  "posting.live.partner": () => ({
    tone: "good",
    title: "Your posting is live",
    steps: [
      "Members can claim it now.",
      "You'll see each project once a representative approves its action plan.",
      "Approved submissions arrive in Deliveries.",
    ],
  }),
};
