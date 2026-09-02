import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  Mail,
  MapPin,
  Menu,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";

import rawPortfolio from "./data/portfolio.json";
import "./App.css";

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

const normalizeLinks = (links, profile) => {
  const result = {
    github: "#",
    linkedin: "#",
    email: text(profile.email),
  };

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

const normalizeSiteConfig = (siteConfig) => {
  if (!Array.isArray(siteConfig)) return siteConfig || {};

  return siteConfig.reduce((acc, row) => {
    const key = text(row.Key || row.key);
    const value = row.value ?? row.Value ?? "";
    if (key) acc[key] = value;
    return acc;
  }, {});
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
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex);

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
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex);

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
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex);

  const groupedSkills = (Array.isArray(raw.skills) ? raw.skills : [])
    .filter((skill) => isPublic(skill) && text(skill.skill_name))
    .sort((a, b) => numberValue(a.importance_index) - numberValue(b.importance_index))
    .reduce((acc, skill) => {
      const category = text(skill.category) || "Skills";
      if (!acc[category]) acc[category] = [];
      acc[category].push(text(skill.skill_name));
      return acc;
    }, {});

  const skills = Object.entries(groupedSkills).map(([category, items]) => ({
    category,
    items,
  }));

  const interests = (Array.isArray(raw.interests) ? raw.interests : [])
    .filter((interest) => isPublic(interest) && text(interest.name))
    .map((interest, index) => ({
      id: text(interest.interest_id || interest.id) || `interest-${index + 1}`,
      title: text(interest.name),
      category: text(interest.category),
      description: text(interest.description),
      icon: interestIcon(interest),
      importanceIndex: numberValue(interest.importance_index, index + 1),
    }))
    .sort((a, b) => a.importanceIndex - b.importanceIndex);

  return {
    profile,
    links,
    projects,
    experience,
    education,
    skills,
    interests,
    siteConfig: normalizeSiteConfig(raw.site_config),
  };
};

const portfolioData = normalizePortfolio(rawPortfolio);

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const iconMap = {
  robot: Bot,
  brain: Brain,
  globe: Globe,
  factory: Factory,
  cpu: Cpu,
};

const skillIcons = {
  Robotics: Bot,
  Analytics: Brain,
  "AI / ML": Brain,
  "Software & Data": Database,
  "Systems & Prototyping": Cpu,
  "Mechanical Design": Wrench,
  Operations: Factory,
  "Embedded / IoT": Cpu,
};

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: "About", href: "#about" },
    { label: "Projects", href: "#projects" },
    { label: "Experience", href: "#experience" },
    { label: "Education", href: "#education" },
    { label: "Skills", href: "#skills" },
    { label: "Interests", href: "#interests" },
    { label: "Contact", href: "#contact" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        className={`nav ${scrolled ? "nav-scrolled" : ""}`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="container nav-inner">
          <a href="#" className="nav-brand">
            <div className="nav-logo">M</div>
            <span>MMD</span>
          </a>

          <div className="nav-links">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>

          <button className="nav-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={24} />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={24} />
            </button>

            {navLinks.map((link, index) => (
              <motion.a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: index * 0.08 }}
              >
                {link.label}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HeroSection() {
  const { profile } = portfolioData;

const getImageUrl = (url) => {
  if (!url) return "";

  // Already direct thumbnail URL
  if (url.includes("drive.google.com/thumbnail")) {
    return url;
  }

  // Google Drive file URL: /file/d/FILE_ID/view
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);

  // Google Drive open URL: ?id=FILE_ID
  const idMatch = url.match(/[?&]id=([^&]+)/);

  const fileId = fileMatch?.[1] || idMatch?.[1];

  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  return url;
};

const photoUrl = getImageUrl(profile.profilePhoto);

  return (
    <section className="hero">
      <div className="hero-background">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="grid-pattern" />
      </div>

      <div className="container hero-inner">
        <div className="hero-grid">
          <motion.div
            className="hero-copy"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div className="availability-pill" variants={fadeInUp}>
              <span />
              Available for Opportunities
            </motion.div>

            <motion.h1 className="hero-title" variants={fadeInUp}>
              Hi, I&apos;m <span>{profile.firstName}</span>
            </motion.h1>

            <motion.p className="hero-headline" variants={fadeInUp}>
              {profile.headline}
            </motion.p>

            <motion.p className="hero-bio" variants={fadeInUp}>
              {profile.shortBio}
            </motion.p>

            <motion.div className="hero-actions" variants={fadeInUp}>
              <a href="#projects" className="btn btn-primary">
                View Projects
                <ChevronRight size={18} />
              </a>

              <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <Download size={18} />
                Resume
              </a>
            </motion.div>

            <motion.div className="hero-stats" variants={fadeInUp}>
              <div>
                <strong>{portfolioData.projects.length}</strong>
                <span>Projects</span>
              </div>

              <div>
                <strong>{portfolioData.experience.length}</strong>
                <span>Roles</span>
              </div>

              <div>
                <strong>
                  {portfolioData.skills.reduce((count, group) => count + group.items.length, 0)}
                </strong>
                <span>Skills</span>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="hero-shape shape-one" />
            <div className="hero-shape shape-two" />

            <div className="hero-core-card hero-photo-card">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={profile.name}
                  className="hero-profile-photo"
                  width="256"
                  height="256"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              ) : (
                <>
                  <div className="hero-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path
                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <p>AI & Robotics</p>
                  <h3>Engineer</h3>
                </>
              )}
            </div>

            <div className="floating-token floating-token-one">🤖</div>
            <div className="floating-token floating-token-two">🧠</div>
          </motion.div>
        </div>

        <motion.a
          href="#about"
          className="scroll-indicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <span>Scroll</span>
          <ArrowDown size={20} />
        </motion.a>
      </div>
    </section>
  );
}

function AboutSection() {
  const { profile } = portfolioData;

  const highlights = [
    {
      icon: Bot,
      title: "Robotics",
      description: "Mobile robotics, prototyping, embedded systems, and intelligent physical systems.",
    },
    {
      icon: Brain,
      title: "Machine Learning",
      description: "Applied ML, data analysis, model evaluation, and real-world AI workflows.",
    },
    {
      icon: Globe,
      title: "Geospatial AI",
      description: "Satellite data, urban change, land-cover modelling, and spatial analytics.",
    },
    {
      icon: Factory,
      title: "Industry 4.0",
      description: "Manufacturing analytics, OEE, process improvement, and automation.",
    },
  ];

  return (
    <section id="about" className="section">
      <div className="container two-column">
        <motion.div
          className="visual-card"
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <Code2 size={72} />
          <span>ENGINEERING × INTELLIGENCE</span>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.span className="section-kicker" variants={fadeInUp}>
            About Me
          </motion.span>

          <motion.h2 className="section-title" variants={fadeInUp}>
            Bridging engineering with <span>intelligence</span>.
          </motion.h2>

          <motion.p className="section-description" variants={fadeInUp}>
            {profile.longBio}
          </motion.p>

          <motion.div className="highlight-grid" variants={staggerContainer}>
            {highlights.map((item) => (
              <motion.div key={item.title} className="highlight-card" variants={fadeInUp}>
                <div>
                  <item.icon size={20} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function ProjectsSection() {
  return (
    <section id="projects" className="section section-muted">
      <div className="container">
        <SectionHeader
          kicker="Selected Work"
          title="Projects in AI, Robotics & Data"
          description="A selection of work spanning machine learning, data engineering, robotics, and industrial applications."
        />

        <motion.div
          className="projects-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {portfolioData.projects.map((project, index) => (
            <motion.article
              key={project.id}
              className={`project-card ${index === 0 ? "project-featured" : ""}`}
              variants={fadeInUp}
              whileHover={{ y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card-hover-arrow">
                <ArrowUpRight size={20} />
              </div>

              <div className="project-header">
                <div>
                  <span className="mono-label">{project.category}</span>
                  <h3>{project.title}</h3>
                  {project.subtitle && <p>{project.subtitle}</p>}
                </div>

                <span className={`status-badge ${project.status === "Completed" ? "completed" : "progress"}`}>
                  {project.status}
                </span>
              </div>

              <p className="project-summary">{project.summary}</p>

              {project.impact && (
                <div className="impact-box">
                  <TrendingUp size={18} />
                  <span>{project.impact}</span>
                </div>
              )}

              <div className="chip-row">
                {project.techStack.slice(0, 6).map((tech) => (
                  <span key={tech}>{tech}</span>
                ))}

                {project.techStack.length > 6 && <span>+{project.techStack.length - 6} more</span>}
              </div>

              <div className="card-links">
                {project.githubUrl && (
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                    <Code2 size={16} />
                    Code
                  </a>
                )}

                {project.paperUrl && (
                  <a href={project.paperUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} />
                    Paper
                  </a>
                )}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ExperienceSection() {
  return (
    <section id="experience" className="section">
      <div className="container">
        <SectionHeader
          kicker="Professional Path"
          title="Experience & Leadership"
          description="Hands-on engineering, robotics prototyping, manufacturing operations, student leadership, and internships."
        />

        <motion.div
          className="timeline"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {portfolioData.experience.map((item) => (
            <motion.div key={item.id} className="timeline-item" variants={fadeInUp}>
              <div className="timeline-dot" />

              <div className="timeline-card">
                <div className="timeline-top">
                  <div>
                    <h3>{item.role}</h3>
                    <p>{item.organization}</p>
                  </div>

                  <span>{item.type}</span>
                </div>

                <div className="timeline-meta">
                  <span>{item.dates}</span>
                  {item.location && (
                    <span>
                      <MapPin size={14} />
                      {item.location}
                    </span>
                  )}
                </div>

                <p className="timeline-summary">{item.summary}</p>

                <div className="chip-row">
                  {item.technologies.slice(0, 8).map((tech) => (
                    <span key={tech}>{tech}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function EducationSection() {
  return (
    <section id="education" className="section section-muted">
      <div className="container">
        <SectionHeader kicker="Academic Foundation" title="Education" />

        <motion.div
          className="education-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {portfolioData.education.map((item) => (
            <motion.div key={item.id} className="education-card" variants={fadeInUp}>
              <div className="education-icon">
                <GraduationCap size={26} />
              </div>

              <div>
                <h3>{item.degree}</h3>
                <h4>{item.field}</h4>
                <p>{item.institution}</p>
                <span>
                  {item.dates}
                  {item.location ? ` · ${item.location}` : ""}
                </span>

                {item.description && <p className="education-description">{item.description}</p>}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function SkillsSection() {
  return (
    <section id="skills" className="section">
      <div className="container">
        <SectionHeader
          kicker="Technical Toolkit"
          title="Skills & Technologies"
          description="Grouped directly from the skills tab in the Google Sheet."
        />

        <motion.div
          className="skills-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {portfolioData.skills.map((group) => {
            const Icon = skillIcons[group.category] || Code2;

            return (
              <motion.div key={group.category} className="skill-card" variants={fadeInUp}>
                <div className="skill-header">
                  <div>
                    <Icon size={20} />
                  </div>
                  <h3>{group.category}</h3>
                </div>

                <div className="chip-row">
                  {group.items.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function InterestsSection() {
  return (
    <section id="interests" className="section section-muted">
      <div className="container">
        <SectionHeader kicker="Research Direction" title="Interests & Focus Areas" />

        <motion.div
          className="interests-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {portfolioData.interests.map((interest) => {
            const Icon = iconMap[interest.icon] || Cpu;

            return (
              <motion.div
                key={interest.id}
                className="interest-card"
                variants={fadeInUp}
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="interest-icon">
                  <Icon size={28} />
                </div>

                <h3>{interest.title}</h3>
                <span>{interest.category}</span>
                <p>{interest.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function ContactSection() {
  const { profile, links } = portfolioData;

  return (
    <section id="contact" className="section">
      <div className="container contact-container">
        <motion.div
          className="contact-card"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.span className="section-kicker" variants={fadeInUp}>
            Contact
          </motion.span>

          <motion.h2 className="section-title" variants={fadeInUp}>
            Let&apos;s build something <span>intelligent</span>.
          </motion.h2>

          <motion.p className="section-description" variants={fadeInUp}>
            I&apos;m open to internships, research collaborations, robotics projects, and AI engineering opportunities.
          </motion.p>

          <motion.div className="contact-actions" variants={fadeInUp}>
            <a href={`mailto:${profile.email || links.email}`} className="btn btn-primary">
              <Mail size={18} />
              Email Me
            </a>

            <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <ExternalLink size={18} />
              LinkedIn
            </a>

            <a href={links.github} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <Code2 size={18} />
              GitHub
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  const { profile } = portfolioData;

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-name">
          <Sparkles size={18} />
          <span>{profile.name}</span>
        </div>

        <p>© {new Date().getFullYear()} {profile.name}. Built for AI & Robotics.</p>
      </div>
    </footer>
  );
}

function SectionHeader({ kicker, title, description }) {
  return (
    <motion.div
      className="section-header"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={staggerContainer}
    >
      <motion.span className="section-kicker" variants={fadeInUp}>
        {kicker}
      </motion.span>

      <motion.h2 className="section-title" variants={fadeInUp}>
        {title}
      </motion.h2>

      {description && (
        <motion.p className="section-description" variants={fadeInUp}>
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}

export default function App() {
  return (
    <div className="app">
      <div className="grain-overlay" aria-hidden="true" />
      <Navigation />
      <main>
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <ExperienceSection />
        <EducationSection />
        <SkillsSection />
        <InterestsSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}