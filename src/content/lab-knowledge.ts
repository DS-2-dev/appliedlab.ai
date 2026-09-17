/*
  What the site's assistant (Ask the Lab, /api/ask) knows about the Lab. It
  answers from this and nothing else, so a fact missing here is a question
  it declines. Sources: the advisory board deck (Fall 2026) and the site
  copy. The meeting schedule and upcoming events are not here: the route
  adds them from data/ on each request, so they stay current.

  Keep it factual and current. Every line here can end up in an answer.
*/

export const LAB_KNOWLEDGE = `
# The Applied AI Lab at Weber State University

## What it is
- The Applied AI Lab is a student-led organization at Weber State University where students solve industry challenges using AI.
- Its three aims: hands-on experience for students (industry problems and deliverables, experience using AI), industry adoption (helping Utah businesses put AI to work), and deeper relationships (learning by building, alongside peers and faculty).
- Founder and president: Kylar Vierra, an Economics major with minors in Finance and Business Administration.
- Contact: ailab@weber.edu.
- Membership is open to students of any major, and no prior experience is needed. Meetings are free.
- Everything is show-up: there is no RSVP. Forms on the site only collect contact details for reminders.
- A laptop helps but is not required. The first weeks start from zero.

## Weekly meetings
- Meetings are weekly, in the Shepherd Union at Weber State.
- Meetings flex between three modes:
  - Collective: standard lecture style, briefly covering a general topic together.
  - Focused: solo work, with one-on-one time with Lab leadership, case by case.
  - Collaborative: members work together on shared problems while leadership helps.
- Once a month the Lab takes members out for a social.

## Who is involved
- Partners: organizations that post problems.
- Members: students who claim problems and build solutions.
- Reps: faculty liaisons who review work and connect members with partners.

## The pipeline (how a project runs)
Phase 1, the parallel pipeline. Partners and members run side by side, and anyone can claim any project.
1. Partners post problems. Partner organizations submit their challenges to the notice board.
2. Members claim and start work. A member claims a project by submitting an action plan, which faculty approve, and then gets to work.
3. Project milestones. Members post progress, and partners observe from a distance.
4. Review gate. Faculty reps evaluate the submission with the member, and partners read the submission report.
5. At the partner's request, reps introduce the partner and the member to go over the solution prototype and discuss implementation. This is the gate to Phase 2.
Phase 2, the integrated pipeline.
6. If the partner moves to implement, the member is hired as an intern by the partner organization to implement the project they built. Implementation milestones are tracked on the platform, and reps stay in the loop.
7. Project completion: shipped work, an industry relationship, and a line on the résumé.
Why a pipeline: it creates low-stakes experience opportunities that grow into student-business relationships, with little friction.

## Student roles (three levels, each earned)
- Level 1, Affiliate: registered with the Lab, attends events and meetings, no responsibilities. Every student starts here.
- Level 2, Sponsored: working an approved project, attends two meetings a month, and gets a Claude account funded by the Lab.
- Level 3, Builder: actively implementing with an organization, hired as an intern by a partner, and featured on the partner's profile.
- The path: start as an Affiliate, earn funding, get hired.

## The platform (in development; its launch is up next)
- Notice board: partners post as many problems as they like, tagged by discipline (for example finance, computer science, accounting, design). Several members can work one project together or in parallel.
- Claiming: a member submits an action plan, faculty approve it, and approval unlocks the project and access to the Lab's Claude Teams account.
- Project tracker: members lay out their action plan as milestones with criteria for success and log progress. Reps are notified of claims and submission requests, and partners are notified when a submission is approved. Partners set deadlines, review multiple submissions, meet with members, and can select a member for an internship, which moves the project to Phase 2.
- Portals: members get a public profile showing their claimable, active and completed projects. Partners see their listed projects, how many members are on each, and finished submissions. Reps monitor activity, manage claim and submission approvals, and respond to requests for help.
- Projectum is the Lab's project workspace on this site; a demo is open to try.

## For organizations (partners)
- The Lab looks for the problems that surface at an organization's front line or in the heat of its operations, which usually a worker, a middle manager or an engineer knows best.
- How organizations can help: find those people, find their problems, and connect them with the Lab. Every connection becomes a project for a member.
- Example problems and the disciplines they call for: a snow removal annual pricing model (finance), a business model (business management), an accounting structure (accounting), internal document style enforcement (graphic design), the fastest maintenance routine (mathematics), and automatic schedule creation and assignment (computer science).
- Partners review each submission and meet the students behind it, and can hire a member as an intern to implement the work.
- To bring a problem, email ailab@weber.edu.

## Progress (Fall 2026)
- Complete: initial planning, funding, and attendance.
- Halfway: marketing and awareness.
- Up next: partner projects, the platform launch, then scaling and iterating.

## Beliefs and purpose
1. AI cannot supplement understanding: AI is only as great as our ability to leverage it.
2. Education is becoming top-down: begin with the end in mind, and back into the understanding needed to build it.
3. Community is essential: staying connected keeps us in touch with the tools people need to help each other.
- Purpose: to make the world a better place.
- The model is demand-forward: students are aligned with employer needs from day one. Students ask "What can I do for you?", employers ask "What can you do for me?", and the model answers both.
- The Lab is piloting this model now while it builds its network and platform, and the model could be laid over any university's business connections.
`.trim();
