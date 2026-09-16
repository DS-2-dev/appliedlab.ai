/*
  ALL site-chrome copy lives here, including the landing's three audience
  deals. Handbook body content lives in handbook.ts; case packages in
  cases.ts; showcase entries in the database.

  VOICE + CONTENT RULES: canonical in the lab-voice skill at
  .claude/skills/lab-voice/SKILL.md (repo root), which carries the 16 rules,
  the genre boundary, and the worked examples. copy-lint
  (scripts/copy-lint.mjs) is the mechanical arm and runs on every content
  file. The register in one line: a graduate writer explaining the Lab to a
  casual reader. Write to the skill, then run the lint.

  OWNERSHIP: the ownership and seal-optionality sentences published on /work,
  /partners, the case detail page, and the handbook instruments are
  commitments. Rephrase only without weakening them; the exact terms live in
  the skill.

  STATUS: PROVISIONAL, every string, pending Kylar's markup pass.
  Flags: [VERIFY disclaimer] footer.orgLine; [TAGLINE] hero.headline is the
  provisional tagline, overridden by the settings tagline when set.
*/

export const copy = {
  meta: {
    title: "Applied AI Lab at Weber State",
    description:
      "A student club at Weber State. Members build AI solutions to problems from local organizations. Weekly meetings in Shepherd Union. Any major.",
  },

  nav: {
    wordmark: "Applied AI Lab",
    wordmarkSuffix: "at Weber State",
    skipLink: "Skip to content",
    items: [
      { label: "For students", href: "/#for-students" },
      { label: "For faculty", href: "/#for-faculty" },
      { label: "For organizations", href: "/#for-organizations" },
      { label: "How it works", href: "/handbook" },
      { label: "The work", href: "/work" },
    ],
    // The three the header shows while the site is one page. They do not
    // navigate yet: each opens the construction notice below, and the href is
    // kept so they become ordinary links the day those pages go up.
    launchItems: [
      { label: "Work", href: "/work" },
      { label: "Handbook", href: "/handbook" },
      { label: "Join", href: "/join" },
    ],
    construction: {
      heading: "This page is still being built",
      body: "The landing page is what is ready today. This one goes up shortly, and the header will take you straight to it.",
      close: "Stay here",
    },
    cta: "Sign up",
    ctaHref: "/join",
    login: "Log in",
    loginHref: "/login",
    // Replace Log in and Sign up in the header once someone is signed in.
    dashboard: "Dashboard",
    dashboardHref: "/projectum",
    logout: "Log out",
    // In place of Log in on the static site, which has no accounts.
    demo: "Try Projectum",
  },

  hero: {
    eyebrow: "Applied AI Lab at Weber State",
    headline: "Build the thing in your head.",
    sub: "Everyone has ideas, and few have the skills to execute them. AI closes that gap. The Lab is where Weber State students close it, on problems organizations bring.",
    ctaPrimary: "Come to the next meeting",
    ctaSecondary: "See how it runs",
    // consolidated reassurance strip (2026-08-22 audit): the lines every
    // deciding student needed, on one screen instead of three page-bottoms
    facts: [
      "Any major.",
      "No experience needed.",
      "Meetings are free.",
      "A laptop helps but isn't required.",
      "The first weeks start from zero.",
    ],
  },

  howItWorks: {
    kicker: "How it works",
    heading: "Problem. Build. Review. Show.",
    intro:
      "Here is the whole thing in one breath. A member takes one problem and works it for a semester, start to finish.",
    steps: [
      // `body` is the longer half, recovered from earlier versions of the
      // site (commits 4521e21 and bfe8632) where each step had more than one
      // line: the sealed-solution promise on 01, the two halves of a meeting
      // on 02, the rubric on 03, and the showcase's own paragraph on 04.
      {
        id: "problem",
        num: "01",
        title: "Start with a problem",
        caption:
          "Bring one from your own life or work, or claim a case, which is a problem a local organization brings us.",
        body:
          "A case is a problem a local organization brings, and any solution they already hold stays sealed until your review, so what you build is judged on its own.",
      },
      {
        id: "build",
        num: "02",
        title: "Build in the room",
        caption:
          "Each meeting opens with one short skill, and the rest of the hour is yours, with help beside you.",
        body:
          "We open by taking one real problem apart from start to finish, so you see the whole shape of a build before touching your own. The rest of the meeting belongs to your project. You build, and we walk the room and help you get unstuck.",
      },
      {
        id: "review",
        num: "03",
        title: "Face the review",
        caption:
          "A faculty member rates the finished work on four criteria and talks it through with you in person.",
        body:
          "The four are the same every time and published in advance, so you know what you are being read against before you start rather than after you finish.",
      },
      {
        id: "showcase",
        num: "04",
        title: "Show it in public",
        caption:
          "The semester ends with a public showcase where members present what they built.",
        body:
          "Members present working tools to the organizations that asked for them, and to anyone curious. It is open, and it is the end of the line every project is built toward.",
      },
    ],
    fullLink: "The whole design, in one place",
  },

  // The short club description Kylar asked for (2026-09-01), sitting between
  // the four steps and the pipelines. Every line of its body is already
  // written: the definition, what you get, and what it asks all come from the
  // students block, so the landing and the member deal cannot drift apart.
  clubShort: {
    kicker: "What we do",
    heading: "We connect classrooms to real work",
    // The card's two halves. Both are one card as of 2026-09-02, so each half
    // needs its own name or the deal reads as a continuation of the
    // description rather than a separate promise.
    subheading: "What the Lab is",
    dealSubheading: "What membership is",
    // The three paragraphs are the first site's, recovered from commit
    // bfe8632, where this was the club's own description. Three edits, all
    // for copy-lint: "Lab" cased to match the site, the two prose colons
    // rewritten, and the bare "December" given its year.
    paragraphs: [
      "Weber State students are learning AI tools faster than any syllabus can keep up with. Local organizations are sitting on problems they would love to hand somebody. The Lab puts the two in the same room.",
      "A business brings us something real. A student takes it on and spends the semester building a working solution with modern AI tools, automated workflows for instance, which are multi-step tasks a computer runs on its own. Weekly meetings are where the building happens. A monthly social keeps it human. The showcase in December 2026 is where everything lands in public.",
      "The format got a test run before launch. While road-testing it, the founder built a route planner for a working business in about two weeks, and rebuilt a budget process that used to take weeks into one that finishes in days. Both are still running. That is the bar for a Lab project. It has to run.",
    ],
  },

  thisFall: {
    kicker: "This semester",
    heading: "Week by week",
    intro: "Rooms can change, and each meeting's room is posted here.",
    todayLabel: "today",
    milestones: [
      {
        id: "blockparty",
        date: "2026-08-28",
        dateLabel: "Fri Aug 28",
        title: "Wildcat Block Party",
        note: "Find our table. 8 am to 2 pm on campus.",
      },
      {
        id: "kickoff",
        date: "2026-09-03",
        dateLabel: "Thu Sep 3",
        title: "Kickoff",
        note: "What the Lab is, how the semester runs, how to start a project.",
      },
      {
        id: "weekly",
        date: null,
        dateLabel: "Sep to Dec",
        title: "Weekly workshops",
        note: "One off-campus social a month.",
      },
      {
        id: "thanksgiving",
        date: "2026-11-26",
        dateLabel: "Thu Nov 26",
        title: "No meeting",
        note: "Thanksgiving.",
      },
      {
        id: "showcase",
        date: "2026-12-03",
        dateLabel: "Thu Dec 3",
        title: "Public showcase",
        note: "Members present finished work in public.",
      },
    ],
    roomFallback: "Shepherd Union, room posted here",
    joinHeading: "Joining",
    joinBody: "Meetings are free for students and faculty.",
    joinFacts: "A laptop helps but isn't required.",
    fundedLine: "Members with an active project get a Claude account funded by the Lab. Claude is the AI assistant members build with, made by Anthropic.",
    joinCta: "Get the kickoff reminder",
  },

  // ------------------------------------------------------------------ /join

  join: {
    meta: { title: "Join" },
    kicker: "Welcome",
    heading: "Join the Lab",
    lede: "Membership is showing up, and meetings are free.",
    whatToBring: "A laptop helps but isn't required. The first weeks start from zero.",
    formHeading: "Leave your name",
    formIntro:
      "Rooms can change from week to week. Leave your name and we'll send the kickoff reminder and each week's room, and we'll know to look for you.",
    fields: {
      name: { label: "Your name" },
      email: { label: "Email", help: "Reminders and rooms only. We don't share it." },
      major: { label: "Major or college (optional)" },
    },
    submit: "Send",
    successHeading: "You're on the list",
    successBody: "We'll look for you at the next meeting.",
    duplicateMsg: "You're already on the list.",
    // The QR scan switch: one page captures every kind of visitor, and the
    // escape is a plain link, never a gate.
    audience: {
      label: "I'm here as",
      options: [
        { id: "student", label: "A student" },
        { id: "faculty", label: "Faculty" },
        { id: "organization", label: "An organization" },
      ],
    },
    roleLinks: {
      student: { label: "What membership involves", href: "/#for-students" },
      faculty: { label: "What the Representative role involves", href: "/#for-faculty" },
      organization: { label: "How partnering works", href: "/#for-organizations" },
    },
    justLooking: { text: "Just looking?", cta: "See the Lab" },
  },

  nextMeeting: {
    kicker: "Next meeting",
    // rendered from settings.meeting_schedule, so prose stays weekday-free
    cadence: "The Lab meets {schedule} in Shepherd Union.",
    calendarLead: "Put it on your calendar:",
    semesterCta: "The whole semester (.ics)",
  },

  calendar: {
    addGoogle: "Google Calendar",
  },

  statusKey: {
    label: "The markers",
    items: ["Running now", "This semester", "Planned, designed with the build ahead"],
  },

  theWork: {
    kicker: "The work",
    heading: "Built here, still running",
    intro:
      "Two tools built while testing the format are in use today. The record shows what got built, who built it, and whether it still runs.",
    recordNote: "Member work joins after faculty review. The founder built these two while testing the format.",
    cta: "See the work",
  },

  // The close of the landing: purpose, vision, people (2026-08-22, moved
  // from the retired /about; the statement is the master plan's, verbatim)
  close: {
    kicker: "Purpose",
    statement: "To bring people together, ask hard questions, and elevate everyone involved.",
    belonging: "Every college and every discipline at Weber State belongs here.",
    vision: "To build a model that transforms America's student-employer working relationships.",
    peopleHeading: "Student led, with faculty backing",
    people: [
      {
        name: "Gavin Roberts",
        role: "Advisor",
        detail: "Chair of Economics, Goddard School of Business and Economics.",
      },
      {
        name: "Kylar Vierra",
        role: "President",
        detail: "Founder. Runs the weekly meetings and builds alongside members.",
      },
    ],
    officersNote: "Officer roles are open this semester. Ask at a meeting.",
    horizon:
      "If this works, freshmen will be building real solutions and standing out to businesses before they graduate. High-impact, kind, highly valuable people that everyone wants to work with.",
    whyCta: { label: "Why it runs this way", href: "/handbook#why" },
  },

  // ------------------------------------------------------------------ /work

  work: {
    meta: { title: "The work" },
    kicker: "The work",
    heading: "The library and the record",
    lede: "The case library holds problems to work on, and the record holds what has been built.",
    statusLine: "The first claimable cases go up before the kickoff.",

    libraryKicker: "The library",
    libraryHeading: "Cases to work from",
    libraryLede:
      "A case is a problem an organization brought in and allowed us to package. When they hold a solution of their own, it stays sealed while you work, so you face the problem the same way they did.",
    exampleNote:
      "These two are examples of the format. The first draws on the Lab's own summer work with the details changed, and neither is claimable.",
    exampleBadge: "Example, not claimable",
    openHeading: "Ready to claim",

    howKicker: "How a case works",
    sealedHeading: "Sealed until your review",
    sealedBody:
      "When the organization holds a solution of its own, it stays sealed while you work. Your Representative opens it with you at the review and sets it beside yours, so the comparison happens after you have committed to an approach.",
    sealedCustody:
      "Until the portal exists, a sealed solution lives in a drive folder only the reviewing Representative can open.",
    aiBoundary:
      "The case write-up itself is working material. After redaction, members build against it with AI tools. The sealed solution never touches those tools.",
    ownershipHeading: "Who owns what",
    ownershipSealed:
      "The sealed solution is the Partner's property. Your Representative shows it once, in person, at your review, and it is never shared beyond that meeting or processed by AI.",
    ownershipMember:
      "The solution you build is yours. It appears in the Partner's view and at the showcase under your name, and a Partner who wants to use it makes an agreement with you.",
    schemaHeading: "What a case package contains",
    rubricHeading: "How finished work is rated",
    rubricBody:
      "A Representative rates finished casework from 1 to 5 on four criteria, and written feedback comes with the rating. The two of you then meet in person for thirty minutes, and the organization's solution comes out for comparison.",
    claimHeading: "Claiming one",
    claimBody:
      "Come to a meeting and say which case you want. Cases are worked solo by default, and a Representative can approve a pair on a large one. A project of your own works the same way, so write it up and start.",

    recordKicker: "The record",
    recordHeading: "Finished work",
    recordLede: "The record shows finished work, who built it, and whether it still runs.",
    memberNote:
      "Member work joins after the first review round. Each published piece shows the following.",
    memberOwnLine:
      "Members own what they build, and a Partner who wants to use a member's solution makes an agreement with that member.",
    founderNote:
      "The founder built both of these while testing the format, before the Lab opened. They carry no faculty rating, and both are in use.",
    showcaseEventLine: "The semester closes with a public showcase in Shepherd Union.",
    runningLabel: "Still in use",
    limitsLabel: "What it doesn't do",
    ratingLabel: "Faculty rating",
    unratedLabel: "Not faculty rated",
    partnerUnnamed: "Organization not named",
  },

  // ------------------------------------------------------ /cases/[slug]

  caseDetail: {
    backTo: "The library",
    fields: {
      org: "Organization",
      domain: "Domain",
      scope: "Scope",
      needs: "What you need coming in",
      businessModel: "The organization",
      problem: "The problem",
      dependencies: "Constraints and dependencies",
      achieves: "What solving it achieves",
      constraints: "Hard limits",
      deliverable: "What you hand in",
      mess: "What is deliberately unresolved",
      sealed: "The organization's own solution",
    },
    sealedNote:
      "Your Representative opens it with you at the review, in person. It remains the Partner's property, and it is never shared beyond that meeting or processed by AI.",
    claimHeading: "Claiming",
    claimBody: "Come to a meeting and say you want this one.",
    partnerCta: { text: "Run an organization with a problem like this one?", label: "Bring it to us", href: "/#for-organizations" },
  },

  // ------------------------------------------------------------- /handbook

  handbookPage: {
    backToTop: "Back to top",
    contentsHeading: "Contents",
    sourceNote: "Last updated August 19, 2026.",
  },

  // -------------------------------------------------------------- /faculty

  // The deals render as landing sections (2026-08-22); /join consumes
  // faculty.start and partners.start for its forms.
  // The three deals (2026-08-22): each audience's complete offer, rendered
  // as landing sections. The /join forms consume faculty.start and
  // partners.start unchanged. Role pages are retired.
  students: {
    id: "for-students",
    label: "For students",
    heading: "Members",
    definition:
      "A member takes one problem from a first plan to a working tool, with the Lab's tools and help in the room. Any major qualifies, and membership is showing up.",
    doBlock: {
      heading: "What you do",
      items: [
        {
          title: "Pick the problem",
          body: "Bring one from your own life or work, or claim a case. Either counts, and either activates your funded Claude account. Claude is the AI assistant members build with, made by Anthropic.",
        },
        {
          title: "Build until it works",
          body: "Write a short plan of action first, and an officer helps with your first one. Then build, week after week, until someone else can use what you made.",
        },
      ],
    },
    ladderHeading: "The ladder",
    ladderLede: "Involvement is a ladder with published gates. Meet the bar and you climb.",
    getBlock: {
      heading: "What you get",
      body: "You leave with a working tool, the story of how you built it, and a faculty rating that says what it holds. The boat can have holes in it. It has to float, and you learn why it floats.",
    },
    asks: {
      heading: "What the role asks",
      body: "Showing up is the whole cost. Staying on the ladder takes an active project and 60% attendance at the weekly meetings, and membership is free.",
    },
    protections: [
      "The solution you build is yours. It appears in the Partner's view and at the showcase under your name, and a Partner who wants to use it makes an agreement with you.",
      "A rating always comes with written feedback and a thirty-minute debrief, and more than one faculty member can rate the same work.",
    ],
    ask: { label: "Leave your name", href: "/join" },
  },

  faculty: {
    id: "for-faculty",
    label: "For faculty",
    heading: "Representatives",
    definition:
      "A Representative reviews finished member work in their own field and connects the Lab to organizations they know. The role is smaller than it sounds, and any college, department, or club at Weber State can hold one.",
    doBlock: {
      heading: "What you do",
      intro: "The role has two parts, and the second is the larger one.",
      items: [
        {
          title: "Package a case",
          body: "Work with an organization in your field to write up a problem they bring. You capture the situation, the constraints, and what a solution has to achieve, and any solution of theirs is sealed until review.",
        },
        {
          title: "Review finished work",
          body: "Rate finished casework from 1 to 5 on four criteria and write the feedback that goes with the rating. You then meet the student in person for thirty minutes and compare their approach with the organization's.",
        },
        {
          title: "Later, live projects",
          planned: true,
          body: "Once live projects open, Representatives also review plans of action, hold monthly check-ins, and act as liaison between Partner and Member. Joining that half stays your choice.",
        },
      ],
    },
    rubricHeading: "The four criteria",
    numbers: {
      heading: "The semester, in numbers",
      // [VERIFY] Kylar to set N reviews, hours, and landing weeks; until
      // then this states the mechanism honestly without inventing figures.
      body: "The first semester's numbers are being set with the first Representatives. You name your own cap in the form, reviews batch into blocks you schedule, and past your cap the Lab recruits a second Representative.",
      links: [
        { label: "See the case package that lands on your desk", href: "/cases/example-seasonal-budget" },
      ],
    },
    getBlock: {
      heading: "What you get",
      body: "You see what students in your field produce when handed an open problem and AI tools. What you observe feeds directly into what you teach.",
    },
    protections: [
      "Your review load stays fixed, batched into blocks you schedule.",
      "If your field produces more work than one person can review, the Lab recruits a second Representative.",
    ],
    ask: { label: "Tell us your field", href: "/join?as=faculty" },
    start: {
      kicker: "Next step",
      heading: "Tell us your field",
      kind: "representative",
      mailSubject: "Representative interest",
      formIntro:
        "Tell us your field and roughly what you could take on. We reply within {days} business days.",
      fields: {
        org: {
          label: "Department, college, or program",
          help: "Where you sit at Weber State.",
        },
        contact: { label: "Your name" },
        email: { label: "Email", help: "Where the reply goes. We don't share it." },
        problem: {
          label: "What could you take on?",
          help: "Reviewing casework, packaging a case with an organization you know, or both. Rough is fine.",
        },
      },
      submit: "Send",
      successHeading: "Got it",
      successBody:
        "We reply within {days} business days. If email is easier, write to ailab@weber.edu.",
    },
  },

  partners: {
    id: "for-organizations",
    label: "For organizations",
    heading: "Partners",
    definition:
      "A Partner brings the Lab one problem, solved or still open. Members work it from scratch, beside your business and never inside it, and any solution you hold stays sealed until the review.",
    heroNote: "The Lab is new. Fall 2026 is the first semester, and early partners shape how it runs.",
    give: {
      heading: "What you give",
      body: "The ask is one problem, described once. We capture the situation, the constraints, and what a solution has to achieve, and any solution of your own is sealed at intake.",
      timeLine:
        "One conversation starts it. Sensitive detail comes out before the case enters the library, and after that there is no fee and no contract. Expect an occasional question from the member working your case, and little else.",
    },
    steps: [
      { title: "Tell us the problem", note: "The form takes about five minutes." },
      { title: "We talk", note: "Half an hour on what can be shared and what comes out." },
      { title: "We package and seal", note: "A Representative writes it up. Your solution is sealed." },
      { title: "Students work it", note: "From scratch, through the semester." },
      { title: "You see what came back", note: "Rated work, and the end-of-semester showcase if you'd like to come." },
    ],
    youAreHere: "start here",
    info: {
      heading: "What happens to your information",
      lines: [
        "Sensitive detail comes out before the case enters the library, not after, and you decide what can be shared in the packaging conversation.",
        "After redaction, the case write-up is working material that members build against with AI tools. Your sealed solution never touches those tools.",
        "Your solution sits in the drawer the whole time, and it comes out once, in person, at the review, after the member has committed to an approach.",
        "Until the portal exists, the sealed file lives in a drive folder only your Representative can open.",
        "The sealed solution remains your property. Your Representative shows it once, in person, at the faculty review, and it is never shared beyond that meeting or processed by AI.",
      ],
    },
    getBlock: {
      heading: "What you get",
      body: "You see how students approach a problem you know well, and you meet the ones whose work stands out. What comes back is evidence of what students can do with AI in your domain, on a problem you set.",
      ownLine:
        "The student's solution remains theirs in the same way. It appears in your view and at the showcase under their name, and using it starts with an agreement between you and the member.",
      agreementLine:
        "That agreement can be as small as a conversation, and the Lab sits in when you want it there.",
    },
    checker: {
      heading: "Is it a case?",
      intro: "Three questions.",
      questions: [
        "Does it cost you real time or money?",
        "Can it be described without giving away secrets?",
        "Could someone outside your walls work on it beside you?",
      ],
      yes: "Yes",
      no: "No",
      allYes: "That's a case. Send it.",
      someNo: "Send it anyway, and the conversation will sort it out.",
      idle: "Answer all three.",
    },
    ask: { label: "Send us the problem", href: "/join?as=organization" },
    start: {
      kicker: "Next step",
      heading: "Send us the problem",
      kind: "casework",
      mailSubject: "Partner inquiry",
      formIntro: "We reply within {days} business days.",
      fields: {
        org: {
          label: "Organization",
          help: "Business, nonprofit, university entity, or another club.",
        },
        contact: { label: "Your name" },
        email: { label: "Email", help: "Where the reply goes. We don't share it." },
        problem: {
          label: "What's the problem?",
          help: "Plain words are perfect. What breaks, what does it cost, and what have you tried?",
        },
      },
      submit: "Send",
      successHeading: "Got it",
      successBody:
        "We reply within {days} business days. If email is easier, write to ailab@weber.edu.",
    },
  },

  footer: {
    contactHeading: "Talk to us",
    email: "ailab@weber.edu",
    accommodations:
      "Contact the Applied AI Lab at ailab@weber.edu to request accommodations in relation to a disability.",
    // [VERIFY disclaimer] exact required wording pending from Student Involvement
    orgLine: "Applied AI Lab at Weber State, a student organization.",
    linksHeading: "The Lab",
    links: [
      { label: "For students", href: "/#for-students" },
      { label: "For faculty", href: "/#for-faculty" },
      { label: "For organizations", href: "/#for-organizations" },
      { label: "How it works", href: "/handbook" },
      { label: "The work", href: "/work" },
      { label: "Purpose", href: "/#purpose" },
    ],
  },

  forms: {
    requiredError: "This one's required.",
    emailError: "That email doesn't look complete.",
    rateLimited: "Too many submissions from this connection. Try again in an hour, or email ailab@weber.edu.",
    genericError: "Something broke on our end. Email us at ailab@weber.edu instead.",
    emailFallbackNote: "Form storage isn't live yet, so the button opens a ready-to-send email instead.",
    sending: "Sending...",
  },

  notFound: {
    line: "There's nothing at this address.",
    cta: "Back to the Lab",
  },


  // Accounts (2026-09-11). Open to Weber State addresses, by Google or by
  // email and password. Microcopy throughout, so fragments are fine; the
  // bans still apply.
  auth: {
    login: {
      title: "Log in",
      heading: "Log in to the Lab",
      body: "Use your Weber State Google account, or the email and password you signed up with.",
      submit: "Log in",
      pending: "Logging in",
      forgot: "Forgot your password?",
      switchPrompt: "New to the Lab?",
      switchCta: "Create an account",
    },
    signup: {
      title: "Create an account",
      heading: "Create your Lab account",
      body: "Accounts are open to Weber State students, faculty and staff with a university email.",
      submit: "Create account",
      pending: "Creating your account",
      switchPrompt: "Already have an account?",
      switchCta: "Log in",
      checkHeading: "Check your inbox",
      checkBody: "We sent a confirmation link to {email}. Open it to finish creating your account.",
    },
    forgot: {
      title: "Reset your password",
      heading: "Reset your password",
      body: "Enter the email on your account and we'll send a link to choose a new password.",
      submit: "Send reset link",
      pending: "Sending",
      sentHeading: "Check your inbox",
      sentBody: "If an account uses {email}, a reset link is on its way.",
      back: "Back to log in",
      // Local preview only: nothing sends email, so the link is shown instead.
      devNote: "This is the local preview, so no email goes out.",
      devLink: "Open the reset link",
    },
    reset: {
      title: "Choose a new password",
      heading: "Choose a new password",
      body: "Pick something you haven't used here before.",
      submit: "Save password",
      pending: "Saving",
      expired: "That reset link has expired or was already used.",
      requestNew: "Request a new link",
    },
    fields: {
      name: { label: "Full name" },
      email: { label: "Email", help: "Your @weber.edu or @mail.weber.edu address." },
      password: { label: "Password" },
      newPassword: { label: "New password", help: "At least 8 characters." },
      show: "Show password",
      hide: "Hide password",
    },
    google: "Continue with Google",
    googleUnavailable:
      "Google sign-in turns on once the Lab's Supabase project is connected. Email and password work in this preview.",
    divider: "or",
    projectumDemo: "Projectum demo",
    errors: {
      emailRequired: "Enter your email.",
      emailInvalid: "Enter a valid email address.",
      emailDomain: "Use your Weber State email, ending in @weber.edu or @mail.weber.edu.",
      passwordRequired: "Enter your password.",
      passwordShort: "Use at least 8 characters.",
      passwordLong: "Use 72 characters or fewer.",
      nameRequired: "Enter your name.",
      badCredentials: "That email and password don't match an account.",
      unconfirmed: "Confirm your email first. The link is in your inbox.",
      exists: "An account already uses that email. Log in instead.",
      rateLimited: "Too many attempts. Wait a few minutes and try again.",
      generic: "Something went wrong on our end. Try again in a moment.",
      googleDomain: "Google sign-in is for Weber State accounts. Choose your university account and try again.",
      googleFailed: "Google sign-in didn't finish. Try again.",
      linkExpired: "That link has expired or was already used. Request a new one.",
      samePassword: "Choose a password you haven't used here before.",
      removed: "This account has been turned off. Write to ailab@weber.edu if that looks wrong.",
      googleUnavailable: "Google sign-in isn't connected in this preview yet. Use email and password.",
    },
  },

  // The one signed-in page, a placeholder until its contents are decided.
  projectum: {
    title: "Projectum",
    // Beside the logo at the top of the sidebar.
    brandName: "Projectum",
    // Two cards at the foot of the sidebar, above the profile. Resources
    // leaves Projectum, so its arrow points out. Attendance holds the QR
    // code members scan at meetings, a placeholder until the code exists.
    resources: {
      title: "Resources",
      description: "Guides, practice and reading to strengthen your skills with AI.",
      href: "/handbook",
    },
    attendance: {
      title: "Meeting attendance",
      description: "Scan at each meeting to check in.",
      placeholder: "QR code placeholder",
    },
    projects: "All Projects",
    yourProjects: "Your Projects",
    // The Agents tab, below All Projects, empty until agents arrive.
    agents: {
      title: "Agents",
      description: "The agents you build, in one place.",
      empty: "Agents you build will show up here.",
    },
    addProject: "Add Project",
    addProjectDescription: "Name the idea, give it a thumbnail, link its meeting notes doc and add the people working on it.",
    createProject: "Create project",
    cancel: "Cancel",
    // The Add Project form. Microcopy.
    form: {
      namePlaceholder: "Study room finder",
      thumbnail: "Thumbnail",
      thumbnailHelp: "Required. PNG, JPG, WebP or GIF.",
      thumbnailPick: "Choose an image",
      thumbnailChange: "Change image",
      description: "Description of the idea",
      descriptionPlaceholder: "What it does and who it helps.",
      notes: "Meeting notes doc",
      notesHelp: "Required. A Google Doc for meeting notes and anything else the team keeps.",
      notesPlaceholder: "https://docs.google.com/document/d/...",
      people: "People involved",
      addPerson: "Add person",
      everyoneAdded: "Everyone is added",
      removePerson: "Remove",
      noPeople: "No one added yet.",
      editTitle: "Edit project",
      editDescription: "Update the name, thumbnail, description, notes doc and people.",
      save: "Save changes",
      peopleInPlan: "People and roles are edited in the plan.",
      errors: {
        name: "Enter a project name.",
        thumbnail: "Add a thumbnail image.",
        thumbnailType: "Choose an image file.",
        thumbnailRead: "That image could not be read. Try another.",
        notes: "Enter a Google Doc link, such as https://docs.google.com/document/d/your-doc.",
      },
    },
    // The people Add person offers until accounts can be searched. Made up.
    demo: {
      directory: ["Avery Chen", "Jordan Patel", "Sam Rivera", "Taylor Brooks", "Riley Nguyen", "Morgan Lee"],
      // Sample projects for All Projects, shown until more teams add theirs.
      // Made up, and marked Sample on their cards. Each carries what its
      // stage needs, in the shape a real project takes: people by name with
      // a role once past Brainstorming, step owners and credits by name,
      // builds oldest first. Placeholder links only.
      samples: [
        {
          name: "Quiet Room Map",
          stage: "live",
          icon: "map",
          notesUrl: "https://docs.google.com/document/d/sample-quiet-room-map",
          description: "A campus map of open study rooms, updated from the library's room sensors.",
          people: [
            { name: "Avery Chen", role: "manager" },
            { name: "Jordan Patel", role: "backend" },
            { name: "Sam Rivera", role: "uiux" },
          ],
          plan: {
            thesis:
              "Students walk between buildings looking for a free study room. Quiet Room Map shows which rooms are open right now, using the occupancy sensors the library already runs.",
            reasoning:
              "The sensor data already exists, so the work is a clear map and a reliable feed. A small team can ship it in a semester and test it in one building first.",
            techStack: "Next.js, Supabase, Library sensor feed",
            steps: [
              { text: "Map the rooms in the main library", owner: "Avery Chen" },
              { text: "Connect the sensor feed", owner: "Jordan Patel" },
              { text: "Design and test the map screen", owner: "Sam Rivera" },
            ],
          },
          prototype: {
            githubUrl: "https://github.com/sample-lab/quiet-room-map",
            supabase: true,
            builds: [
              { note: "", techStack: "Next.js, Postgres, Library sensor feed", at: "2026-06-02T16:00:00.000Z" },
              {
                note: "Moved room status to Supabase realtime, so the map updates without a refresh.",
                techStack: "Next.js, Supabase, Library sensor feed",
                at: "2026-06-23T16:00:00.000Z",
              },
              {
                note: "Added filters for rooms with outlets and whiteboards after student testing.",
                techStack: "Next.js, Supabase, Library sensor feed",
                at: "2026-07-14T16:00:00.000Z",
              },
            ],
          },
          launch: {
            siteUrl: "https://quiet-room-map.example.edu",
            slidesUrl: "https://slides.example.com/quiet-room-map",
            demoUrl: "https://video.example.com/quiet-room-map",
            at: "2026-08-04T16:00:00.000Z",
            contributions: {
              "Avery Chen": "Ran the plan and check-ins and presented the launch.",
              "Jordan Patel": "Connected the sensor feed and built the realtime room service.",
              "Sam Rivera": "Designed the map screen and ran two rounds of student testing.",
            },
          },
        },
        {
          name: "Advising Queue",
          stage: "prototype",
          icon: "clock",
          notesUrl: "https://docs.google.com/document/d/sample-advising-queue",
          description: "Students join the advising line from their phone and get a text when their turn comes.",
          people: [
            { name: "Taylor Brooks", role: "manager" },
            { name: "Riley Nguyen", role: "frontend" },
          ],
          plan: {
            thesis:
              "Students wait in the advising hallway with no sense of how long the line is. Advising Queue lets them join from their phone and texts them when their turn comes.",
            reasoning:
              "The advising office already logs every visit in a spreadsheet. A text alert frees students to study while they wait, and staff see the whole line at once.",
            techStack: "Next.js, Postgres, SMS gateway",
            steps: [
              { text: "Interview advising staff about peak hours", owner: "Taylor Brooks" },
              { text: "Build the join screen and the queue view", owner: "Riley Nguyen" },
            ],
          },
          prototype: {
            githubUrl: "https://github.com/sample-lab/advising-queue",
            supabase: false,
            builds: [
              { note: "", techStack: "Next.js, Postgres, SMS gateway", at: "2026-07-20T16:00:00.000Z" },
              {
                note: "Added the staff view that calls the next student and sends the text.",
                techStack: "Next.js, Postgres, SMS gateway",
                at: "2026-08-10T16:00:00.000Z",
              },
            ],
          },
        },
        {
          name: "Lab Inventory Assistant",
          stage: "solidifying",
          icon: "boxes",
          notesUrl: "https://docs.google.com/document/d/sample-lab-inventory-assistant",
          description: "A chat assistant that tells members which lab equipment is free and where it is kept.",
          people: [
            { name: "Morgan Lee", role: "data" },
            { name: "Jordan Patel", role: "backend" },
          ],
          plan: {
            thesis:
              "Members spend time hunting for lab equipment that someone else has checked out. A chat assistant answers where each item is and who has it, straight from the inventory sheet.",
            reasoning:
              "The inventory sheet is already kept up to date, so the assistant only has to read it well. Equipment questions are the most common messages in the lab channel.",
            techStack: "Python, FastAPI, Inventory sheet",
            steps: [
              { text: "Clean up the inventory sheet columns", owner: "Morgan Lee" },
              { text: "Build the chat endpoint", owner: "Jordan Patel" },
            ],
          },
        },
        {
          name: "Syllabus to Calendar",
          stage: "brainstorming",
          icon: "calendar",
          notesUrl: "https://docs.google.com/document/d/sample-syllabus-to-calendar",
          description: "Turns a course syllabus into calendar events for every due date and exam.",
          people: [{ name: "Riley Nguyen" }],
        },
        {
          name: "Pantry Stock Tracker",
          stage: "prototype",
          icon: "basket",
          notesUrl: "https://docs.google.com/document/d/sample-pantry-stock-tracker",
          description: "Tracks food pantry stock and flags items likely to run out before the next delivery.",
          people: [
            { name: "Sam Rivera", role: "uiux" },
            { name: "Morgan Lee", role: "data" },
            { name: "Avery Chen", role: "manager" },
          ],
          plan: {
            thesis:
              "The campus food pantry runs short of staples between deliveries because stock is counted by hand. The tracker logs what goes out and flags items likely to run out.",
            reasoning:
              "Volunteers already record every checkout on paper. Moving that log to a tablet turns the same effort into a forecast for the next order.",
            techStack: "Next.js, Supabase, Tablet checkout form",
            steps: [
              { text: "Design the tablet checkout form", owner: "Sam Rivera" },
              { text: "Build the run-out forecast", owner: "Morgan Lee" },
              { text: "Set up weekly check-ins with the pantry lead", owner: "Avery Chen" },
            ],
          },
          prototype: {
            githubUrl: "https://github.com/sample-lab/pantry-stock-tracker",
            supabase: true,
            builds: [
              { note: "", techStack: "Next.js, Supabase", at: "2026-07-01T16:00:00.000Z" },
              {
                note: "Replaced the paper log with the tablet form at the pantry desk.",
                techStack: "Next.js, Supabase, Tablet checkout form",
                at: "2026-07-22T16:00:00.000Z",
              },
              {
                note: "Added a weekly forecast email for the pantry lead.",
                techStack: "Next.js, Supabase, Tablet checkout form",
                at: "2026-08-12T16:00:00.000Z",
              },
            ],
          },
        },
        {
          name: "Tutor Match",
          stage: "brainstorming",
          icon: "users",
          notesUrl: "https://docs.google.com/document/d/sample-tutor-match",
          description: "Pairs students with peer tutors by course, schedule and how they like to meet.",
          people: [{ name: "Taylor Brooks" }, { name: "Avery Chen" }],
        },
        {
          name: "Parking Pulse",
          stage: "live",
          icon: "car",
          notesUrl: "https://docs.google.com/document/d/sample-parking-pulse",
          description: "Shows how full each campus lot is from gate counts, so students know before they drive in.",
          people: [
            { name: "Jordan Patel", role: "backend" },
            { name: "Riley Nguyen", role: "frontend" },
            { name: "Taylor Brooks", role: "communication" },
            { name: "Morgan Lee", role: "qa" },
          ],
          plan: {
            thesis:
              "Commuters circle full lots before class while open spaces sit elsewhere on campus. Parking Pulse shows how full each lot is, using the gate counters already installed.",
            reasoning:
              "Parking services shared the gate counts, which update every minute. A page that loads fast on a phone gives drivers what they need before they leave home.",
            techStack: "Astro, Cloudflare Workers, Gate counter feed",
            steps: [
              { text: "Get access to the gate counter feed", owner: "Taylor Brooks" },
              { text: "Build the lot status service", owner: "Jordan Patel" },
              { text: "Build the lot map page", owner: "Riley Nguyen" },
              { text: "Check the counts against a manual tally", owner: "Morgan Lee" },
            ],
          },
          prototype: {
            githubUrl: "https://github.com/sample-lab/parking-pulse",
            supabase: false,
            builds: [
              { note: "", techStack: "Astro, Cloudflare Workers, Gate counter feed", at: "2026-05-12T16:00:00.000Z" },
              {
                note: "Cached the gate counts so the page loads in under a second on campus Wi-Fi.",
                techStack: "Astro, Cloudflare Workers, Gate counter feed",
                at: "2026-06-09T16:00:00.000Z",
              },
            ],
          },
          launch: {
            siteUrl: "https://parking-pulse.example.edu",
            slidesUrl: "https://slides.example.com/parking-pulse",
            demoUrl: "https://video.example.com/parking-pulse",
            at: "2026-07-01T16:00:00.000Z",
            contributions: {
              "Jordan Patel": "Built the lot status service and its cache.",
              "Riley Nguyen": "Built the lot map page.",
              "Taylor Brooks": "Worked with parking services and wrote the launch updates.",
              "Morgan Lee": "Checked the counts against manual tallies across two weeks.",
            },
          },
        },
        {
          name: "Grant Draft Helper",
          stage: "solidifying",
          icon: "file",
          notesUrl: "https://docs.google.com/document/d/sample-grant-draft-helper",
          description: "Drafts a first version of a small grant application from a partner's notes.",
          people: [
            { name: "Morgan Lee", role: "data" },
            { name: "Sam Rivera", role: "communication" },
          ],
          plan: {
            thesis:
              "Small nonprofits partnering with the Lab spend hours on short grant applications. The helper drafts a first version from a partner's notes for them to edit.",
            reasoning:
              "Most small grants ask the same handful of questions. A draft that answers them gives a partner something to react to on day one.",
            techStack: "Next.js, Postgres, Document templates",
            steps: [
              { text: "Collect five past applications as examples", owner: "Sam Rivera" },
              { text: "Build the draft generator", owner: "Morgan Lee" },
            ],
          },
        },
      ],
    },
    // The All Projects view: every project in one grid, filtered by stage.
    allProjects: {
      title: "All Projects",
      description:
        "Projects appear here at every stage, from first idea to launch. Sample projects fill the list until more teams add theirs.",
      filterLabel: "Filter by stage",
      all: "All",
      yours: "Yours",
      sample: "Sample",
      empty: "No projects at this stage yet.",
      // Every card opens a brief of its project, to view only. Your own
      // also open their board.
      view: "View",
      open: "Open",
      overview: "A brief of this project at its current stage, to view only.",
    },
    projectName: "Project name",
    projectActions: "Project actions",
    rename: "Rename",
    // A project's folder colour in Your Projects: the sidebar's grey or one
    // of four presets.
    folderColor: "Folder color",
    colors: { default: "Default", blue: "Blue", green: "Green", amber: "Amber", rose: "Rose" },
    delete: "Delete",
    settings: "Settings",
    // A project's view: a track of its stages, left to right, over one wide
    // card. A new project starts in Brainstorming.
    board: {
      stages: {
        brainstorming: "Brainstorming",
        solidifying: "Solidifying",
        prototype: "Prototype",
        live: "Live",
      },
      stageTrack: "Project stage",
      stageDone: "done",
      people: "People involved",
      // Keyed by the stage a project moves into.
      moveTo: {
        solidifying: "Move to Solidifying",
        prototype: "Move to Prototype",
        live: "Move to Live",
      },
      // A Live project's card: where to see it, and who did what.
      launch: "Live",
      liveSince: "Live since",
      visitSite: "Visit the site",
      slides: "Slides",
      demo: "Demo",
      contributions: "Contributions",
      contributionsConfirmed: "Confirmed by the team",
      editLaunch: "Edit launch",
      planPending: "The plan shows here once the project moves to Solidifying.",
      // A past stage, opened from the stage track. The stage name follows
      // pastView.
      pastView: "Read only. This is how the project stood when it left",
      completed: "Completed",
      backTo: "Back to",
      prototype: "Prototype",
      // A card past Brainstorming shows its plan.
      thesis: "Idea thesis",
      reasoning: "Reasoning",
      techStack: "Tech stack",
      roles: "People and roles",
      viewSteps: "View steps",
      stepsTitle: "Steps",
      options: "Project options",
      // Every project keeps a Google Doc for meeting notes, at every stage.
      // One saved before the doc was required asks for it, and its moves
      // wait until the link is added.
      notes: "Meeting notes",
      openNotes: "Open the notes doc",
      notesMissing: "Every project keeps its meeting notes in a Google Doc. Add the link to move this project on.",
      addNotes: "Add the link",
      editDetails: "Edit details",
      editPlan: "Edit plan",
      // A prototype's build chip ("Build 3") and its log.
      build: "Build",
      buildLog: "Build log",
      openBuildLog: "open the build log",
      firstBuild: "Started the prototype.",
      newBuild: "New build",
    },
    // The form a project fills out on its way into Solidifying. Every field
    // is required. Microcopy.
    solidify: {
      title: "Move to Solidifying",
      description: "Fill out every field to move this project into Solidifying.",
      editTitle: "Edit plan",
      editDescription: "Update the plan. Every field stays required.",
      editSubmit: "Save plan",
      ideaHeading: "Idea",
      idea: "The idea so far",
      thesis: "Idea thesis, expanded",
      thesisPlaceholder: "The problem, who has it and what the project builds.",
      reasoning: "Reasoning",
      reasoningPlaceholder: "Why this idea, and why this approach.",
      plan: "Plan",
      techStack: "Tech stack",
      techStackPlaceholder: "Next.js, Postgres, Python",
      steps: "Steps",
      step: "Step",
      roleFor: "Role for",
      stepPlaceholder: "What gets done",
      stepOwner: "Who does it",
      addStep: "Add step",
      removeStep: "Remove step",
      roles: "People and roles",
      rolePlaceholder: "Pick a role",
      editMeanings: "Edit what roles mean",
      submit: "Move to Solidifying",
      errors: {
        summary: "Fill out every field to move this project.",
        thesis: "Expand the idea thesis.",
        reasoning: "Add your reasoning.",
        techStack: "List the tech stack.",
        steps: "Add at least one step.",
        stepText: "Describe this step.",
        stepOwner: "Pick who does this step.",
        people: "Add at least one person.",
        role: "Pick a role.",
        meaning: "Describe this role.",
      },
    },
    // The form from Solidifying to Prototype: a Prototype section on top of
    // the whole plan again. Every field is required. Microcopy.
    prototype: {
      title: "Move to Prototype",
      description: "Link the repo, confirm Supabase and check the plan. Every field is required.",
      editTitle: "Edit prototype",
      editDescription: "Update the repo, Supabase and the plan. Every field stays required.",
      submit: "Move to Prototype",
      editSubmit: "Save prototype",
      heading: "Prototype",
      github: "Link to GitHub",
      githubPlaceholder: "https://github.com/owner/repo",
      supabase: "Supabase integration",
      supabaseYes: "Uses Supabase",
      supabaseNo: "No Supabase",
      errors: {
        githubUrl: "Enter a GitHub repository link, such as https://github.com/owner/repo.",
        supabase: "Choose whether the project uses Supabase.",
      },
    },
    // The form from Prototype to Live, the last stage: where to see the
    // finished project, what each person contributed, and a confirmation.
    // Every field is required. Microcopy.
    live: {
      title: "Move to Live",
      description: "Share where to see the finished project and credit each person. Every field is required.",
      editTitle: "Edit launch",
      editDescription: "Update the links and contributions, then confirm them again.",
      submit: "Move to Live",
      editSubmit: "Save launch",
      links: "Links",
      site: "Live website or portal",
      sitePlaceholder: "https://your-project.example.edu",
      slides: "Presentation slides",
      slidesPlaceholder: "https://slides.example.com/your-deck",
      demo: "Demo",
      demoPlaceholder: "https://video.example.com/your-demo",
      contributions: "Contributions",
      contributionsHelp: "What each person contributed, started from the steps they owned.",
      contributionFor: "Contribution from",
      contributionPlaceholder: "What they built, ran or delivered",
      confirm: "I confirm everyone listed contributed to this project as described.",
      errors: {
        summary: "Fill out every field and confirm the contributions to move on.",
        url: "Enter a link, such as https://example.com.",
        contribution: "Describe what this person contributed.",
        confirmed: "Confirm the contributions to move on.",
      },
    },
    // The form that starts a prototype's next build. Both fields are
    // required. Title and submit are followed by the build's number.
    // Microcopy.
    build: {
      title: "Start Build",
      description: "Log what changed since the last build. Both fields are required.",
      note: "What changed",
      notePlaceholder: "What you added, fixed or changed since the last build.",
      techStack: "Tech stack",
      techStackHelp: "Update it if the stack changed. The plan picks up the change.",
      submit: "Start Build",
      errors: {
        note: "Describe what changed.",
        techStack: "List the tech stack.",
      },
    },
    // Role presets, in the order they are offered. A project can reword the
    // meanings.
    roles: {
      manager: { name: "Manager", meaning: "Keeps the plan on track, runs check-ins and clears blockers." },
      uiux: { name: "UI/UX", meaning: "Designs the screens and flows and tests them with users." },
      frontend: { name: "Frontend", meaning: "Builds the interface people use." },
      backend: { name: "Backend", meaning: "Builds the server, data and integrations behind it." },
      data: { name: "Data & AI", meaning: "Handles the data, models and prompts." },
      qa: { name: "QA & Testing", meaning: "Tests each build and follows bugs until they close." },
      communication: { name: "Communication", meaning: "Keeps the partner and the team updated and writes the updates." },
    },
    // Placeholder Settings view until what it controls is decided.
    settingsPage: {
      description: "Placeholder text. Account settings will live here.",
      // The dialog's nav, one entry per section.
      sectionsLabel: "Settings sections",
      profileTitle: "Profile",
      profileDescription: "Placeholder text for your name and email.",
      nameLabel: "Name",
      emailLabel: "Email",
      // The profile picture, kept in this browser until profiles are stored
      // with the account.
      photoLabel: "Profile picture",
      photoUpload: "Upload photo",
      photoChange: "Change photo",
      photoRemove: "Remove",
      photoErrors: {
        type: "Choose an image file.",
        read: "That image could not be read. Try another.",
      },
      preferencesTitle: "Preferences",
      preferencesDescription: "How Projectum looks in this browser.",
      darkMode: "Dark mode",
      darkModeHelp: "Switch Projectum to dark colors.",
      // Agent access: one row per connector, placeholders until they exist.
      agentsTitle: "Agent access",
      agentsDescription: "Connect an AI assistant so it can work with your projects.",
      connectors: [
        { id: "claude", name: "Claude", description: "Placeholder text for the Claude connector." },
        { id: "chatgpt", name: "ChatGPT", description: "Placeholder text for the ChatGPT connector." },
      ],
      connect: "Connect",
      planned: "Planned",
      // Attended meetings, drawn like GitHub's contribution graph with one
      // square per weekly meeting. Sample data until check-ins are
      // recorded. The schedule itself renders from data/settings.json.
      attendanceTitle: "Attended meetings",
      attendanceDescription: "Sample data until check-ins are recorded.",
      attendanceSchedule: (schedule: string) => `Meetings run ${schedule}.`,
      attendanceSummary: (attended: number, held: number) =>
        `${attended} of ${held} meetings attended in the last year`,
      attendanceStates: {
        attended: "Attended",
        missed: "Missed",
        upcoming: "Upcoming",
      },
      accountTitle: "Account",
      accountDescription: "Log out of Projectum on this device.",
    },
    logout: "Log out",
    toggle: "Toggle sidebar",
  },

} as const;

export type Copy = typeof copy;
