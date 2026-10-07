/*
  All site copy lives here: the landing (the hero, How it works and Ask the
  Lab), the sign-in screens and Projectum.

  VOICE + CONTENT RULES: canonical in the lab-voice skill
  (.claude/skills/lab-voice/SKILL.md). copy-lint (scripts/copy-lint.mjs)
  is the mechanical arm. Write to the skill, then run the lint.
*/


export const copy = {
  meta: {
    title: "Applied AI Lab at Weber State",
    description:
      "A student club at Weber State. Members build AI solutions to problems from local organizations. Weekly meetings in Shepherd Union. Any major.",
  },

  nav: {
    wordmark: "Applied AI Lab",
    login: "Log in",
    signup: "Sign up",
  },

  // The landing hero (2026-09-16), written for students of every major and
  // for the organizations that bring problems. PROVISIONAL, pending Kylar.
  home: {
    kicker: "Applied AI Lab at Weber State",
    heading: "Students solving industry problems with AI.",
    // The word in the heading that tilts into italic now and then.
    headingTilt: "solving",
    lede: "Organizations bring the challenges their teams face every day, and students from any major build the solutions with AI. Students gain hands-on experience, and a partner can hire the student who built its tool as an intern.",
    join: "Join the Lab",
    // Scrolls to the first step of How it works, below the hero.
    how: "See how it works",
  },

  // How it works (2026-09-16): the landing's scroll-driven section, one step
  // per header link, after the advisory board deck. PROVISIONAL, pending
  // Kylar. `id` is the anchor the header links to.
  how: {
    kicker: "How it works",
    steps: [
      {
        id: "about",
        label: "About",
        title: "A student-led lab for applied AI",
        body: "Students from any major take on industry challenges and solve them with AI. Meetings are free, and no experience is needed.",
        purposeLabel: "Our purpose",
        purpose: "To bring people together, ask hard questions, and elevate everyone involved.",
        aims: [
          { title: "Hands-on experience", body: "Members work industry problems through to a finished deliverable." },
          { title: "Industry adoption", body: "Utah organizations put AI to work on the problems they bring." },
          { title: "Deeper relationships", body: "Students learn by building alongside peers and faculty." },
        ],
        footnote: "Founded by Kylar Vierra and advised by Gavin Roberts, Chair of Economics.",
        // The demand-forward model, as the two questions it answers.
        exchange: {
          label: "The model",
          asks: [
            { who: "Students ask", question: "What can I do for you?" },
            { who: "Employers ask", question: "What can you do for me?" },
          ],
          answer: "The Lab answers both.",
        },
      },
      {
        id: "pipeline",
        label: "The Pipeline",
        title: "From a posted problem to an internship",
        // Its step detail tells the story, so the card drops the intro where space is short.
        compact: true,
        body: "Partners and members work side by side until a review gate, where a partner who moves to implement can hire the member as an intern.",
        // The deck's pipeline, step by step. `who` lists the lanes a step
        // touches, lead first.
        pipeline: {
          lanes: ["Partners", "Members", "Reps"],
          phases: [
            { label: "Phase 1", name: "Parallel pipeline", from: 0, to: 3 },
            { label: "Gate", name: "Meet and discuss", from: 4, to: 4 },
            { label: "Phase 2", name: "Integrated pipeline", from: 5, to: 6 },
          ],
          steps: [
            {
              title: "Partners post problems",
              body: "Partner organizations submit their challenges to the notice board.",
              who: ["Partners"],
            },
            {
              title: "Members claim and start work",
              body: "A member claims a project with an action plan, faculty approve it, and the work begins.",
              who: ["Members", "Reps"],
            },
            {
              title: "Project milestones",
              body: "Members post their progress, and partners follow it from a distance.",
              who: ["Members", "Partners"],
            },
            {
              title: "Submission review",
              body: "Faculty reps evaluate the submission with the member, and partners read the submission report.",
              who: ["Reps", "Members", "Partners"],
            },
            {
              title: "Partners and members meet",
              body: "At the partner's request, reps introduce the two to go over the prototype and discuss implementation.",
              who: ["Partners", "Members", "Reps"],
            },
            {
              title: "Hired as an intern",
              body: "If the partner moves to implement, the member joins the organization as an intern and reps stay in the loop.",
              who: ["Members", "Partners", "Reps"],
            },
            {
              title: "Project completion",
              body: "The work ships, and the member leaves with an industry relationship and a line on the résumé.",
              who: ["Members", "Partners"],
            },
          ],
          back: "Back",
          next: "Next",
          stepWord: "Step",
          of: "of",
          whoLabel: "Who",
        },
        footnote: "The pipeline turns low-stakes experience into student-business relationships, with little friction.",
      },
      {
        id: "platform",
        label: "Platform",
        title: "A notice board and a project tracker",
        status: "Open now",
        body: "Partners post problems to the notice board, members claim them with an action plan, and every milestone is tracked where partners and reps can follow it.",
        cta: { label: "Open Projectum", href: "/projectum" },
        // A picture of the notice board, drawn with the sample problems from
        // the advisory board deck. The real one is in Projectum.
        board: {
          label: "Notice board",
          status: "Sample",
          filters: ["All", "Finance", "CS", "Design"],
          rows: [
            { name: "Snow-removal pricing model", field: "Finance", state: "Claim" },
            { name: "Auto schedule builder", field: "CS", state: "Claim" },
            { name: "Brand style enforcement", field: "Design", state: "Claimed" },
          ],
        },
        flowLabel: "How a claim works",
        flow: ["Action plan", "Faculty approval", "Claude Teams access"],
        levels: [
          {
            level: "For members",
            name: "A public profile",
            points: ["Claimable, active and completed projects", "Milestones and progress log"],
          },
          {
            level: "For partners",
            name: "Projects and submissions",
            points: ["Members on each listed project", "Finished submissions to review"],
          },
          {
            level: "For reps",
            name: "Approvals and an overview",
            points: ["Claim and submission approvals", "Every team and partner at a glance"],
          },
        ],
        footnote: "Several members can work one project, together or in parallel.",
      },
      {
        id: "roles",
        label: "Student Roles",
        title: "Three levels, each one earned",
        body: "Every student starts as an Affiliate. An approved project earns funding, and implementing it with a partner can lead to an internship.",
        cta: { label: "Start as an Affiliate", href: "join" },
        earnLabel: "What you earn",
        earn: [
          { when: "At Sponsored", what: "A Lab-funded Claude account" },
          { when: "At Builder", what: "An internship with a partner" },
        ],
        levels: [
          {
            level: "Level 1",
            name: "Affiliate",
            points: ["Registered with the Lab", "Comes to meetings and events", "No responsibilities"],
          },
          {
            level: "Level 2",
            name: "Sponsored",
            points: ["Works an approved project", "Attends two meetings a month", "Gets a funded Claude account"],
          },
          {
            level: "Level 3",
            name: "Builder",
            points: ["Implements the work with a partner", "Hired as an intern", "Featured on the partner's profile"],
          },
        ],
        footnote: "Every level up is earned and recognized.",
      },
      {
        id: "partners",
        label: "Partners",
        title: "Bring the problems your team runs into",
        body: "Organizations post as many problems as they like, and members from any discipline build the solutions.",
        cta: { label: "Post a problem", href: "join" },
        // A picture of the partner portal, drawn with the sample projects
        // from the advisory board deck. The real one is in Projectum.
        portal: {
          label: "Partner portal",
          status: "Sample",
          note: "Sign up as a business to post your own",
          rows: [
            { name: "Lead-intake CRM", meta: "2 submissions ready" },
            { name: "Route optimizer", meta: "Members working" },
            { name: "Fleet forecast", meta: "Open to claim" },
          ],
        },
        helpLabel: "How you can help",
        help: [
          { title: "Find the people", body: "The workers, managers and engineers closest to the work." },
          { title: "Find their problems", body: "The ones that surface at the front line or in the heat of operations." },
          { title: "Connect them with us", body: "Every connection becomes a project for a member." },
        ],
        examplesLabel: "Problems we take on",
        examples: [
          { problem: "An annual snow removal pricing model", field: "Finance" },
          { problem: "A business model", field: "Business management" },
          { problem: "An accounting structure", field: "Accounting" },
          { problem: "Document style enforcement", field: "Graphic design" },
          { problem: "The fastest maintenance routine", field: "Mathematics" },
          { problem: "Automatic schedule creation", field: "Computer science" },
        ],
        footnote: "Partners review each submission, meet the student behind it, and can hire that student as an intern to implement the work.",
      },
    ],
  },

  // Ask the Lab (2026-09-16): the landing's chat, after How it works. The
  // answers come from /api/ask. PROVISIONAL, pending Kylar.
  // The invitation card after Ask the Lab (2026-09-17). PROVISIONAL,
  // pending Kylar.
  cta: {
    kicker: "Join",
    heading: "Start building with the Lab",
    body: "Students from any major, faculty and organizations each have a place in the Lab. Tell us who you are, and the Lab follows up by email.",
    join: "Join the Lab",
    partner: "Bring a problem",
    partnerHref: "mailto:ailab@weber.edu",
  },

  ask: {
    kicker: "Questions",
    heading: "Ask anything about the Lab",
    placeholder: "Ask about meetings, projects or partnering",
    send: "Send",
    suggestions: [
      "Do I need experience with AI to join?",
      "How does a project go from a problem to an internship?",
      "What does a Sponsored member get?",
      "How can my organization bring a problem?",
    ],
    thinking: "Thinking",
    footnote: "Answers are written by AI and can be wrong. For anything that matters, email ailab@weber.edu.",
    offline: "The assistant isn't connected on this version of the site yet. Email ailab@weber.edu and we'll answer there.",
    error: "The assistant couldn't answer just now. Email ailab@weber.edu and we'll answer there.",
    reset: "New chat",
  },

  // The landing's footer (2026-09-16). Microcopy.
  footer: {
    school: "Weber State University",
    labLabel: "The Lab",
    contactLabel: "Contact",
    tryLabel: "Try",
    projectum: "Projectum",
    askLink: "Ask the Lab",
    email: "ailab@weber.edu",
    copyEmail: "Copy the email address ailab@weber.edu",
    linkedin: "LinkedIn",
    // TODO: the Lab's LinkedIn page. Until its address is known, this opens
    // a LinkedIn search for the Lab.
    linkedinHref: "https://www.linkedin.com/search/results/companies/?keywords=Applied%20AI%20Lab%20Weber%20State",
    place: "Shepherd Union, Ogden, Utah",
  },

  notFound: {
    line: "There's nothing at this address.",
    cta: "Back to the Lab",
  },

  // Join the Lab (2026-09-17), in its own file (join.ts).

  // Accounts (2026-09-11). Open to Weber State addresses, by Google or by
  // email and password. Microcopy throughout, so fragments are fine; the
  // bans still apply.
  auth: {
    // Page titles for the browser tab.
    loginTitle: "Log in",
    signupTitle: "Join the Lab",
    fields: {
      email: { label: "Email" },
    },
    google: "Continue with Google",
    divider: "or",
    // Projectum sign-in by emailed code (src/lib/account.ts). One form for
    // logging in and signing up: a new address is asked for a name once.
    code: {
      heading: "Log in to the Lab",
      signupHeading: "Join the Lab",
      body: "Continue with Google, or get a 6-digit code by email. Students, faculty and partner organizations all sign in here.",
      emailSubmit: "Send code",
      emailPending: "Sending",
      codeLabel: "Code",
      codeSent: "We sent a code to {email}. It works for 10 minutes.",
      codeSubmit: "Log in",
      codePending: "Checking",
      nameIntro: "Welcome to the Lab. Add your name to finish your account.",
      nameLabel: "Your name",
      nameHelp: "Partner organizations can use the organization's name.",
      nameSubmit: "Create account",
      // Sign up asks who is joining first, so people use the right email.
      // The role still comes from the email itself.
      rolePrompt: "I'm joining as",
      roles: {
        member: { label: "Student", hint: "Sign up with your @mail.weber.edu email." },
        rep: { label: "Faculty", hint: "Sign up with your @weber.edu email." },
        partner: {
          label: "Business or organization",
          hint: "Sign up with your work email. The Lab approves each new organization.",
        },
      },
      changeRole: "Change",
      wrongEmail: {
        member: "Students sign up with an @mail.weber.edu email.",
        rep: "Faculty sign up with an @weber.edu email.",
        partner: "Weber State emails sign up as a student or faculty. Use your organization's email.",
      },
      otherEmail: "Use a different email",
      resend: "Send a new code",
      resent: "A new code is on its way.",
      // Local preview only, where no email goes out.
      devNote: "Local preview, so no email goes out. Your code is {code}.",
      errors: {
        code: "That code doesn't match. Check the email and try again.",
        expired: "That code has expired. Send a new one.",
        name: "Enter your name.",
        emailUnavailable: "Sign-in email is still being set up. Write to ailab@weber.edu for access.",
        network: "We couldn't reach the Lab. Check your connection and try again.",
        googleFailed: "Google sign-in didn't finish. Try again, or use a code.",
        googleUnavailable: "Google sign-in is still being set up. Use a code for now.",
      },
    },
    // A partner organization's account before the Lab approves it.
    pending: {
      heading: "Your account is waiting for approval",
      body: "The Lab reviews each new partner organization, and we'll email you once yours is approved.",
    },
    errors: {
      emailRequired: "Enter your email.",
      emailInvalid: "Enter a valid email address.",
      rateLimited: "Too many attempts. Wait a few minutes and try again.",
      generic: "Something went wrong on our end. Try again in a moment.",
      removed: "This account has been turned off. Write to ailab@weber.edu if that looks wrong.",
    },
  },

  // The one signed-in page.
  projectum: {
    title: "Projectum",
    // Beside the logo at the top of the sidebar.
    brandName: "Projectum",
    projects: "All Projects",
    yourProjects: "Your Projects",
    addProject: "Add Project",
    addProjectDescription: "Name the idea, give it a thumbnail, link its meeting notes doc and add the people working on it.",
    createProject: "Create project",
    cancel: "Cancel",
    // The Add Project form. Microcopy.
    form: {
      namePlaceholder: "Study room finder",
      thumbnail: "Thumbnail",
      thumbnailHelp: "Optional. PNG, JPG, WebP or GIF.",
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
    // The All Projects view: every project in one grid, filtered by stage.
    allProjects: {
      title: "All Projects",
      description: "Projects appear here at every stage, from first idea to launch.",
      filterLabel: "Filter by stage",
      all: "All",
      yours: "Yours",
      // Another account's project, marked with its owner's name.
      by: (name: string) => `By ${name}`,
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
        live: "Submitted",
      },
      stageTrack: "Project stage",
      stageDone: "done",
      people: "People involved",
      // Keyed by the stage a project moves into.
      moveTo: {
        solidifying: "Move to Solidifying",
        prototype: "Move to Prototype",
        live: "Submit work",
      },
      // A Live project's card: where to see it, and who did what.
      launch: "Submitted",
      liveSince: "Submitted",
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
      techStack: "Tools",
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
      techStack: "Tools (optional)",
      techStackPlaceholder: "Excel, Python, Figma",
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
        summary: "Fill out the required fields to move this project.",
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
    // The form from Solidifying to Prototype: the main link on top of the
    // whole plan again. Microcopy.
    prototype: {
      title: "Move to Prototype",
      description: "Link where the work lives and check the plan.",
      editTitle: "Edit prototype",
      editDescription: "Update the main link and the plan.",
      submit: "Move to Prototype",
      editSubmit: "Save prototype",
      heading: "Prototype",
      github: "Main link",
      githubPlaceholder: "A repository, Drive folder, Figma file or spreadsheet",
      errors: {
        githubUrl: "Enter a link that starts with https://.",
      },
    },
    // The form from Prototype to Live, the last stage: where to see the
    // finished project, what each person contributed, and a confirmation.
    // Every field is required. Microcopy.
    live: {
      title: "Submit work",
      description: "Upload your final report and credit each person. The Lab reviews the submission, then the partner organization sees it.",
      editTitle: "Edit submission",
      editDescription: "Update the links and contributions, then confirm them again.",
      submit: "Submit work",
      editSubmit: "Save submission",
      links: "Links (optional)",
      report: "Final report",
      reportHelp: "A PDF, up to 10 MB.",
      reportPick: "Choose a PDF",
      reportChange: "Choose another",
      sending: "Submitting",
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
        summary: "Add the report, credit everyone and confirm to submit.",
        url: "Enter a link, such as https://example.com, or leave it empty.",
        report: "Add your final report as a PDF.",
        reportType: "The report has to be a PDF.",
        reportSize: "The report has to be 10 MB or smaller.",
        pending: "A submission is already waiting for the Lab's review.",
        failed: "That didn't send. Try again.",
        contribution: "Describe what this person contributed.",
        confirmed: "Confirm the contributions to move on.",
      },
    },
    // The form that starts a prototype's next build. What changed is
    // required. Title and submit are followed by the build's number.
    // Microcopy.
    build: {
      title: "Start Build",
      description: "Log what changed since the last build.",
      note: "What changed",
      notePlaceholder: "What you added, fixed or changed since the last build.",
      techStack: "Tools (optional)",
      techStackHelp: "Update them if they changed. The plan picks up the change.",
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
      description: "Your profile, how Projectum looks, and your account.",
      // The dialog's nav, one entry per section.
      sectionsLabel: "Settings sections",
      profileTitle: "Profile",
      profileDescription: "Your name and email, and the picture others see.",
      nameLabel: "Name",
      emailLabel: "Email",
      // The profile picture, saved with the account.
      photoLabel: "Profile picture",
      photoUpload: "Upload photo",
      photoChange: "Change photo",
      photoRemove: "Remove",
      photoErrors: {
        type: "Choose an image file.",
        read: "That image could not be read. Try another.",
        save: "The picture didn't save. Try again.",
      },
      preferencesTitle: "Preferences",
      preferencesDescription: "How Projectum looks in this browser.",
      darkMode: "Dark mode",
      darkModeHelp: "Switch Projectum to dark colors.",
      accountTitle: "Account",
      accountDescription: "Log out of Projectum on this device.",
    },
    logout: "Log out",
    toggle: "Toggle sidebar",
    // Shown in place of Projectum if a view crashes. The Lab gets an alert.
    crash: {
      title: "Something went wrong",
      body: "This view hit an error, and the Lab has been told. Try again, and if it keeps happening, reload the page.",
      retry: "Try again",
      reload: "Reload page",
    },
    // The pipeline from the board deck: partners post problems, members
    // claim them with an action plan, the approver approves or denies.
    // Microcopy, apart from the descriptions under each view's title.
    pipeline: {
      nav: {
        board: "Notice Board",
        myProblems: "My Problems",
        myClaims: "My Claims",
        queue: "Approvals",
        post: "Post a problem",
      },
      fields: {
        finance: "Finance",
        accounting: "Accounting",
        business: "Business",
        "computer-science": "Computer Science",
        design: "Design",
        mathematics: "Mathematics",
        marketing: "Marketing",
        other: "Other",
      },
      board: {
        title: "Notice Board",
        description: "Problems posted by partner organizations. Claim one with an action plan, and the Lab reviews it.",
        all: "All",
        search: "Search problems",
        empty: "No open problems match yet.",
        filterLabel: "Filter by field",
      },
      myProblems: {
        title: "My Problems",
        description: "The problems you posted, with the student teams working on each.",
        empty: "You haven't posted a problem yet. Post one and students can start claiming it.",
      },
      card: {
        due: (date: string) => `Due ${date}`,
        teams: (n: number) => (n === 0 ? "No teams yet" : n === 1 ? "1 team working" : `${n} teams working`),
        pending: (n: number) => `${n} pending`,
        yourClaim: { pending: "Your claim is pending", approved: "You're working on this" },
        closed: "Closed",
        open: "Open",
      },
      problem: {
        back: "Back",
        postedBy: (name: string) => `Posted by ${name}`,
        details: "Details",
        deliverable: "What they want back",
        deadline: "Deadline",
        fields: "Fields",
        claim: "Claim this problem",
        claimed: "You have a claim on this problem",
        edit: "Edit",
        close: "Close problem",
        reopen: "Reopen problem",
        teams: "Teams",
        noTeams: "No teams yet.",
        noTeamsPartner: "No approved teams yet. Teams appear here once the Lab approves their plan.",
        openBoard: "Open board",
        viewProgress: "View progress",
        progressDescription: "The team's board as it stands, to view only.",
        notFound: "This problem isn't available.",
      },
      // A team's latest submission, as its board, My Claims and the problem
      // show it.
      submission: {
        pending: "Submitted, waiting for the Lab's review",
        accepted: "Submission accepted",
        returned: "Sent back for more work",
        report: "Download report",
        note: "Note from the Lab",
        heading: "Submission",
        links: { site: "Website", slides: "Slides", demo: "Demo" },
        contributions: "Contributions",
      },
      // After an accepted submission: a meeting, the internship, phase 2.
      phase: {
        requestMeeting: "Request meeting",
        meetingTitle: "Request a meeting",
        meetingDescription: "The Lab introduces you to the team by email. Add anything they should know first.",
        meetingPlaceholder: "Optional. A time that works, or what you'd like to cover.",
        meetingSend: "Request meeting",
        meetingRequested: "Meeting requested",
        meetingArranged: "Meeting arranged",
        select: "Select for internship",
        selectTitle: "Select this team for an internship",
        selectDescription: "The team joins your organization to put their work to use. They track implementation milestones here, and you mark the project complete.",
        selectPlaceholder: "Optional. A welcome, or what comes first.",
        selectSend: "Select team",
        selected: "Selected for internship",
        complete: "Complete",
        markComplete: "Mark complete",
        completeConfirm: "Mark this project complete? The team's milestones lock.",
        heading: "Phase 2, implementation",
        intro: "Track what it takes to put the work to use. The partner organization follows along.",
        empty: "No implementation milestones yet.",
        add: "Add milestone",
        addPlaceholder: "Train the front desk on the new tool",
        remove: "Remove",
        progress: (done: number, total: number) => `${done} of ${total} done`,
        completedOn: (date: string) => `Completed ${date}`,
        message: "Message from the partner",
        cancel: "Cancel",
        failed: "That didn't send. Try again.",
      },
      claimStatus: {
        pending: "Pending review",
        approved: "Approved",
        denied: "Not approved",
        withdrawn: "Withdrawn",
      },
      plan: {
        approach: "Approach",
        milestones: "Milestones",
        criterion: "Success looks like",
        finishBy: "Finish by",
      },
      problemForm: {
        postTitle: "Post a problem",
        editTitle: "Edit problem",
        description: "Describe something your people deal with. Students claim it with a plan, and the Lab reviews each plan.",
        title: "Title",
        titlePlaceholder: "Snow removal annual pricing model",
        summary: "One-line summary",
        summaryPlaceholder: "A model to price annual snow removal contracts",
        details: "Details",
        detailsPlaceholder: "The situation, what you've tried, and any data you can share.",
        fields: "Fields",
        fieldsHelp: "Pick every field the problem touches.",
        deliverable: "What you want back",
        deliverablePlaceholder: "A spreadsheet model we can update each season",
        deadline: "Deadline",
        deadlineHelp: "Optional.",
        submit: "Post problem",
        save: "Save changes",
        cancel: "Cancel",
        errors: {
          title: "Give the problem a title.",
          summary: "Add a one-line summary.",
          fields: "Pick at least one field.",
          failed: "That didn't save. Try again.",
        },
      },
      claimForm: {
        title: "Claim this problem",
        description: "Lay out your action plan. The Lab reviews it, and once it's approved you can start.",
        approach: "Approach",
        approachPlaceholder: "How you'll tackle the problem and what you'll use.",
        milestones: "Milestones",
        milestonesHelp: "Each milestone says what it is and how you'll know it worked.",
        milestoneTitle: "Milestone",
        milestoneCriterion: "Success looks like",
        milestoneTitlePlaceholder: "Clean five years of cost data",
        milestoneCriterionPlaceholder: "No gaps, every month accounted for",
        addMilestone: "Add milestone",
        removeMilestone: "Remove milestone",
        finishBy: "Finish by",
        finishByHelp: "Optional.",
        teammates: "Teammates",
        teammatesHelp: "Optional. Add other students working with you.",
        addTeammate: "Add teammate",
        removeTeammate: "Remove",
        submit: "Submit plan",
        cancel: "Cancel",
        errors: {
          approach: "Describe your approach.",
          milestones: "Add at least one milestone.",
          milestone: "Every milestone needs both what it is and what success looks like.",
          alreadyClaimed: "You or a teammate already have a claim on this problem.",
          closed: "This problem has closed.",
          failed: "That didn't send. Try again.",
        },
      },
      // Add Project: a member proposes a project of their own, with a plan,
      // for the Lab to approve like any claim.
      proposal: {
        title: "Propose a project",
        description: "Pitch a project of your own with a plan. The Lab reviews it, and once it's approved your board opens.",
        heading: "The project",
        planHeading: "Your plan",
        submit: "Submit proposal",
      },
      myClaims: {
        title: "My Claims",
        description: "Every problem you've claimed and project you've proposed, and where each plan stands.",
        empty: "You haven't claimed a problem yet. Find one on the Notice Board.",
        note: "Note from the Lab",
        withdraw: "Withdraw",
        withdrawConfirm: "Withdraw this claim? Your team loses its place on the problem.",
        openBoard: "Open board",
        team: "Team",
      },
      queue: {
        title: "Approvals",
        description: "Meeting requests to arrange, claims and submissions waiting for a decision, and partner organizations waiting to post.",
        claims: "Claims",
        partners: "New partners",
        noClaims: "No claims waiting.",
        noPartners: "No partners waiting.",
        approve: "Approve",
        deny: "Deny",
        note: "Note to the team",
        notePlaceholder: "Optional. Sent with the decision.",
        claimedBy: (names: string) => `Claimed by ${names}`,
        studentProject: "Student project",
        submissions: "Submissions",
        noSubmissions: "No submissions waiting.",
        meetings: "Meeting requests",
        noMeetings: "No meeting requests waiting.",
        arranged: "Mark arranged",
        partnerContact: "Partner",
        teamContacts: "Team",
        accept: "Accept",
        sendBack: "Send back",
        submissionNote: "Note to the team",
        submissionNotePlaceholder: "Sent with the decision. When you send it back, say what to change.",
        approvePartner: "Approve",
        signedUp: (date: string) => `Signed up ${date}`,
      },
      // The approvers' overview: every problem, team and account at once.
      overview: {
        nav: "Overview",
        title: "Overview",
        description: "Every problem, team and account in the Lab, open or closed, with where each one stands.",
        stats: {
          open: "Open problems",
          working: "Teams working",
          waiting: "Waiting on you",
          hired: "Interns hired",
          complete: "Projects complete",
        },
        tabs: { problems: "Problems", teams: "Teams", people: "People" },
        search: "Search",
        all: "All",
        empty: "Nothing matches.",
        columns: {
          problem: "Problem",
          postedBy: "Posted by",
          status: "Status",
          teams: "Teams",
          created: "Created",
          team: "Team",
          stage: "Stage",
          name: "Name",
          email: "Email",
          role: "Role",
          joined: "Joined",
          activity: "Activity",
        },
        problemStatus: { open: "Open", closed: "Closed" },
        stages: {
          pending: "Plan pending",
          denied: "Not approved",
          withdrawn: "Withdrawn",
          working: "Working",
          submitted: "Submitted",
          accepted: "Accepted",
          returned: "Sent back",
          hired: "Hired",
          complete: "Complete",
        },
        roles: { member: "Student", rep: "Faculty", partner: "Business" },
        approverBadge: "Approver",
        personStatus: { active: "Active", pending: "Waiting", removed: "Off" },
        activity: (problems: number, claims: number) =>
          [problems ? `${problems} posted` : "", claims ? `${claims} active` : ""].filter(Boolean).join(", "),
        level: "Level",
        claude: "Claude",
        claudeGive: "Mark given",
        claudeGiven: "Given",
        claudeNeeded: "Needed",
        approve: "Approve",
        turnOff: "Turn off",
        turnOn: "Turn on",
        turnOffConfirm: (name: string) => `Turn off ${name}'s account? They're signed out everywhere and can't sign in until it's turned back on.`,
        openBoard: "Board",
      },
      // Member levels, from the board deck. Worked out from claims.
      levels: {
        affiliate: { name: "Affiliate", meaning: "Registered with the Lab. Claim a problem or propose a project to move up." },
        sponsored: { name: "Sponsored", meaning: "Working an approved project, with a Lab-funded Claude account." },
        builder: { name: "Builder", meaning: "Hired as an intern by a partner organization to put the work to use." },
      },
      // Profile settings and the public profile page.
      profile: {
        levelHeading: "Your level",
        claudeHeading: "Claude account",
        claudeReady: "Your Lab-funded Claude account is ready. Check your Weber State email for the invite.",
        claudeWaiting: "The Lab is setting up your funded Claude account.",
        publicLabel: "Public profile",
        publicHelp: "Anyone with the link sees your name, picture, level and projects, and never your email.",
        copyLink: "Copy link",
        copied: "Copied",
        view: "View",
        hideNameLabel: "Keep our name off student profiles",
        hideNameHelp: "Students' public profiles list the organizations they worked with once the Lab accepts their work. Turn this on to leave yours out.",
        pageTitle: "Profile",
        fields: "Fields",
        working: "Working on",
        done: "Completed work",
        for: (partner: string) => `For ${partner}`,
        studentProject: "Own project",
        team: (names: string) => `With ${names}`,
        hired: "Hired as an intern",
        complete: "Internship complete",
        contribution: "Contribution",
        none: "No projects yet.",
        notFound: "This profile isn't public, or the link is wrong.",
        home: "Applied AI Lab at Weber State",
      },
      loading: "Loading",
      failed: "That didn't load. Try again.",
      retry: "Try again",
    },
  },
} as const;

export type Copy = typeof copy;
