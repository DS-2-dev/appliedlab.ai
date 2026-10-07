/*
  What the site's assistant (Ask the Lab, /api/ask) knows about the Lab. It
  answers from this and nothing else, so a fact missing here is a question
  it declines. Sources: the advisory board deck (Fall 2026), the master
  plan (purpose and beliefs, chosen over the deck's on 2026-09-16) and the
  site copy. The meeting schedule and upcoming events are not here: the route
  adds them from data/ on each request, so they stay current.

  Keep it factual and current. Every line here can end up in an answer.
*/

export const LAB_KNOWLEDGE = `
# The Applied AI Lab at Weber State University

## What it is
- The Applied AI Lab is a student-led organization at Weber State University where students solve industry challenges using AI.
- Its three aims: hands-on experience for students (industry problems and deliverables, experience using AI), industry adoption (helping Utah businesses put AI to work), and deeper relationships (learning by building, alongside peers and faculty).
- Founder and president: Kylar Vierra, an Economics major with minors in Finance and Business Administration.
- Faculty advisor: Gavin Roberts, Chair of the Economics Department.
- The Lab is a multidisciplinary organization that includes every college and discipline at Weber State.
- Purpose: to bring people together, ask hard questions, and elevate everyone involved.
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

## The platform (live on this site as Projectum, at appliedlab.ai/projectum)
- Signing up: at appliedlab.ai/signup, a person picks student, faculty or business and gets a 6-digit code by email (Google sign-in is being set up). Students use their @mail.weber.edu address and faculty their @weber.edu address. Businesses use their own email, and the Lab approves each new business before it can post.
- Notice board: partners post as many problems as they like, tagged by field (finance, accounting, business, computer science, design, mathematics, marketing). Several teams can work one problem in parallel.
- Claiming: a student, alone or with teammates, claims a problem with an action plan (an approach and milestones, each with how success is judged). The Lab reviews and approves it. Students can also propose a project of their own the same way.
- The board: an approved plan opens the team's board, where it moves from Solidifying to Prototype with a build log the partner can follow, then to Submitted.
- Submitting: the team uploads a final report (a PDF) and credits each person. The Lab reviews it first, then the partner reads it.
- After acceptance: the partner can ask the Lab to introduce them to the team, and can select the team for an internship. That opens phase 2, a checklist of implementation milestones, until the partner marks the project complete.
- Levels and profiles: a student's level (Affiliate, Sponsored, Builder) follows from their projects, and a student can turn on a public profile page showing their level and work. Sponsored students get a Lab-funded Claude account.

## For organizations (partners)
- The Lab looks for the problems that surface at an organization's front line or in the heat of its operations, which usually a worker, a middle manager or an engineer knows best.
- How organizations can help: find those people, find their problems, and connect them with the Lab. Every connection becomes a project for a member.
- Example problems and the disciplines they call for: a snow removal annual pricing model (finance), a business model (business management), an accounting structure (accounting), internal document style enforcement (graphic design), the fastest maintenance routine (mathematics), and automatic schedule creation and assignment (computer science).
- Partners review each submission and meet the students behind it, and can hire a member as an intern to implement the work.
- To bring a problem, sign up as a business at appliedlab.ai/signup and post it on the notice board once the Lab approves the account, or email ailab@weber.edu.

## Progress (Fall 2026)
- Complete: initial planning and attendance.
- Funding: largely secured, with the last pieces still being finalized.
- Halfway: marketing and awareness.
- Platform: launched, as Projectum on this site.
- Up next: partner projects, then scaling and iterating.

## Beliefs
1. AI is a means to an end, not the end itself.
2. AI cannot supplement understanding, only skills.
3. AI won't replace jobs, but the people who use it will.
4. AI carries the values of the people who build it.
- Approach: learning is top down, not bottom up. We use AI to bridge the gap between idea and execution.

## The model
- The model is demand-forward: students are aligned with employer needs from day one. Students ask "What can I do for you?", employers ask "What can you do for me?", and the model answers both.
- The Lab is piloting this model now while it builds its network and platform, and the model could be laid over any university's business connections.
`.trim();
