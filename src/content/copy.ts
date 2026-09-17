/*
  All site copy lives here. The public site was cleared for a redesign on
  2026-09-16; what remains is the page title, the sign-in screens and
  Projectum.

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
    // The header's links, after the advisory board deck's sections. The
    // pages behind them are not built yet.
    items: [
      { label: "About", href: "/#about" },
      { label: "The Pipeline", href: "/#pipeline" },
      { label: "Platform", href: "/#platform" },
      { label: "Student Roles", href: "/#roles" },
      { label: "Partners", href: "/#partners" },
    ],
    login: "Log in",
    signup: "Sign up",
    // In place of Log in on the static site, which has no accounts.
    demo: "Try Projectum",
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
    howHref: "#about" as const,
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
        caption: "What the Lab is",
        title: "A student-led lab for applied AI",
        body: "Students from any major take on industry challenges and solve them with AI. Meetings are free, and no experience is needed.",
        chips: [],
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
        caption: "How a project runs",
        title: "From a posted problem to an internship",
        body: "Partners post problems, and members claim them with an action plan and build toward milestones. Faculty reps review each submission, and a partner that moves to implement can hire the member as an intern.",
        chips: ["Post", "Claim", "Build", "Review", "Hire"],
        chain: true,
      },
      {
        id: "platform",
        label: "Platform",
        caption: "Where the work lives",
        title: "A notice board and a project tracker",
        status: "Launching next",
        body: "Partners post problems to the notice board, members claim them with an action plan, and every milestone is tracked where partners and reps can follow it.",
        chips: [],
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
        caption: "How students grow",
        title: "Three levels, each one earned",
        body: "Every student starts as an Affiliate. An approved project earns funding, and implementing it with a partner can lead to an internship.",
        chips: [],
        cta: { label: "Start as an Affiliate", href: "/signup" },
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
        caption: "What organizations bring",
        title: "Bring the problems your team runs into",
        body: "Organizations post as many problems as they like, and members from any discipline build the solutions.",
        chips: [],
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
