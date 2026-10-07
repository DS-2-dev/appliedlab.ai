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
        status: "Launching next",
        body: "Partners post problems to the notice board, members claim them with an action plan, and every milestone is tracked where partners and reps can follow it.",
        cta: { label: "Try the Projectum demo", href: "/projectum" },
        // A preview of the notice board, with sample problems from the
        // advisory board deck. The platform is not live yet.
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
            name: "Approvals and help",
            points: ["Claim and submission approvals", "Requests for help from members"],
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
        cta: { label: "Bring a problem", href: "mailto:ailab@weber.edu" },
        // A preview of the partner portal, drawn with the sample projects
        // from the advisory board deck. The platform is not live yet.
        portal: {
          label: "Partner portal",
          status: "Sample",
          note: "Arrives with the platform launch",
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
    projectum: "Projectum demo",
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
  },
} as const;

export type Copy = typeof copy;
