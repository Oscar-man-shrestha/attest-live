/**
 * Campus seed + wipe helpers for Attest.
 *
 *   cd packages/db && npx ts-node --transpile-only seed-campus.ts              # insert seed_* students + ideas
 *   cd packages/db && npx ts-node --transpile-only seed-campus.ts --wipe-probes # delete probe_* only (keep seed_*)
 *   cd packages/db && npx ts-node --transpile-only seed-campus.ts --wipe        # delete probe_* and seed_*
 *
 * Seed rows use username prefix `seed_`. Never use these accounts for real people.
 * After seed, restart the API so embedding workers fill profile/idea vectors.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, domains, ideas, pool, sql, users } from "./index";

const PASS = "!seed-not-for-login";

async function campusDomainId() {
  const [named] = await db.select().from(domains).where(eq(domains.name, "Campus"));
  if (named) return named.id;
  const [anyDomain] = await db.select().from(domains).limit(1);
  if (anyDomain) return anyDomain.id;
  const [created] = await db.insert(domains).values({ name: "Campus" }).returning();
  return created.id;
}

type SeedStudent = {
  username: string;
  email: string;
  displayName: string;
  branch: string;
  semester: number;
  headline: string;
  interests: string[];
  skills: string[];
  twoWeekLine: string;
};

const STUDENTS: SeedStudent[] = [
  { username: "seed_ananya", email: "seed.ananya.cse@bl.students.amrita.edu", displayName: "Ananya Rao", branch: "CSE", semester: 5, headline: "Full-stack and campus tools", interests: ["Web apps", "Developer tools", "Campus tech fixes"], skills: ["React", "Node.js / Express", "JavaScript / TypeScript"], twoWeekLine: "I can ship a login and a small API for a campus tool." },
  { username: "seed_karthik", email: "seed.karthik.ece@bl.students.amrita.edu", displayName: "Karthik Nair", branch: "ECE", semester: 5, headline: "Embedded and IoT", interests: ["Embedded systems", "IoT", "PCB design"], skills: ["Embedded C", "ESP32 / Raspberry Pi", "PCB design (KiCad)"], twoWeekLine: "I can bring up an ESP32 sensor node with a basic dashboard." },
  { username: "seed_meera", email: "seed.meera.aie@bl.students.amrita.edu", displayName: "Meera Iyer", branch: "AIE", semester: 5, headline: "ML for campus data", interests: ["Machine learning", "Data science", "Edtech"], skills: ["Python", "Machine learning", "Data analysis"], twoWeekLine: "I can train a small classifier and document the results." },
  { username: "seed_arjun", email: "seed.arjun.me@bl.students.amrita.edu", displayName: "Arjun Menon", branch: "ME", semester: 7, headline: "CAD and fabrication", interests: ["CAD and product design", "3D printing", "Manufacturing"], skills: ["SolidWorks / Fusion 360", "3D printing", "AutoCAD"], twoWeekLine: "I can CAD and print an enclosure in a week." },
  { username: "seed_divya", email: "seed.divya.eee@bl.students.amrita.edu", displayName: "Divya Krishnan", branch: "EEE", semester: 5, headline: "Power and renewables", interests: ["Renewable energy", "Power electronics", "Electric vehicles"], skills: ["MATLAB / Simulink", "Circuit design", "Arduino"], twoWeekLine: "I can simulate a charge controller and wire a small prototype." },
  { username: "seed_rahul", email: "seed.rahul.cse@bl.students.amrita.edu", displayName: "Rahul Sharma", branch: "CSE", semester: 3, headline: "Mobile and UI", interests: ["Mobile apps", "UI and UX design", "Web apps"], skills: ["Flutter", "Figma", "JavaScript / TypeScript"], twoWeekLine: "I can design and build a Flutter prototype for a campus flow." },
];

const IDEA_SEEDS: { owner: string; title: string; pitch: string; audience: string; gap: string; ships: string; helpNeeded: string[]; branch: string; semester: number }[] = [
  { owner: "seed_karthik", title: "Hostel corridor air-quality node", pitch: "A cheap ESP32 node that shows CO2 and PM levels on each hostel floor so people open windows before exams feel stuffy.", audience: "Hostel residents who study late in closed corridors.", gap: "Nobody measures air quality on the floors; complaints stay anecdotal.", ships: "Two deployed nodes, a simple web chart, and a one-page how-to for the next floor.", helpNeeded: ["ESP32 / Raspberry Pi", "React"], branch: "ECE", semester: 5 },
  { owner: "seed_ananya", title: "Lost-and-found board for campus", pitch: "A campus lost-and-found with photos, last-seen location, and claim flow so ID cards and chargers come back faster.", audience: "Students who lose cards, bottles, and chargers every week.", gap: "WhatsApp forwards get buried; there is no single place to look.", ships: "Working board with post, claim, and admin hide, live for two weeks.", helpNeeded: ["React", "SQL and databases"], branch: "CSE", semester: 5 },
  { owner: "seed_meera", title: "Course-note search by meaning", pitch: "Upload lecture PDFs and search them by meaning, not exact words, so revision before quizzes is faster.", audience: "Juniors drowning in shared Drive folders.", gap: "Filename search fails when notes are scanned or poorly named.", ships: "Ingest for one subject, semantic search UI, and a short eval on ten queries.", helpNeeded: ["Python", "Machine learning"], branch: "AIE", semester: 5 },
  { owner: "seed_arjun", title: "3D-printed lab phone stand", pitch: "A printable phone stand that clamps to lab benches so teams can record experiments hands-free.", audience: "Lab groups filming setups for reports.", gap: "People prop phones on books; stands tip over.", ships: "CAD files, ten printed units, and a cut-list for the makerspace.", helpNeeded: ["SolidWorks / Fusion 360", "3D printing"], branch: "ME", semester: 7 },
];

async function wipeMatching(label: string, pattern: "probe" | "all") {
  console.log(`Wiping ${label}…`);
  const filter = pattern === "probe"
    ? "username like 'probe_%'"
    : "username like 'probe_%' or username like 'seed_%'";
  const ideasOwned = `select id from ideas where owner_id in (select id from users where ${filter})`;
  const usersMatch = `select id from users where ${filter}`;

  const steps = [
    `delete from idea_comments where idea_id in (${ideasOwned})`,
    `delete from ratings where idea_id in (${ideasOwned})`,
    `delete from contributions where idea_id in (${ideasOwned})`,
    `delete from join_requests where idea_id in (${ideasOwned})`,
    `delete from idea_looking_for where idea_id in (${ideasOwned})`,
    `delete from idea_images where idea_id in (${ideasOwned})`,
    `delete from interactions where idea_id in (${ideasOwned})`,
    `delete from reactions where target_type = 'idea' and target_id in (${ideasOwned})`,
    `delete from tryouts where offer_id in (select id from offers where idea_id in (${ideasOwned}) or builder_id in (${usersMatch}))`,
    `delete from offers where idea_id in (${ideasOwned}) or builder_id in (${usersMatch})`,
    `delete from tasks where idea_id in (${ideasOwned})`,
    `delete from check_ins where idea_id in (${ideasOwned})`,
    `delete from revisions where target_type = 'idea' and target_id in (${ideasOwned})`,
    `delete from reports where target_type = 'idea' and target_id in (${ideasOwned})`,
    `delete from approaches where idea_id in (${ideasOwned})`,
    `delete from sprint_invites where idea_id in (${ideasOwned})`,
    `delete from team_members where idea_id in (${ideasOwned})`,
    `delete from group_messages where group_id in (select id from groups where idea_id in (${ideasOwned}))`,
    `delete from group_members where group_id in (select id from groups where idea_id in (${ideasOwned}))`,
    `delete from groups where idea_id in (${ideasOwned})`,
    `delete from saves where target_type = 'idea' and target_id in (${ideasOwned})`,
    `delete from saved_ideas where idea_id in (${ideasOwned})`,
    `update ideas set forked_from_id = null where forked_from_id in (${ideasOwned})`,
    `update ideas set duplicate_of_id = null where duplicate_of_id in (${ideasOwned})`,
    `delete from ideas where owner_id in (${usersMatch})`,
    `delete from idea_comments where user_id in (${usersMatch})`,
    `delete from reactions where user_id in (${usersMatch})`,
    `delete from interactions where user_id in (${usersMatch})`,
    `delete from saves where user_id in (${usersMatch})`,
    `delete from saved_ideas where user_id in (${usersMatch})`,
    `delete from notices where user_id in (${usersMatch})`,
    `delete from documents where user_id in (${usersMatch})`,
    `delete from proof_pages where user_id in (${usersMatch})`,
    `delete from reports where reporter_id in (${usersMatch})`,
    `delete from events where actor_id in (${usersMatch})`,
    `delete from group_members where user_id in (${usersMatch})`,
    `delete from team_members where user_id in (${usersMatch})`,
    `delete from community_members where user_id in (${usersMatch})`,
    `delete from community_bans where user_id in (${usersMatch})`,
    `delete from user_skills where user_id in (${usersMatch})`,
    `delete from follows where follower_id in (${usersMatch}) or following_id in (${usersMatch})`,
    `delete from tryouts where offer_id in (select id from offers where builder_id in (${usersMatch}))`,
    `delete from offers where builder_id in (${usersMatch})`,
    `delete from offers where problem_id in (select id from problems where author_id in (${usersMatch}))`,
    `delete from problems where author_id in (${usersMatch})`,
    `delete from users where ${filter}`,
  ];

  for (const q of steps) {
    await pool.query(q);
  }
  console.log(`${label} wipe done.`);
}

async function wipeProbes() {
  await wipeMatching("probe_* users only (keeping seed_*)", "probe");
}

async function wipe() {
  await wipeMatching("probe_* and seed_* users", "all");
}

async function seed() {
  console.log("Seeding campus students…");
  const university = "Amrita Vishwa Vidyapeetham, Bengaluru";
  for (const s of STUDENTS) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, s.username)).limit(1);
    if (existing) {
      await db.update(users).set({
        displayName: s.displayName,
        branch: s.branch,
        semester: s.semester,
        university,
        degree: "B.Tech",
        headline: s.headline,
        interests: s.interests,
        campusSkills: s.skills,
        twoWeekLine: s.twoWeekLine,
        profileEmbedding: null,
      }).where(eq(users.id, existing.id));
      continue;
    }
    await db.insert(users).values({
      username: s.username,
      email: s.email,
      passwordHash: PASS,
      displayName: s.displayName,
      branch: s.branch,
      semester: s.semester,
      university,
      degree: "B.Tech",
      headline: s.headline,
      interests: s.interests,
      campusSkills: s.skills,
      twoWeekLine: s.twoWeekLine,
    });
  }

  const byUser = new Map(
    (await db.select({ id: users.id, username: users.username }).from(users).where(sql`${users.username} like 'seed_%'`))
      .map((row) => [row.username, row.id]),
  );

  console.log("Seeding ideas…");
  const domainId = await campusDomainId();
  for (const idea of IDEA_SEEDS) {
    const ownerId = byUser.get(idea.owner);
    if (!ownerId) continue;
    const [hit] = await db.select({ id: ideas.id }).from(ideas).where(eq(ideas.title, idea.title)).limit(1);
    if (hit) continue;
    await db.insert(ideas).values({
      ownerId,
      title: idea.title,
      description: idea.pitch,
      domainId,
      accessType: "open_open",
      status: "open",
      pitch: idea.pitch,
      audience: idea.audience,
      gap: idea.gap,
      ships: idea.ships,
      helpNeeded: idea.helpNeeded,
      authorName: STUDENTS.find((s) => s.username === idea.owner)?.displayName ?? idea.owner,
      authorBranch: idea.branch,
      authorSemester: idea.semester,
      stage: "idea",
      teamStatus: "open",
      hideName: false,
      isSmall: false,
    });
  }

  console.log("Seed complete. Restart API so embeddings catch up. Wipe probes with --wipe-probes; full wipe with --wipe.");
}

async function main() {
  if (process.argv.includes("--wipe-probes")) await wipeProbes();
  else if (process.argv.includes("--wipe")) await wipe();
  else await seed();
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
