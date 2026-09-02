import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  Bot,
  Brain,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Factory,
  Globe,
  GraduationCap,
  Layers,
  Mail,
  MapPin,
  Menu,
  Shuffle,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";

import rawPortfolio from "./data/portfolio.json";
import "./App.css";

/* ------------------------------------------------------------------ */
/*  Data normalisation                                                 */
/*  Every spreadsheet column name read below is part of the pipeline   */
/*  contract documented in the README. Do not rename them here without */
/*  renaming them in the sheet in the same change.                     */
/* ------------------------------------------------------------------ */

const text = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

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

  if (s && e) return `${s} - ${e}`;
  if (s) return `${s} - Present`;
  return e || "";
};

// Turns a Google Drive share link into something an <img> can actually load.
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
 * The Site_config tab is read two ways on purpose.
 *
 * When the CSV parses cleanly the columns are Key / value / description.
 * But Google's gviz endpoint guesses how many rows are headers, and on this
 * tab it currently guesses wrong and welds several rows into the column
 * labels. The row *values* survive that, so when the clean keys are missing
 * we fall back to matching the column by the first word of its merged label.
 * That keeps the show_* switches working either way.
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

// Profile photographs come from the Media tab: image rows related to "profile".
// One photo renders as a single card; several become a shuffling stack.
const normalizeGallery = (media, profile) => {
  const rows = Array.isArray(media) ? media : [];

  const photos = rows
    .filter((row) => isPublic(row))
    .filter((row) => text(row.type).toLowerCase() === "image")
    .filter((row) => {
      const related = text(row.related_type).toLowerCase();
      return related === "" || related === "profile";
    })
    .map((row, index) => ({
      id: text(row.media_id) || `photo-${index + 1}`,
      url: driveImageUrl(row.url),
      alt: text(row.alt_text) || text(row.tittle || row.title) || text(profile.name),
    }))
    .filter((photo) => photo.url);

  if (photos.length > 0) return photos;

  const fallback = driveImageUrl(profile.profilePhoto);
  return fallback ? [{ id: "profile", url: fallback, alt: profile.name }] : [];
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

  const links = normalizeLinks(raw.links, profile);

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
    links,
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

/* ------------------------------------------------------------------ */
/*  Motion presets                                                     */
/* ------------------------------------------------------------------ */

const EASE = [0.22, 1, 0.36, 1];

const rise = {
  hidden: { opacity: 0, y: 26, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const inViewOnce = { once: true, margin: "-80px" };

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

/* ------------------------------------------------------------------ */
/*  Shared pieces                                                      */
/* ------------------------------------------------------------------ */

// Adds a cursor-tracking spotlight + a subtle tilt to any panel.
function usePointerGlow(maxTilt = 0) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const onPointerMove = useCallback(
    (event) => {
      const node = ref.current;
      if (!node || reduce) return;

      const rect = node.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      node.style.setProperty("--mx", `${px * 100}%`);
      node.style.setProperty("--my", `${py * 100}%`);

      if (maxTilt) {
        node.style.setProperty("--ry", `${(px - 0.5) * 2 * maxTilt}deg`);
        node.style.setProperty("--rx", `${(0.5 - py) * 2 * maxTilt}deg`);
      }
    },
    [maxTilt, reduce],
  );

  const onPointerLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--ry", "0deg");
  }, []);

  const handlers = useMemo(
    () => ({ onPointerMove, onPointerLeave }),
    [onPointerMove, onPointerLeave],
  );

  return [ref, handlers];
}

function Counter({ value, duration = 1.4 }) {
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

function SectionHead({ index, kicker, title, description, align = "left" }) {
  return (
    <motion.div
      className={`sec-head sec-head-${align}`}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      variants={stagger}
    >
      <motion.div className="kicker" variants={rise}>
        <span className="kicker-index">{index}</span>
        <span className="kicker-line" aria-hidden="true" />
        <span>{kicker}</span>
      </motion.div>

      <motion.h2 className="sec-title" variants={rise}>
        {title}
      </motion.h2>

      {description && (
        <motion.p className="sec-desc" variants={rise}>
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}

// The instrument-panel corner ticks that mark every bento tile.
function Ticks() {
  return (
    <span className="ticks" aria-hidden="true">
      <i /> <i /> <i /> <i />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Photo stack — the shuffling cards                                  */
/* ------------------------------------------------------------------ */

function PhotoStack({ photos }) {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState(() => photos.map((_, i) => i));
  const [flying, setFlying] = useState(null);
  const timer = useRef(null);

  const many = photos.length > 1;

  const shuffle = useCallback(() => {
    if (!many) return;

    setOrder((current) => {
      const front = current[0];
      setFlying(front);

      window.setTimeout(() => {
        setOrder((inner) => [...inner.slice(1), inner[0]]);
        setFlying(null);
      }, reduce ? 0 : 320);

      return current;
    });
  }, [many, reduce]);

  // Auto-advance, paused when the visitor prefers reduced motion.
  useEffect(() => {
    if (!many || reduce) return undefined;

    timer.current = window.setInterval(shuffle, 4200);
    return () => window.clearInterval(timer.current);
  }, [many, reduce, shuffle]);

  if (photos.length === 0) {
    return (
      <div className="photo-stack photo-empty">
        <div className="photo-card photo-placeholder">
          <Bot size={40} />
          <span className="mono">AI &amp; ROBOTICS</span>
          <strong>Engineer</strong>
        </div>
      </div>
    );
  }

  return (
    <div className={`photo-stack ${many ? "is-stack" : ""}`}>
      <div className="photo-frame">
        {order.map((photoIndex, depth) => {
          const photo = photos[photoIndex];
          const isFlying = flying === photoIndex;

          return (
            <motion.figure
              key={photo.id}
              className="photo-card"
              style={{ zIndex: photos.length - depth }}
              initial={false}
              animate={
                isFlying
                  ? { x: 210, y: -26, rotate: 14, scale: 0.94, opacity: 0.35 }
                  : {
                      x: depth * 16,
                      y: depth * -12,
                      rotate: depth === 0 ? 0 : depth * 3.2,
                      scale: 1 - depth * 0.05,
                      opacity: depth > 3 ? 0 : 1,
                    }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 210, damping: 26, mass: 0.9 }
              }
            >
              <img
                src={photo.url}
                alt={photo.alt}
                width="320"
                height="400"
                loading={depth === 0 ? "eager" : "lazy"}
                fetchPriority={depth === 0 ? "high" : "low"}
                decoding="async"
                draggable="false"
              />
              <span className="photo-sheen" aria-hidden="true" />
            </motion.figure>
          );
        })}
      </div>

      {many && (
        <div className="photo-controls">
          <button type="button" onClick={shuffle} className="shuffle-btn">
            <Shuffle size={15} />
            Shuffle
          </button>

          <div className="photo-dots" role="presentation">
            {photos.map((photo, i) => (
              <span key={photo.id} className={order[0] === i ? "on" : ""} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chrome                                                             */
/* ------------------------------------------------------------------ */

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });
  return <motion.div className="scroll-progress" style={{ scaleX: width }} aria-hidden="true" />;
}

const NAV_LINKS = [
  { label: "About", href: "#about", key: null },
  { label: "Work", href: "#projects", key: "show_projects" },
  { label: "Path", href: "#experience", key: "show_experience" },
  { label: "Study", href: "#education", key: "show_education" },
  { label: "Stack", href: "#skills", key: "show_skills" },
  { label: "Focus", href: "#interests", key: "show_interests" },
  { label: "Contact", href: "#contact", key: "show_contact" },
];

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("");

  const navLinks = useMemo(
    () => NAV_LINKS.filter((link) => !link.key || showSection(link.key)),
    [],
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlights the section the reader is currently inside.
  useEffect(() => {
    const ids = navLinks.map((link) => link.href.slice(1));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [navLinks]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <motion.nav
        className={`nav ${scrolled ? "nav-solid" : ""}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
      >
        <div className="shell nav-inner">
          <a href="#top" className="brand">
            <span className="brand-mark">M</span>
            <span className="brand-text">
              <strong>MMD</strong>
              <em>AI &amp; Robotics</em>
            </span>
          </a>

          <div className="nav-links">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={active === link.href.slice(1) ? "on" : ""}
              >
                {link.label}
              </a>
            ))}
          </div>

          <button
            className="nav-toggle"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="sheet"
            initial={{ opacity: 0, clipPath: "circle(0% at 92% 6%)" }}
            animate={{ opacity: 1, clipPath: "circle(150% at 92% 6%)" }}
            exit={{ opacity: 0, clipPath: "circle(0% at 92% 6%)" }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <button
              className="sheet-close"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={22} />
            </button>

            <nav className="sheet-links">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.06, duration: 0.45, ease: EASE }}
                >
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  {link.label}
                </motion.a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sections                                                           */
/* ------------------------------------------------------------------ */

function Hero() {
  const { profile, gallery } = data;
  const [glowRef, glowHandlers] = usePointerGlow();

  const skillCount = data.skills.reduce((n, group) => n + group.items.length, 0);
  const words = profile.headline.split("|")[0].trim();

  return (
    <header className="hero" id="top" ref={glowRef} {...glowHandlers}>
      <div className="hero-field" aria-hidden="true">
        <span className="hero-grid" />
        <span className="hero-glow" />
        <span className="hero-beam hero-beam-a" />
        <span className="hero-beam hero-beam-b" />
      </div>

      <div className="shell hero-inner">
        <motion.div className="hero-copy" initial="hidden" animate="visible" variants={stagger}>
          <motion.div className="status" variants={rise}>
            <span className="status-dot" aria-hidden="true" />
            Available for opportunities
            {profile.location && <em>· {profile.location}</em>}
          </motion.div>

          <motion.h1 className="hero-title" variants={stagger}>
            {["Hi,", "I'm"].map((word) => (
              <motion.span key={word} className="word" variants={rise}>
                {word}
              </motion.span>
            ))}
            <motion.span className="word accent" variants={rise}>
              {profile.firstName}
            </motion.span>
          </motion.h1>

          <motion.p className="hero-role" variants={rise}>
            {words}
          </motion.p>

          <motion.p className="hero-bio" variants={rise}>
            {profile.shortBio}
          </motion.p>

          <motion.div className="hero-cta" variants={rise}>
            <a href="#projects" className="btn btn-primary">
              View Projects
              <ChevronRight size={17} />
            </a>

            <a
              href={profile.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              <Download size={17} />
              Download Resume
            </a>
          </motion.div>

          <motion.dl className="hero-stats" variants={rise}>
            {[
              { n: data.projects.length, label: "Projects" },
              { n: data.experience.length, label: "Roles" },
              { n: skillCount, label: "Skills" },
              { n: data.interests.length, label: "Focus areas" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt>
                  <Counter value={stat.n} />
                </dt>
                <dd>{stat.label}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
        >
          <PhotoStack photos={gallery} />
        </motion.div>
      </div>

      <a href="#about" className="scroll-cue">
        <span className="mono">SCROLL</span>
        <ArrowDown size={16} />
      </a>
    </header>
  );
}

function BentoTile({ className = "", tilt = 0, children, ...rest }) {
  const [glowRef, glowHandlers] = usePointerGlow(tilt);

  return (
    <motion.div
      className={`tile ${className}`}
      variants={rise}
      ref={glowRef}
      {...glowHandlers}
      {...rest}
    >
      <Ticks />
      <span className="tile-glow" aria-hidden="true" />
      <div className="tile-body">{children}</div>
    </motion.div>
  );
}

const HIGHLIGHTS = [
  {
    icon: Bot,
    title: "Robotics",
    body: "Mobile robotics, prototyping, embedded systems and intelligent physical systems.",
  },
  {
    icon: Brain,
    title: "Machine Learning",
    body: "Applied ML, data analysis, model evaluation and real-world AI workflows.",
  },
  {
    icon: Globe,
    title: "Geospatial AI",
    body: "Satellite data, urban change, land-cover modelling and spatial analytics.",
  },
  {
    icon: Factory,
    title: "Industry 4.0",
    body: "Manufacturing analytics, OEE, process improvement and automation.",
  },
];

function About() {
  const { profile } = data;

  return (
    <section id="about" className="section">
      <div className="shell">
        <SectionHead
          index="01"
          kicker="About"
          title={
            <>
              Bridging engineering with <span className="accent">intelligence</span>.
            </>
          }
        />

        <motion.div
          className="bento about-bento"
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={stagger}
        >
          <BentoTile className="span-2 rows-2 tile-feature" tilt={3}>
            <p className="lead">{profile.longBio}</p>

            <div className="chips">
              {profile.location && (
                <span className="chip">
                  <MapPin size={13} />
                  {profile.location}
                </span>
              )}
              {profile.email && (
                <span className="chip">
                  <Mail size={13} />
                  {profile.email}
                </span>
              )}
            </div>
          </BentoTile>

          {HIGHLIGHTS.map((item) => (
            <BentoTile key={item.title} tilt={5}>
              <span className="tile-icon">
                <item.icon size={19} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </BentoTile>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/*
 * Bento placement. The first project is a 2x2 feature; the next two sit beside
 * it; anything after that runs full-width rows. When the tail would leave a
 * single tile stranded in a half-empty row, it stretches to fill instead.
 */
const projectSpan = (index, total) => {
  if (index === 0) return "span-2 rows-2 tile-feature";
  if (index >= 3 && index === total - 1 && (total - 3) % 2 === 1) return "span-4";
  return "span-2";
};

function Projects() {
  const [open, setOpen] = useState(null);
  const total = data.projects.length;

  return (
    <section id="projects" className="section section-alt">
      <div className="shell">
        <SectionHead
          index="02"
          kicker="Selected work"
          title="Projects in AI, robotics & data"
          description="Machine learning, data engineering, robotics and industrial applications. Tap a card for the problem and the approach."
        />

        <motion.div
          className="bento projects-bento"
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={stagger}
        >
          {data.projects.map((project, index) => {
            const featured = index === 0;
            // The feature tile is tall enough to carry the detail permanently.
            const expanded = featured || open === project.id;

            return (
              <BentoTile
                key={project.id}
                className={`project ${projectSpan(index, total)} ${expanded ? "is-open" : ""}`}
                tilt={featured ? 2 : 4}
              >
                {!featured && (
                  <button
                    type="button"
                    className="project-hit"
                    onClick={() => setOpen(expanded ? null : project.id)}
                    aria-expanded={expanded}
                  >
                    <span className="sr-only">
                      {expanded ? "Hide details for" : "Show details for"} {project.title}
                    </span>
                  </button>
                )}

                <div className="project-top">
                  <span className="mono tile-tag">{project.category}</span>
                  <span
                    className={`badge ${project.status === "Completed" ? "ok" : "wip"}`}
                  >
                    {project.status}
                  </span>
                </div>

                <h3>{project.title}</h3>
                {project.subtitle && <p className="project-sub">{project.subtitle}</p>}
                <p className="project-summary">{project.summary}</p>

                {project.impact && (
                  <p className="impact">
                    <TrendingUp size={15} />
                    <span>{project.impact}</span>
                  </p>
                )}

                <AnimatePresence initial={false}>
                  {expanded && (project.problem || project.solution) && (
                    <motion.dl
                      className="project-detail"
                      initial={featured ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.42, ease: EASE }}
                    >
                      {project.problem && (
                        <div>
                          <dt className="mono">PROBLEM</dt>
                          <dd>{project.problem}</dd>
                        </div>
                      )}
                      {project.solution && (
                        <div>
                          <dt className="mono">APPROACH</dt>
                          <dd>{project.solution}</dd>
                        </div>
                      )}
                    </motion.dl>
                  )}
                </AnimatePresence>

                <div className="chips tight">
                  {project.techStack.slice(0, featured ? 8 : 4).map((tech) => (
                    <span key={tech} className="chip">
                      {tech}
                    </span>
                  ))}
                  {project.techStack.length > (featured ? 8 : 4) && (
                    <span className="chip muted">
                      +{project.techStack.length - (featured ? 8 : 4)}
                    </span>
                  )}
                </div>

                <div className="tile-foot">
                  {featured ? (
                    <span className="mono expand-hint">Featured project</span>
                  ) : (
                    <span className="mono expand-hint">
                      {expanded ? "Hide details" : "Details"}
                      <ArrowUpRight size={13} className={expanded ? "flip" : ""} />
                    </span>
                  )}

                  <span className="tile-links">
                    {project.githubUrl && (
                      <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                        <Code2 size={15} />
                        Code
                      </a>
                    )}
                    {project.paperUrl && (
                      <a href={project.paperUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={15} />
                        Paper
                      </a>
                    )}
                  </span>
                </div>
              </BentoTile>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function Experience() {
  const trackRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 70%", "end 60%"],
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 110, damping: 30, restDelta: 0.001 });

  return (
    <section id="experience" className="section">
      <div className="shell">
        <SectionHead
          index="03"
          kicker="Professional path"
          title="Experience & leadership"
          description="Robotics prototyping, manufacturing operations, student leadership and internships across IoT, automotive and refinery work."
        />

        <div className="timeline" ref={trackRef}>
          <div className="timeline-rail" aria-hidden="true">
            <motion.span className="timeline-fill" style={{ scaleY }} />
          </div>

          <motion.ol
            className="timeline-list"
            initial="hidden"
            whileInView="visible"
            viewport={inViewOnce}
            variants={stagger}
          >
            {data.experience.map((item) => (
              <motion.li key={item.id} className="tl-item" variants={rise}>
                <span className="tl-node" aria-hidden="true" />

                <article className="tl-card">
                  <Ticks />
                  <header>
                    <div>
                      <h3>{item.role}</h3>
                      <p className="tl-org">{item.organization}</p>
                    </div>
                    {item.type && <span className="mono tl-type">{item.type}</span>}
                  </header>

                  <div className="tl-meta mono">
                    <span>{item.dates}</span>
                    {item.location && (
                      <span>
                        <MapPin size={12} />
                        {item.location}
                      </span>
                    )}
                  </div>

                  <p className="tl-summary">{item.summary}</p>

                  <div className="chips tight">
                    {item.technologies.slice(0, 6).map((tech) => (
                      <span key={tech} className="chip">
                        {tech}
                      </span>
                    ))}
                  </div>
                </article>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </div>
    </section>
  );
}

function Education() {
  return (
    <section id="education" className="section section-alt">
      <div className="shell">
        <SectionHead index="04" kicker="Academic foundation" title="Education" />

        <motion.div
          className="bento edu-bento"
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={stagger}
        >
          {data.education.map((item) => (
            <BentoTile key={item.id} className="span-3" tilt={2}>
              <span className="tile-icon">
                <GraduationCap size={20} />
              </span>

              <div className="edu-head">
                <h3>{item.degree}</h3>
                <span className="mono">{item.dates}</span>
              </div>

              <p className="edu-field accent">{item.field}</p>
              <p className="edu-inst">
                {item.institution}
                {item.location ? ` · ${item.location}` : ""}
              </p>

              {item.description && <p className="edu-desc">{item.description}</p>}
            </BentoTile>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Skills() {
  const marquee = useMemo(
    () => data.skills.flatMap((group) => group.items.map((item) => item.name)),
    [],
  );

  return (
    <section id="skills" className="section">
      <div className="shell">
        <SectionHead
          index="05"
          kicker="Technical toolkit"
          title="Skills & technologies"
          description="Grouped straight from the Skills tab of the spreadsheet."
        />

        <motion.div
          className="bento skills-bento"
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={stagger}
        >
          {data.skills.map((group) => {
            const Icon = skillIcons[group.category] || Code2;

            return (
              <BentoTile key={group.category} tilt={4}>
                <span className="tile-icon">
                  <Icon size={18} />
                </span>
                <h3 className="skill-cat">{group.category}</h3>

                <ul className="skill-list">
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <span>{item.name}</span>
                      {item.level && <em className="mono">{item.level}</em>}
                    </li>
                  ))}
                </ul>
              </BentoTile>
            );
          })}
        </motion.div>
      </div>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div className="marquee-row" key={copy}>
              {marquee.map((name) => (
                <span key={`${copy}-${name}`}>
                  {name}
                  <i>/</i>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Interests() {
  return (
    <section id="interests" className="section section-alt">
      <div className="shell">
        <SectionHead index="06" kicker="Research direction" title="Interests & focus areas" />

        <motion.div
          className="bento interests-bento"
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={stagger}
        >
          {data.interests.map((interest) => {
            const Icon = iconMap[interest.icon] || Cpu;

            return (
              <BentoTile key={interest.id} className="interest" tilt={6}>
                <span className="tile-icon">
                  <Icon size={20} />
                </span>
                <h3>{interest.title}</h3>
                <span className="mono tile-tag">{interest.category}</span>
                <p>{interest.description}</p>
              </BentoTile>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function Contact() {
  const { profile, links } = data;
  const [glowRef, glowHandlers] = usePointerGlow();

  return (
    <section id="contact" className="section">
      <div className="shell">
        <motion.div
          className="contact"
          ref={glowRef}
          {...glowHandlers}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={stagger}
        >
          <span className="tile-glow" aria-hidden="true" />
          <Ticks />

          <motion.div className="kicker" variants={rise}>
            <span className="kicker-index">07</span>
            <span className="kicker-line" aria-hidden="true" />
            <span>Contact</span>
          </motion.div>

          <motion.h2 className="sec-title" variants={rise}>
            Let&apos;s build something <span className="accent">intelligent</span>.
          </motion.h2>

          <motion.p className="sec-desc" variants={rise}>
            Open to internships, research collaborations, robotics projects and AI engineering
            roles.
          </motion.p>

          <motion.div className="contact-cta" variants={rise}>
            <a href={`mailto:${profile.email || links.email}`} className="btn btn-primary">
              <Mail size={17} />
              Email me
            </a>

            <a
              href={links.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              <ExternalLink size={17} />
              LinkedIn
            </a>

            <a
              href={links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              <Code2 size={17} />
              GitHub
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  const { profile } = data;

  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <span className="footer-brand">
          <Sparkles size={15} />
          {profile.name}
        </span>

        <span className="mono footer-note">
          © {new Date().getFullYear()} · Content managed from Google Sheets
        </span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <div className="app">
      <div className="noise" aria-hidden="true" />
      <ScrollProgress />
      <Navigation />

      <main>
        <Hero />
        <About />
        {showSection("show_projects") && <Projects />}
        {showSection("show_experience") && <Experience />}
        {showSection("show_education") && <Education />}
        {showSection("show_skills") && <Skills />}
        {showSection("show_interests") && <Interests />}
        {showSection("show_contact") && <Contact />}
      </main>

      <Footer />
    </div>
  );
}
