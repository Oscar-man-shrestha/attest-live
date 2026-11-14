import { z } from "zod";

export const CAMPUS_DOMAIN = "bl.students.amrita.edu";

export const BRANCHES = ["CSE", "AIE", "ECE", "EEE", "ME", "EAC"] as const;
export const branchSchema = z.enum(BRANCHES);

type Branch = (typeof BRANCHES)[number];

export type PoolOption = {
    label: string;
    /** Options in the same group replace a picked option first. */
    group: string;
    /** Branches that see this option first. Empty means every branch. */
    branches: Branch[];
    /** Lowercase words matched against idea text for suggestions. */
    keywords: string[];
};

export const INTEREST_POOL: PoolOption[] = [
    { label: "Web apps", group: "software", branches: ["CSE", "AIE", "EAC"], keywords: ["web", "website", "frontend", "backend", "react", "next.js", "dashboard", "portal"] },
    { label: "Mobile apps", group: "software", branches: ["CSE", "AIE", "EAC"], keywords: ["app", "android", "ios", "flutter", "mobile"] },
    { label: "Open source", group: "software", branches: ["CSE", "AIE"], keywords: ["open source", "github", "library", "package"] },
    { label: "Developer tools", group: "software", branches: ["CSE"], keywords: ["cli", "developer", "tooling", "extension", "plugin", "automation"] },
    { label: "Cybersecurity", group: "software", branches: ["CSE", "EAC"], keywords: ["security", "privacy", "encryption", "auth", "ctf", "vulnerability"] },
    { label: "Cloud and DevOps", group: "software", branches: ["CSE"], keywords: ["cloud", "docker", "kubernetes", "deploy", "server", "devops", "aws"] },
    { label: "Game development", group: "software", branches: ["CSE", "AIE"], keywords: ["game", "unity", "unreal", "gamedev"] },
    { label: "AR and VR", group: "software", branches: ["CSE", "AIE", "ECE"], keywords: ["ar", "vr", "augmented", "virtual reality", "mixed reality", "metaverse"] },
    { label: "Competitive programming", group: "career", branches: ["CSE", "AIE"], keywords: ["dsa", "leetcode", "codeforces", "algorithm", "contest"] },

    { label: "Machine learning", group: "ai", branches: ["AIE", "CSE"], keywords: ["ml", "machine learning", "model", "prediction", "classifier", "training"] },
    { label: "Generative AI and LLMs", group: "ai", branches: ["AIE", "CSE"], keywords: ["llm", "gpt", "gemini", "chatbot", "generative", "rag", "prompt"] },
    { label: "Computer vision", group: "ai", branches: ["AIE", "CSE", "ECE"], keywords: ["vision", "image", "camera", "opencv", "detection", "yolo"] },
    { label: "NLP and speech", group: "ai", branches: ["AIE", "CSE"], keywords: ["nlp", "text", "speech", "language", "translation", "voice"] },
    { label: "Data science", group: "ai", branches: ["AIE", "CSE"], keywords: ["data", "analytics", "visualization", "pandas", "dataset", "statistics"] },

    { label: "Embedded systems", group: "hardware", branches: ["ECE", "EAC", "EEE"], keywords: ["embedded", "microcontroller", "firmware", "stm32", "esp32", "arduino"] },
    { label: "IoT", group: "hardware", branches: ["ECE", "EAC", "EEE", "CSE"], keywords: ["iot", "sensor", "smart", "esp32", "mqtt", "connected"] },
    { label: "Robotics", group: "hardware", branches: ["ME", "ECE", "EAC", "AIE"], keywords: ["robot", "robotics", "ros", "arm", "rover", "autonomous"] },
    { label: "Drones", group: "hardware", branches: ["ME", "ECE", "EAC"], keywords: ["drone", "uav", "quadcopter", "flight"] },
    { label: "VLSI and chip design", group: "hardware", branches: ["ECE", "EAC"], keywords: ["vlsi", "verilog", "fpga", "chip", "asic", "rtl"] },
    { label: "PCB design", group: "hardware", branches: ["ECE", "EEE", "EAC"], keywords: ["pcb", "circuit", "kicad", "schematic"] },
    { label: "Signal processing", group: "hardware", branches: ["ECE", "EAC", "AIE"], keywords: ["signal", "dsp", "audio", "filter", "fft"] },
    { label: "Wireless and 5G", group: "hardware", branches: ["ECE", "EAC"], keywords: ["wireless", "5g", "antenna", "rf", "lora", "communication"] },

    { label: "Electric vehicles", group: "power", branches: ["EEE", "ME", "ECE"], keywords: ["ev", "electric vehicle", "battery", "motor", "charging"] },
    { label: "Renewable energy", group: "power", branches: ["EEE", "ME"], keywords: ["solar", "renewable", "wind", "energy", "power"] },
    { label: "Power electronics", group: "power", branches: ["EEE", "ECE"], keywords: ["inverter", "converter", "power electronics", "bms"] },
    { label: "Smart grid", group: "power", branches: ["EEE"], keywords: ["grid", "meter", "load", "smart grid"] },

    { label: "CAD and product design", group: "mechanical", branches: ["ME"], keywords: ["cad", "solidworks", "fusion 360", "design", "prototype"] },
    { label: "3D printing", group: "mechanical", branches: ["ME", "ECE"], keywords: ["3d print", "printing", "additive", "fdm"] },
    { label: "Automotive and motorsport", group: "mechanical", branches: ["ME", "EEE"], keywords: ["car", "vehicle", "baja", "formula", "motorsport", "automotive"] },
    { label: "Manufacturing", group: "mechanical", branches: ["ME"], keywords: ["manufacturing", "cnc", "machining", "factory"] },
    { label: "Aerospace", group: "mechanical", branches: ["ME", "ECE"], keywords: ["aerospace", "rocket", "satellite", "space", "cubesat"] },

    { label: "Healthtech", group: "domains", branches: [], keywords: ["health", "medical", "hospital", "patient", "fitness", "wellness"] },
    { label: "Edtech", group: "domains", branches: [], keywords: ["learning", "education", "study", "course", "quiz", "notes"] },
    { label: "Fintech", group: "domains", branches: ["CSE", "AIE"], keywords: ["payment", "finance", "upi", "money", "budget", "expense"] },
    { label: "Agritech", group: "domains", branches: ["ECE", "EEE", "AIE"], keywords: ["farm", "agriculture", "crop", "soil", "irrigation"] },
    { label: "Climate and sustainability", group: "domains", branches: [], keywords: ["climate", "waste", "recycling", "sustainability", "carbon", "water"] },
    { label: "Assistive tech", group: "domains", branches: [], keywords: ["accessibility", "disability", "assistive", "blind", "deaf"] },
    { label: "Startups", group: "career", branches: [], keywords: ["startup", "business", "product", "customers", "market"] },
    { label: "Research papers", group: "career", branches: [], keywords: ["research", "paper", "publication", "ieee", "journal"] },
    { label: "Hackathons", group: "career", branches: [], keywords: ["hackathon", "sih", "competition", "challenge"] },
    { label: "Internships and placements", group: "career", branches: [], keywords: ["internship", "placement", "resume", "interview", "job"] },
    { label: "UI and UX design", group: "creative", branches: [], keywords: ["ui", "ux", "figma", "design", "interface"] },
    { label: "Video and content", group: "creative", branches: [], keywords: ["video", "content", "youtube", "reel", "editing", "podcast"] },

    { label: "Campus tech fixes", group: "campus", branches: [], keywords: ["campus", "hostel", "mess", "bus", "library", "wi-fi", "attendance"] },
    { label: "Clubs and fests", group: "campus", branches: [], keywords: ["club", "fest", "event", "society"] },
];

export const INTEREST_TILES: string[] = INTEREST_POOL.map((option) => option.label);

export const SKILL_POOL: PoolOption[] = [
    { label: "Python", group: "code", branches: [], keywords: ["python"] },
    { label: "C / C++", group: "code", branches: ["ECE", "EEE", "EAC", "CSE"], keywords: ["c++", "cpp", "embedded c"] },
    { label: "Java", group: "code", branches: ["CSE"], keywords: ["java", "spring"] },
    { label: "JavaScript / TypeScript", group: "web", branches: ["CSE", "AIE"], keywords: ["javascript", "typescript", "node"] },
    { label: "React", group: "web", branches: ["CSE", "AIE"], keywords: ["react", "next.js", "frontend"] },
    { label: "Node.js / Express", group: "web", branches: ["CSE"], keywords: ["node", "express", "backend", "api"] },
    { label: "SQL and databases", group: "web", branches: ["CSE", "AIE"], keywords: ["sql", "postgres", "database", "mysql", "mongodb"] },
    { label: "Flutter", group: "mobile", branches: ["CSE", "AIE", "EAC"], keywords: ["flutter", "dart", "app"] },
    { label: "Android (Kotlin)", group: "mobile", branches: ["CSE", "EAC"], keywords: ["android", "kotlin", "app"] },
    { label: "Git and GitHub", group: "code", branches: [], keywords: ["git", "github"] },
    { label: "Linux", group: "code", branches: ["CSE", "ECE"], keywords: ["linux", "bash", "shell"] },
    { label: "Machine learning", group: "ai", branches: ["AIE", "CSE"], keywords: ["ml", "machine learning", "model", "scikit"] },
    { label: "Deep learning (PyTorch)", group: "ai", branches: ["AIE", "CSE"], keywords: ["pytorch", "tensorflow", "deep learning", "neural"] },
    { label: "OpenCV", group: "ai", branches: ["AIE", "ECE"], keywords: ["opencv", "vision", "image"] },
    { label: "Data analysis", group: "ai", branches: ["AIE", "CSE"], keywords: ["pandas", "data", "analysis", "excel"] },
    { label: "Arduino", group: "hardware", branches: ["ECE", "EEE", "EAC", "ME"], keywords: ["arduino", "sensor"] },
    { label: "ESP32 / Raspberry Pi", group: "hardware", branches: ["ECE", "EEE", "EAC"], keywords: ["esp32", "raspberry pi", "iot"] },
    { label: "Embedded C", group: "hardware", branches: ["ECE", "EAC", "EEE"], keywords: ["embedded", "firmware", "microcontroller"] },
    { label: "PCB design (KiCad)", group: "hardware", branches: ["ECE", "EEE", "EAC"], keywords: ["pcb", "kicad", "circuit"] },
    { label: "Verilog / FPGA", group: "hardware", branches: ["ECE", "EAC"], keywords: ["verilog", "fpga", "vlsi"] },
    { label: "MATLAB / Simulink", group: "hardware", branches: ["EEE", "ECE", "ME"], keywords: ["matlab", "simulink", "simulation"] },
    { label: "Circuit design", group: "hardware", branches: ["EEE", "ECE"], keywords: ["circuit", "analog", "electronics"] },
    { label: "SolidWorks / Fusion 360", group: "mechanical", branches: ["ME"], keywords: ["solidworks", "fusion 360", "cad"] },
    { label: "AutoCAD", group: "mechanical", branches: ["ME"], keywords: ["autocad", "drawing"] },
    { label: "ANSYS / simulation", group: "mechanical", branches: ["ME", "EEE"], keywords: ["ansys", "fea", "cfd", "simulation"] },
    { label: "3D printing", group: "mechanical", branches: ["ME"], keywords: ["3d print", "printing"] },
    { label: "ROS", group: "mechanical", branches: ["ME", "ECE", "AIE"], keywords: ["ros", "robot"] },
    { label: "Figma", group: "design", branches: [], keywords: ["figma", "ui", "ux", "design"] },
    { label: "Video editing", group: "design", branches: [], keywords: ["video", "editing", "premiere"] },
    { label: "Technical writing", group: "people", branches: [], keywords: ["writing", "docs", "report", "paper"] },
    { label: "Presenting and pitching", group: "people", branches: [], keywords: ["pitch", "presentation", "demo"] },
    { label: "Research", group: "people", branches: [], keywords: ["research", "survey", "literature"] },
    { label: "Outreach and marketing", group: "people", branches: [], keywords: ["outreach", "marketing", "social media", "users"] },
];

export const SUGGESTED_SKILLS: string[] = SKILL_POOL.map((option) => option.label);

export const TWO_WEEK_EXAMPLES: Record<Branch, string[]> = {
    CSE: ["I can build the login and backend API for a small web app.", "I can turn a Figma design into working React pages."],
    AIE: ["I can train a small image classifier and wrap it in an API.", "I can clean a dataset and make a dashboard from it."],
    ECE: ["I can wire sensors to an ESP32 and send the readings to an app.", "I can design and test a small PCB."],
    EEE: ["I can build a battery monitor with Arduino and log the data.", "I can simulate a power circuit in MATLAB and pick the parts."],
    ME: ["I can model the enclosure in CAD and 3D print two versions.", "I can build the frame for a small robot or rover."],
    EAC: ["I can write the firmware for a sensor node and a simple web view.", "I can connect a microcontroller to a mobile app over Bluetooth."],
};

/** Pool order for one branch: that branch's options first, then options for everyone, then the rest. */
export function orderPoolForBranch(pool: PoolOption[], branch: string | null | undefined): string[] {
    const rank = (option: PoolOption) => {
        if (branch && option.branches.includes(branch as Branch)) return 0;
        if (option.branches.length === 0) return 1;
        return 2;
    };
    return [...pool].sort((a, b) => rank(a) - rank(b)).map((option) => option.label);
}

export const IDEA_STAGES = ["idea", "prototype", "building", "launched"] as const;
export const TEAM_STATUSES = ["open", "in_build", "shipped"] as const;
export const OFFER_STATUSES = ["new", "tryout", "accepted", "declined"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "submitted", "done", "disputed"] as const;
export const RECEIPT_STATUSES = ["signed", "submitted", "disputed", "removed"] as const;

export const VOLUNTEER_SENTENCE = "Volunteer. No pay, no equity, no academic credit.";

export const campusEmailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((email, ctx) => {
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email" });
            return;
        }
        if (!email.endsWith(`@${CAMPUS_DOMAIN}`)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Use a @${CAMPUS_DOMAIN} address` });
        }
    });

export const requestCodeSchema = z.object({ email: campusEmailSchema });
export const verifyCodeSchema = z.object({
    email: campusEmailSchema,
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const microsoftCallbackSchema = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
});

const optionalUrl = z.string().trim().url().max(300).regex(/^https?:\/\//i, "Links must start with http:// or https://")
    .nullable().optional().or(z.literal(""));

export const projectSchema = z.object({
    title: z.string().trim().min(2).max(100),
    url: optionalUrl,
    summary: z.string().trim().max(280).optional(),
});
export const certificationSchema = z.object({
    name: z.string().trim().min(2).max(120),
    issuer: z.string().trim().max(80).optional(),
    year: z.number().int().min(2000).max(2100).nullable().optional(),
    url: optionalUrl,
});
export const experienceSchema = z.object({
    role: z.string().trim().min(2).max(80),
    org: z.string().trim().min(2).max(80),
    period: z.string().trim().max(40).optional(),
});

export const campusProfileSchema = z.object({
    displayName: z.string().trim().min(1).max(80),
    branch: branchSchema,
    semester: z.number().int().min(1).max(8),
    skills: z.array(z.string().trim().min(1).max(40)).max(8),
    interests: z.array(z.string()).max(20),
    twoWeekLine: z.string().trim().min(8).max(280),
    hoursPerWeek: z.number().int().min(1).max(40).nullable().optional(),
    availableDays: z.array(z.string().trim().min(1).max(20)).max(7).optional(),
    githubUrl: optionalUrl.refine((url) => !url || /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9-]+\/?$/.test(url), "Use your GitHub profile link, like https://github.com/username"),
    siteUrl: optionalUrl,
    linkedinUrl: optionalUrl.refine((url) => !url || /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?$/.test(url), "Use your LinkedIn profile link, like https://www.linkedin.com/in/name"),
    degree: z.string().trim().max(40).nullable().optional(),
    graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
    cgpa: z.number().min(0).max(10).nullable().optional(),
    headline: z.string().trim().max(120).nullable().optional(),
    projects: z.array(projectSchema).max(6).optional(),
    certifications: z.array(certificationSchema).max(10).optional(),
    experience: z.array(experienceSchema).max(6).optional(),
    profilePicUrl: optionalUrl,
    coverUrl: optionalUrl,
    currentlyWorkingOn: z.string().trim().max(160).nullable().optional(),
});
export type CampusProfileInput = z.infer<typeof campusProfileSchema>;

export const INTERACTION_KINDS = ["view", "dwell", "not_interested", "undo_not_interested", "share"] as const;

export const sprintCommentSchema = z.object({
    body: z.string().trim().min(1, "Write something first").max(2000, "Comments are capped at 2000 characters"),
    parentId: z.string().uuid().optional(),
});
export const commentsQuerySchema = z.object({
    sort: z.enum(["top", "new"]).default("top"),
    cursor: z.string().max(200).optional(),
});
export const REACTION_TARGETS = ["idea", "comment"] as const;
export const reactionSchema = z.object({
    targetType: z.enum(REACTION_TARGETS),
    targetId: z.string().uuid(),
});
export const interactionSchema = z.object({
    ideaId: z.string().uuid(),
    kind: z.enum(INTERACTION_KINDS),
    dwellMs: z.number().int().min(0).max(600_000).optional(),
});
export type InteractionInput = z.infer<typeof interactionSchema>;

export const addInterestSchema = z.object({ label: z.string().trim().min(1).max(60) });

export const feedQuerySchema = z.object({ cursor: z.string().max(200).optional() });

export const PEOPLE_SCOPES = ["all", "branch", "cohort"] as const;
export const peopleQuerySchema = z.object({
    scope: z.enum(PEOPLE_SCOPES).default("all"),
    cursor: z.string().max(200).optional(),
});
export const invitePersonSchema = z.object({ ideaId: z.string().uuid() });
export const branchPopularityQuerySchema = z.object({ branch: branchSchema });

const publicText = (min: number) => z.string().trim().min(min).max(2000);

export const IDEA_VISIBILITY = ["minimal", "standard", "open"] as const;
export type IdeaVisibility = (typeof IDEA_VISIBILITY)[number];

export const createSprintIdeaSchema = z.object({
    title: z.string().trim().min(3).max(120),
    blurb: z.string().trim().min(12).max(160).optional(),
    pitch: publicText(40),
    audience: publicText(12),
    gap: publicText(12),
    ships: publicText(40),
    helpNeeded: z.array(z.string().trim().min(1).max(60)).min(1).max(6),
    stage: z.enum(IDEA_STAGES).default("idea"),
    isSmall: z.boolean().default(false),
    hourCap: z.number().int().min(1).max(40).nullable().optional(),
    compensationSentence: z.string().trim().min(8).max(240).optional(),
    hideName: z.boolean().default(false),
    visibility: z.enum(IDEA_VISIBILITY).default("standard"),
    approach: z.string().trim().min(10).max(4000),
    contactEmail: campusEmailSchema,
    publicWriteup: z.string().trim().max(2500).optional(),
}).superRefine((value, ctx) => {
    if (value.visibility === "minimal" && !(value.blurb && value.blurb.trim().length >= 12)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimal visibility needs a short public teaser", path: ["blurb"] });
    }
});
export type CreateSprintIdeaInput = z.infer<typeof createSprintIdeaSchema>;

export const createProblemSchema = z.object({
    title: z.string().trim().min(3).max(120),
    whatHappens: publicText(20),
    whoFeels: publicText(12),
    fixWouldChange: publicText(20),
    source: z.enum(["lived", "heard"]),
    hideName: z.boolean().default(false),
    approach: z.string().trim().min(10).max(4000),
    contactEmail: campusEmailSchema,
});
export type CreateProblemInput = z.infer<typeof createProblemSchema>;

export const freshLineSchema = z.object({
    freshLine: z.string().trim().min(12).max(400),
});

const linkList = z.array(z.string().url()).max(6);

export const createOfferSchema = z.object({
    ideaId: z.string().uuid().optional(),
    problemId: z.string().uuid().optional(),
    body: z.string().trim().min(12).max(2000),
    hoursPerWeek: z.number().int().min(1).max(40),
    availableDays: z.array(z.string().trim().min(1).max(20)).min(1).max(7),
    links: linkList.default([]),
    skills: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
    phases: z.array(z.string().trim().min(1).max(60)).max(6).default([]),
    proposal: z.object({
        title: z.string().trim().min(3).max(120),
        pitch: publicText(40),
        audience: publicText(12),
        gap: publicText(12),
        ships: publicText(40),
        helpNeeded: z.array(z.string().trim().min(1).max(60)).min(1).max(6),
        hideName: z.boolean().default(false),
        compensationSentence: z.string().trim().min(8).max(240).optional(),
        isSmall: z.boolean().default(false),
        hourCap: z.number().int().min(1).max(40).nullable().optional(),
        stage: z.enum(IDEA_STAGES).default("idea"),
        visibility: z.enum(IDEA_VISIBILITY).default("standard"),
        blurb: z.string().trim().min(12).max(160).optional(),
    }).optional(),
}).refine((value) => Boolean(value.ideaId) !== Boolean(value.problemId), {
    message: "Choose an idea or a problem",
}).refine((value) => !value.problemId || (value.proposal && value.body.length >= 40), {
    message: "A proposal needs at least 40 characters and the public idea fields",
}).refine((value) => !value.proposal || value.proposal.visibility !== "minimal" || Boolean(value.proposal.blurb), {
    message: "Minimal visibility needs a short public teaser",
    path: ["proposal", "blurb"],
});

export const tryoutSchema = z.object({
    brief: z.string().trim().min(12).max(1000),
    hourCap: z.number().int().min(1).max(8),
});

export const addTaskSchema = z.object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().max(2000).optional(),
    role: z.string().trim().max(60).optional(),
    assigneeId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
    description: z.string().trim().max(2000),
    links: linkList.default([]),
});

export const reassignTaskSchema = z.object({
    assigneeId: z.string().uuid().nullable().optional(),
});

export const checkInSchema = z.object({
    done: z.string().trim().min(2).max(400),
    stuck: z.string().trim().min(2).max(400),
    next: z.string().trim().min(2).max(400),
});

export const inviteMemberSchema = z.object({ email: campusEmailSchema });

export const respondInviteSchema = z.object({ action: z.enum(["accept", "decline"]) });

export const removeMemberSchema = z.object({
    userId: z.string().uuid(),
    reason: z.string().trim().min(4).max(400),
});

export const reportSchema = z.object({
    targetType: z.enum(["idea", "problem"]),
    targetId: z.string().uuid(),
    reason: z.enum(["spam", "copied work"]),
});

export const resolveReportSchema = z.object({
    action: z.enum(["restore", "keep"]),
});

export const saveSchema = z.object({
    targetType: z.enum(["idea", "problem"]),
    targetId: z.string().uuid(),
});

export const draftSchema = z.object({
    kind: z.enum(["idea", "problem", "help"]),
    notes: z.string().trim().min(8).max(4000),
});

/** Email domains that sign in, and the university each one proves. */
export const UNIVERSITY_BY_DOMAIN: Record<string, { university: string; campus: string }> = {
    [CAMPUS_DOMAIN]: { university: "Amrita Vishwa Vidyapeetham", campus: "Bengaluru" },
};

export function universityForEmail(email: string) {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const match = UNIVERSITY_BY_DOMAIN[domain];
    return match ? `${match.university}, ${match.campus}` : null;
}

export const DEGREES = ["B.Tech", "M.Tech", "BCA", "MCA", "B.Sc", "M.Sc", "MBA", "PhD"] as const;

export type RollGuess = {
    branch: (typeof BRANCHES)[number] | null;
    degree: string | null;
    joinYear: number | null;
    graduationYear: number | null;
    semester: number | null;
};

/**
 * Reads a roll-number style address such as bl.en.u4cse22045@... : "en.u4" is a four-year
 * B.Tech, "cse" the branch, "22" the joining year. Every field is a guess the student confirms.
 */
export function guessFromRollNumber(email: string, now = new Date()): RollGuess {
    const local = email.split("@")[0]?.toLowerCase() ?? "";
    const branch = suggestBranch(email);
    const roll = local.match(/(?:^|\.)(en|sc|ms)?\.?([up])(\d)([a-z]{2,4})(\d{2})\d{2,4}$/);
    if (!roll) return { branch, degree: null, joinYear: null, graduationYear: null, semester: null };
    const [, school, level, years] = roll;
    const joinYear = 2000 + Number(roll[5]);
    const length = Number(years) || 4;
    const degree = level === "u" ? (school === "sc" ? "B.Sc" : "B.Tech") : (school === "sc" ? "M.Sc" : "M.Tech");
    const monthsIn = (now.getFullYear() - joinYear) * 12 + (now.getMonth() - 7);
    const semester = monthsIn < 0 ? 1 : Math.min(length * 2, Math.floor(monthsIn / 6) + 1);
    return { branch, degree, joinYear, graduationYear: joinYear + length, semester: Math.min(8, Math.max(1, semester)) };
}

export const DOCUMENT_KINDS = ["resume", "certificate", "idea_brief"] as const;
export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export const uploadDocumentSchema = z.object({ kind: z.enum(DOCUMENT_KINDS) });
export const documentIdSchema = z.string().uuid();

export type IdeaBriefExtraction = {
    title: string | null;
    blurb: string | null;
    pitch: string | null;
    audience: string | null;
    gap: string | null;
    ships: string | null;
    approach: string | null;
};

export type DocumentExtraction = {
    skills: string[];
    cgpa: number | null;
    githubUrl: string | null;
    linkedinUrl: string | null;
    siteUrl: string | null;
    degree: string | null;
    graduationYear: number | null;
    headline: string | null;
    projects: { title: string; url?: string; summary?: string }[];
    certifications: { name: string; issuer?: string; year?: number; url?: string }[];
    experience: { role: string; org: string; period?: string }[];
    usedOcr: boolean;
    /** Present when kind was idea_brief. Bytes are deleted after parse. */
    ideaBrief?: IdeaBriefExtraction | null;
};

export function suggestBranch(email: string): (typeof BRANCHES)[number] | null {
    const local = email.split("@")[0]?.toLowerCase() ?? "";
    const ordered: Array<[(typeof BRANCHES)[number], string]> = [
        ["AIE", "aie"],
        ["CSE", "cse"],
        ["ECE", "ece"],
        ["EEE", "eee"],
        ["EAC", "eac"],
        ["ME", "mec"],
    ];
    for (const [branch, code] of ordered) {
        if (local.includes(code)) return branch;
    }
    if (/(^|[^a-z])me([^a-z]|$)/.test(local)) return "ME";
    return null;
}
