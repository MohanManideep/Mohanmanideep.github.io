import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  Bot,
  Brain,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Factory,
  Globe,
  Layers,
  Mail,
  Menu,
  Shuffle,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";

import rawPortfolio from "./data/portfolio.json";
import "./App.css";

/* ==================================================================
   Data normalisation

   Every spreadsheet column read below is part of the pipeline
   contract documented in the README. Renaming one here without
   renaming it in the sheet (in the same change) drops the section.
   ================================================================== */

const text = (value) => (value === undefined || value === null ? "" : String(value).trim());

const numberValue = (value, fallback = 999) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isPublic = (row) => {
  if (!row) return false;
  const value = row.is_public ?? row.Public ?? row.public;
  if (value === undefined || value === null || value === "") return true;
  return value === true || String(value).toUpperCase() === "TRUE";
};

const isTruthy = (value) => value === true || String(value).toUpperCase() === "TRUE";

const splitList = (value) => {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return text(value)
    .split(/[,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const dateRange = (start, end) => {
  const s = text(start);
  const e = text(end);
  if (s && e) return `${s} — ${e}`;
  if (s) return `${s} — Present`;
  return e || "";
};

const driveImageUrl = (url) => {
  const value = text(url);
  if (!value) return "";
  if (value.includes("drive.google.com/thumbnail")) return value;

  const fileMatch = value.match(/\/file\/d\/([^/]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  const fileId = fileMatch?.[1] || idMatch?.[1];

  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : value;
};

const normalizeLinks = (links, profile) => {
  const result = { github: "#", linkedin: "#", email: text(profile.email) };
  if (!Array.isArray(links)) return result;

  links.filter(isPublic).forEach((link) => {
    const label = text(link.label || link.link_id || link.icon).toLowerCase();
    const url = text(link.url);
    if (!url) return;

    if (label.includes("github")) result.github = url;
    if (label.includes("linkedin")) result.linkedin = url;
    if (label.includes("email") || label.includes("mail")) {
      result.email = url.replace(/^mailto:/i, "");
    }
  });

  return result;
};

/*
 * Site_config is read two ways on purpose. When the CSV parses cleanly the
 * columns are Key / value / description. But the gviz endpoint guesses how
 * many rows are headers and currently guesses wrong on this tab, welding
 * several rows into the column labels. Row *values* survive that, so when the
 * clean keys are missing we match the column by the first word of its merged
 * label. The show_* switches then work either way.
 */
const normalizeSiteConfig = (rows) => {
  if (!Array.isArray(rows)) return rows || {};

  return rows.reduce((acc, row) => {
    let key = row.Key ?? row.key;
    let value = row.value ?? row.Value;

    if (key === undefined) {
      const entries = Object.entries(row);
      const byPrefix = (prefix) =>
        entries.find(([label]) => label.trim().toLowerCase().startsWith(prefix))?.[1];
      key = byPrefix("key");
      value = byPrefix("value");
    }

    const name = text(key);
    if (name) acc[name] = value;
    return acc;
  }, {});
};

// Profile plates come from the Media tab: public image rows related to "profile".
const normalizeGallery = (media, profile) => {
  const rows = Array.isArray(media) ? media : [];

  const photos = rows
    .filter(isPublic)
    .filter((row) => text(row.type).toLowerCase() === "image")
    .filter((row) => {
      const related = text(row.related_type).toLowerCase();
      return related === "" || related === "profile";
    })
    .map((row, index) => ({
      id: text(row.media_id) || `plate-${index + 1}`,
      url: driveImageUrl(row.url),
      alt: text(row.alt_text) || text(row.tittle || row.title) || text(profile.name),
      label: text(row.tittle || row.title) || `Photo ${index + 1}`,
    }))
    .filter((photo) => photo.url);

  if (photos.length > 0) return photos;

  const fallback = driveImageUrl(profile.profilePhoto);
  return fallback ? [{ id: "profile", url: fallback, alt: profile.name, label: "Profile" }] : [];
};

const interestIcon = (interest) => {
  const value = `${interest.name || ""} ${interest.category || ""}`.toLowerCase();
  if (value.includes("robot") || value.includes("mobile")) return "robot";
  if (value.includes("geo") || value.includes("satellite") || value.includes("urban")) return "globe";
  if (value.includes("machine") || value.includes("ai")) return "brain";
  if (value.includes("industry") || value.includes("manufacturing")) return "factory";
  if (value.includes("iot") || value.includes("embedded")) return "cpu";
  return "cpu";
};

const normalizePortfolio = (raw) => {
  const rawProfile = Array.isArray(raw.profile) ? raw.profile[0] || {} : raw.profile || {};

  const profile = {
    name: text(rawProfile.full_name || rawProfile.name || "Mohan Manideep Danda"),
    firstName: text(rawProfile.full_name || rawProfile.name || "Mohan").split(" ")[0],
    headline: text(rawProfile.headline || "M.Sc. Artificial Intelligence & Robotics Student"),
    shortBio: text(rawProfile.short_bio),
    longBio: text(rawProfile.long_bio || rawProfile.short_bio),
    location: text(rawProfile.location),
    email: text(rawProfile.email).replace(/^mailto:/i, ""),
    resumeUrl: text(rawProfile.resume_url) || "#",
    profilePhoto: text(rawProfile.profile_photo || rawProfile.profile_photo_url),
  };

  const projects = (Array.isArray(raw.projects) ? raw.projects : [])
    .filter((project) => isPublic(project) && text(project.tittle || project.title))
    .map((project, index) => ({
      id: text(project.project_id || project.id) || `project-${index + 1}`,
      title: text(project.tittle || project.title),
      subtitle: text(project.subtittle || project.subtitle),
      category: text(project.category),
      status: text(project.status || "Completed"),
      summary: text(project.summary),
      problem: text(project.problem),
      solution: text(project.solution),
      impact: text(project.impact),
      techStack: splitList(project.tech_stack || project.techStack),
      githubUrl: text(project.github_url || project.githubUrl),
      paperUrl: text(project.paper_url || project.paperUrl),
      importanceIndex: numberValue(project.importance_index, index + 1),
      order: index,
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex || a.order - b.order);

  const experience = (Array.isArray(raw.experience) ? raw.experience : [])
    .filter((item) => isPublic(item) && text(item.role || item.organization))
    .map((item, index) => ({
      id: text(item.experience_id || item.id) || `experience-${index + 1}`,
      role: text(item.role),
      organization: text(item.organization),
      type: text(item.type),
      dates: dateRange(item.start_date, item.end_date),
      location: text(item.location),
      summary: text(item.summary),
      technologies: splitList(item.technology || item.technologies),
      importanceIndex: numberValue(item.importance_index, index + 1),
      order: index,
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex || a.order - b.order);

  const education = (Array.isArray(raw.education) ? raw.education : [])
    .filter((item) => isPublic(item) && text(item.institution))
    .map((item, index) => ({
      id: text(item["education id"] || item.education_id || item.id) || `education-${index + 1}`,
      institution: text(item.institution),
      degree: text(item.degree),
      field: text(item.field),
      dates: dateRange(item.start_date, item.end_date),
      location: text(item.location),
      description: text(item.description),
      importanceIndex: numberValue(item.importance_index, index + 1),
      order: index,
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex || a.order - b.order);

  const groupedSkills = (Array.isArray(raw.skills) ? raw.skills : [])
    .filter((skill) => isPublic(skill) && text(skill.skill_name))
    .sort((a, b) => numberValue(a.importance_index) - numberValue(b.importance_index))
    .reduce((acc, skill) => {
      const category = text(skill.category) || "Skills";
      if (!acc[category]) acc[category] = [];
      acc[category].push({ name: text(skill.skill_name), level: text(skill.level) });
      return acc;
    }, {});

  const skills = Object.entries(groupedSkills).map(([category, items]) => ({ category, items }));

  const interests = (Array.isArray(raw.interests) ? raw.interests : [])
    .filter((interest) => isPublic(interest) && text(interest.name))
    .map((interest, index) => ({
      id: text(interest.interest_id || interest.id) || `interest-${index + 1}`,
      title: text(interest.name),
      category: text(interest.category),
      description: text(interest.description),
      icon: interestIcon(interest),
      importanceIndex: numberValue(interest.importance_index, index + 1),
      order: index,
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex || a.order - b.order);

  return {
    profile,
    links: normalizeLinks(raw.links, profile),
    projects,
    experience,
    education,
    skills,
    interests,
    gallery: normalizeGallery(raw.media, profile),
    siteConfig: normalizeSiteConfig(raw.site_config),
  };
};

const data = normalizePortfolio(rawPortfolio);

const showSection = (key) => {
  const value = data.siteConfig?.[key];
  if (value === undefined || value === null || value === "") return true;
  return isTruthy(value);
};

/* ==================================================================
   Motion
   ================================================================== */

const EASE = [0.16, 1, 0.3, 1];

const rise = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};


/*
 * Only the bottom edge is pulled in, so content reveals just before it fully
 * enters. Shrinking the top edge too would mean a heading landed there by a
 * nav-link jump sits outside the trigger zone and stays hidden.
 */
const seen = { once: true, margin: "0px 0px -60px 0px" };

const iconMap = { robot: Bot, brain: Brain, globe: Globe, factory: Factory, cpu: Cpu };

const skillIcons = {
  Robotics: Bot,
  Analytics: TrendingUp,
  "AI / ML": Brain,
  "Software & Data": Database,
  "Systems & Prototyping": Cpu,
  "Mechanical Design": Wrench,
  "Mechanical Simulation": Layers,
  Operations: Factory,
  "Embedded / IoT": Cpu,
  Database: Database,
  Programming: Code2,
};

/* Sections, in page order. Doubles as the nav and the title-block index. */
const SECTIONS = [
  { id: "about", label: "About", key: null },
  { id: "projects", label: "Projects", key: "show_projects" },
  { id: "experience", label: "Experience", key: "show_experience" },
  { id: "education", label: "Education", key: "show_education" },
  { id: "skills", label: "Skills", key: "show_skills" },
  { id: "interests", label: "Interests", key: "show_interests" },
  { id: "contact", label: "Contact", key: "show_contact" },
];

const navSections = SECTIONS.filter((sheet) => !sheet.key || showSection(sheet.key));

/* ==================================================================
   Small parts
   ================================================================== */

/*
 * Reveals a line of text by sliding it out from behind a mask.
 *
 * Above the fold (onMount) the entrance is a CSS animation, not a JS one.
 * The first screen is the one thing every visitor sees, so it must not depend
 * on a scroll observer, a hydrated animation loop, or anything else that can
 * fail — the CSS keyframe fills backwards, so with animation disabled the text
 * simply renders in place. Below the fold, JS reveals on scroll are fine.
 */
function Reveal({ children, delay = 0, onMount = false, className = "" }) {
  if (onMount) {
    return (
      <span className={`reveal ${className}`}>
        <span className="reveal-inner cover-mask" style={{ animationDelay: `${delay}s` }}>
          {children}
        </span>
      </span>
    );
  }

  return (
    <span className={`reveal ${className}`}>
      <motion.span
        className="reveal-inner"
        initial={{ y: "108%" }}
        whileInView={{ y: "0%" }}
        viewport={seen}
        transition={{ duration: 0.95, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function Counter({ value, duration = 1.6 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return undefined;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return <span ref={ref}>{reduce ? value : shown}</span>;
}

// A drafting dimension line: |<------ label ------>|
function Dimension({ label, className = "", onMount = false, delay = 0 }) {
  if (onMount) {
    return (
      <div className={`dim cover-wipe ${className}`} style={{ animationDelay: `${delay}s` }}>
        <span className="dim-cap" />
        <span className="dim-rule" />
        <span className="label dim-label">{label}</span>
        <span className="dim-rule" />
        <span className="dim-cap" />
      </div>
    );
  }

  return (
    <motion.div
      className={`dim ${className}`}
      initial={{ opacity: 0, scaleX: 0 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={seen}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      <span className="dim-cap" />
      <span className="dim-rule" />
      <span className="label dim-label">{label}</span>
      <span className="dim-rule" />
      <span className="dim-cap" />
    </motion.div>
  );
}

function SheetHead({ kicker, title, note }) {
  return (
    <div className="sheet-head">
      <motion.div
        className="sheet-head-meta"
        initial="hidden"
        whileInView="visible"
        viewport={seen}
        variants={stagger}
      >
        <motion.span className="label kicker-text" variants={rise}>
          {kicker}
        </motion.span>
        <motion.span className="head-rule" variants={rise} />
      </motion.div>

      <h2 className="sheet-title">
        <Reveal>{title}</Reveal>
      </h2>

      {note && (
        <motion.p
          className="sheet-note"
          initial="hidden"
          whileInView="visible"
          viewport={seen}
          variants={rise}
        >
          {note}
        </motion.p>
      )}
    </div>
  );
}

/* ==================================================================
   Photo plates — the shuffling stack
   ================================================================== */

function PhotoPlates({ photos }) {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState(() => photos.map((_, i) => i));
  const [flying, setFlying] = useState(null);
  const many = photos.length > 1;

  const shuffle = useCallback(() => {
    if (!many) return;

    setOrder((current) => {
      setFlying(current[0]);
      window.setTimeout(
        () => {
          setOrder((inner) => [...inner.slice(1), inner[0]]);
          setFlying(null);
        },
        reduce ? 0 : 340,
      );
      return current;
    });
  }, [many, reduce]);

  useEffect(() => {
    if (!many || reduce) return undefined;
    const id = window.setInterval(shuffle, 4600);
    return () => window.clearInterval(id);
  }, [many, reduce, shuffle]);

  if (photos.length === 0) {
    return (
      <div className="plates">
        <div className="plate-frame">
          <div className="plate plate-empty">
            <Bot size={38} />
            <span className="label">AI &amp; ROBOTICS</span>
          </div>
        </div>
      </div>
    );
  }

  const front = photos[order[0]];

  return (
    <div className="plates">
      <div className="plate-frame">
        <span className="plate-reg plate-reg-tl" aria-hidden="true" />
        <span className="plate-reg plate-reg-br" aria-hidden="true" />

        {order.map((photoIndex, depth) => {
          const photo = photos[photoIndex];
          const isFlying = flying === photoIndex;

          return (
            <motion.figure
              key={photo.id}
              className="plate"
              style={{ zIndex: photos.length - depth }}
              initial={false}
              animate={
                isFlying
                  ? { x: 240, y: -30, rotate: 11, scale: 0.95, opacity: 0.3 }
                  : {
                      x: depth * 17,
                      y: depth * -13,
                      rotate: depth === 0 ? -1.4 : depth * 2.6,
                      scale: 1 - depth * 0.045,
                      opacity: depth > 3 ? 0 : 1,
                    }
              }
              transition={
                reduce ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 25 }
              }
            >
              <img
                src={photo.url}
                alt={photo.alt}
                width="340"
                height="440"
                loading={depth === 0 ? "eager" : "lazy"}
                fetchPriority={depth === 0 ? "high" : "low"}
                decoding="async"
                draggable="false"
              />
              <span className="plate-wash" aria-hidden="true" />
            </motion.figure>
          );
        })}
      </div>

      <div className="plate-bar">
        <span className="label plate-label">
          <em>{front.label}</em>
        </span>

        {many && (
          <button type="button" className="plate-shuffle" onClick={shuffle}>
            <Shuffle size={13} />
            Shuffle
          </button>
        )}
      </div>
    </div>
  );
}

/* ==================================================================
   Fixed sheet chrome
   ================================================================== */

function Nav({ active }) {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        className={`nav ${solid ? "nav-solid" : ""}`}
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
      >
        <div className="nav-inner">
          <a href="#top" className="mark">
            <span className="mark-glyph">M</span>
            <span className="mark-text">
              <strong>DANDA</strong>
            </span>
          </a>

          <nav className="nav-links">
            {navSections.map((sheet) => (
              <a
                key={sheet.id}
                href={`#${sheet.id}`}
                className={active === sheet.id ? "on" : ""}
              >
                {sheet.label}
              </a>
            ))}
          </nav>

          <button className="nav-burger" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="drawer"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <button className="drawer-close" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={22} />
            </button>

            <nav className="drawer-links">
              {navSections.map((sheet, i) => (
                <motion.a
                  key={sheet.id}
                  href={`#${sheet.id}`}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.055, duration: 0.5, ease: EASE }}
                >
                  {sheet.label}
                  <ArrowUpRight size={20} />
                </motion.a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ==================================================================
   Cover
   ================================================================== */

function Cover() {
  const { profile, gallery } = data;
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const parallax = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  const skillCount = data.skills.reduce((n, group) => n + group.items.length, 0);
  const role = profile.headline;

  return (
    <section className="cover" id="top" ref={ref}>
      <div className="cover-field" aria-hidden="true">
        <span className="blueprint-grid" />
        <span className="blueprint-grid fine" />
        <span className="cover-wash" />
      </div>

      <motion.div className="cover-inner" style={{ y: parallax, opacity: fade }}>
        <div className="cover-top cover-rise" style={{ animationDelay: "0.04s" }}>
          <span className="live">
            <span className="live-dot" />
            Available for opportunities
          </span>
        </div>

        <h1 className="cover-title">
          <span className="cover-line">
            <Reveal onMount delay={0.10}>
              {profile.firstName}
            </Reveal>
          </span>
          <span className="cover-line cover-line-2">
            <Reveal onMount delay={0.18}>
              {profile.name.split(" ").slice(1).join(" ") || "Danda"}
            </Reveal>
          </span>
        </h1>

        <Dimension label={role} className="cover-dim" onMount delay={0.28} />

        <div className="cover-body">
          <div className="cover-text">
            <p className="cover-bio cover-rise" style={{ animationDelay: "0.30s" }}>
              {profile.shortBio}
            </p>

            <div className="cover-cta cover-rise" style={{ animationDelay: "0.36s" }}>
              <a href="#projects" className="btn btn-solid">
                View Projects
                <ArrowUpRight size={17} />
              </a>
              <a
                href={profile.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-line"
              >
                <Download size={16} />
                Download Resume
              </a>
            </div>

            <dl className="cover-stats cover-rise" style={{ animationDelay: "0.42s" }}>
              {[
                { n: data.projects.length, l: "Projects" },
                { n: data.experience.length, l: "Roles" },
                { n: skillCount, l: "Skills" },
                { n: data.interests.length, l: "Interests" },
              ].map((stat) => (
                <div key={stat.l}>
                  <dt>
                    <Counter value={stat.n} />
                  </dt>
                  <dd className="label">{stat.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="cover-plates cover-rise" style={{ animationDelay: "0.24s" }}>
            <PhotoPlates photos={gallery} />
          </div>
        </div>
      </motion.div>

      <a href="#about" className="cover-scroll">
        <span className="label">SCROLL</span>
        <ArrowDown size={15} />
      </a>
    </section>
  );
}

/* ==================================================================
   About
   ================================================================== */

const CAPABILITIES = [
  {
    icon: Bot,
    title: "Robotics",
    body: "Mobile robotics, prototyping and embedded systems.",
  },
  {
    icon: Brain,
    title: "Machine Learning",
    body: "Applied ML, model evaluation and real-world workflows.",
  },
  {
    icon: Globe,
    title: "Geospatial AI",
    body: "Satellite data, land cover and urban change.",
  },
  {
    icon: Factory,
    title: "Industry 4.0",
    body: "Manufacturing analytics, OEE and automation.",
  },
];

/*
 * The long bio reads as a wall in one block. Lifting its first sentence out
 * gives the section something to open on and leaves the rest as detail.
 *
 * A sentence only ends where at least two lowercase letters precede the stop,
 * which is what keeps abbreviations from splitting the line — "M.Sc." and
 * "B.Tech." would otherwise both read as the end of a sentence.
 */
const splitLead = (bio) => {
  const match = /[a-z]{2}\.\s+(?=[A-Z])/.exec(bio);
  if (!match) return [bio, ""];

  const at = match.index + match[0].length;
  return [bio.slice(0, at).trim(), bio.slice(at).trim()];
};

function About() {
  const { profile, education, experience, interests } = data;
  const [lead, rest] = splitLead(profile.longBio);

  // Every fact below is read from the sheet, never asserted independently.
  const facts = [
    { k: "Based in", v: profile.location },
    {
      k: "Studying",
      v: education[0] && `${education[0].degree} · ${education[0].institution}`,
    },
    {
      k: "Most recently",
      v: experience[0] && `${experience[0].role} · ${experience[0].organization}`,
    },
    {
      k: "Focused on",
      v: interests.slice(0, 3).map((i) => i.title).join(", "),
    },
  ].filter((f) => f.v);

  return (
    <section id="about" className="sheet">
      <div className="wrap">
        <SheetHead kicker="About" title="From machines to machines that think." />

        <motion.div
          className="about"
          initial="hidden"
          whileInView="visible"
          viewport={seen}
          variants={stagger}
        >
          <motion.p className="about-lead" variants={rise}>
            {lead}
          </motion.p>

          <div className="about-split">
            {rest && (
              <motion.p className="about-rest" variants={rise}>
                {rest}
              </motion.p>
            )}

            <motion.dl className="facts" variants={rise}>
              {facts.map((fact) => (
                <div key={fact.k}>
                  <dt className="label">{fact.k}</dt>
                  <dd>{fact.v}</dd>
                </div>
              ))}
            </motion.dl>
          </div>

          <motion.ul className="caps" variants={stagger}>
            {CAPABILITIES.map((cap) => (
              <motion.li key={cap.title} className="cap" variants={rise}>
                <span className="cap-icon">
                  <cap.icon size={18} />
                </span>
                <h3>{cap.title}</h3>
                <p>{cap.body}</p>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </section>
  );
}

/* ==================================================================
   Projects — horizontal filmstrip driven by vertical scroll
   ================================================================== */

function ProjectCard({ project }) {
  return (
    <article className="pj">
      <span className="pj-reg" aria-hidden="true" />

      <header className="pj-head">
        <span className="label">{project.category}</span>
        <span className={`pj-status ${project.status === "Completed" ? "done" : "wip"}`}>
          {project.status}
        </span>
      </header>

      <h3 className="pj-title">{project.title}</h3>
      {project.subtitle && <p className="pj-sub">{project.subtitle}</p>}

      <p className="pj-summary">{project.summary}</p>

      {project.problem && (
        <div className="pj-note">
          <span className="label">PROBLEM</span>
          <p>{project.problem}</p>
        </div>
      )}

      {project.solution && (
        <div className="pj-note">
          <span className="label">APPROACH</span>
          <p>{project.solution}</p>
        </div>
      )}

      {project.impact && (
        <p className="pj-impact">
          <TrendingUp size={15} />
          {project.impact}
        </p>
      )}

      <div className="pj-foot">
        <div className="tags">
          {project.techStack.slice(0, 6).map((tech) => (
            <span key={tech} className="tag">
              {tech}
            </span>
          ))}
          {project.techStack.length > 6 && (
            <span className="tag dim">+{project.techStack.length - 6}</span>
          )}
        </div>

        {(project.githubUrl || project.paperUrl) && (
          <div className="pj-links">
            {project.githubUrl && (
              <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                <Code2 size={14} />
                Code
              </a>
            )}
            {project.paperUrl && (
              <a href={project.paperUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                Paper
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Projects() {
  const outerRef = useRef(null);
  const trackRef = useRef(null);
  const viewRef = useRef(null);
  const reduce = useReducedMotion();

  const [distance, setDistance] = useState(0);
  const [canPin, setCanPin] = useState(false);

  // Measure how far the strip must travel, and whether pinning makes sense here.
  useLayoutEffect(() => {
    const measure = () => {
      const wide = window.matchMedia("(min-width: 900px)").matches;
      const track = trackRef.current;
      const view = viewRef.current;

      if (!track || !view || !wide || reduce) {
        setCanPin(false);
        setDistance(0);
        return;
      }

      setCanPin(true);
      setDistance(Math.max(0, track.scrollWidth - view.clientWidth));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [reduce]);

  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ["start start", "end end"],
  });

  const rawX = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const x = useSpring(rawX, { stiffness: 120, damping: 28, restDelta: 0.5 });
  const railScale = useTransform(scrollYProgress, [0, 1], [0.04, 1]);

  return (
    <section
      id="projects"
      className={`sheet strip-outer ${canPin ? "is-pinned" : ""}`}
      ref={outerRef}
      style={canPin ? { height: `calc(100vh + ${distance}px)` } : undefined}
    >
      <div className="strip-stick">
        <div className="wrap strip-head">
          <SheetHead
            kicker="Selected work"
            title="Projects"
            note="Machine learning, data engineering, robotics and industrial work."
          />

          {canPin && (
            <div className="strip-rail" aria-hidden="true">
              <motion.span style={{ scaleX: railScale }} />
            </div>
          )}
        </div>

        <div className="strip-view" ref={viewRef}>
          <motion.div
            className="strip-track"
            ref={trackRef}
            style={canPin ? { x } : undefined}
          >
            {data.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ==================================================================
   Experience — a revision table
   ================================================================== */

function Experience() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 65%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 110, damping: 30, restDelta: 0.001 });

  return (
    <section id="experience" className="sheet sheet-alt">
      <div className="wrap">
        <SheetHead
          kicker="Experience"
          title="Experience & leadership"
          note="Robotics prototyping, manufacturing operations, student leadership and internships."
        />

        <div className="rev" ref={ref}>
          <div className="rev-rail" aria-hidden="true">
            <motion.span style={{ scaleY }} />
          </div>

          <motion.ol
            className="rev-list"
            initial="hidden"
            whileInView="visible"
            viewport={seen}
            variants={stagger}
          >
            {data.experience.map((item) => (
              <motion.li key={item.id} className="rev-row" variants={rise}>
                <div className="rev-main">
                  <div className="rev-line">
                    <h3>{item.role}</h3>
                    <span className="label rev-date">{item.dates}</span>
                  </div>

                  <p className="rev-org">
                    {item.organization}
                    {item.location && <em> · {item.location}</em>}
                  </p>

                  <p className="rev-summary">{item.summary}</p>

                  <div className="tags">
                    {item.technologies.slice(0, 6).map((tech) => (
                      <span key={tech} className="tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {item.type && <span className="label rev-type">{item.type}</span>}
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </div>
    </section>
  );
}

/* ==================================================================
   Education
   ================================================================== */

function Education() {
  return (
    <section id="education" className="sheet">
      <div className="wrap">
        <SheetHead kicker="Education" title="Where I studied" />

        <motion.div
          className="edu-grid"
          initial="hidden"
          whileInView="visible"
          viewport={seen}
          variants={stagger}
        >
          {data.education.map((item) => (
            <motion.article key={item.id} className="edu" variants={rise}>
              <span className="label edu-date">{item.dates}</span>
              <h3>{item.degree}</h3>
              <p className="edu-field">{item.field}</p>
              <p className="edu-inst">
                {item.institution}
                {item.location ? ` · ${item.location}` : ""}
              </p>
              {item.description && <p className="edu-desc">{item.description}</p>}
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ==================================================================
   Skills — a parts list
   ================================================================== */

/*
 * Eleven category blocks read as eleven near-identical lists, and a marquee
 * underneath repeated the same names again. This shows every skill at once
 * and lets the category act as a filter instead of a divider.
 */
const ALL_SKILLS = data.skills.flatMap((group) =>
  group.items.map((item) => ({ ...item, category: group.category })),
);

const isTopSkill = (level) => text(level).toLowerCase().includes("top");

function Skills() {
  const [filter, setFilter] = useState(null);
  const reduce = useReducedMotion();

  const shown = useMemo(
    () => (filter ? ALL_SKILLS.filter((skill) => skill.category === filter) : ALL_SKILLS),
    [filter],
  );

  return (
    <section id="skills" className="sheet sheet-alt">
      <div className="wrap">
        <SheetHead
          kicker="Skills"
          title="Skills & technologies"
          note={`${ALL_SKILLS.length} skills across ${data.skills.length} areas. Pick an area to narrow the list.`}
        />

        <motion.div
          className="filters"
          initial="hidden"
          whileInView="visible"
          viewport={seen}
          variants={stagger}
          role="group"
          aria-label="Filter skills by area"
        >
          <motion.button
            type="button"
            className={`filter ${filter === null ? "on" : ""}`}
            onClick={() => setFilter(null)}
            variants={rise}
            aria-pressed={filter === null}
          >
            All
            <span>{ALL_SKILLS.length}</span>
          </motion.button>

          {data.skills.map((group) => (
            <motion.button
              key={group.category}
              type="button"
              className={`filter ${filter === group.category ? "on" : ""}`}
              onClick={() => setFilter(filter === group.category ? null : group.category)}
              variants={rise}
              aria-pressed={filter === group.category}
            >
              {group.category}
              <span>{group.items.length}</span>
            </motion.button>
          ))}
        </motion.div>

        <motion.ul className="skill-grid" layout={!reduce}>
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((skill) => {
              const Icon = skillIcons[skill.category] || Code2;
              const top = isTopSkill(skill.level);

              return (
                <motion.li
                  key={skill.name}
                  className={`skill ${top ? "is-top" : ""}`}
                  layout={!reduce}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.32, ease: EASE }}
                >
                  <span className="skill-icon">
                    <Icon size={15} />
                  </span>

                  <span className="skill-text">
                    <strong>{skill.name}</strong>
                    {skill.level && <em>{skill.level}</em>}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      </div>
    </section>
  );
}

/* ==================================================================
   Interests
   ================================================================== */

function Interests() {
  return (
    <section id="interests" className="sheet">
      <div className="wrap">
        <SheetHead kicker="Interests" title="What I want to work on next" />

        <motion.div
          className="focus-grid"
          initial="hidden"
          whileInView="visible"
          viewport={seen}
          variants={stagger}
        >
          {data.interests.map((interest) => {
            const Icon = iconMap[interest.icon] || Cpu;

            return (
              <motion.article key={interest.id} className="focus" variants={rise}>
                <header>
                  <span className="focus-icon">
                    <Icon size={18} />
                  </span>
                </header>

                <h3>{interest.title}</h3>
                <span className="label focus-cat">{interest.category}</span>
                <p>{interest.description}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ==================================================================
   Contact
   ================================================================== */

function Contact() {
  const { profile, links } = data;

  return (
    <section id="contact" className="sheet sheet-end">
      <div className="wrap">
        <div className="contact">
          <motion.span
            className="label"
            initial="hidden"
            whileInView="visible"
            viewport={seen}
            variants={rise}
          >
            Get in touch
          </motion.span>

          <h2 className="contact-title">
            <span className="cover-line">
              <Reveal>Let&apos;s build</Reveal>
            </span>
            <span className="cover-line">
              <Reveal delay={0.1}>something real.</Reveal>
            </span>
          </h2>

          <motion.p
            className="contact-note"
            initial="hidden"
            whileInView="visible"
            viewport={seen}
            variants={rise}
          >
            Open to internships, research collaborations, robotics projects and AI engineering
            roles.
          </motion.p>

          <motion.div
            className="contact-cta"
            initial="hidden"
            whileInView="visible"
            viewport={seen}
            variants={stagger}
          >
            <motion.a
              href={`mailto:${profile.email || links.email}`}
              className="btn btn-solid"
              variants={rise}
            >
              <Mail size={16} />
              Email me
            </motion.a>
            <motion.a
              href={links.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-line"
              variants={rise}
            >
              LinkedIn
              <ArrowUpRight size={15} />
            </motion.a>
            <motion.a
              href={links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-line"
              variants={rise}
            >
              GitHub
              <ArrowUpRight size={15} />
            </motion.a>
          </motion.div>
        </div>
      </div>

      <footer className="foot">
        <div className="wrap foot-inner">
          <span className="label">{profile.name}</span>
          <span className="label">© {new Date().getFullYear()} · Managed from Google Sheets</span>
        </div>
      </footer>
    </section>
  );
}

/* ================================================================== */

export default function App() {
  const [active, setActive] = useState("");
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const nodes = navSections
      .map((sheet) => document.getElementById(sheet.id))
      .filter(Boolean);

    if (nodes.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app">
      <div className="paper" aria-hidden="true" />
      <motion.div className="progress" style={{ scaleX: progress }} aria-hidden="true" />

      <Nav active={active} />

      <main>
        <Cover />
        <About />
        {showSection("show_projects") && <Projects />}
        {showSection("show_experience") && <Experience />}
        {showSection("show_education") && <Education />}
        {showSection("show_skills") && <Skills />}
        {showSection("show_interests") && <Interests />}
        {showSection("show_contact") && <Contact />}
      </main>
    </div>
  );
}
