/*
  HOW THE LAB WORKS: the operating model, published with status markers.

  Source: master-plan/master-plan.md (v2). Identity (purpose, beliefs,
  behavior, people) lives in about.ts. Voice follows the spec in copy.ts,
  including the 2026-08-19 rules: no splice punctuation, affirmative first,
  no asserted value, and incompleteness framed as a build to follow.

  Standing content rules: status on everything, no claims we cannot back,
  no sign-up surface for planned things. Funded Claude accounts are stated
  plainly (Kylar's standing exception). Ownership rules (2026-08-19): sealed
  solutions are Partner property, shown once, in person, at review, never
  processed by AI. Members own what they build.

  STATUS: copy is PROVISIONAL pending Kylar's markup pass.
*/

export type Status = "running" | "fall" | "planned";

export const STATUS_LABELS: Record<Status, string> = {
  running: "Running now",
  fall: "This semester",
  planned: "Planned",
};

export const STATUS_NOTES: Record<Status, string> = {
  running: "In operation today.",
  fall: "Begins Fall 2026.",
  planned: "Designed, with the build ahead.",
};

export const handbook = {
  meta: {
    title: "How it works",
    description:
      "How the Applied AI Lab runs, from the case pipeline and the membership ladder to the roles, with each part marked by how far the build has come.",
  },

  intro: {
    kicker: "How it works",
    heading: "How the Lab works",
    lede: "The Lab is building one ladder for its members, from a first case in the library to live work inside local organizations. This page is the design. The first steps are running now, and each section below shows how far the build has come.",
    statusKeyHeading: "How to read the markers",
  },


  // Why it runs this way (2026-08-22): conviction moves in from the retired
  // /about. The beliefs, the thesis, and the culture are the design's reasons.
  why: {
    kicker: "Why",
    heading: "Why it runs this way",
    beliefs: {
      heading: "Four beliefs, one approach",
      items: [
        {
          title: "AI is a means, not the end",
          body: "AI is becoming a daily tool for building workflows and automations that hand people back their time. We want students and local industry to capture that early.",
        },
        {
          title: "Understanding is still earned",
          body: "AI can hand you a skill in an afternoon. Understanding is built the long way, and it is what tells you where the tool stops being reliable.",
        },
        {
          title: "We prepare the person",
          body: "The person who uses the tool well is the one organizations will look for. The Lab builds that person, one who understands whole systems and carries relationships no automation can.",
        },
        {
          title: "No model is neutral",
          body: "Every model carries the values of the people who built it. Some are built with ethics at their core, and others are built to hold your attention, because attention is what they sell. We ask who built a system, what it optimizes for, and whether it is honest about its limits.",
        },
      ],
      approachKicker: "The approach",
      approach:
        "Most people have ideas, and far fewer have the technical skills to execute them. The Lab closes that gap by developing one skill first, building with AI. You build the thing you can already picture, then work backward into the understanding that makes it hold up.",
      spine: "Learning is top down, not bottom up.",
    },
    thesis: {
      heading: "An alternative measure",
      body: "Rated casework creates an alternative means of measuring individual performance. The work surfaces qualities a transcript does not carry, and the rating puts a defensible number beside them. The rubric rates each piece of work on four criteria, and the record those ratings build is where these qualities show.",
      qualities: ["Drive", "Creativity", "Collaboration", "Critical thinking", "Practicality"],
    },
    culture: {
      heading: "Three values, under pressure",
      lede: "Values are cheap when nothing is going wrong.",
      weLabel: "We",
      avoidLabel: "Avoid",
      values: [
        {
          name: "Be excellent",
          gloss: "Excellence here means work you can stand behind and explain.",
          rows: [
            {
              situation: "The AI produced something that works, and you do not fully understand it.",
              we: "Take it apart until you can explain why it is right and where a person still has to be.",
              avoid: "Shipping it and hoping nobody asks. You will be asked, at the showcase.",
            },
            {
              situation: "You over-engineered your tool. It is impressive and unusable.",
              we: "Reconstruct it. You have done the hard part. Ask your point of contact which problem still costs them time.",
              avoid: "Shipping the version that presents well but does not do the job.",
            },
            {
              situation: "Your case rating came back lower than you hoped.",
              we: "Read the written feedback, take the debrief seriously, and pick your next case with the gap in mind. The rating measures the work, and work revises.",
              avoid: "Treating the number as a verdict on you, or never claiming another case.",
            },
            {
              situation: "Your Partner or Representative says the work is not good enough.",
              we: "Ask what specifically is missing, write it down, and come back with a revision.",
              avoid: "Defending the first version, or reading the note as a verdict on you.",
            },
          ],
        },
        {
          name: "Be kind",
          gloss: "Kindness here is candor with care, especially for whoever just walked in.",
          rows: [
            {
              situation: "A first-time attendee from a non-technical major is sitting alone.",
              we: "Ask what they do every week that takes too long, and work on that with them. Everyone has one.",
              avoid: "Letting the room split into people who know and people who do not.",
            },
            {
              situation: "Someone's work will not hold up.",
              we: "Say it early, about the work, with the next concrete step.",
              avoid: "Softening it until it means nothing, or saving it until it is too late.",
            },
            {
              situation: "You think a call from leadership is wrong.",
              we: "Say so directly, once, with your reasoning. Then commit to the decision.",
              avoid: "Agreeing in the room and relitigating it afterwards.",
            },
          ],
        },
        {
          name: "Work hard",
          gloss: "Hard work here is showing up, saying where you are, and filing the update even when it is late.",
          rows: [
            {
              situation: "You are behind, and you have not filed a weekly update in two weeks.",
              we: "File it late anyway, and say what stalled. A leaky ship beats no ship.",
              avoid: "Waiting for good news. Silence turns a slow week into a dead project.",
            },
            {
              situation: "You claimed your first case and do not know where to start.",
              we: "Bring it to the workshop and say exactly that. Starting confused is the expected starting state.",
              avoid: "Sitting on it alone until the case goes stale.",
            },
            {
              situation: "The project is harder than you thought and you are not sure you can finish.",
              we: "Say so early, and ask for the specific help you need.",
              avoid: "Hoping it resolves on its own, or handing over work you cannot stand behind.",
            },
            {
              situation: "Your point of contact has not replied in a week.",
              we: "Send one message naming what you need and by when, then tell your Representative.",
              avoid: "Stalling quietly while the milestones pass.",
            },
          ],
        },
      ],
    },
  },

  roadmap: {
    kicker: "Where we are",
    heading: "Three steps, and we are on the first",
    steps: [
      {
        n: "1",
        status: "fall" as Status,
        title: "Pilot the Parallel Pipeline",
        when: "Fall 2026",
        body: "A seeded case library, weekly workshops, faculty review, and a closing public showcase. This semester is the first run of the loop.",
      },
      {
        n: "2",
        status: "planned" as Status,
        title: "Build the web infrastructure",
        when: "December 2026",
        body: "Portals, the case library as an application, the project board, and the workbench. Until then the Lab runs on this site, forms, and a shared drive.",
      },
      {
        n: "3",
        status: "planned" as Status,
        title: "Open the Integrated Pipeline and scale",
        when: "After that",
        body: "The Integrated Pipeline activates as partners sign. Casework and Representatives expand across colleges.",
      },
    ],
  },

  pipelinesIntro: {
    kicker: "The pipelines",
    heading: "Parallel and integrated",
    lede: "The Lab runs two pipelines. In the Parallel Pipeline, members work beside a business on a problem it brings, without touching its operations. In the Integrated Pipeline, a member works inside the business on live work, and it opens as partners sign.",
    parallelLabel: "Parallel",
    integratedLabel: "Integrated",
    reviewLabel: "review",
    memberLabel: "Member",
    businessLabel: "Business",
  },

  parallel: {
    kicker: "The Parallel Pipeline",
    heading: "Beside the business, never inside it",
    status: "fall" as Status,
    lede: "Members work problems that partners bring, from scratch and in parallel, without touching the business itself. Faculty rate the results, and finished work shows at the semester's end. Anyone can run this loop without an application, and this semester a project of your own counts the same way.",
    steps: [
      {
        n: "01",
        title: "A case enters the library",
        body: "A Partner picks a problem from their own operation and packages it with us. The package carries the business model, the problem with its context and dependencies, what a solution has to achieve, and their own solution when they hold one.",
        detail:
          "The solution is sealed at intake, and Members work from the problem and its context alone. A Representative opens the solution once, in person, at the faculty review. It is never shared beyond that meeting or processed by AI, and it remains the Partner's property.",
        note: "The Lab seeds the library from its own work, from faculty, and from university entities, and Partner casework joins as partnerships sign.",
        mess: "Cases stay messy on purpose. Problems inside organizations are ambiguous, and a fix needs testing to prove it worked. A package that cleans that up has removed the thing worth learning.",
      },
      {
        n: "02",
        title: "A Member claims it",
        body: "Cases are worked solo by default, and a Representative may approve a pair on a large case. The Member writes a plan of action with milestones, posts updates as the work moves, and finishes with a solution, which is usually a tool, a plan, or a report.",
        detail:
          "The plan of action is deliberately the same instrument the Integrated Pipeline runs on. Casework is where you learn to write one, and a weak first plan means a revision rather than a Partner's time.",
      },
      {
        n: "03",
        title: "Faculty review and rate it",
        body: "A Representative reviews the work and meets the Member in person for thirty minutes. When the Partner holds a solution of their own, it comes out there so the two approaches can be compared.",
        detail:
          "Rating runs on an anchored 1 to 5 rubric across problem understanding, method, effectiveness, and communication, with written feedback beside the number. More than one faculty member can rate the same work, and the display shows the average and the count.",
      },
      {
        n: "04",
        title: "The work goes on the record",
        body: "The Representative submits rated work to the showcase. Partners see finished casework, its ratings, and the Members behind it, and they can invite Members into live projects on the strength of it.",
        detail:
          "Completed, rated casework and standing on the ladder earn that visibility, and both gates are published. Members control what appears on their public profile, and Members own the solutions they build. A Partner who wants to use one makes an agreement with its builder.",
      },
    ],
  },

  integrated: {
    kicker: "The Integrated Pipeline",
    heading: "Inside the business, on live work",
    status: "planned" as Status,
    lede: "A Member works directly inside a partner organization on live work, entered from the Parallel Pipeline. It opens as partners sign, and the route in is written below, so a Member can see what it takes before the first project posts.",
    steps: [
      "A Partner identifies a problem in their organization and works with a Representative to build project goals, milestones, and an information package. Then they post it.",
      "Two routes lead in, and both pass the same gate. A Partner invites a Member off their rated casework, or any Member with at least one completed, rated case and Sponsored standing applies through their Representative.",
      "Either way, the Member writes a plan of action before committing. The Representative reviews it, and introduces the Partner and the Member once it is realistic. The Advisor stays informed and arbitrates disputes.",
      "Work runs on recorded milestones, weekly updates from the Member, monthly check-ins with the Representative, and a Partner point of contact for questions and iteration.",
      "The Member submits the final work, the Partner reviews it, and the Member helps with implementation. Then both measure whether it worked, and adjust.",
      "The project is drafted for the showcase, redacted, reviewed by the Representative and Advisor, and published.",
    ],
  },

  roles: {
    kicker: "Structure",
    heading: "Who does what",
    status: "running" as Status,
    entries: [
      {
        id: "advisor",
        title: "Advisor",
        who: "Faculty",
        status: "running" as Status,
        summary:
          "Holds student leadership to its responsibilities, recruits Representatives, and keeps institutional knowledge alive across leadership turnover.",
        points: [
          "Holds student leaders to their responsibilities, and replaces them when necessary.",
          "Finds and recruits Representatives across the university.",
          "Watches the health of the case library and of inbound project requests, and makes sure Representatives meet their responsibilities.",
          "Mentors the President on leadership, conduct, and organization, so knowledge moves down the hierarchy on purpose.",
        ],
        note: "A student will rarely arrive with the skillset to run an organization like this. Filling that gap is the Advisor's job, and it is the reason the role exists.",
      },
      {
        id: "president",
        title: "President",
        who: "Student, any college or department",
        status: "running" as Status,
        summary:
          "The face of the Lab. Runs programming for meetings, socials, and the showcase, and mentors Officers and Members.",
        points: [
          "Writes and runs programming that meets Members where they are, whether they are starting cases, mid-case, or preparing submissions.",
          "Mentors Officers on leading and supporting Members, and mentors Members on technique, planning, and connections.",
          "Keeps the website accurate, from the meeting schedule and agenda to the room and announcements.",
          "Attends every meeting, manages relations with other clubs, and forms teams when a problem crosses disciplines.",
        ],
        pressure: [
          {
            situation: "Your term is ending and the next President is not up to speed.",
            we: "Start the handoff a semester early, and write down what only you know.",
            avoid: "Leaving with the knowledge undocumented.",
          },
          {
            situation: "Nobody brought a problem to the workshop this week.",
            we: "Run the room on a member's case you already know is stuck. There is always one.",
            avoid: "Filling the hour with a demonstration and calling it a workshop.",
          },
          {
            situation: "Two Members from different colleges are solving the same problem separately.",
            we: "Put them on one team.",
            avoid: "Leaving the parallel work alone because it is less effort.",
          },
          {
            situation: "A Member's attendance has slipped below 60% and their standing is at risk.",
            we: "Tell them now, and ask what changed. There is still time to fix it.",
            avoid: "Letting the semester close and removing standing as a surprise.",
          },
        ],
      },
      {
        id: "officer",
        title: "Officer",
        who: "Student",
        status: "fall" as Status,
        summary:
          "The first responder for Members starting casework, from onboarding through plan-of-action coaching and unsticking early work.",
        points: [
          "Assists the President and attends every meeting.",
          "Coaches Members through their first plans of action and unsticks early work.",
          "Mentors Members on technique, planning, and connections.",
        ],
      },
      {
        id: "representative",
        title: "Representative",
        who: "Faculty",
        status: "fall" as Status,
        summary:
          "The liaison between Members and Partners, and the quality gate of the Parallel Pipeline. Representatives build and keep Partner relationships in their field.",
        fullRole: "/#for-faculty",
        points: [
          "Works with Partners to package casework, with sensitive details redacted before intake and the Partner's solution sealed.",
          "Reviews finished casework by rating it against the rubric, writing feedback, and holding a thirty-minute debrief where the sealed solution is opened in person.",
          "Submits reviewed work to the showcase.",
          "On live projects, reviews plans of action, introduces Partner and Member, keeps milestones honest, and acts as liaison.",
        ],
        note: "Reviews batch into blocks, and the load on any one Representative stays fixed. Any college, department, or club at Weber State may have a Representative.",
        pressure: [
          {
            situation: "A Partner tells you a Member's work is not good enough.",
            we: "Get specifics, put them in front of the Member with a deadline, and stay in it until it is fixed.",
            avoid: "Replacing the Member first, or passing the complaint along without owning the fix.",
          },
          {
            situation: "A Member's plan of action is thin, but they are keen and you like them.",
            we: "Send it back naming the specific gap, and describe what a realistic plan covers.",
            avoid: "Approving on enthusiasm, or rejecting without saying what was missing.",
          },
          {
            situation: "A Member has to come off a project.",
            we: "Tell them yourself, in person, with the reason and what comes next.",
            avoid: "Sending it by email, or letting the Partner deliver the news.",
          },
        ],
      },
      {
        id: "partner",
        title: "Partner",
        who: "A business, nonprofit, local organization, university entity, or another club",
        status: "fall" as Status,
        summary:
          "Provides casework for the Parallel Pipeline, and later organizes live projects inside the Lab's framework, working with a Representative throughout.",
        fullRole: "/#for-organizations",
        points: [
          "Packages a solved problem with its context and dependencies, along with the solution, which stays sealed until review.",
          "Reviews finished casework and the Members behind it.",
          "Can invite Members into live projects once the Integrated Pipeline opens.",
        ],
        pressure: [
          {
            situation: "A Member sent questions, and your week got away from you.",
            we: "Reply briefly, or name someone who can. A day of your silence costs them a week.",
            avoid: "Going quiet and expecting the milestone to hold.",
          },
          {
            situation: "You want to provide casework, but you are wary of what it reveals.",
            we: "Bring it to your Representative. Redaction and the sealed intake exist for this.",
            avoid: "Waiting for a perfectly safe case. The messy ones teach.",
          },
          {
            situation: "The delivered tool is not what you hoped for.",
            we: "Say what is missing against the milestones, and give them the iteration.",
            avoid: "Accepting it politely and shelving it. The Member then believes they delivered.",
          },
        ],
      },
    ],
  },

  ladder: {
    kicker: "Membership",
    heading: "A ladder with published gates",
    status: "fall" as Status,
    lede: "Involvement is a ladder, and what each step takes is written below. Meet the bar and you advance.",
    rungs: [
      {
        name: "Affiliate Member",
        level: "Entry",
        status: "fall" as Status,
        requirement: "Attend events.",
        body: "Showing up is the whole requirement, and it carries no responsibilities.",
      },
      {
        name: "Sponsored Member",
        level: "Mid",
        status: "fall" as Status,
        requirement:
          "Have a project, either one you wrote up yourself or a case you claimed, and hold 60% attendance.",
        body: "A Claude account funded by the Lab comes with the project, and it stays active while you stay active.",
      },
      {
        name: "Builder",
        level: "Full",
        status: "planned" as Status,
        requirement:
          "Work a live Partner project, show weekly progress through the semester, and hold 60% attendance.",
        body: "Builders work inside a partner organization, on live work.",
      },
    ],
    outcome:
      "Members learn how their own field uses AI and how to deploy it well. They can say where it belongs in their work and where a person remains integral, and they can defend both positions.",
  },

  instruments: {
    kicker: "Instruments",
    heading: "The same instruments run both pipelines",
    status: "fall" as Status,
    lede: "Both pipelines run on the same instruments by design. The Parallel Pipeline is where a Member learns to write a plan of action, file weekly updates, and defend finished work, and the Integrated Pipeline is where those habits meet a live organization.",
    items: [
      {
        title: "Plan of action",
        short: "Plan",
        applies: "both",
        body: "The plan of action decides whether a request is approved. It describes how the Member intends to reach each milestone, and it shows the Partner that the Member understands the problem. Members write their first ones on casework.",
      },
      {
        title: "Weekly updates",
        short: "Updates",
        applies: "both",
        body: "A list of the work done in the prior week. A late update beats a missing one.",
      },
      {
        title: "Monthly check-ins",
        short: "Check-ins",
        applies: "integrated",
        body: "The Member and Representative meet to stay aligned on live project work and its outcomes.",
      },
      {
        title: "Point of contact",
        short: "Contact",
        applies: "integrated",
        body: "The Partner names one person for questions, so the Member and Representative stay aligned with the organization.",
      },
      {
        title: "Publication",
        short: "Publication",
        applies: "both",
        body: "A publication is redacted of sensitive information. It shows the tool and what it does, screenshots where they can be shown, the student, the Partner, the college and department, and a long account of the experience and the process. Finished casework publishes in the same format.",
      },
      {
        title: "Ownership",
        short: "Ownership",
        applies: "both",
        body: "Sealed solutions remain Partner property. They are shown once, in person, at review, and they are never shared beyond that meeting or processed by AI. Members own the solutions they build, and a Partner who wants to use one makes an agreement with the member.",
      },
      {
        title: "Posts",
        short: "Posts",
        applies: "integrated",
        body: "Project postings state whether the work is paid or unpaid and the pay structure. Payment goes to the Member doing the work, and the Lab provides default Lab-Partner contracts, amendable by request.",
        status: "planned" as Status,
      },
    ],
  },

  operation: {
    kicker: "Operation",
    heading: "Weekly workshops, monthly socials",
    status: "fall" as Status,
    lede: "The weekly workshop is where Members claim cases, get unstuck, prepare submissions, and debrief ratings.",
    shapeHeading: "How a workshop runs",
    shapeIntro:
      "Every workshop opens with a short piece of general AI skill, always collective and usually brief. The heavier half then takes one of three shapes.",
    shapes: [
      {
        name: "Collective",
        body: "The President and Advisor work one major problem brought by a Member, in front of the room.",
      },
      {
        name: "Focused",
        body: "Leadership circulates and gives one-on-one support on Members' cases and projects.",
      },
      {
        name: "Collaborative",
        body: "Members group off around similar problems across their cases and projects.",
      },
    ],
    socialsHeading: "Socials",
    socials: [
      "Socials run once a month, off campus.",
      "Most of us commute, so the Lab has to earn its place in the week. The socials are where the Lab becomes people you know.",
    ],
  },

  tools: {
    kicker: "Tools",
    heading: "What we intend to build",
    status: "planned" as Status,
    lede: "The tools below are planned for December 2026 and after. Until they arrive, the Lab runs on this site, forms, a shared drive, and the weekly workshop.",
    items: [
      {
        name: "Case Library",
        body: "A centralized list of casework open to every Member. Today it runs as published pages.",
      },
      {
        name: "Project Board",
        body: "The board of live Partner projects. Eligible Members see and apply, and Partners invite from casework ratings.",
      },
      {
        name: "Workbench",
        body: "Project tracking for both pipelines, holding milestones, notes, plans of action, and the people attached to each piece of work.",
      },
      {
        name: "Toolbox",
        body: "Shared internal AI tools and frameworks built and polished by Members, for Members.",
      },
      {
        name: "LabChat",
        body: "A Members-only communication platform. Google Chat covers this for now.",
      },
      {
        name: "Onboarding",
        body: "Guided introductions for Members and for Partners, covering the calendar, the tools, the people, and the operation.",
      },
    ],
  },
} as const;
