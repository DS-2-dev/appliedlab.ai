// Join the Lab (2026-09-17): the Sign up page, a form rather than an
// account. Students, faculty and organizations each give a few details and
// the Lab follows up by email. Microcopy throughout. PROVISIONAL, pending
// Kylar.
//
// Its own module so the form's rules (src/lib/interest.ts), which the Worker
// bundles too, carry only these strings and not the whole site's copy.
// copy.ts includes it as copy.join. Voice rules as in copy.ts.

export const join = {
  title: "Join the Lab",
  heading: "Join the Lab",
  body: "Tell us who you are, and the Lab follows up by email.",
  roleLabel: "I'm joining as",
  roles: {
    student: { label: "Student", hint: "Any major. No experience needed." },
    faculty: { label: "Faculty", hint: "Review student work as a Rep." },
    organization: { label: "Organization", hint: "Bring a problem for members to solve." },
  },
  fields: {
    name: "Full name",
    email: "Email",
    weberHelp: "Your @weber.edu or @mail.weber.edu address.",
    workEmail: "Work email",
    major: "Major",
    year: "Year",
    yearPlaceholder: "Choose one",
    department: "Department",
    organization: "Organization",
    title: "Your role there",
    optional: "Optional",
  },
  years: ["First year", "Second year", "Third year", "Fourth year", "Graduate student"],
  notes: {
    student: "What would you like to build?",
    faculty: "How would you like to help?",
    organization: "What problem would you bring?",
  },
  submit: "Send",
  pending: "Sending",
  sentHeading: "Thanks, {name}",
  sentBody: "The Lab will follow up at {email}.",
  another: "Send another",
  errors: {
    name: "Enter your name.",
    email: "Enter a valid email address.",
    weber: "Use your Weber State email, ending in @weber.edu or @mail.weber.edu.",
    major: "Enter your major.",
    year: "Choose your year.",
    department: "Enter your department.",
    organization: "Enter your organization's name.",
    tooLong: "Keep this under {n} characters.",
    failed: "That didn't send. Try again, or email ailab@weber.edu.",
    limited: "Too many tries at once. Wait a minute and send again.",
  },
} as const;
